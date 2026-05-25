import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { commandLeadFocusHref } from "@/lib/growth/command/command-action-catalog"
import type { DealIntelligenceScorePublicView } from "@/lib/growth/deal-intelligence/deal-intelligence-types"
import { dealNeedsOperatorAction } from "@/lib/growth/deal-intelligence/deal-recommendation-engine"
import { emitGrowthNotification } from "@/lib/growth/notifications/emit-growth-notification"

export type DealIntelligenceNotificationContext = {
  leadId: string
  opportunityId: string | null
  companyName: string
  ownerUserId: string | null
  score: DealIntelligenceScorePublicView
  previousScore: DealIntelligenceScorePublicView | null
}

export async function emitDealIntelligenceNotifications(
  admin: SupabaseClient,
  input: DealIntelligenceNotificationContext,
): Promise<void> {
  const actionUrl = input.opportunityId
    ? `/admin/growth/opportunities/pipeline?opportunityId=${input.opportunityId}`
    : commandLeadFocusHref(input.leadId, "opportunity")

  if (input.score.riskLevel === "critical" || input.score.riskLevel === "high") {
    const prevRisk = input.previousScore?.dealRiskScore ?? 0
    if (input.score.dealRiskScore > prevRisk + 10) {
      await emitGrowthNotification(admin, {
        ownerUserId: input.ownerUserId,
        leadId: input.leadId,
        opportunityId: input.opportunityId,
        notificationType: "deal_risk_increased",
        title: "Deal risk increased",
        body: `${input.companyName} revenue risk rose to ${input.score.riskLevel.replace(/_/g, " ")} (${input.score.dealRiskScore}/100).`,
        sourceSystem: "intelligence",
        sourceId: input.score.id,
        actionUrl,
        metadata: {
          riskLevel: input.score.riskLevel,
          dealRiskScore: input.score.dealRiskScore,
        },
      })
    }
  }

  if (input.score.closeProbability >= 70) {
    await emitGrowthNotification(admin, {
      ownerUserId: input.ownerUserId,
      leadId: input.leadId,
      opportunityId: input.opportunityId,
      notificationType: "high_probability_deal",
      title: "High-probability deal",
      body: `${input.companyName} close probability is ${input.score.closeProbability}%. Review recommended action.`,
      sourceSystem: "intelligence",
      sourceId: input.score.id,
      actionUrl,
      metadata: { closeProbability: input.score.closeProbability },
    })
  }

  if (input.previousScore && input.score.forecastConfidence < input.previousScore.forecastConfidence - 8) {
    await emitGrowthNotification(admin, {
      ownerUserId: input.ownerUserId,
      leadId: input.leadId,
      opportunityId: input.opportunityId,
      notificationType: "forecast_confidence_dropped",
      title: "Forecast confidence dropped",
      body: `${input.companyName} forecast confidence fell to ${input.score.forecastConfidence}%.`,
      sourceSystem: "intelligence",
      sourceId: input.score.id,
      actionUrl,
      metadata: {
        forecastConfidence: input.score.forecastConfidence,
        previousForecastConfidence: input.previousScore.forecastConfidence,
      },
    })
  }

  if (input.score.predictedCloseWindow === "this_week" || input.score.predictedCloseWindow === "next_14_days") {
    await emitGrowthNotification(admin, {
      ownerUserId: input.ownerUserId,
      leadId: input.leadId,
      opportunityId: input.opportunityId,
      notificationType: "close_window_detected",
      title: "Close window detected",
      body: `${input.companyName} may close ${input.score.predictedCloseWindow.replace(/_/g, " ")}.`,
      sourceSystem: "intelligence",
      sourceId: input.score.id,
      actionUrl,
      metadata: { predictedCloseWindow: input.score.predictedCloseWindow },
    })
  }

  if (dealNeedsOperatorAction(input.score.recommendedOperatorAction)) {
    await emitGrowthNotification(admin, {
      ownerUserId: input.ownerUserId,
      leadId: input.leadId,
      opportunityId: input.opportunityId,
      notificationType: "deal_needs_action",
      title: "Deal needs action",
      body: `${input.companyName}: recommended ${input.score.recommendedOperatorAction.replace(/_/g, " ")}.`,
      sourceSystem: "intelligence",
      sourceId: input.score.id,
      actionUrl,
      metadata: { recommendedOperatorAction: input.score.recommendedOperatorAction },
    })
  }
}
