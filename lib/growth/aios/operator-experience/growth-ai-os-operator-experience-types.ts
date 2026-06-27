/** GE-AI-UX-1A / GE-AI-UX-2A / GE-AI-UX-3A — Operator-first AI Operations experience (client-safe). */

export const GROWTH_AIOS_GE_AI_UX_1A_PHASE = "GE-AI-UX-1A" as const

export const GROWTH_AI_OS_OPERATOR_EXPERIENCE_QA_MARKER =
  "growth-ge-ai-ux-3a-teammate-operator-experience-v1" as const

export const GROWTH_AI_OS_OPERATOR_EXPERIENCE_RULE =
  "Operator experience is presentation-only — it synthesizes existing Command Center read models without changing APIs, runtime, repositories, or autonomous behavior." as const

export type GrowthAiOsOperatorImpactLevel = "high" | "medium" | "low"

export type GrowthAiOsOperatorHealthTone = "healthy" | "attention" | "critical"

export type GrowthAiOsOperatorExecutiveBrief = {
  greeting: string
  teammateName: string
  teammateRole: string
  introLine: string
  aiHealthPercent: number
  aiHealthTone: GrowthAiOsOperatorHealthTone
  aiHealthLabel: string
  todayHighlights: string[]
  criticalIssueCount: number
  primaryCtaLabel: string
  primaryCtaHref: string
}

export type GrowthAiOsOperatorAttentionCard = {
  id: string
  headline: string
  summary: string
  estimatedImpact: string
  ctaLabel: string
  ctaHref: string
  impactScore: number
}

export type GrowthAiOsOperatorWorkingItem = {
  id: string
  label: string
  count: number | null
}

export type GrowthAiOsOperatorBusinessMetric = {
  id: string
  label: string
  value: string
  trendLabel: string | null
}

export type GrowthAiOsOperatorTimelineItem = {
  id: string
  timeLabel: string
  occurredAt: string
  headline: string
  rawTitle: string | null
  href: string | null
}

export type GrowthAiOsOperatorSystemStatus = {
  tone: GrowthAiOsOperatorHealthTone
  headline: string
  detail: string | null
}

export type GrowthAiOsOperatorRevenueRecommendation = {
  id: string
  headline: string
  reasons: string[]
  estimatedValue: string | null
  reviewHref: string | null
  dismissible: true
  workflowRequestId: string | null
}

export type GrowthAiOsOperatorApprovalSummary = {
  totalPending: number
  groups: Array<{ id: string; label: string; count: number }>
  approvalCenterHref: string
  canApproveAllEligible: false
}

export type GrowthAiOsOperatorOutreachRecommendation = {
  primaryChannel: string
  secondaryChannel: string | null
  reason: string
  draftHref: string | null
  evidenceAvailable: boolean
}

export type GrowthAiOsOperatorAiImprovement = {
  id: string
  headline: string
  detail: string
  reviewHref: string | null
}

export type GrowthAiOsOperatorExperienceViewModel = {
  readOnly: true
  qaMarker: typeof GROWTH_AI_OS_OPERATOR_EXPERIENCE_QA_MARKER
  generatedAt: string
  executiveBrief: GrowthAiOsOperatorExecutiveBrief
  needsAttention: GrowthAiOsOperatorAttentionCard[]
  aiWorking: GrowthAiOsOperatorWorkingItem[]
  businessSnapshot: GrowthAiOsOperatorBusinessMetric[]
  timeline: GrowthAiOsOperatorTimelineItem[]
  systemStatus: GrowthAiOsOperatorSystemStatus
  revenueRecommendation: GrowthAiOsOperatorRevenueRecommendation | null
  approvalSummary: GrowthAiOsOperatorApprovalSummary | null
  outreachRecommendation: GrowthAiOsOperatorOutreachRecommendation | null
  aiImprovements: GrowthAiOsOperatorAiImprovement[]
}
