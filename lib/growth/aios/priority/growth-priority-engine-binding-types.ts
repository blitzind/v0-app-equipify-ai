/** GE-AI-2E — Priority Engine Binding types (client-safe). */

export const GROWTH_AIOS_GE_AI_2E_PHASE = "GE-AI-2E" as const

export const GROWTH_PRIORITY_ENGINE_BINDING_QA_MARKER = "growth-ge-ai-2e-priority-engine-binding-v1" as const

export const GROWTH_PRIORITY_ENGINE_BINDING_RULE =
  "Priority Engine Binding is read-only projection — it connects 4F mission priority, Meta-Recommender, and Growth Objectives without executing workflows, activating schedulers, sending outbound, mutating Core records, or bypassing Growth Autonomy." as const

export const GROWTH_PRIORITY_ENGINE_BINDING_RANKING_FORMULA =
  "primary = mission_priority.overallPriority (4F); secondary = meta_recommendation.score; tie-break = priorityRank asc then id asc" as const

export const GROWTH_PRIORITY_BINDING_STATUSES = [
  "ready",
  "blocked",
  "needs_approval",
  "needs_review",
  "starved",
  "waiting",
] as const

export type GrowthPriorityBindingStatus = (typeof GROWTH_PRIORITY_BINDING_STATUSES)[number]

export const GROWTH_PRIORITY_RECOMMENDED_NEXT_STEPS = [
  "run_research",
  "run_qualification",
  "run_planning",
  "review_execution_plan",
  "prepare_outreach",
  "approve_outreach",
  "prepare_meeting",
  "monitor",
  "pause",
] as const

export type GrowthPriorityRecommendedNextStep = (typeof GROWTH_PRIORITY_RECOMMENDED_NEXT_STEPS)[number]

export const GROWTH_PRIORITY_WORKFLOW_AGENTS = [
  "research",
  "qualification",
  "planning",
  "execution",
  "outreach_preparation",
  "meeting_preparation",
  "revenue_operator",
  "none",
] as const

export type GrowthPriorityWorkflowAgent = (typeof GROWTH_PRIORITY_WORKFLOW_AGENTS)[number]

export type GrowthPriorityBindingBlocker = {
  type: "policy" | "approval" | "data" | "budget" | "starvation" | "auth" | "runtime"
  label: string
  severity: "low" | "medium" | "high"
}

export type GrowthPriorityBindingEvidence = {
  source: string
  label: string
  value?: string | number | boolean
  confidence?: number
}

export type GrowthPriorityBinding = {
  id: string
  organizationId: string
  objectiveId?: string
  missionId?: string
  leadId?: string
  sourceRecommendationId?: string
  priorityRank: number
  priorityScore: number
  status: GrowthPriorityBindingStatus
  recommendedNextStep: GrowthPriorityRecommendedNextStep
  workflowAgent: GrowthPriorityWorkflowAgent
  title: string
  summary: string
  evidence: GrowthPriorityBindingEvidence[]
  blockers: GrowthPriorityBindingBlocker[]
  route?: string
  createdAt: string
}

export type GrowthPriorityBindingObjectiveContext = {
  objectiveId: string
  title: string
  status: string
  running: boolean
  topBinding: GrowthPriorityBinding | null
  bindings: GrowthPriorityBinding[]
}

export type GrowthPriorityEngineRevenueOperatorBinding = {
  readOnly: true
  summary: string
  topBindingIds: string[]
  alignedOrchestrationIds: string[]
}

export type GrowthPriorityEngineOrchestrationBinding = {
  bindingId: string | null
  priorityRank: number | null
  priorityScore: number | null
  status: GrowthPriorityBindingStatus | null
  recommendedNextStep: GrowthPriorityRecommendedNextStep | null
}

export type GrowthPriorityEngineBindingReadModel = {
  readOnly: true
  qaMarker: typeof GROWTH_PRIORITY_ENGINE_BINDING_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_PRIORITY_ENGINE_BINDING_RULE
  rankingFormula: typeof GROWTH_PRIORITY_ENGINE_BINDING_RANKING_FORMULA
  topBindings: GrowthPriorityBinding[]
  bindings: GrowthPriorityBinding[]
  objectiveContexts: GrowthPriorityBindingObjectiveContext[]
  sourcesIncluded: string[]
  sourcesFailed: Array<{ source: string; message: string }>
  summary: {
    total: number
    starved: number
    needsApproval: number
    blocked: number
    byStatus: Partial<Record<GrowthPriorityBindingStatus, number>>
  }
  revenueOperatorBinding: GrowthPriorityEngineRevenueOperatorBinding
}
