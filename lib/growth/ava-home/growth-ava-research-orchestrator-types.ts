/** GE-AIOS-6B — Ava Research Orchestrator types (client-safe). */

export const GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER = "ge-aios-6b-ava-research-orchestrator-v1" as const

export const GROWTH_AVA_RESEARCH_LOOP_COMPLETED_EVENT = "growth.ava.research_loop.completed" as const

export const GROWTH_AVA_RESEARCH_QUEUE_DEFAULT_MAX_LEADS = 5 as const

export const GROWTH_AVA_RESEARCH_QUEUE_OPERATOR_LABEL = "Research Top Revenue Queue Leads" as const

export const GROWTH_AVA_RESEARCH_QUEUE_API_PATH = "/api/platform/growth/ava/research-queue" as const

export const GROWTH_AVA_RESEARCH_QUEUE_SECTIONS = ["high_priority", "needs_review"] as const

export type GrowthAvaResearchLoopLeadOutcome = "completed" | "skipped" | "failed"

/** GE-AIOS-6D — Qualification specialist outcome for orchestrator transparency. */
export type GrowthAvaQualificationOrchestratorStatus = "completed" | "skipped" | "blocked" | "failed"

export const GROWTH_AVA_QUALIFICATION_WAITING_MESSAGE =
  "Qualification is waiting for approval or policy enablement." as const

export type GrowthAvaResearchLoopLeadResult = {
  leadId: string
  companyName: string | null
  outcome: GrowthAvaResearchLoopLeadOutcome
  skipReason?: string | null
  researchRunId?: string | null
  workflowStatus?: string | null
  qualificationStatus?: GrowthAvaQualificationOrchestratorStatus | null
  qualificationSkipReason?: string | null
  qualificationPolicyGate?: string | null
  hasBuyingSignals?: boolean
  readyForOutreachReview?: boolean
}

export type GrowthAvaResearchLoopSummary = {
  qaMarker: typeof GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER
  runId: string
  completedAt: string
  companiesReviewed: number
  researchCompleted: number
  buyingSignalsVerified: number
  readyForOutreachReview: number
  qualificationCompleted: number
  qualificationSkipped: number
  qualificationFailed: number
  narrative: string
  leadResults: GrowthAvaResearchLoopLeadResult[]
  transportBlocked: true
  humanApprovalRequired: true
  outboundOccurred: false
}

export type GrowthAvaResearchQueueRunResult = {
  ok: boolean
  qaMarker: typeof GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER
  summary: GrowthAvaResearchLoopSummary | null
  blocked?: boolean
  blockReason?: string | null
  transportBlocked: true
  humanApprovalRequired: true
  outboundOccurred: false
}
