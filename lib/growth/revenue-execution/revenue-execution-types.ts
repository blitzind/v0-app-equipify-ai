/** Client-safe Sprint 5 — Revenue Execution & Pipeline Advancement types. */

export const GROWTH_REVENUE_EXECUTION_QA_MARKER = "growth-revenue-execution-v5" as const

export const GROWTH_REVENUE_EXECUTION_PLAN_METADATA_KEY = "revenue_execution_plan_v5" as const
export const GROWTH_REVENUE_EXECUTION_TIMELINE_METADATA_KEY = "revenue_execution_timeline_v5" as const
export const GROWTH_REVENUE_PLAYBOOK_SUGGESTION_METADATA_KEY = "revenue_playbook_suggestion_v5" as const

export const GROWTH_REVENUE_PLAYBOOK_KEYS = [
  "meeting_requested",
  "pricing_requested",
  "proposal_requested",
  "objection_recovery",
  "re_engagement",
  "competitive_threat",
  "expansion_opportunity",
] as const
export type GrowthRevenuePlaybookKey = (typeof GROWTH_REVENUE_PLAYBOOK_KEYS)[number]

export const GROWTH_REVENUE_COMMAND_CENTER_VIEWS = [
  "revenue_ready",
  "high_confidence_opportunities",
  "stalled_opportunities",
  "objection_heavy",
  "re_engagement",
  "competitive_risk",
] as const
export type GrowthRevenueCommandCenterView = (typeof GROWTH_REVENUE_COMMAND_CENTER_VIEWS)[number]

export const GROWTH_OPPORTUNITY_REVIEW_ACTIONS = [
  "accept",
  "reject",
  "snooze",
  "request_research",
] as const
export type GrowthOpportunityReviewAction = (typeof GROWTH_OPPORTUNITY_REVIEW_ACTIONS)[number]

export type GrowthRevenuePlaybookAction = {
  kind: string
  label: string
  description: string
}

export type GrowthRevenuePlaybook = {
  key: GrowthRevenuePlaybookKey
  title: string
  summary: string
  recommendedActions: GrowthRevenuePlaybookAction[]
  recommendedMessaging: string[]
  recommendedNextStep: string
  successCriteria: string[]
  qaMarker: typeof GROWTH_REVENUE_EXECUTION_QA_MARKER
}

export type GrowthSalesExecutionPlanStep = {
  id: string
  order: number
  title: string
  description: string
  suggestedChannel: "call" | "email" | "meeting" | "crm" | "research" | "other"
  completed: boolean
  operatorNotes: string | null
}

export type GrowthSalesExecutionPlan = {
  qaMarker: typeof GROWTH_REVENUE_EXECUTION_QA_MARKER
  leadId: string
  generatedAt: string
  updatedAt: string
  summary: string
  steps: GrowthSalesExecutionPlanStep[]
  editable: true
  requiresHumanApproval: true
}

export type GrowthRevenueForecastEvidence = {
  qaMarker: typeof GROWTH_REVENUE_EXECUTION_QA_MARKER
  leadId: string
  forecastScore: number | null
  forecastTier: string | null
  revenueReadinessScore: number | null
  revenueReadinessTier: string | null
  opportunityRecommendationScore: number | null
  opportunityConfidence: number | null
  buyingSignals: string[]
  commitments: string[]
  objections: string[]
  memoryCoverageScore: number | null
  relationshipStage: string | null
  engagementTrend: string | null
  summary: string
}

export type GrowthRevenueTimelineEntry = {
  id: string
  occurredAt: string
  category:
    | "reply"
    | "call"
    | "meeting"
    | "opportunity_recommendation"
    | "revenue_readiness"
    | "playbook"
    | "execution_plan"
    | "review_action"
    | "other"
  title: string
  summary: string
  metadata?: Record<string, unknown>
}

export type GrowthBuyingSignalEvidence = {
  signalType: string
  evidenceSnippet: string
  confidence: string | null
  source: string | null
  supportingContext: string | null
}

export type GrowthOpportunityReviewContext = {
  qaMarker: typeof GROWTH_REVENUE_EXECUTION_QA_MARKER
  recommendation: import("@/lib/growth/opportunity-intelligence/opportunity-types").GrowthOpportunityRecommendation
  revenueReadiness: import("@/lib/growth/revenue-workflow/revenue-workflow-types").GrowthRevenueReadinessSnapshot | null
  playbook: GrowthRevenuePlaybook | null
  executionPlan: GrowthSalesExecutionPlan | null
  buyingSignals: GrowthBuyingSignalEvidence[]
  commitments: string[]
  objections: string[]
  relationshipStage: string | null
  engagementTrend: string | null
}

export type GrowthRevenueCommandCenterLead = {
  leadId: string
  companyName: string
  view: GrowthRevenueCommandCenterView
  revenueReadinessScore: number
  revenueReadinessTier: string
  opportunityScore: number | null
  opportunityConfidence: number | null
  callPriorityScore: number | null
  nextBestAction: string | null
  primaryReason: string
  pendingRecommendationId: string | null
}

export type GrowthRevenueCommandCenterDashboard = {
  qaMarker: typeof GROWTH_REVENUE_EXECUTION_QA_MARKER
  generatedAt: string
  view: GrowthRevenueCommandCenterView | "all"
  sections: Record<GrowthRevenueCommandCenterView, GrowthRevenueCommandCenterLead[]>
  totalActionable: number
}

export function revenuePlaybookLabel(key: GrowthRevenuePlaybookKey): string {
  return key.replace(/_/g, " ")
}
