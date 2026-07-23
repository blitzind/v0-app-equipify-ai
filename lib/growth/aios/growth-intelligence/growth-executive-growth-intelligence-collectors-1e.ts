/** AVA-GROWTH-OPERATOR-1E — Collectors mapping existing learning systems to executive recommendations. */

import {
  formatExecutiveConfidenceBand,
  formatExecutiveConfidenceLabel,
} from "@/lib/growth/aios/operator-experience/growth-executive-experience-1d"
import type { GrowthLearningInsight } from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"
import type { GrowthMetaRecommendation } from "@/lib/growth/aios/recommendations/growth-meta-recommender-types"
import type { MarketIntelligenceRecommendation } from "@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a-types"
import type { MarketIntelligenceSegmentMetrics } from "@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a-types"
import type { GrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthHomeSalesOutcomesPayload } from "@/lib/growth/specialists/execution/sales-outcome-types"
import type { GrowthOrganizationalEvidenceCompletenessSnapshot } from "@/lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b-types"
import type {
  GrowthExecutiveGrowthRecommendation,
  GrowthExecutiveRecommendationCategory,
  GrowthExecutiveRecommendationEvidence,
  GrowthExecutiveRecommendationSource,
} from "@/lib/growth/aios/growth-intelligence/growth-executive-growth-intelligence-types-1e"

function normalizeIndustryLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function buildRecommendation(input: {
  id: string
  category: GrowthExecutiveRecommendationCategory
  headline: string
  reason: string
  supportingEvidence: GrowthExecutiveRecommendationEvidence[]
  expectedImpact: string
  confidence: number
  confidenceReason: string
  sourceSystems: GrowthExecutiveRecommendationSource[]
  rank: number
}): GrowthExecutiveGrowthRecommendation {
  const band = formatExecutiveConfidenceBand(input.confidence)
  return {
    id: input.id,
    category: input.category,
    headline: input.headline,
    reason: input.reason,
    supportingEvidence: input.supportingEvidence,
    expectedImpact: input.expectedImpact,
    confidence: band,
    confidenceReason: input.confidenceReason,
    requiresOperatorApproval: true,
    recommendationOnly: true,
    sourceSystems: input.sourceSystems,
    rank: input.rank,
  }
}

function insightConfidence(insight: GrowthLearningInsight): number {
  if (insight.status !== "advisory") return 0.25
  return Math.max(0.35, Math.min(0.95, insight.confidence))
}

export function collectExecutiveRecommendationsFromClosedLoopInsights(input: {
  insights: GrowthLearningInsight[]
  startRank?: number
}): GrowthExecutiveGrowthRecommendation[] {
  const output: GrowthExecutiveGrowthRecommendation[] = []
  let rank = input.startRank ?? 1

  for (const insight of input.insights) {
    if (insight.status !== "advisory") continue

    const category: GrowthExecutiveRecommendationCategory =
      insight.insightType === "icp_fit"
        ? "icp"
        : insight.insightType === "channel_performance" || insight.insightType === "message_performance"
          ? "outreach"
          : insight.insightType === "research_quality"
            ? "research"
            : insight.insightType === "approval_friction"
              ? "automation"
              : insight.insightType === "objective_progress"
                ? "executive_planning"
                : insight.insightType === "outbound_risk"
                  ? "outreach"
                  : "organizational_learning"

    output.push(
      buildRecommendation({
        id: `closed-loop:${insight.id}`,
        category,
        headline: `I recommend we ${insight.recommendedAdjustment.replace(/_/g, " ")} based on ${insight.title.toLowerCase()}.`,
        reason: insight.summary,
        supportingEvidence: [
          {
            source: "closed_loop_learning",
            label: insight.title,
            value: insight.sampleSize,
          },
          ...insight.evidence.slice(0, 3).map((row) => ({
            source: "closed_loop_learning" as const,
            label: row.label,
            value: row.value ?? null,
          })),
        ],
        expectedImpact:
          insight.impact >= 0.35
            ? "Material improvement to conversion or efficiency if approved"
            : "Incremental improvement — monitor after approval",
        confidence: insightConfidence(insight),
        confidenceReason: `${formatExecutiveConfidenceLabel(insight.confidence)} from ${insight.sampleSize} observed outcomes`,
        sourceSystems: ["closed_loop_learning"],
        rank: rank++,
      }),
    )
  }

  return output
}

