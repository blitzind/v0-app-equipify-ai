import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  applyVideoPageRollupDelta,
  mapVideoPageEventToRollupDelta,
} from "@/lib/growth/runtime-guardrails/growth-media-incremental-rollups"
import { GROWTH_RUNTIME_GUARDRAILS_QA_MARKER } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

function rollupsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("video_page_rollups")
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("video_page_events")
}

export async function incrementVideoPageEventRollup(
  admin: SupabaseClient,
  input: {
    organizationId: string
    videoPageId: string
    eventType: string
    sessionId?: string | null
    watchPercent?: number
    eventTimestamp?: string
  },
): Promise<void> {
  let sessionAlreadySeen = false
  let priorWatchPercent = 0

  if (input.sessionId) {
    const { data, error } = await eventsTable(admin)
      .select("event_type, metadata_json")
      .eq("video_page_id", input.videoPageId)
      .eq("session_id", input.sessionId)
      .limit(200)

    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      if (String((row as { event_type: string }).event_type) === "page_viewed") {
        sessionAlreadySeen = true
      }
      const metadata = (row as { metadata_json: Record<string, unknown> | null }).metadata_json
      const progress = Number(metadata?.watch_percent ?? metadata?.progress_percent ?? 0)
      priorWatchPercent = Math.max(priorWatchPercent, progress)
    }
  }

  const delta = mapVideoPageEventToRollupDelta(input.eventType, {
    sessionAlreadySeen,
    watchPercent: input.watchPercent,
    priorWatchPercent,
  })
  delta.lastEventAt = input.eventTimestamp ?? new Date().toISOString()

  const { data: existing, error: fetchError } = await rollupsTable(admin)
    .select("*")
    .eq("video_page_id", input.videoPageId)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)

  const state = existing
    ? {
        views: Number((existing as { views: number }).views),
        uniqueViewers: Number((existing as { unique_viewers: number }).unique_viewers),
        completions: Number((existing as { completions: number }).completions),
        ctaClicks: Number((existing as { cta_clicks: number }).cta_clicks),
        totalWatchPercentSum: Number((existing as { total_watch_percent_sum: number }).total_watch_percent_sum),
        watchSessionCount: Number((existing as { watch_session_count: number }).watch_session_count),
        avgWatchPercent: Number((existing as { avg_watch_percent: number }).avg_watch_percent),
        lastEventAt: (existing as { last_event_at: string | null }).last_event_at,
      }
    : {
        views: 0,
        uniqueViewers: 0,
        completions: 0,
        ctaClicks: 0,
        totalWatchPercentSum: 0,
        watchSessionCount: 0,
        avgWatchPercent: 0,
        lastEventAt: null,
      }

  const next = applyVideoPageRollupDelta(state, delta)

  const { error } = await rollupsTable(admin).upsert(
    {
      video_page_id: input.videoPageId,
      organization_id: input.organizationId,
      views: next.views,
      unique_viewers: next.uniqueViewers,
      completions: next.completions,
      avg_watch_percent: next.avgWatchPercent,
      cta_clicks: next.ctaClicks,
      total_watch_percent_sum: next.totalWatchPercentSum,
      watch_session_count: next.watchSessionCount,
      last_event_at: next.lastEventAt,
      qa_marker: GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
    },
    { onConflict: "video_page_id" },
  )

  if (error) throw new Error(error.message)
}
