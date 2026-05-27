import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchOpportunityWorkspaceDashboard } from "@/lib/growth/revenue-intelligence/opportunity-workspace-dashboard"
import { computeGlobalChannelEffectiveness } from "@/lib/growth/revenue-intelligence/channel-effectiveness-analytics"
import { computeGlobalSalesExecutionInsights } from "@/lib/growth/revenue-intelligence/sales-execution-insights"
import {
  GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER,
  type GrowthExecutiveRevenueOpsDashboard,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase7-types"

export async function fetchExecutiveRevenueOpsDashboard(admin: SupabaseClient): Promise<GrowthExecutiveRevenueOpsDashboard> {
  const [workspace, channelMetrics, insights] = await Promise.all([
    fetchOpportunityWorkspaceDashboard(admin, { limit: 100 }),
    computeGlobalChannelEffectiveness(admin),
    computeGlobalSalesExecutionInsights(admin).catch(() => ({
      replyQualityScore: 0,
      objectionResolutionRate: 0,
      meetingConversionRate: 0,
      opportunityConversionRate: 0,
      campaignOpportunityConversion: 0,
      senderEffectiveness: 0,
      domainEffectiveness: 0,
      sequenceEffectiveness: 0,
      operatorResponseQuality: 0,
    })),
  ])

  const momentumTrendSummary: Record<string, number> = {
    accelerating: 0,
    steady: 0,
    cooling: 0,
    stalled: 0,
  }
  for (const item of workspace.items) {
    momentumTrendSummary[item.momentumTrend] = (momentumTrendSummary[item.momentumTrend] ?? 0) + 1
  }

  const totalTouches = channelMetrics.reduce((sum, m) => sum + m.touchCount, 0)
  const positiveTouches = channelMetrics.reduce((sum, m) => sum + m.positiveOutcomes, 0)
  const engagementTrendRate = totalTouches > 0 ? Math.round((positiveTouches / totalTouches) * 100) : 0

  const pipelineAccelerationScore = Math.round(
    (workspace.hottestAccountCount * 10 +
      momentumTrendSummary.accelerating * 8 -
      momentumTrendSummary.stalled * 5) /
      Math.max(1, workspace.items.length),
  )

  const revenueRiskIndicators: string[] = []
  if (workspace.stalledConversationCount >= 5) {
    revenueRiskIndicators.push(`${workspace.stalledConversationCount} stalled conversations may slow pipeline.`)
  }
  if (insights.objectionResolutionRate < 30 && insights.objectionResolutionRate > 0) {
    revenueRiskIndicators.push("Low objection resolution rate across channels.")
  }
  if (momentumTrendSummary.cooling >= 3) {
    revenueRiskIndicators.push(`${momentumTrendSummary.cooling} accounts showing cooling momentum.`)
  }
  const emailMetric = channelMetrics.find((m) => m.channel === "email")
  if (emailMetric && emailMetric.touchCount >= 20 && emailMetric.effectivenessScore < 20) {
    revenueRiskIndicators.push("Email channel effectiveness low relative to touch volume — review operator execution.")
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count: operatorActivityCount } = await admin
    .schema("growth")
    .from("multi_channel_activity_timeline_events")
    .select("id", { count: "exact", head: true })
    .gte("occurred_at", since)
    .then((r) => r)
    .catch(() => ({ count: 0 }))

  return {
    qaMarker: GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER,
    channelPerformance: channelMetrics.map((m) => ({
      channel: m.channel,
      effectivenessScore: m.effectivenessScore,
      touchCount: m.touchCount,
    })),
    momentumTrendSummary,
    engagementTrendRate,
    meetingConversionRate: insights.meetingConversionRate,
    pipelineAccelerationScore: Math.max(0, Math.min(100, pipelineAccelerationScore)),
    revenueRiskIndicators,
    operatorActivityCount: operatorActivityCount ?? 0,
  }
}