export function collectExecutiveRecommendationsFromMarketIntelligence(input: {
  recommendations: MarketIntelligenceRecommendation[]
  startRank?: number
}): GrowthExecutiveGrowthRecommendation[] {
  let rank = input.startRank ?? 1
  return input.recommendations.map((row) => {
    const industryLabel =
      Array.isArray(row.after) && typeof row.after[row.after.length - 1] === "string"
        ? String(row.after[row.after.length - 1])
        : row.kind.includes("remove")
          ? "underperforming segment"
          : "strong segment"

    const headline =
      row.kind === "remove_industry"
        ? `I recommend retiring ${industryLabel} from discovery.`
        : row.kind === "add_industry"
          ? `I recommend expanding into ${industryLabel}.`
          : `I recommend updating our ICP: ${row.reason}`

    return buildRecommendation({
      id: `market-intelligence:${row.id}`,
      category: "icp",
      headline,
      reason: row.reason,
      supportingEvidence: row.supportingEvidence.map((evidence) => ({
        source: "market_intelligence",
        label: evidence.label,
        value: evidence.referenceId,
      })),
      expectedImpact:
        row.expectedPortfolioImpactPercent != null
          ? `Estimated portfolio impact up to ${row.expectedPortfolioImpactPercent}%`
          : row.businessImpactEstimate ?? "Improved qualification efficiency",
      confidence: (row.confidence.confidencePercent ?? 50) / 100,
      confidenceReason: `${row.confidence.confidencePercent}% confidence from ${row.confidence.sampleSize} companies evaluated`,
      sourceSystems: ["market_intelligence"],
      rank: rank++,
    })
  })
}

export function collectExecutiveRecommendationsFromSegmentAnalytics(input: {
  segments: MarketIntelligenceSegmentMetrics[]
  startRank?: number
}): GrowthExecutiveGrowthRecommendation[] {
  const output: GrowthExecutiveGrowthRecommendation[] = []
  let rank = input.startRank ?? 1

  const industries = input.segments.filter((row) => row.dimension === "industry")
  const best = [...industries].sort(
    (left, right) => (right.qualificationRate ?? 0) - (left.qualificationRate ?? 0),
  )[0]
  const worst = [...industries]
    .filter((row) => row.researched >= 5)
    .sort((left, right) => (left.qualificationRate ?? 100) - (right.qualificationRate ?? 100))[0]

  if (best && worst && best.segmentKey !== worst.segmentKey) {
    const bestLabel = normalizeIndustryLabel(best.segmentKey)
    const worstLabel = normalizeIndustryLabel(worst.segmentKey)
    if ((best.qualificationRate ?? 0) - (worst.qualificationRate ?? 0) >= 15) {
      output.push(
        buildRecommendation({
          id: `segment:expand:${best.segmentKey}`,
          category: "discovery",
          headline: `I recommend expanding ${bestLabel} discovery.`,
          reason: `${bestLabel} is producing significantly stronger admission quality than ${worstLabel}.`,
          supportingEvidence: [
            { source: "market_intelligence", label: `${bestLabel} qualification rate`, value: best.qualificationRate },
            { source: "market_intelligence", label: `${worstLabel} qualification rate`, value: worst.qualificationRate },
            { source: "market_intelligence", label: "Companies evaluated", value: best.researched + worst.researched },
          ],
          expectedImpact: "Shift discovery budget toward higher-converting industries",
          confidence: best.researched >= 10 ? 0.72 : 0.55,
          confidenceReason:
            best.researched >= 10
              ? "Sufficient segment sample size across industries"
              : "Emerging pattern — I'd like your judgment before reallocating discovery",
          sourceSystems: ["market_intelligence"],
          rank: rank++,
        }),
      )
    }
  }

  for (const segment of industries) {
    if (segment.researched < 10) continue
    if ((segment.qualified ?? 0) > 0) continue
    const label = normalizeIndustryLabel(segment.segmentKey)
    output.push(
      buildRecommendation({
        id: `segment:retire:${segment.segmentKey}`,
        category: "discovery",
        headline: `I recommend retiring ${label} from discovery.`,
        reason: `${label} has produced zero qualified opportunities across ${segment.researched} evaluated companies.`,
        supportingEvidence: [
          { source: "market_intelligence", label: "Companies evaluated", value: segment.researched },
          { source: "market_intelligence", label: "Qualified opportunities", value: segment.qualified },
          { source: "market_intelligence", label: "Meetings", value: segment.meetings },
        ],
        expectedImpact: "Reduce research waste on consistently low-fit industries",
        confidence: segment.researched >= 20 ? 0.78 : 0.6,
        confidenceReason:
          segment.researched >= 20
            ? "Large sample with zero qualification signal"
            : "Pattern is visible but sample is still building",
        sourceSystems: ["market_intelligence"],
        rank: rank++,
      }),
    )
  }

  return output
}

