import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchOpportunityWorkspaceDashboard } from "@/lib/growth/revenue-intelligence/opportunity-workspace-dashboard"
import { computeGlobalSalesExecutionInsights } from "@/lib/growth/revenue-intelligence/sales-execution-insights"
import {
  GROWTH_REVENUE_INTELLIGENCE_QA_MARKER,
  type GrowthBuyingMomentumTrend,
  type GrowthExecutiveRevenueDashboard,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase6-types"

export async function fetchExecutiveRevenueDashboard(admin: SupabaseClient): Promise<GrowthExecutiveRevenueDashboard> {
  const workspace = await fetchOpportunityWorkspaceDashboard(admin, { limit: 100 })
  const insights = await computeGlobalSalesExecutionInsights(admin).catch(() => ({
    replyQualityScore: 0,
    objectionResolutionRate: 0,
    meetingConversionRate: 0,
    opportunityConversionRate: 0,
    campaignOpportunityConversion: 0,
    senderEffectiveness: 0,
    domainEffectiveness: 0,
    sequenceEffectiveness: 0,
    operatorResponseQuality: 0,
  }))

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: attributionRows } = await admin
    .schema("growth")
    .from("campaign_revenue_attribution_snapshots")
    .select("opportunities_generated, demo_requests, pricing_questions, positive_replies")
    .gte("snapshot_date", since)

  let opportunitiesGenerated = 0
  let demoRequests = 0
  let pricingQuestions = 0
  let positiveReplies = 0
  for (const row of attributionRows ?? []) {
    const record = row as Record<string, unknown>
    opportunitiesGenerated += Number(record.opportunities_generated ?? 0)
    demoRequests += Number(record.demo_requests ?? 0)
    pricingQuestions += Number(record.pricing_questions ?? 0)
    positiveReplies += Number(record.positive_replies ?? 0)
  }

  const { data: pipelineRows } = await admin.schema("growth").from("opportunities").select("stage")
  const pipelineCount = (pipelineRows ?? []).filter(
    (row) => !["closed_lost", "closed_won"].includes(String((row as { stage?: string }).stage)),
  ).length

  const momentumTrendSummary: Record<GrowthBuyingMomentumTrend, number> = {
    accelerating: 0,
    steady: 0,
    cooling: 0,
    stalled: 0,
  }
  for (const item of workspace.items) {
    momentumTrendSummary[item.momentumTrend] += 1
  }

  const operationalRiskToRevenue: string[] = []
  if (workspace.stalledConversationCount >= 5) {
    operationalRiskToRevenue.push(`${workspace.stalledConversationCount} stalled conversations may impact pipeline velocity.`)
  }
  if (insights.objectionResolutionRate < 30 && insights.objectionResolutionRate > 0) {
    operationalRiskToRevenue.push("Low objection resolution rate — revenue at risk from unresolved blockers.")
  }
  if (workspace.highRiskCount >= 3) {
    operationalRiskToRevenue.push(`${workspace.highRiskCount} high-risk opportunities need operator review.`)
  }

  return {
    qaMarker: GROWTH_REVENUE_INTELLIGENCE_QA_MARKER,
    opportunityPipelineCount: pipelineCount ?? 0,
    hottestAccounts: workspace.items.filter((i) => i.momentumScore >= 65).slice(0, 10),
    momentumTrendSummary,
    objectionTrendRate: insights.objectionResolutionRate,
    meetingConversionRate: insights.meetingConversionRate,
    campaignEffectivenessScore: insights.campaignOpportunityConversion,
    senderEffectivenessScore: insights.senderEffectiveness,
    domainEffectivenessScore: insights.domainEffectiveness,
    operationalRiskToRevenue,
    campaignAttribution: {
      opportunitiesGenerated,
      demoRequests,
      pricingQuestions,
      positiveReplies,
    },
  }
}
