import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  computeMediaAssetEventRollup,
  listMediaAssetEventsForAsset,
} from "@/lib/growth/media/media-asset-analytics-repository"
import { GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER } from "@/lib/growth/media/media-asset-analytics-types"
import type { GrowthMediaAssetEventRow } from "@/lib/growth/media/media-asset-analytics-types"
import {
  applyIncrementalMediaRollupDelta,
  computeIncrementalMediaRollupDelta,
  emptyIncrementalMediaRollupState,
  type IncrementalMediaRollupState,
} from "@/lib/growth/runtime-guardrails/growth-media-incremental-rollups"
import { GROWTH_RUNTIME_GUARDRAIL_LIMITS } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import { GROWTH_RUNTIME_GUARDRAILS_QA_MARKER } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

function rollupsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("media_asset_event_rollups")
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("media_asset_events")
}

function mapRollupRow(row: Record<string, unknown>): IncrementalMediaRollupState {
  return {
    views: Number(row.views ?? 0),
    uniqueViews: Number(row.unique_views ?? 0),
    playStarts: Number(row.play_starts ?? 0),
    completions: Number(row.completions ?? 0),
    ctaClicks: Number(row.cta_clicks ?? 0),
    totalWatchSeconds: Number(row.total_watch_seconds ?? 0),
    watchSessionCount: Number(row.watch_session_count ?? 0),
    completionRate: Number(row.completion_rate ?? 0),
    averageWatchSeconds: Number(row.average_watch_seconds ?? 0),
    lastEventAt: row.last_event_at ? String(row.last_event_at) : null,
  }
}

async function getSessionContext(
  admin: SupabaseClient,
  input: { organizationId: string; assetId: string; sessionId: string; excludeEventId?: string },
): Promise<{ sessionAlreadyViewed: boolean; sessionPriorMaxProgress: number }> {
  let query = eventsTable(admin)
    .select("id, event_type, progress_seconds")
    .eq("organization_id", input.organizationId)
    .eq("asset_id", input.assetId)
    .eq("session_id", input.sessionId)
    .limit(GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_MEDIA_EVENTS_PER_SESSION)

  if (input.excludeEventId) {
    query = query.neq("id", input.excludeEventId)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  let sessionAlreadyViewed = false
  let sessionPriorMaxProgress = 0
  for (const row of data ?? []) {
    const eventType = String((row as { event_type: string }).event_type)
    if (eventType === "video_viewed") sessionAlreadyViewed = true
    const progress = Number((row as { progress_seconds: number | null }).progress_seconds ?? 0)
    sessionPriorMaxProgress = Math.max(sessionPriorMaxProgress, progress)
  }

  return { sessionAlreadyViewed, sessionPriorMaxProgress }
}

export async function incrementMediaAssetEventRollup(
  admin: SupabaseClient,
  input: { organizationId: string; assetId: string; event: GrowthMediaAssetEventRow },
): Promise<IncrementalMediaRollupState> {
  const { data: existingRow, error: fetchError } = await rollupsTable(admin)
    .select("*")
    .eq("asset_id", input.assetId)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)

  const existing = existingRow
    ? mapRollupRow(existingRow as Record<string, unknown>)
    : emptyIncrementalMediaRollupState()

  const sessionContext = await getSessionContext(admin, {
    organizationId: input.organizationId,
    assetId: input.assetId,
    sessionId: input.event.sessionId,
    excludeEventId: input.event.id,
  })

  const delta = computeIncrementalMediaRollupDelta(input.event, sessionContext)
  const next = applyIncrementalMediaRollupDelta(existing, delta)

  const { error } = await rollupsTable(admin).upsert(
    {
      asset_id: input.assetId,
      organization_id: input.organizationId,
      views: next.views,
      unique_views: next.uniqueViews,
      play_starts: next.playStarts,
      completions: next.completions,
      completion_rate: next.completionRate,
      average_watch_seconds: next.averageWatchSeconds,
      total_watch_seconds: next.totalWatchSeconds,
      watch_session_count: next.watchSessionCount,
      cta_clicks: next.ctaClicks,
      last_event_at: next.lastEventAt,
      qa_marker: GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER,
    },
    { onConflict: "asset_id" },
  )

  if (error) throw new Error(error.message)
  return next
}

/** Admin-only full rebuild in batches of MAX_MEDIA_ROLLUP_BATCH. */
export async function rebuildMediaAssetRollupsBatch(
  admin: SupabaseClient,
  input?: { organizationId?: string; offset?: number },
): Promise<{ processed: number; hasMore: boolean }> {
  const batchSize = GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_MEDIA_ROLLUP_BATCH
  const offset = input?.offset ?? 0

  let query = admin
    .schema("growth")
    .from("media_assets")
    .select("id, organization_id")
    .eq("asset_type", "video")
    .order("created_at", { ascending: true })
    .range(offset, offset + batchSize - 1)

  if (input?.organizationId) {
    query = query.eq("organization_id", input.organizationId)
  }

  const { data: assets, error } = await query
  if (error) throw new Error(error.message)

  const rows = assets ?? []
  for (const asset of rows) {
    const assetId = String((asset as { id: string }).id)
    const organizationId = String((asset as { organization_id: string }).organization_id)
    const events = await listMediaAssetEventsForAsset(admin, { organizationId, assetId })
    const rollup = computeMediaAssetEventRollup(events)

    await rollupsTable(admin).upsert(
      {
        asset_id: assetId,
        organization_id: organizationId,
        views: rollup.views,
        unique_views: rollup.uniqueViews,
        play_starts: rollup.playStarts,
        completions: rollup.completions,
        completion_rate: rollup.completionRate,
        average_watch_seconds: rollup.averageWatchSeconds,
        total_watch_seconds: rollup.averageWatchSeconds * rollup.uniqueViews,
        watch_session_count: rollup.uniqueViews,
        cta_clicks: rollup.ctaClicks,
        last_event_at: rollup.lastEventAt,
        qa_marker: GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
      },
      { onConflict: "asset_id" },
    )
  }

  return { processed: rows.length, hasMore: rows.length === batchSize }
}
