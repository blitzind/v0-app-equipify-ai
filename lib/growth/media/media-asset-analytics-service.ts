import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getMediaAsset } from "@/lib/growth/media/media-asset-repository"
import {
  GROWTH_MEDIA_PLAYBACK_ANALYTICS_EVENT_TYPES,
  GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER,
  GROWTH_MEDIA_PLAYBACK_ANALYTICS_SAFETY_FLAGS,
  type GrowthMediaAssetEventRollup,
  type GrowthMediaAssetEventRow,
  type GrowthMediaPlaybackAnalyticsIngestInput,
} from "@/lib/growth/media/media-asset-analytics-types"
import {
  getMediaAssetEventRollup,
  insertMediaAssetEvent,
  listMediaAssetEventRollups,
} from "@/lib/growth/media/media-asset-analytics-repository"
import { incrementMediaAssetEventRollup } from "@/lib/growth/runtime-guardrails/growth-media-rollup-service"
import { consumeBudget } from "@/lib/growth/runtime-guardrails/growth-runtime-budget-service"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { createCascadeBudgetTracker } from "@/lib/growth/runtime-guardrails/growth-cascade-budget-service"

function isPlaybackEventType(value: string): value is GrowthMediaPlaybackAnalyticsIngestInput["eventType"] {
  return (GROWTH_MEDIA_PLAYBACK_ANALYTICS_EVENT_TYPES as readonly string[]).includes(value)
}

export function shouldAllowMediaPlaybackAnalyticsIngest(
  input: Pick<GrowthMediaPlaybackAnalyticsIngestInput, "trackingToken" | "ingestSource">,
): boolean {
  if (input.ingestSource === "platform_admin") return true
  return Boolean(input.trackingToken?.trim())
}

export async function ingestGrowthMediaPlaybackAnalyticsEvent(
  admin: SupabaseClient,
  input: GrowthMediaPlaybackAnalyticsIngestInput,
): Promise<{ event: GrowthMediaAssetEventRow; rollup: GrowthMediaAssetEventRollup }> {
  if (!isPlaybackEventType(input.eventType)) {
    throw new Error("invalid_event_type")
  }
  if (!shouldAllowMediaPlaybackAnalyticsIngest(input)) {
    throw new Error("tracking_token_required")
  }
  if (!input.sessionId.trim()) {
    throw new Error("session_id_required")
  }

  const asset = await getMediaAsset(admin, input.assetId)
  if (!asset) throw new Error("asset_not_found")
  if (asset.organizationId !== input.organizationId) throw new Error("organization_scope_mismatch")
  if (asset.assetType !== "video") throw new Error("invalid_asset_type")

  const event = await insertMediaAssetEvent(admin, {
    organizationId: input.organizationId,
    assetId: input.assetId,
    eventType: input.eventType,
    sessionId: input.sessionId.trim(),
    relationshipId: input.relationshipId ?? null,
    leadId: input.leadId ?? null,
    sharePageId: input.sharePageId ?? null,
    templateId: input.templateId ?? null,
    sequenceId: input.sequenceId ?? null,
    anonymousIdHash: input.anonymousIdHash ?? null,
    progressSeconds: input.progressSeconds ?? null,
    progressPercent: input.progressPercent ?? null,
    durationSeconds: input.durationSeconds ?? null,
    ctaKey: input.ctaKey ?? null,
    metadata: {
      ...(input.metadata ?? {}),
      ingest_source: input.ingestSource ?? "client_hook",
      ...GROWTH_MEDIA_PLAYBACK_ANALYTICS_SAFETY_FLAGS,
    },
    eventTimestamp: input.eventTimestamp,
  })

  const cascade = await createCascadeBudgetTracker(admin, {
    eventId: event.id,
    organizationId: input.organizationId,
  })
  cascade.recordWrite(1)

  const mediaBudget = await consumeBudget(admin, {
    organizationId: input.organizationId,
    resourceType: "media_events",
    windowKind: "daily",
    volume: 1,
  })
  if (!mediaBudget.allowed) {
    await cascade.flush()
    throw new Error("media_event_budget_exceeded")
  }

  const rollupEnabled = await isRuntimeKillSwitchEnabled(admin, "media_rollup_enabled")
  const rollup = rollupEnabled
    ? await incrementMediaAssetEventRollup(admin, {
        organizationId: input.organizationId,
        assetId: input.assetId,
        event,
      })
    : (await getMediaAssetEventRollup(admin, {
        organizationId: input.organizationId,
        assetId: input.assetId,
      })) ?? {
        assetId: input.assetId,
        organizationId: input.organizationId,
        views: 0,
        uniqueViews: 0,
        playStarts: 0,
        completions: 0,
        completionRate: 0,
        averageWatchSeconds: 0,
        ctaClicks: 0,
        lastEventAt: null,
        updatedAt: new Date().toISOString(),
      }

  if (event.leadId && cascade.recordWakeEvaluation(1)) {
    const { dispatchMediaSequenceWakeSafely } = await import(
      "@/lib/growth/sequences/runtime/sequence-trigger-runtime-dispatchers"
    )
    dispatchMediaSequenceWakeSafely(admin, {
      leadId: event.leadId,
      mediaAssetId: event.assetId,
      sharePageId: event.sharePageId,
      sessionId: event.sessionId,
      watchSeconds: event.progressSeconds,
      completionRate: event.progressPercent,
      ctaKey: event.ctaKey,
      occurredAt: event.eventTimestamp,
      evidenceRef: event.id,
      playbackEventType: input.eventType,
    })
  }

  await cascade.flush()

  return { event, rollup }
}

export async function getGrowthMediaAssetPlaybackAnalytics(
  admin: SupabaseClient,
  input: { organizationId: string; assetId: string },
): Promise<{ assetId: string; rollup: GrowthMediaAssetEventRollup | null }> {
  const asset = await getMediaAsset(admin, input.assetId)
  if (!asset) throw new Error("asset_not_found")
  if (asset.organizationId !== input.organizationId) throw new Error("organization_scope_mismatch")

  const rollup = await getMediaAssetEventRollup(admin, input)
  return { assetId: asset.id, rollup }
}

export async function getGrowthMediaPlaybackAnalyticsSummary(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number },
): Promise<{ items: GrowthMediaAssetEventRollup[]; totals: Record<string, number> }> {
  const items = await listMediaAssetEventRollups(admin, input)
  const totals = items.reduce(
    (acc, item) => {
      acc.views += item.views
      acc.unique_views += item.uniqueViews
      acc.play_starts += item.playStarts
      acc.completions += item.completions
      acc.cta_clicks += item.ctaClicks
      return acc
    },
    { views: 0, unique_views: 0, play_starts: 0, completions: 0, cta_clicks: 0 },
  )
  return { items, totals }
}

export { GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER, GROWTH_MEDIA_PLAYBACK_ANALYTICS_SAFETY_FLAGS }
