/** AVA-GROWTH-OPERATOR-1E — Growth Executive Intelligence types (client-safe). */

import type { GrowthExecutiveConfidenceBand } from "@/lib/growth/aios/operator-experience/growth-executive-experience-1d"

export const GROWTH_AIOS_GROWTH_OPERATOR_1E_QA_MARKER =
  "ava-growth-operator-1e-growth-intelligence-v1" as const

export const GROWTH_EXECUTIVE_GROWTH_INTELLIGENCE_RULE =
  "presentation-only: synthesize existing learning systems into executive recommendations — no duplicate learning engine, no automatic mutation" as const

export const GROWTH_EXECUTIVE_RECOMMENDATION_CATEGORIES = [
  "icp",
  "discovery",
  "research",
  "outreach",
  "portfolio",
  "providers",
  "budget",
  "messaging",
  "automation",
  "growth_strategy",
  "executive_planning",
  "organizational_learning",
] as const

export type GrowthExecutiveRecommendationCategory =
  (typeof GROWTH_EXECUTIVE_RECOMMENDATION_CATEGORIES)[number]

export type GrowthExecutiveRecommendationSource =
  | "closed_loop_learning"
  | "market_intelligence"
  | "meta_recommender"
  | "portfolio_health"
  | "sales_outcomes"
  | "mission_discovery"
  | "organizational_evidence"
  | "resource_allocation"
  | "institutional_learning"

export type GrowthExecutiveRecommendationEvidence = {
  source: GrowthExecutiveRecommendationSource
  label: string
  value?: string | number | boolean | null
}

export type GrowthExecutiveGrowthRecommendation = {
  id: string
  category: GrowthExecutiveRecommendationCategory
  headline: string
  reason: string
  supportingEvidence: GrowthExecutiveRecommendationEvidence[]
  expectedImpact: string
  confidence: GrowthExecutiveConfidenceBand
  confidenceReason: string
  requiresOperatorApproval: true
  recommendationOnly: true
  sourceSystems: GrowthExecutiveRecommendationSource[]
  rank: number
}

export type GrowthExecutiveGrowthReportSection = {
  id: string
  title: string
  paragraphs: string[]
}

export type GrowthExecutiveGrowthReport = {
  qaMarker: typeof GROWTH_AIOS_GROWTH_OPERATOR_1E_QA_MARKER
  generatedAt: string
  title: "Executive Growth Report"
  subtitle: "How I'm improving our growth organization"
  whatImproved: string[]
  whatDeclined: string[]
  whatsWastingResources: string[]
  whatWeShouldChange: string[]
  opportunitiesDiscovered: string[]
  whereToFocusNext: string[]
  decisionsRequiringApproval: string[]
  sections: GrowthExecutiveGrowthReportSection[]
  topRecommendations: GrowthExecutiveGrowthRecommendation[]
}

export type GrowthExecutiveGrowthIntelligenceReadModel = {
  qaMarker: typeof GROWTH_AIOS_GROWTH_OPERATOR_1E_QA_MARKER
  governanceRule: typeof GROWTH_EXECUTIVE_GROWTH_INTELLIGENCE_RULE
  generatedAt: string
  recommendations: GrowthExecutiveGrowthRecommendation[]
  report: GrowthExecutiveGrowthReport
  sourceSummary: Record<GrowthExecutiveRecommendationSource, number>
}
