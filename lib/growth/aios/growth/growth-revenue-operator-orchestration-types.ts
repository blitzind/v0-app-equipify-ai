/** GE-AIOS-GROWTH-4B — Revenue Operator orchestration types (client-safe). */

import type { GrowthLeadResearchCanonicalWorkflowType } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { GrowthLeadResearchExecutionPlanApprovalStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import type { GrowthLeadResearchApprovedPlanReadinessState } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-types"
import type { GrowthLeadResearchExecutionPreflightStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-preflight-types"
import type { GrowthLeadResearchExecutionDryRunStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-types"
import type { GrowthLeadResearchExecutionState } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"
import type {
  GrowthAgentKind,
  GrowthAgentRequiredGate,
} from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { GrowthMetaRecommenderRevenueOperatorBinding } from "@/lib/growth/aios/recommendations/growth-meta-recommender-types"
import type { GrowthPriorityEngineRevenueOperatorBinding } from "@/lib/growth/aios/priority/growth-priority-engine-binding-types"
import type { GrowthAiOsRevenueOperatorPolicyAwareness } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"

export const GROWTH_AIOS_GROWTH_4B_PHASE = "GE-AIOS-GROWTH-4B" as const

export const GROWTH_REVENUE_OPERATOR_ORCHESTRATION_QA_MARKER =
  "growth-aios-growth-4b-revenue-operator-orchestration-v1" as const

export const GROWTH_REVENUE_OPERATOR_ORCHESTRATION_RULE =
  "Revenue Operator orchestration supervises agent handoffs and monitors gates — it evaluates system state and assigns agent ownership without executing agents, runtime, outbound, providers, Work Orders, or Core mutations. Per-opportunity next action defers to Canonical Decision Engine 1A when bound (AVA-GROWTH-OPERATOR-1B)." as const

export const REVENUE_OPERATOR_LIFECYCLE_STAGES = [
  "research",
  "qualification",
  "planning",
  "approved_ready",
  "execution",
  "meeting",
  "outreach_blocked",
  "closed",
  "blocked",
] as const

export type RevenueOperatorLifecycleStage = (typeof REVENUE_OPERATOR_LIFECYCLE_STAGES)[number]

export const REVENUE_OPERATOR_ORCHESTRATION_DECISIONS = [
  "continue_current_agent",
  "handoff_to_research",
  "handoff_to_qualification",
  "handoff_to_planning",
  "handoff_to_execution",
  "handoff_to_meeting",
  "human_review_required",
  "blocked",
] as const

export type RevenueOperatorOrchestrationDecision =
  (typeof REVENUE_OPERATOR_ORCHESTRATION_DECISIONS)[number]

export const REVENUE_OPERATOR_ESCALATION_LEVELS = [
  "none",
  "low",
  "medium",
  "high",
  "critical",
] as const

export type RevenueOperatorEscalationLevel = (typeof REVENUE_OPERATOR_ESCALATION_LEVELS)[number]

export type RevenueOperatorPlanStateInput = {
  leadId: string
  companyId?: string | null
  companyName?: string | null
  planId?: string | null
  workflowType: GrowthLeadResearchCanonicalWorkflowType
  approvalStatus: GrowthLeadResearchExecutionPlanApprovalStatus
  readinessState?: GrowthLeadResearchApprovedPlanReadinessState | null
  preflightStatus?: GrowthLeadResearchExecutionPreflightStatus | null
  pilotEligible?: boolean
  pilotBlockedReasons?: string[]
  runtimeState?: GrowthLeadResearchExecutionState | null
  latestDryRunStatus?: GrowthLeadResearchExecutionDryRunStatus | null
  confidence?: number | null
  generatedAt?: string
}

export type RevenueOperatorAgentHandoffContract = {
  handoffId: string
  sourceAgent: GrowthAgentKind
  destinationAgent: GrowthAgentKind
  reason: string
  requiredContext: string[]
  requiredGates: GrowthAgentRequiredGate[]
  expectedOutputs: string[]
  readOnly: true
}

export type RevenueOperatorOrchestrationRecord = {
  orchestrationId: string
  evaluationTimestamp: string
  leadId: string
  companyId: string | null
  companyName: string | null
  currentLifecycleStage: RevenueOperatorLifecycleStage
  owningAgent: GrowthAgentKind
  candidateAgents: GrowthAgentKind[]
  orchestrationDecision: RevenueOperatorOrchestrationDecision
  recommendedNextAgent: GrowthAgentKind
  confidence: number
  reasoning: string
  requiredGates: GrowthAgentRequiredGate[]
  blockedReasons: string[]
  escalationLevel: RevenueOperatorEscalationLevel
  recommendedNextAction: string
  handoffPreview: RevenueOperatorAgentHandoffContract | null
  /** Policy engine block keys when recommended agent is policy-blocked (GE-AIOS-CONSOLIDATION-1E). */
  policyEvaluationKeys?: string[]
  policyBlockReasons?: string[]
  /** GE-AI-2E — read-only priority binding projection for this lead. */
  priorityBinding?: {
    bindingId: string | null
    priorityRank: number | null
    priorityScore: number | null
    status: string | null
    recommendedNextStep: string | null
  }
  /** AVA-GROWTH-OPERATOR-1B — canonical decision authority deferral. */
  canonicalAuthorityBinding?: import("@/lib/growth/aios/authority/growth-canonical-opportunity-authority-types-1b").GrowthCanonicalAuthorityBinding
}

export type RevenueOperatorOrchestrationPlanContext = {
  currentOwner: GrowthAgentKind
  nextOwner: GrowthAgentKind
  handoffSummary: string | null
  orchestrationReasoning: string
  orchestrationDecision: RevenueOperatorOrchestrationDecision
  escalationLevel: RevenueOperatorEscalationLevel
  blockedReasons: string[]
}

export type RevenueOperatorReadModel = {
  qaMarker: typeof GROWTH_REVENUE_OPERATOR_ORCHESTRATION_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_REVENUE_OPERATOR_ORCHESTRATION_RULE
  supervisorAgent: GrowthAgentKind
  schedulerActive: false
  summary: {
    leadsEvaluated: number
    humanReviewRequired: number
    blocked: number
    executionReady: number
  }
  orchestrations: RevenueOperatorOrchestrationRecord[]
  metaRecommenderBinding?: GrowthMetaRecommenderRevenueOperatorBinding
  priorityEngineBinding?: GrowthPriorityEngineRevenueOperatorBinding
  autonomyPolicyAwareness?: GrowthAiOsRevenueOperatorPolicyAwareness
  autonomyPolicySource?: string
}

export type RevenueOperatorOrchestrationEngineResult = {
  record: RevenueOperatorOrchestrationRecord
  planContext: RevenueOperatorOrchestrationPlanContext
}
