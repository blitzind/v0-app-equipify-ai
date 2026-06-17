import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { CallIntelligenceScorecardPublicView } from "@/lib/growth/call-intelligence/call-intelligence-types"
import {
  growthCallNotificationActionHref,
  growthWorkspaceCallsCoachingHref,
} from "@/lib/growth/navigation/growth-call-notification-links"
import { emitGrowthNotification } from "@/lib/growth/notifications/emit-growth-notification"

export type CallIntelligenceNotificationContext = {
  leadId: string
  companyName: string
  ownerUserId: string | null
  opportunityId: string | null
  meetingId: string | null
  realtimeSessionId: string | null
  scorecard: CallIntelligenceScorecardPublicView
  previousScorecard: CallIntelligenceScorecardPublicView | null
}

export async function emitCallIntelligenceNotifications(
  admin: SupabaseClient,
  input: CallIntelligenceNotificationContext,
): Promise<void> {
  if (input.scorecard.metrics.incomplete) return

  const coachingUrl = growthWorkspaceCallsCoachingHref({
    leadId: input.leadId,
    callSessionId: input.realtimeSessionId,
  })
  const followUpUrl = growthCallNotificationActionHref({
    notificationType: "call_followup_due",
    leadId: input.leadId,
  })

  if (input.scorecard.overallScore < 45 || input.scorecard.riskLevel === "critical") {
    await emitGrowthNotification(admin, {
      ownerUserId: input.ownerUserId,
      leadId: input.leadId,
      opportunityId: input.opportunityId,
      notificationType: "call_score_low",
      title: "Low call intelligence score",
      body: `${input.companyName} call scored ${input.scorecard.overallScore}/100. Review coaching opportunities.`,
      sourceSystem: "coaching",
      sourceId: input.scorecard.id,
      actionUrl: coachingUrl,
      metadata: { overallScore: input.scorecard.overallScore, riskLevel: input.scorecard.riskLevel },
    })
  }

  if (input.scorecard.nextStepScore < 45) {
    await emitGrowthNotification(admin, {
      ownerUserId: input.ownerUserId,
      leadId: input.leadId,
      opportunityId: input.opportunityId,
      notificationType: "next_step_missing",
      title: "Next step missing",
      body: `${input.companyName}: no clear next step commitment detected on the call.`,
      sourceSystem: "coaching",
      sourceId: input.scorecard.id,
      actionUrl: coachingUrl,
      metadata: { nextStepScore: input.scorecard.nextStepScore },
    })
  }

  if (input.scorecard.competitorRiskScore >= 50 || input.scorecard.competitorMentions.length > 0) {
    await emitGrowthNotification(admin, {
      ownerUserId: input.ownerUserId,
      leadId: input.leadId,
      opportunityId: input.opportunityId,
      notificationType: "competitor_risk_detected",
      title: "Competitor risk on call",
      body: `${input.companyName}: competitor pressure detected during the conversation.`,
      sourceSystem: "coaching",
      sourceId: input.scorecard.id,
      actionUrl: coachingUrl,
      metadata: { competitorRiskScore: input.scorecard.competitorRiskScore },
    })
  }

  if (input.scorecard.detectedObjections.length >= 2 && input.scorecard.objectionHandlingScore < 55) {
    await emitGrowthNotification(admin, {
      ownerUserId: input.ownerUserId,
      leadId: input.leadId,
      opportunityId: input.opportunityId,
      notificationType: "unresolved_objection",
      title: "Unresolved objections",
      body: `${input.companyName}: multiple objections need operator follow-up.`,
      sourceSystem: "coaching",
      sourceId: input.scorecard.id,
      actionUrl: coachingUrl,
      metadata: { objectionCount: input.scorecard.detectedObjections.length },
    })
  }

  if (input.scorecard.buyingSignalScore >= 65 && input.scorecard.outcome === "positive") {
    await emitGrowthNotification(admin, {
      ownerUserId: input.ownerUserId,
      leadId: input.leadId,
      opportunityId: input.opportunityId,
      notificationType: "strong_buying_signal",
      title: "Strong buying signal on call",
      body: `${input.companyName} showed strong buying signals. Human review recommended.`,
      sourceSystem: "coaching",
      sourceId: input.scorecard.id,
      actionUrl: coachingUrl,
      metadata: { buyingSignalScore: input.scorecard.buyingSignalScore },
    })
  }

  if (input.scorecard.recommendedNextAction.toLowerCase().includes("follow-up")) {
    await emitGrowthNotification(admin, {
      ownerUserId: input.ownerUserId,
      leadId: input.leadId,
      opportunityId: input.opportunityId,
      notificationType: "call_followup_due",
      title: "Call follow-up due",
      body: `${input.companyName}: ${input.scorecard.recommendedNextAction}.`,
      sourceSystem: "coaching",
      sourceId: input.scorecard.id,
      actionUrl: followUpUrl,
      metadata: { recommendedNextAction: input.scorecard.recommendedNextAction },
    })
  }
}
