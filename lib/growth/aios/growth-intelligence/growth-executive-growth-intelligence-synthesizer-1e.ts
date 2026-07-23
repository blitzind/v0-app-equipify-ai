/** AVA-GROWTH-OPERATOR-1E — Growth Executive Intelligence synthesizer + report (client-safe). */

import {
  GROWTH_AIOS_GROWTH_OPERATOR_1E_QA_MARKER,
  GROWTH_EXECUTIVE_GROWTH_INTELLIGENCE_RULE,
  type GrowthExecutiveGrowthIntelligenceReadModel,
  type GrowthExecutiveGrowthRecommendation,
  type GrowthExecutiveGrowthReport,
  type GrowthExecutiveGrowthReportSection,
  type GrowthExecutiveRecommendationSource,
} from "@/lib/growth/aios/growth-intelligence/growth-executive-growth-intelligence-types-1e"
import { collectAllExecutiveGrowthRecommendations } from "@/lib/growth/aios/growth-intelligence/growth-executive-growth-intelligence-collectors-1e"
import type { GrowthLearningInsight } from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"
import type { GrowthMetaRecommendation } from "@/lib/growth/aios/recommendations/growth-meta-recommender-types"
import type { MarketIntelligenceRecommendation, MarketIntelligenceSegmentMetrics } from "@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a-types"
import type { GrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthHomeSalesOutcomesPayload } from "@/lib/growth/specialists/execution/sales-outcome-types"
import type { GrowthOrganizationalEvidenceCompletenessSnapshot } from "@/lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b-types"

const REPORT_TOP_N = 5

function countSources(recommendations: GrowthExecutiveGrowthRecommendation[]): Record<GrowthExecutiveRecommendationSource, number> {
  const counts: Record<GrowthExecutiveRecommendationSource, number> = {
    closed_loop_learning: 0,
    market_intelligence: 0,
    meta_recommender: 0,
    portfolio_health: 0,
    sales_outcomes: 0,
    mission_discovery: 0,
    organizational_evidence: 0,
    resource_allocation: 0,
    institutional_learning: 0,
  }

  for (const row of recommendations) {
    for (const source of row.sourceSystems) {
      counts[source] += 1
    }
  }
  return counts
}

function buildReportSections(input: {
  recommendations: GrowthExecutiveGrowthRecommendation[]
  salesOutcomes: GrowthHomeSalesOutcomesPayload | null | undefined
  portfolio: GrowthPortfolioManagerSnapshot | null | undefined
  closedLoopInsights: GrowthLearningInsight[]
}): GrowthExecutiveGrowthReportSection[] {
  const sections: GrowthExecutiveGrowthReportSection[] = []
  const summary = input.salesOutcomes?.dailySummary

  if (summary) {
    const improved: string[] = []
    if (summary.researched > 0) improved.push(`I researched ${summary.researched} companies.`)
    if (summary.outreach_prepared > 0) improved.push(`I prepared ${summary.outreach_prepared} outreach packages.`)
    if (summary.strong_opportunities > 0) {
      improved.push(`I identified ${summary.strong_opportunities} strong opportunities.`)
    }
    if (improved.length) {
      sections.push({
        id: "accomplishments",
        title: "What I accomplished",
        paragraphs: improved,
      })
    }
  }

  const icpRecs = input.recommendations.filter((row) => row.category === "icp").slice(0, 3)
  if (icpRecs.length) {
    sections.push({
      id: "icp-intelligence",
      title: "ICP intelligence",
      paragraphs: icpRecs.map((row) => row.headline),
    })
  }

  const discoveryRecs = input.recommendations.filter((row) => row.category === "discovery").slice(0, 3)
  if (discoveryRecs.length) {
    sections.push({
      id: "discovery-intelligence",
      title: "Discovery intelligence",
      paragraphs: discoveryRecs.map((row) => row.headline),
    })
  }

  const outreachRecs = input.recommendations.filter((row) => row.category === "outreach").slice(0, 3)
  if (outreachRecs.length) {
    sections.push({
      id: "outreach-intelligence",
      title: "Outreach intelligence",
      paragraphs: outreachRecs.map((row) => `${row.headline} ${row.reason}`),
    })
  }

  const portfolio = input.portfolio
  if (portfolio && portfolio.health.healthState !== "healthy") {
    sections.push({
      id: "portfolio-health",
      title: "Portfolio health",
      paragraphs: [
        `Portfolio state: ${portfolio.health.healthState.replace(/_/g, " ")}.`,
        `Active companies: ${portfolio.health.counts.activeCompanies} of ${portfolio.target.targetActiveCompanies} target.`,
      ],
    })
  }

  const advisoryInsights = input.closedLoopInsights.filter((row) => row.status === "advisory")
  if (advisoryInsights.length) {
    sections.push({
      id: "organizational-learning",
      title: "What I'm learning",
      paragraphs: advisoryInsights.slice(0, 4).map((row) => row.summary),
    })
  }

  return sections
}

