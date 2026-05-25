import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { listGrowthMeetingsForLead } from "@/lib/growth/meeting-intelligence/meeting-repository"
import { fetchGrowthOpportunityDetail } from "@/lib/growth/opportunity-pipeline/pipeline-repository"
import type { GrowthOpportunityDetail } from "@/lib/growth/opportunity-pipeline/pipeline-types"
import { listGrowthOutboundRepliesForLead } from "@/lib/growth/outbound/reply-repository"
import { fetchLatestCompletedProspectResearchRun } from "@/lib/growth/research/research-repository"
import { fetchLatestCallIntelligenceScorecardForLead } from "@/lib/growth/call-intelligence/call-intelligence-repository"
import type { DealIntelligenceScoreInputs } from "@/lib/growth/deal-intelligence/deal-intelligence-types"
import type { GrowthLead } from "@/lib/growth/types"

export type GatherDealScoreContextInput = {
  admin: SupabaseClient
  opportunityId?: string | null
  leadId: string
}

export type GatherDealScoreContextResult = {
  opportunity: GrowthOpportunityDetail | null
  lead: GrowthLead
  scoreInputs: DealIntelligenceScoreInputs
}

export async function gatherDealScoreContext(
  input: GatherDealScoreContextInput,
): Promise<GatherDealScoreContextResult> {
  const lead = await fetchGrowthLeadById(input.admin, input.leadId)
  if (!lead) throw new Error("Lead not found.")

  const [opportunity, meetings, replies, research, cadenceOverdue, callScorecard, meetingOutcomeRes] =
    await Promise.all([
      input.opportunityId ? fetchGrowthOpportunityDetail(input.admin, input.opportunityId) : Promise.resolve(null),
      listGrowthMeetingsForLead(input.admin, input.leadId, 20),
      listGrowthOutboundRepliesForLead(input.admin, input.leadId),
      lead.latestProspectResearchRunId
        ? fetchLatestCompletedProspectResearchRun(input.admin, input.leadId)
        : Promise.resolve(null),
      countOverdueCadenceTasks(input.admin, input.leadId),
      fetchLatestCallIntelligenceScorecardForLead(input.admin, input.leadId).catch(() => null),
      input.admin
        .schema("growth")
        .from("meeting_outcome_intelligence_scores")
        .select(
          "meeting_outcome_score, meeting_quality_score, next_step_confidence, follow_up_recommendation, buying_signal_count, no_show_risk_pattern",
        )
        .eq("lead_id", input.leadId)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .catch(() => ({ data: null, error: null })),
    ])

  const now = Date.now()
  const overdueFollowUp = Boolean(lead.followUpAt && Date.parse(lead.followUpAt) < now)
  const unansweredReplies = replies.filter((reply) => reply.unanswered && reply.priority !== "low").length
  const closeDateOverdue = Boolean(
    opportunity?.expectedCloseDate && Date.parse(opportunity.expectedCloseDate) < now,
  )

  const scoreInputs: DealIntelligenceScoreInputs = {
    stageKey: opportunity?.stageKey,
    stageAgeDays: opportunity?.stageAgeDays,
    amount: opportunity?.amount,
    probability: opportunity?.probability,
    forecastCategory: opportunity?.forecastCategory,
    isStale: opportunity?.isStale,
    riskScore: opportunity?.riskScore,
    engagementTier: lead.engagementTier,
    engagementScore: lead.engagementScore,
    meetingsCompleted: meetings.filter((m) => m.status === "completed").length,
    meetingsScheduled: meetings.filter((m) => m.status === "scheduled").length,
    meetingNoShows: meetings.filter((m) => m.status === "no_show").length,
    repliesReceived: replies.length,
    unansweredReplies,
    researchConfidence: research?.researchConfidence ?? null,
    websiteMaturityScore: research?.websiteMaturityScore ?? null,
    painSignalCount: research?.signals.painSignals.length ?? 0,
    hasOwner: Boolean(opportunity?.ownerUserId ?? lead.assignedTo),
    overdueFollowUp,
    competitorPressure: lead.conversationCompetitorPressure ?? 0,
    buyingIntent: lead.conversationBuyingIntent,
    closeDateOverdue,
    cadenceTasksOverdue: cadenceOverdue,
    callOverallScore: callScorecard?.overallScore ?? null,
    callBuyingSignalScore: callScorecard?.buyingSignalScore ?? null,
    callCompetitorRiskScore: callScorecard?.competitorRiskScore ?? null,
    callNextStepScore: callScorecard?.nextStepScore ?? null,
    callOutcome: callScorecard?.outcome ?? null,
    meetingCompletedWithHighScore: Boolean(
      callScorecard &&
        !callScorecard.metrics.incomplete &&
        meetings.some((m) => m.status === "completed") &&
        callScorecard.overallScore >= 65,
    ),
    meetingOutcomeScore: meetingOutcomeRes.data?.meeting_outcome_score as number | null,
    meetingQualityScore: meetingOutcomeRes.data?.meeting_quality_score as number | null,
    meetingNextStepConfidence: meetingOutcomeRes.data?.next_step_confidence as number | null,
    meetingFollowUpRecommendation: meetingOutcomeRes.data?.follow_up_recommendation as string | null,
    meetingBuyingSignalCount: meetingOutcomeRes.data?.buying_signal_count as number | undefined,
    meetingNoShowRiskPattern: meetingOutcomeRes.data?.no_show_risk_pattern as boolean | undefined,
  }

  return { opportunity, lead, scoreInputs }
}

async function countOverdueCadenceTasks(admin: SupabaseClient, leadId: string): Promise<number> {
  const now = new Date().toISOString()
  const { count, error } = await admin
    .schema("growth")
    .from("cadence_tasks")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("status", "pending")
    .lt("due_at", now)

  if (error) return 0
  return count ?? 0
}
