import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { MeetingOutcomeScoreInputs } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-types"
import { computeHumanExecutionReadiness } from "@/lib/growth/human-execution/human-execution-readiness-score"
import { fetchGrowthMeetingById } from "@/lib/growth/meeting-intelligence/meeting-repository"

export async function gatherMeetingOutcomeScoreInputs(
  admin: SupabaseClient,
  meetingId: string,
): Promise<MeetingOutcomeScoreInputs | null> {
  const meeting = await fetchGrowthMeetingById(admin, meetingId)
  if (!meeting) return null

  const [callRes, dealRes, replyRes, leadRes, priorMeetingsRes] = await Promise.all([
    admin
      .schema("growth")
      .from("call_intelligence_scorecards")
      .select("overall_score, buying_signal_score, next_step_score, competitor_risk_score, detected_objections, buying_signals")
      .eq("meeting_id", meetingId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .schema("growth")
      .from("deal_intelligence_scores")
      .select("close_probability, deal_risk_score")
      .eq("lead_id", meeting.leadId)
      .eq("score_status", "active")
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .schema("growth")
      .from("outbound_replies")
      .select("intent, priority")
      .eq("lead_id", meeting.leadId)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .schema("growth")
      .from("leads")
      .select("engagement_score, last_human_touch_at, score")
      .eq("id", meeting.leadId)
      .maybeSingle(),
    admin
      .schema("growth")
      .from("meetings")
      .select("status")
      .eq("lead_id", meeting.leadId)
      .neq("id", meetingId),
  ])

  const callObjections = Array.isArray(callRes.data?.detected_objections)
    ? callRes.data.detected_objections.length
    : 0
  const callBuyingSignals = Array.isArray(callRes.data?.buying_signals) ? callRes.data.buying_signals.length : 0

  const readiness = computeHumanExecutionReadiness({
    dealCloseProbability: dealRes.data?.close_probability as number | null,
    dealRiskScore: dealRes.data?.deal_risk_score as number | null,
    callOverallScore: callRes.data?.overall_score as number | null,
    callNextStepScore: callRes.data?.next_step_score as number | null,
    engagementScore: leadRes.data?.engagement_score as number | null,
    replyIntent: replyRes.data?.intent as string | null,
    replyPriority: replyRes.data?.priority as string | null,
    meetingOutcome: meeting.outcome,
    meetingFollowUpOverdue:
      meeting.followUpDueAt != null && Date.parse(meeting.followUpDueAt) <= Date.now() && meeting.status === "completed",
    daysSinceLastTouch: leadRes.data?.last_human_touch_at
      ? Math.floor((Date.now() - Date.parse(leadRes.data.last_human_touch_at as string)) / 86400000)
      : null,
  })

  const priorStatuses = (priorMeetingsRes.data ?? []).map((row) => row.status as string)

  return {
    meetingStatus: meeting.status,
    meetingOutcome: meeting.outcome,
    meetingFollowUpOverdue:
      meeting.followUpDueAt != null && Date.parse(meeting.followUpDueAt) <= Date.now() && meeting.status === "completed",
    meetingOutcomeMissing: meeting.status === "completed" && !meeting.outcome?.trim(),
    meetingNoShow: meeting.status === "no_show",
    callOverallScore: callRes.data?.overall_score as number | null,
    callBuyingSignalScore: callRes.data?.buying_signal_score as number | null,
    callNextStepScore: callRes.data?.next_step_score as number | null,
    callCompetitorRiskScore: callRes.data?.competitor_risk_score as number | null,
    callObjectionCount: callObjections,
    callBuyingSignalCount: callBuyingSignals,
    replyIntent: replyRes.data?.intent as string | null,
    replyPriority: replyRes.data?.priority as string | null,
    dealCloseProbability: dealRes.data?.close_probability as number | null,
    dealRiskScore: dealRes.data?.deal_risk_score as number | null,
    executionReadinessScore: readiness.readinessScore,
    engagementScore: leadRes.data?.engagement_score as number | null,
    priorMeetingCount: priorStatuses.length,
    priorNoShowCount: priorStatuses.filter((status) => status === "no_show").length,
    attendeeCount: meeting.attendeeEmails?.length ?? 0,
  }
}
