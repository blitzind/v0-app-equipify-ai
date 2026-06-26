/** GE-AIOS-GROWTH-4D — Agent Memory & Shared Context types (client-safe). */

import type { GrowthLeadResearchCanonicalWorkflowType } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type {
  GrowthAgentKind,
  GrowthAgentPermissionProfile,
  GrowthAgentRequiredGate,
} from "@/lib/growth/aios/growth/growth-agent-framework-types"

export const GROWTH_AIOS_GROWTH_4D_PHASE = "GE-AIOS-GROWTH-4D" as const

export const GROWTH_AGENT_MEMORY_QA_MARKER = "growth-aios-growth-4d-agent-memory-v1" as const

export const GROWTH_AGENT_MEMORY_RULE =
  "Agent memory is read-only aggregation in 4D — agents share one deterministic context model without writing memory, executing agents, runtime, outbound, providers, Work Orders, or Core mutations." as const

export const GROWTH_AGENT_MEMORY_COMPLETENESS_STATES = [
  "complete",
  "partial",
  "missing_research",
  "missing_qualification",
  "missing_plan",
  "missing_approval",
  "missing_runtime_context",
  "blocked",
] as const

export type GrowthAgentMemoryCompletenessState =
  (typeof GROWTH_AGENT_MEMORY_COMPLETENESS_STATES)[number]

export const GROWTH_AGENT_MEMORY_CONFLICT_KINDS = [
  "approved_but_readiness_blocked",
  "handoff_ready_but_preflight_blocked",
  "runtime_eligible_but_dry_run_missing",
  "execution_recommended_but_pilot_blocked",
  "outbound_recommended_while_outreach_blocked",
  "core_mutation_risk_without_approval",
] as const

export type GrowthAgentMemoryConflictKind = (typeof GROWTH_AGENT_MEMORY_CONFLICT_KINDS)[number]

export type GrowthAgentMemoryConflict = {
  conflictId: string
  kind: GrowthAgentMemoryConflictKind
  summary: string
  severity: "low" | "medium" | "high" | "critical"
}

export type GrowthAgentSharedMemoryRecord = {
  memoryId: string
  leadId: string
  companyId: string | null
  companyName: string | null
  companySummary: string | null
  researchSummary: string | null
  qualificationSummary: string | null
  opportunityAssessment: string | null
  nextBestAction: string | null
  executionPlanSummary: string | null
  workflowType: GrowthLeadResearchCanonicalWorkflowType | null
  approvalState: string | null
  readinessState: string | null
  handoffState: string | null
  boundaryStatus: string | null
  preflightStatus: string | null
  simulationSummary: string | null
  runtimeState: string | null
  dryRunState: string | null
  pilotState: string | null
  owningAgent: GrowthAgentKind
  routedEvents: string[]
  revenueOperatorRecommendation: string | null
  blockedReasons: string[]
  humanReviewRequirements: string[]
  confidence: number | null
  lastUpdatedAt: string
  completenessState: GrowthAgentMemoryCompletenessState
  missingFields: string[]
  recommendedRemediation: string
  conflicts: GrowthAgentMemoryConflict[]
}

export type GrowthAgentContextView = {
  agentKind: GrowthAgentKind
  agentName: string
  whatToKnow: string[]
  allowedActions: string[]
  requiredGates: GrowthAgentRequiredGate[]
  blockedCapabilities: string[]
  recommendedNextAction: string
  missingContext: string[]
  confidence: number | null
  permissionProfile: GrowthAgentPermissionProfile
}

export type GrowthAgentMemoryLeadBundle = {
  sharedMemory: GrowthAgentSharedMemoryRecord
  agentViews: GrowthAgentContextView[]
}

export type GrowthAgentMemoryPlanContext = {
  completenessState: GrowthAgentMemoryCompletenessState
  owningAgent: GrowthAgentKind
  missingContext: string[]
  conflicts: GrowthAgentMemoryConflict[]
  recommendedRemediation: string
  confidence: number | null
}

export type GrowthAgentMemoryReadModel = {
  qaMarker: typeof GROWTH_AGENT_MEMORY_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_AGENT_MEMORY_RULE
  summary: {
    leadsIndexed: number
    complete: number
    partial: number
    blocked: number
    conflictsDetected: number
  }
  leads: GrowthAgentMemoryLeadBundle[]
}

export type GrowthAgentMemoryAggregationInput = {
  leadId: string
  companyId?: string | null
  companyName?: string | null
  companySummary?: string | null
  researchSummary?: string | null
  qualificationSummary?: string | null
  opportunityAssessment?: string | null
  nextBestAction?: string | null
  executionPlanSummary?: string | null
  workflowType?: GrowthLeadResearchCanonicalWorkflowType | null
  approvalState?: string | null
  readinessState?: string | null
  handoffState?: string | null
  boundaryStatus?: string | null
  preflightStatus?: string | null
  simulationSummary?: string | null
  runtimeState?: string | null
  dryRunState?: string | null
  pilotState?: string | null
  owningAgent: GrowthAgentKind
  routedEvents?: string[]
  revenueOperatorRecommendation?: string | null
  blockedReasons?: string[]
  humanReviewRequirements?: string[]
  confidence?: number | null
  lastUpdatedAt: string
  generatedAt?: string
  futureExecutionEligible?: boolean | null
  pilotEligible?: boolean | null
  pilotBlockedReasons?: string[]
  orchestrationDecision?: string | null
  preflightMissingRequirements?: string[]
  coreTouchRiskPresent?: boolean
  outboundRecommended?: boolean
  workflowStatus?: string | null
}
