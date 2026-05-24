import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildLiveCoachingSessionInsightsRollup } from "@/lib/growth/realtime/live-coaching/session-insights-rollup"
import {
  fetchLiveCoachingSessionInsightsRollup,
  upsertLiveCoachingSessionInsightsRollup,
} from "@/lib/growth/realtime/live-coaching/session-insights-repository"
import type { LiveCoachingSessionInsightsPayload } from "@/lib/growth/realtime/live-coaching/session-insights-types"
import { buildLiveCoachingSessionInsightsQaProofMarker } from "@/lib/growth/realtime/live-coaching/live-coaching-production-proof"
import { listLiveCoachingSessionTimelineEvents } from "@/lib/growth/realtime/live-coaching/session-timeline-repository"

async function computeRollupFromTimeline(
  admin: SupabaseClient,
  input: { leadId: string; sessionId: string },
) {
  const events = await listLiveCoachingSessionTimelineEvents(admin, input)
  const rollup = buildLiveCoachingSessionInsightsRollup({
    leadId: input.leadId,
    sessionId: input.sessionId,
    events,
  })
  return { events, rollup }
}

export async function getLiveCoachingSessionInsightsPayload(
  admin: SupabaseClient,
  input: { leadId: string; sessionId: string },
): Promise<LiveCoachingSessionInsightsPayload> {
  const stored = await fetchLiveCoachingSessionInsightsRollup(admin, input)
  if (stored) {
    return {
      rollup: stored,
      qaProof: buildLiveCoachingSessionInsightsQaProofMarker({ hasRollup: true }),
    }
  }

  const { events, rollup } = await computeRollupFromTimeline(admin, input)
  if (events.length === 0) {
    return {
      rollup: null,
      qaProof: buildLiveCoachingSessionInsightsQaProofMarker({ hasRollup: false }),
    }
  }

  return {
    rollup,
    qaProof: buildLiveCoachingSessionInsightsQaProofMarker({ hasRollup: true }),
  }
}

export async function recomputeLiveCoachingSessionInsights(
  admin: SupabaseClient,
  input: { leadId: string; sessionId: string },
): Promise<LiveCoachingSessionInsightsPayload> {
  const rollup = await computeRollupFromTimeline(admin, input)
  const persisted = await upsertLiveCoachingSessionInsightsRollup(admin, rollup)

  return {
    rollup: persisted,
    qaProof: buildLiveCoachingSessionInsightsQaProofMarker({ hasRollup: true }),
  }
}
