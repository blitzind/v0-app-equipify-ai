import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildLiveCoachingSessionTimelineQaProofMarker } from "@/lib/growth/realtime/live-coaching/live-coaching-production-proof"
import { buildSessionTimelineDiagnostics } from "@/lib/growth/realtime/live-coaching/session-timeline-diagnostics"
import {
  countLiveCoachingSessionTimelineEvents,
  listLiveCoachingSessionTimelineEvents,
  LIVE_COACHING_SESSION_TIMELINE_MAX_EVENTS,
} from "@/lib/growth/realtime/live-coaching/session-timeline-repository"
import type { LiveCoachingSessionTimelinePayload } from "@/lib/growth/realtime/live-coaching/session-timeline-types"

export async function getLiveCoachingSessionTimelinePayload(
  admin: SupabaseClient,
  input: { leadId: string; sessionId: string },
): Promise<LiveCoachingSessionTimelinePayload> {
  const limit = LIVE_COACHING_SESSION_TIMELINE_MAX_EVENTS
  const [events, eventCount] = await Promise.all([
    listLiveCoachingSessionTimelineEvents(admin, { ...input, limit }),
    countLiveCoachingSessionTimelineEvents(admin, input.sessionId),
  ])
  const diagnostics = buildSessionTimelineDiagnostics(events)

  return {
    events,
    diagnostics,
    meta: {
      total: eventCount,
      limit,
      truncated: eventCount > events.length,
    },
    qaProof: buildLiveCoachingSessionTimelineQaProofMarker({ eventCount }),
  }
}