export function buildGrowthExecutiveGrowthReport(input: {
  generatedAt: string
  recommendations: GrowthExecutiveGrowthRecommendation[]
  salesOutcomes?: GrowthHomeSalesOutcomesPayload | null
  portfolio?: GrowthPortfolioManagerSnapshot | null
  closedLoopInsights?: GrowthLearningInsight[]
}): GrowthExecutiveGrowthReport {
  const top = input.recommendations.slice(0, REPORT_TOP_N)
  const summary = input.salesOutcomes?.dailySummary
  const portfolio = input.portfolio ?? null
  const insights = input.closedLoopInsights ?? []

  const whatImproved: string[] = []
  if (summary?.researched) whatImproved.push(`Researched ${summary.researched} companies`)
  if (summary?.outreach_prepared) whatImproved.push(`Prepared ${summary.outreach_prepared} outreach packages`)
  if (summary?.meetings_prepared) whatImproved.push(`Prepared ${summary.meetings_prepared} meetings`)
  if (portfolio?.health.healthState === "healthy") {
    whatImproved.push("Portfolio coverage is healthy")
  }

  const whatDeclined: string[] = []
  if (portfolio && portfolio.health.healthState !== "healthy") {
    whatDeclined.push(`Portfolio health: ${portfolio.health.healthState.replace(/_/g, " ")}`)
  }
  if (summary && summary.approvals_pending >= 3) {
    whatDeclined.push(`${summary.approvals_pending} approvals waiting — execution throughput is slowing`)
  }

  const whatsWastingResources = input.recommendations
    .filter((row) => row.category === "discovery" || row.category === "research" || row.category === "portfolio")
    .map((row) => row.reason)
    .slice(0, 4)

  const whatWeShouldChange = top.map((row) => row.headline)
  const opportunitiesDiscovered = input.recommendations
    .filter((row) => row.category === "icp" || row.category === "discovery")
    .map((row) => row.expectedImpact)
    .slice(0, 4)

  const whereToFocusNext =
    top.length > 0
      ? top.slice(0, 3).map((row) => row.headline)
      : ["Continue current objective and monitor portfolio health"]

  const decisionsRequiringApproval = top.map(
    (row) => `${row.headline} (${row.confidence} confidence — requires your approval)`,
  )

  return {
    qaMarker: GROWTH_AIOS_GROWTH_OPERATOR_1E_QA_MARKER,
    generatedAt: input.generatedAt,
    title: "Executive Growth Report",
    subtitle: "How I'm improving our growth organization",
    whatImproved,
    whatDeclined,
    whatsWastingResources,
    whatWeShouldChange,
    opportunitiesDiscovered,
    whereToFocusNext,
    decisionsRequiringApproval,
    sections: buildReportSections({
      recommendations: input.recommendations,
      salesOutcomes: input.salesOutcomes,
      portfolio,
      closedLoopInsights: insights,
    }),
    topRecommendations: top,
  }
}

export function synthesizeGrowthExecutiveGrowthIntelligence(input: {
  generatedAt: string
  closedLoopInsights?: GrowthLearningInsight[]
  marketIntelligenceRecommendations?: MarketIntelligenceRecommendation[]
  segmentMetrics?: MarketIntelligenceSegmentMetrics[]
  metaRecommender?: GrowthMetaRecommendation[]
  portfolio?: GrowthPortfolioManagerSnapshot | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  organizationalEvidence?: GrowthOrganizationalEvidenceCompletenessSnapshot | null
  salesOutcomes?: GrowthHomeSalesOutcomesPayload | null
}): GrowthExecutiveGrowthIntelligenceReadModel {
  const recommendations = collectAllExecutiveGrowthRecommendations(input)
  const report = buildGrowthExecutiveGrowthReport({
    generatedAt: input.generatedAt,
    recommendations,
    salesOutcomes: input.salesOutcomes,
    portfolio: input.portfolio,
    closedLoopInsights: input.closedLoopInsights,
  })

  return {
    qaMarker: GROWTH_AIOS_GROWTH_OPERATOR_1E_QA_MARKER,
    governanceRule: GROWTH_EXECUTIVE_GROWTH_INTELLIGENCE_RULE,
    generatedAt: input.generatedAt,
    recommendations,
    report,
    sourceSummary: countSources(recommendations),
  }
}

export function mergeGrowthIntelligenceIntoStrategicRecommendations(input: {
  intelligence: GrowthExecutiveGrowthIntelligenceReadModel
  limit?: number
}): GrowthExecutiveGrowthRecommendation[] {
  return input.intelligence.recommendations.slice(0, input.limit ?? 3)
}
