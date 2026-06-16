/** Growth Engine S2-D — media playback analytics integration diagnostics. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createMediaAsset, getMediaAsset } from "@/lib/growth/media/media-asset-repository"
import {
  computeMediaAssetEventRollup,
  deleteMediaAssetEventsForAsset,
  listMediaAssetEventsForAsset,
} from "@/lib/growth/media/media-asset-analytics-repository"
import {
  GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER,
  GROWTH_MEDIA_PLAYBACK_ANALYTICS_SAFETY_FLAGS,
} from "@/lib/growth/media/media-asset-analytics-types"
import { probeGrowthMediaAssetAnalyticsSchema } from "@/lib/growth/media/media-asset-analytics-schema-health"
import {
  getGrowthMediaAssetPlaybackAnalytics,
  ingestGrowthMediaPlaybackAnalyticsEvent,
} from "@/lib/growth/media/media-asset-analytics-service"

const ANALYTICS_CERT_PREFIX = "growth-media-playback-analytics-s2d-cert"

export type GrowthMediaAssetAnalyticsDiagnosticsCheck = {
  id: string
  ok: boolean
  detail: string
}

export type GrowthMediaAssetAnalyticsDiagnosticsReport = {
  ok: boolean
  skipped: boolean
  execution_id: string
  qa_marker: typeof GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER
  checks: GrowthMediaAssetAnalyticsDiagnosticsCheck[]
  blockers: string[]
  final_verdict: "PASS" | "FAIL" | "SKIP"
  no_public_playback: true
  no_autonomous_tracking_without_token: true
  no_notifications: true
  no_sequence_execution: true
  no_ai_generation: true
}

function pushCheck(
  checks: GrowthMediaAssetAnalyticsDiagnosticsCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

async function resolveCertOrganizationId(admin: SupabaseClient): Promise<string | null> {
  const configured = process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()
  if (configured) return configured

  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) return null
  return data.id
}

export async function executeGrowthMediaAssetAnalyticsDiagnostics(
  admin: SupabaseClient,
): Promise<GrowthMediaAssetAnalyticsDiagnosticsReport> {
  const execution_id = randomUUID()
  const checks: GrowthMediaAssetAnalyticsDiagnosticsCheck[] = []
  const blockers: string[] = []

  const schemaProbe = await probeGrowthMediaAssetAnalyticsSchema(admin)

  if (!schemaProbe.ready) {
    pushCheck(
      checks,
      "analytics_schema",
      true,
      "Analytics tables not applied — integration CRUD skipped until migration approval.",
    )
    pushCheck(
      checks,
      "analytics_integration_skipped",
      true,
      "Analytics migration not applied — integration CRUD skipped until production apply approval.",
    )
    return {
      ok: true,
      skipped: true,
      execution_id,
      qa_marker: GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER,
      checks,
      blockers,
      final_verdict: "SKIP",
      ...GROWTH_MEDIA_PLAYBACK_ANALYTICS_SAFETY_FLAGS,
    }
  }

  pushCheck(
    checks,
    "analytics_schema",
    true,
    "media_asset_events and media_asset_event_rollups are queryable.",
  )

  const organizationId = await resolveCertOrganizationId(admin)
  if (!organizationId) {
    pushCheck(checks, "organization_scope", false, "Could not resolve certification organization id.")
    blockers.push("organization_scope_missing")
  } else {
    pushCheck(checks, "organization_scope", true, "Organization scope resolved.")

    const asset = await createMediaAsset(admin, {
      organizationId,
      assetType: "video",
      provider: "local_stub",
      title: `${ANALYTICS_CERT_PREFIX}-${randomUUID()}`,
      tags: [ANALYTICS_CERT_PREFIX],
      metadata: { cert: true, ...GROWTH_MEDIA_PLAYBACK_ANALYTICS_SAFETY_FLAGS },
    })
    pushCheck(checks, "analytics_create_asset", asset.assetType === "video", "Cert video asset created.")

    const sessionId = `cert-session-${randomUUID()}`
    await ingestGrowthMediaPlaybackAnalyticsEvent(admin, {
      organizationId,
      assetId: asset.id,
      eventType: "video_viewed",
      sessionId,
      ingestSource: "platform_admin",
    })
    await ingestGrowthMediaPlaybackAnalyticsEvent(admin, {
      organizationId,
      assetId: asset.id,
      eventType: "video_play_started",
      sessionId,
      ingestSource: "platform_admin",
    })
    await ingestGrowthMediaPlaybackAnalyticsEvent(admin, {
      organizationId,
      assetId: asset.id,
      eventType: "video_progress",
      sessionId,
      ingestSource: "platform_admin",
      progressSeconds: 45,
      progressPercent: 75,
      durationSeconds: 60,
    })
    await ingestGrowthMediaPlaybackAnalyticsEvent(admin, {
      organizationId,
      assetId: asset.id,
      eventType: "video_completed",
      sessionId,
      ingestSource: "platform_admin",
      progressSeconds: 60,
      progressPercent: 100,
      durationSeconds: 60,
    })
    await ingestGrowthMediaPlaybackAnalyticsEvent(admin, {
      organizationId,
      assetId: asset.id,
      eventType: "video_cta_clicked",
      sessionId,
      ingestSource: "platform_admin",
      ctaKey: "book_meeting",
    })

    const events = await listMediaAssetEventsForAsset(admin, {
      organizationId,
      assetId: asset.id,
    })
    pushCheck(checks, "analytics_events_persisted", events.length === 5, "Deterministic cert events persisted.")

    const rollup = computeMediaAssetEventRollup(events)
    pushCheck(checks, "analytics_rollup_math_views", rollup.views === 1, "Rollup views computed.")
    pushCheck(checks, "analytics_rollup_math_play_starts", rollup.playStarts === 1, "Rollup play starts computed.")
    pushCheck(checks, "analytics_rollup_math_completions", rollup.completions === 1, "Rollup completions computed.")
    pushCheck(checks, "analytics_rollup_math_cta", rollup.ctaClicks === 1, "Rollup CTA clicks computed.")
    pushCheck(
      checks,
      "analytics_rollup_math_average_watch",
      rollup.averageWatchSeconds === 60,
      "Rollup average watch seconds computed from progress/completion.",
    )

    const stored = await getGrowthMediaAssetPlaybackAnalytics(admin, {
      organizationId,
      assetId: asset.id,
    })
    pushCheck(
      checks,
      "analytics_rollup_persisted",
      stored.rollup?.views === 1 && stored.rollup.completions === 1,
      "Rollup row persisted for asset.",
    )

    let tokenBlocked = false
    try {
      await ingestGrowthMediaPlaybackAnalyticsEvent(admin, {
        organizationId,
        assetId: asset.id,
        eventType: "video_viewed",
        sessionId: `blocked-${randomUUID()}`,
        ingestSource: "client_hook",
      })
    } catch (error) {
      tokenBlocked = error instanceof Error && error.message === "tracking_token_required"
    }
    pushCheck(
      checks,
      "analytics_tracking_token_guard",
      tokenBlocked,
      "Client hook ingest blocked without tracking token.",
    )

    await deleteMediaAssetEventsForAsset(admin, asset.id)
    await admin.schema("growth").from("media_assets").delete().eq("id", asset.id)
    pushCheck(
      checks,
      "analytics_cleanup",
      (await getMediaAsset(admin, asset.id)) == null,
      "Analytics cert fixtures deleted.",
    )
  }

  const failedChecks = checks.filter((check) => !check.ok)
  const ok = failedChecks.length === 0 && blockers.length === 0

  return {
    ok,
    skipped: false,
    execution_id,
    qa_marker: GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER,
    checks,
    blockers,
    final_verdict: ok ? "PASS" : "FAIL",
    ...GROWTH_MEDIA_PLAYBACK_ANALYTICS_SAFETY_FLAGS,
  }
}
