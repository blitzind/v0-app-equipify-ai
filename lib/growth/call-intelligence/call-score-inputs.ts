import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { countAcceptedLiveGuidanceForSession } from "@/lib/growth/live-guidance/live-guidance-repository"
import { computeCallExecutionScore } from "@/lib/growth/live-guidance/live-execution-score"
import type { CallIntelligenceScoreInputs } from "@/lib/growth/call-intelligence/call-intelligence-types"
import { fetchGrowthMeetingByRealtimeSessionId } from "@/lib/growth/meeting-intelligence/meeting-repository"
import { fetchLiveCoachingSessionInsightsRollup } from "@/lib/growth/realtime/live-coaching/session-insights-repository"
import {
  fetchGrowthRealtimeCallSession,
  listGrowthRealtimeTranscriptEvents,
} from "@/lib/growth/realtime/realtime-call-repository"
import { detectNextStepLanguage } from "@/lib/growth/realtime/realtime-risk-detection"

const DISCOVERY_AREAS = 5

export type GatherCallScoreInputsResult = {
  scoreInputs: CallIntelligenceScoreInputs
  nextStepSecured: boolean
  insufficientData: boolean
  opportunityId: string | null
  meetingId: string | null
  ownerUserId: string | null
}

export async function gatherCallScoreInputs(
  admin: SupabaseClient,
  input: {
    leadId: string
    realtimeSessionId: string
  },
): Promise<GatherCallScoreInputsResult> {
  const session = await fetchGrowthRealtimeCallSession(admin, input.realtimeSessionId)
  if (!session) throw new Error("Session not found.")

  const [insights, transcriptEvents, acceptedGuidanceCount, meeting] = await Promise.all([
    fetchLiveCoachingSessionInsightsRollup(admin, {
      leadId: input.leadId,
      sessionId: input.realtimeSessionId,
    }),
    listGrowthRealtimeTranscriptEvents(admin, input.realtimeSessionId),
    countAcceptedLiveGuidanceForSession(admin, input.realtimeSessionId),
    fetchGrowthMeetingByRealtimeSessionId(admin, input.realtimeSessionId),
  ])

  const snapshot = session.liveSnapshot
  const discoveryCoveragePercent = Math.round((snapshot.discovery.covered.length / DISCOVERY_AREAS) * 100)
  const nextStepSecured = transcriptEvents.some((event) => detectNextStepLanguage(event.content))
  const executionScore = computeCallExecutionScore({
    snapshot,
    events: transcriptEvents,
    acceptedGuidanceCount,
  }).score

  const now = Date.now()
  const meetingFollowUpDue = Boolean(meeting?.followUpDueAt && Date.parse(meeting.followUpDueAt) <= now)
  const meetingOutcomeMissing = meeting?.status === "completed" && !meeting.outcome
  const meetingNoShow = meeting?.status === "no_show"
  const meetingCompleted = meeting?.status === "completed"

  const scoreInputs: CallIntelligenceScoreInputs = {
    transcriptFinalizedCount: insights?.transcriptFinalizedCount ?? transcriptEvents.length,
    guidanceGeneratedCount: insights?.guidanceGeneratedCount ?? 0,
    objectionCount: insights?.objectionCount ?? snapshot.objections.length,
    buyingSignalCount: insights?.buyingSignalCount ?? snapshot.buyingSignals.length,
    discoveryGapCount: insights?.discoveryGapCount ?? snapshot.discovery.missing.length,
    competitorPressureCount: insights?.competitorPressureCount ?? snapshot.competitorGuidance.length,
    providerInterruptions: insights?.providerInterruptions ?? 0,
    averageTranscriptLatencyMs: insights?.averageTranscriptLatencyMs ?? 0,
    sessionHealthScore: insights?.sessionHealthScore ?? 60,
    guidanceLatencyMs: session.guidanceLatencyMs ?? 0,
    executionScore,
    talkRatioInGoalRange: snapshot.talkRatio.inGoalRange,
    repTalkPercent: snapshot.talkRatio.repTalkPercent,
    discoveryCoveragePercent,
    nextStepSecured,
    meetingCompleted,
    meetingNoShow: Boolean(meetingNoShow),
    meetingOutcomeMissing: Boolean(meetingOutcomeMissing),
    meetingFollowUpDue,
    acceptedGuidanceCount,
  }

  const insufficientData =
    scoreInputs.transcriptFinalizedCount === 0 &&
    snapshot.objections.length === 0 &&
    snapshot.buyingSignals.length === 0 &&
    session.status !== "completed"

  return {
    scoreInputs,
    nextStepSecured,
    insufficientData,
    opportunityId: meeting?.opportunityId ?? null,
    meetingId: meeting?.id ?? null,
    ownerUserId: meeting?.ownerUserId ?? session.createdBy ?? null,
  }
}