export function collectExecutiveRecommendationsFromPortfolioHealth(input: {
  portfolio: GrowthPortfolioManagerSnapshot | null | undefined
  startRank?: number
}): GrowthExecutiveGrowthRecommendation[] {
  const portfolio = input.portfolio
  if (!portfolio) return []

  const output: GrowthExecutiveGrowthRecommendation[] = []
  let rank = input.startRank ?? 1
  const health = portfolio.health
  const counts = health.counts

  if (health.healthState === "critically_low" || health.healthState === "needs_replenishment") {
    output.push(
      buildRecommendation({
        id: "portfolio:replenish",
        category: "portfolio",
        headline: "I recommend prioritizing portfolio replenishment.",
        reason: `Portfolio health is ${health.healthState.replace(/_/g, " ")} — we need ${health.needsCount} more active companies.`,
        supportingEvidence: [
          { source: "portfolio_health", label: "Active companies", value: counts.activeCompanies },
          { source: "portfolio_health", label: "Target active companies", value: portfolio.target.targetActiveCompanies },
          { source: "portfolio_health", label: "Needs count", value: health.needsCount },
        ],
        expectedImpact: "Restore healthy pipeline coverage for sustained outreach",
        confidence: 0.82,
        confidenceReason: "Portfolio health read model is authoritative for replenishment decisions",
        sourceSystems: ["portfolio_health"],
        rank: rank++,
      }),
    )
  }

  if (counts.rejected >= 10) {
    const evaluated = counts.rejected + counts.activeCompanies + counts.archived + counts.invalid
    const rejectRate = Math.round((counts.rejected / Math.max(1, evaluated)) * 100)
    if (rejectRate >= 25) {
      output.push(
        buildRecommendation({
          id: "portfolio:qualification-tighten",
          category: "portfolio",
          headline: "I recommend tightening qualification rules.",
          reason: `I've rejected ${counts.rejected} companies automatically — ${rejectRate}% of evaluated volume may be research waste.`,
          supportingEvidence: [
            { source: "portfolio_health", label: "Rejected automatically", value: counts.rejected },
            { source: "portfolio_health", label: "Currently researching", value: counts.researching },
          ],
          expectedImpact: "Reduce research spend on low-fit companies",
          confidence: rejectRate >= 35 ? 0.7 : 0.55,
          confidenceReason:
            rejectRate >= 35
              ? "High automatic rejection rate across portfolio"
              : "Rejection rate is elevated — review before changing rules",
          sourceSystems: ["portfolio_health", "research"],
          rank: rank++,
        }),
      )
    }
  }

  if (health.researchRunning && counts.researching > portfolio.target.maximumConcurrentResearch) {
    output.push(
      buildRecommendation({
        id: "portfolio:research-cap",
        category: "research",
        headline: "I recommend reducing concurrent research depth.",
        reason: `I'm researching ${counts.researching} companies concurrently — above the healthy maximum of ${portfolio.target.maximumConcurrentResearch}.`,
        supportingEvidence: [
          { source: "portfolio_health", label: "Research in progress", value: counts.researching },
          { source: "portfolio_health", label: "Healthy maximum", value: portfolio.target.maximumConcurrentResearch },
        ],
        expectedImpact: "Lower research cost and operator review load per batch",
        confidence: 0.65,
        confidenceReason: "Research concurrency exceeds configured portfolio maximum",
        sourceSystems: ["portfolio_health", "resource_allocation"],
        rank: rank++,
      }),
    )
  }

  return output
}

