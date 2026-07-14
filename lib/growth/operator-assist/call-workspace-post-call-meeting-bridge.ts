/** GE-AIOS-CALL-WORKSPACE-INTELLIGENCE-2B — Meeting Intelligence bridge (no second summary engine). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthMeetingByRealtimeSessionId, updateGrowthMeetingRow } from "@/lib/growth/meeting-intelligence/meeting-repository"
import { ingestLiveRelationshipEvent } from "@/lib/growth/aios/growth/growth-adaptive-loop-1b-live-ingestion"
import { mapMeetingStatusToAdaptiveProspectEvent } from "@/lib/growth/aios/growth/growth-adaptive-loop-1b-event-mappers"
import type { GrowthCallWorkspacePostCallClosure } from "@/lib/growth/operator-assist/call-workspace-post-call-closure-types"

export async function bridgeCallWorkspaceClosureToMeetingIntelligence(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    realtimeSessionId: string | null | undefined
    closure: Pick<GrowthCallWorkspacePostCallClosure, "meetingSummary" | "callOutcome" | "recommendedNextAction">
    generatedAt: string
  },
): Promise<{ updated: boolean; meetingId: string | null }> {
  if (!input.realtimeSessionId) return { updated: false, meetingId: null }

  const meeting = await fetchGrowthMeetingByRealtimeSessionId(admin, input.realtimeSessionId).catch(() => null)
  if (!meeting) return { updated: false, meetingId: null }

  const shouldComplete = input.closure.callOutcome.outcome !== "no_answer"
  const nextAction = input.closure.recommendedNextAction.label
  const outcome = input.closure.meetingSummary.slice(0, 500)

  await updateGrowthMeetingRow(admin, meeting.id, {
    ...(shouldComplete && meeting.status !== "completed"
      ? {
          status: "completed",
          completed_at: input.generatedAt,
        }
      : {}),
    outcome,
    next_action: nextAction,
    notes: meeting.notes ? `${meeting.notes}\n\n${outcome}` : outcome,
  })

  if (shouldComplete) {
    const event = mapMeetingStatusToAdaptiveProspectEvent({
      status: "completed",
      occurredAt: input.generatedAt,
      outcome: input.closure.meetingSummary,
    })
    if (event) {
      await ingestLiveRelationshipEvent(admin, {
        organizationId: input.organizationId,
        leadId: input.leadId,
        source: "meeting_pipeline",
        event,
        sourceEventId: meeting.id,
        scheduleStrategyRefresh: false,
      }).catch(() => undefined)
    }
  }

  return { updated: true, meetingId: meeting.id }
}
