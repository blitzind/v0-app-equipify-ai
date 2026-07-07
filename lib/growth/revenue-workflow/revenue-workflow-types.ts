/** Client-safe Sprint 4 revenue workflow types. */

export const GROWTH_REVENUE_WORKFLOW_QA_MARKER = "growth-revenue-workflow-v4" as const

export const GROWTH_REVENUE_WORKFLOW_METADATA_KEY = "revenue_workflow_v4" as const

export const GROWTH_REVENUE_READINESS_TIERS = [
  "cold",
  "warming",
  "qualified",
  "sales_ready",
  "revenue_ready",
] as const
export type GrowthRevenueReadinessTier = (typeof GROWTH_REVENUE_READINESS_TIERS)[number]

export type GrowthRevenueReadinessSignal = {
  kind: string
  label: string
  points: number
}

export type GrowthRevenueReadinessRisk = {
  kind: string
  label: string
  severity: "low" | "medium" | "high"
}

export type GrowthRevenueReadinessSnapshot = {
  score: number
  tier: GrowthRevenueReadinessTier
  summary: string
  topPositiveSignals: GrowthRevenueReadinessSignal[]
  topRisks: GrowthRevenueReadinessRisk[]
  computedAt: string
  qaMarker: typeof GROWTH_REVENUE_WORKFLOW_QA_MARKER
}

export type GrowthRevenueReadinessInput = {
  relationshipStage: string | null
  engagementTrend: string | null
  memoryCoverageScore: number | null
  replyCount30d: number
  buyingSignalCount: number
  meetingIntentSignals: number
  pricingIntentSignals: number
  unresolvedObjectionCount: number
  commitmentCount: number
  connectedCallCount: number
  meetingActivityCount: number
  opportunityReadinessScore: number | null
  hasPositiveReply: boolean
  workflowHealth: string | null
}

export type GrowthOpportunityRecommendationScore = {
  opportunityScore: number
  confidence: number
  recommendedStage: string
  recommendedValueMin: number
  recommendedValueMax: number
  supportingEvidence: string[]
  confidenceLabel: "low" | "medium" | "high"
}

export type GrowthRevenueWorkflowCallPriorityBoost = {
  boostPoints: number
  priorityReason: string
  suggestedSortRank: number
}

export type GrowthRevenueWorkflowWorkspaceLead = {
  leadId: string
  companyName: string
  revenueReadinessScore: number
  revenueReadinessTier: GrowthRevenueReadinessTier
  callPriorityScore: number | null
  callPriorityTier: string | null
  opportunityRecommendationScore: number | null
  topBuyingSignals: string[]
  openObjections: string[]
  commitments: string[]
  riskFactors: string[]
  recommendedNextAction: string | null
  nextBestAction: string | null
}

export type GrowthRevenueWorkflowWorkspaceDashboard = {
  qaMarker: typeof GROWTH_REVENUE_WORKFLOW_QA_MARKER
  generatedAt: string
  leads: GrowthRevenueWorkflowWorkspaceLead[]
  pendingOpportunityRecommendations: number
  pendingWorkflowActions: number
  averageRevenueReadiness: number
}

export function revenueReadinessTierLabel(tier: GrowthRevenueReadinessTier): string {
  return tier.replace(/_/g, " ")
}

export function revenueReadinessTierFromScore(score: number): GrowthRevenueReadinessTier {
  if (score >= 80) return "revenue_ready"
  if (score >= 65) return "sales_ready"
  if (score >= 45) return "qualified"
  if (score >= 25) return "warming"
  return "cold"
}

export function readRevenueReadinessFromLeadMetadata(
  metadata: Record<string, unknown> | null | undefined,
): GrowthRevenueReadinessSnapshot | null {
  const raw = metadata?.[GROWTH_REVENUE_WORKFLOW_METADATA_KEY]
  if (!raw || typeof raw !== "object") return null
  const snapshot = raw as Partial<GrowthRevenueReadinessSnapshot>
  if (typeof snapshot.score !== "number" || !snapshot.tier) return null
  return {
    ...(snapshot as GrowthRevenueReadinessSnapshot),
    topPositiveSignals: Array.isArray(snapshot.topPositiveSignals) ? snapshot.topPositiveSignals : [],
    topRisks: Array.isArray(snapshot.topRisks) ? snapshot.topRisks : [],
  }
}