export function collectExecutiveRecommendationsFromMetaRecommender(input: {
  recommendations: GrowthMetaRecommendation[]
  startRank?: number
}): GrowthExecutiveGrowthRecommendation[] {
  let rank = input.startRank ?? 1
  return input.recommendations
    .filter((row) => row.scope === "system" || row.scope === "objective" || row.scope === "campaign")
    .filter((row) => row.recommendationType === "optimize" || row.recommendationType === "monitor")
    .slice(0, 5)
    .map((row) =>
      buildRecommendation({
        id: `meta-recommender:${row.id}`,
        category: row.recommendationType === "optimize" ? "growth_strategy" : "executive_planning",
        headline: row.title.startsWith("I ") ? row.title : `I recommend: ${row.title}`,
        reason: row.summary,
        supportingEvidence: row.evidence.slice(0, 4).map((evidence) => ({
          source: "meta_recommender" as const,
          label: evidence.label,
          value: evidence.value ?? null,
        })),
        expectedImpact: `Priority score ${Math.round(row.score)} across portfolio signals`,
        confidence: row.confidence / 100,
        confidenceReason: "Synthesized from existing meta-recommender scoring — advisory only",
        sourceSystems: ["meta_recommender"],
        rank: rank++,
      }),
    )
}

export function collectExecutiveRecommendationsFromMissionDiscovery(input: {
  mission: GrowthHomeMissionDiscoverySnapshot | null | undefined
  startRank?: number
}): GrowthExecutiveGrowthRecommendation[] {
  const mission = input.mission
  if (!mission) return []

  const output: GrowthExecutiveGrowthRecommendation[] = []
  let rank = input.startRank ?? 1

  if (mission.pipelineLow) {
    output.push(
      buildRecommendation({
        id: "mission:discovery-budget",
        category: "budget",
        headline: "I recommend increasing discovery allocation.",
        reason: "Portfolio coverage is below target — discovery should take priority over net-new outreach expansion.",
        supportingEvidence: [
          { source: "mission_discovery", label: "Pipeline low", value: true },
          { source: "mission_discovery", label: "Lead pool visible", value: mission.leadPoolVisible },
        ],
        expectedImpact: "Replenish qualified pipeline before outreach volume stalls",
        confidence: 0.75,
        confidenceReason: "Mission discovery authority reports pipeline-low state",
        sourceSystems: ["mission_discovery", "portfolio_health"],
        rank: rank++,
      }),
    )
  }

  return output
}

export function collectExecutiveRecommendationsFromOrganizationalEvidence(input: {
  evidence: GrowthOrganizationalEvidenceCompletenessSnapshot | null | undefined
  startRank?: number
}): GrowthExecutiveGrowthRecommendation[] {
  const evidence = input.evidence
  if (!evidence) return []

  const gaps = evidence.completenessMatrix.filter(
    (row) => row.classification === "missing" || row.classification === "partial",
  )
  if (!gaps.length) return []

  const top = gaps.sort((left, right) => {
    const priorityWeight = { highest: 0, medium: 1, lower: 2 } as const
    return priorityWeight[left.priority] - priorityWeight[right.priority]
  })[0]

  return [
    buildRecommendation({
      id: `organizational-evidence:${top.measurementId}`,
      category: "organizational_learning",
      headline: `I recommend improving ${top.label.toLowerCase()} evidence.`,
      reason: top.why,
      supportingEvidence: [
        { source: "organizational_evidence", label: top.label, value: top.classification },
      ],
      expectedImpact: "Better recommendations with stronger evidence backing",
      confidence: top.priority === "highest" ? 0.68 : 0.55,
      confidenceReason: evidence.executiveConfidenceSummary || "Evidence completeness snapshot identifies a structural learning gap",
      sourceSystems: ["organizational_evidence"],
      rank: input.startRank ?? 1,
    }),
  ]
}

