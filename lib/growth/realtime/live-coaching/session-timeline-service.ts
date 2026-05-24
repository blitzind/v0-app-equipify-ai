import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildLiveCoachingSessionTimelineQaProofMarker } from "@/lib/growth/realtime/live-coaching/live-coaching-production-proof"
import { buildSessionTimelineDiagnostics } from "@/lib/growth/realtime/live-coaching/session-timeline-diagnostics"
import {
  countLiveCoachingSessionTimelineEvents,
  listLiveCoachingSessionTimelineEvents,
} from "@/lib/growth/realtime/live-coaching/session-timeline-repository"
import type { LiveCoachingSessionTimelinePayload } from "@/lib/growth/realtime/live-coaching/session-timeline-types"

export async function getLiveCoachingSessionTimelinePayload(
  admin: SupabaseClient,
  input: { leadId: string; sessionId: string },
): Promise<LiveCoachingSessionTimelinePayload> {
  const events = await listLiveCoachingSessionTimelineEvents(admin, input)
  const diagnostics = buildSessionTimelineDiagnostics(events)
  const eventCount = await countLiveCoachingSessionTimelineEvents(admin, input.sessionId)

  return {
    events,
    diagnostics,
    qaProof: buildLiveCoachingSessionTimelineQaProofMarker({ eventCount }),
  }
}