export function collectExecutiveRecommendationsFromSalesOutcomes(input: {
  salesOutcomes: GrowthHomeSalesOutcomesPayload | null | undefined
  startRank?: number
}): GrowthExecutiveGrowthRecommendation[] {
  const summary = input.salesOutcomes?.dailySummary
  if (!summary) return []

  const output: GrowthExecutiveGrowthRecommendation[] = []
  let rank = input.startRank ?? 1

  if (summary.approvals_pending >= 3 && summary.outreach_prepared >= 2) {
    output.push(
      buildRecommendation({
        id: "sales:approval-throughput",
        category: "automation",
        headline: "I recommend clearing the approval queue before adding research volume.",
        reason: `${summary.approvals_pending} packages are waiting for your approval while I've prepared ${summary.outreach_prepared} more today.`,
        supportingEvidence: [
          { source: "sales_outcomes", label: "Approvals waiting", value: summary.approvals_pending },
          { source: "sales_outcomes", label: "Outreach prepared today", value: summary.outreach_prepared },
        ],
        expectedImpact: "Convert prepared work into conversations instead of accumulating backlog",
        confidence: 0.68,
        confidenceReason: "Visible approval backlog with fresh prepared packages",
        sourceSystems: ["sales_outcomes"],
        rank: rank++,
      }),
    )
  }

  return output
}

export function collectAllExecutiveGrowthRecommendations(input: {
  closedLoopInsights?: GrowthLearningInsight[]
  marketIntelligenceRecommendations?: MarketIntelligenceRecommendation[]
  segmentMetrics?: MarketIntelligenceSegmentMetrics[]
  metaRecommender?: GrowthMetaRecommendation[]
  portfolio?: GrowthPortfolioManagerSnapshot | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  organizationalEvidence?: GrowthOrganizationalEvidenceCompletenessSnapshot | null
  salesOutcomes?: GrowthHomeSalesOutcomesPayload | null
}): GrowthExecutiveGrowthRecommendation[] {
  const merged = [
    ...collectExecutiveRecommendationsFromClosedLoopInsights({
      insights: input.closedLoopInsights ?? [],
    }),
    ...collectExecutiveRecommendationsFromMarketIntelligence({
      recommendations: input.marketIntelligenceRecommendations ?? [],
    }),
    ...collectExecutiveRecommendationsFromSegmentAnalytics({
      segments: input.segmentMetrics ?? [],
    }),
    ...collectExecutiveRecommendationsFromPortfolioHealth({
      portfolio: input.portfolio,
    }),
    ...collectExecutiveRecommendationsFromMetaRecommender({
      recommendations: input.metaRecommender ?? [],
    }),
    ...collectExecutiveRecommendationsFromMissionDiscovery({
      mission: input.missionDiscovery,
    }),
    ...collectExecutiveRecommendationsFromOrganizationalEvidence({
      evidence: input.organizationalEvidence,
    }),
    ...collectExecutiveRecommendationsFromSalesOutcomes({
      salesOutcomes: input.salesOutcomes,
    }),
  ]

  const seen = new Set<string>()
  const deduped: GrowthExecutiveGrowthRecommendation[] = []
  for (const row of merged.sort((left, right) => left.rank - right.rank)) {
    const key = row.headline.toLowerCase().slice(0, 80)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(row)
  }

  return deduped.map((row, index) => ({ ...row, rank: index + 1 }))
}
