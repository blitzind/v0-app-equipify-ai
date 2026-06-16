/** Growth Engine S5-E — automation flow simulation types (client-safe). */

import type { SequenceBranchSimulationScenario } from "@/lib/growth/sequences/conditions/sequence-branch-simulation-types"
import type { SequenceTriggerRuntimeSimulationFixture } from "@/lib/growth/sequences/runtime/sequence-trigger-runtime-types"
import type { GrowthAutomationEdgeType } from "@/lib/growth/automation/growth-automation-types"

export const GROWTH_AUTOMATION_SIMULATION_QA_MARKER = "growth-automation-simulation-s5e-v1" as const

export const GROWTH_AUTOMATION_SIMULATION_STATUSES = ["draft", "simulated", "failed"] as const
export type GrowthAutomationSimulationStatus = (typeof GROWTH_AUTOMATION_SIMULATION_STATUSES)[number]

export const GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS = {
  simulation_execution_enabled: false,
  simulation_preview_only: true,
  no_sequence_execution: true,
  no_sequence_pattern_writes: true,
  no_notifications: true,
  no_provider_execution: true,
  no_background_jobs: true,
} as const

export const GROWTH_AUTOMATION_SIMULATION_CONDITION_OUTCOMES = [
  "matched",
  "not_matched",
  "unknown",
] as const
export type GrowthAutomationSimulationConditionOutcome =
  (typeof GROWTH_AUTOMATION_SIMULATION_CONDITION_OUTCOMES)[number]

export type GrowthAutomationSimulationInput = {
  triggerEvent?: string
  leadAttributes?: Record<string, unknown>
  companyAttributes?: Record<string, unknown>
  sharePageAttributes?: Record<string, unknown>
  mediaAttributes?: Record<string, unknown>
  bookingAttributes?: Record<string, unknown>
  highIntentAttributes?: Record<string, unknown>
  conditionOverrides?: Record<string, boolean>
  triggerFixtures?: SequenceTriggerRuntimeSimulationFixture[]
  scenario?: SequenceBranchSimulationScenario
}

export type GrowthAutomationSimulationIssue = {
  severity: "error" | "warning" | "info"
  ruleCode: string
  message: string
  nodeId?: string | null
}

export type GrowthAutomationSimulationExecutedNode = {
  nodeId: string
  nodeType: string
  label: string
  order: number
}

export type GrowthAutomationSimulationExecutedEdge = {
  edgeId: string
  fromNodeId: string
  toNodeId: string
  edgeType: GrowthAutomationEdgeType
  order: number
}

export type GrowthAutomationSimulationWaitState = {
  nodeId: string
  waitKind: "duration" | "until_event" | "condition"
  resolved: true
  resolution: "continued" | "timeout" | "matched" | "unmatched"
  durationSeconds: number | null
  detail: string
}

export type GrowthAutomationSimulationBranchDecision = {
  edgeId: string
  sourceNodeId: string
  targetNodeId: string
  decision: GrowthAutomationEdgeType
  reason: string
}

export type GrowthAutomationSimulationApprovalGate = {
  nodeId: string
  requiresApproval: true
  approved: false
}

export type GrowthAutomationSimulationTimelineEntry = {
  timestamp: string
  nodeId: string
  nodeType: string
  action: string
  status: "completed" | "failed" | "skipped" | "pending"
  details: Record<string, unknown>
}

export type GrowthAutomationSimulationResult = {
  simulationId: string
  flowId: string
  versionId: string
  status: GrowthAutomationSimulationStatus
  entryNodeId: string | null
  executedNodes: GrowthAutomationSimulationExecutedNode[]
  executedEdges: GrowthAutomationSimulationExecutedEdge[]
  waitStates: GrowthAutomationSimulationWaitState[]
  branchDecisions: GrowthAutomationSimulationBranchDecision[]
  approvalGates: GrowthAutomationSimulationApprovalGate[]
  warnings: GrowthAutomationSimulationIssue[]
  errors: GrowthAutomationSimulationIssue[]
  timeline: GrowthAutomationSimulationTimelineEntry[]
  safety: typeof GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS
  createdAt: string
  compileId: string | null
  stats: {
    nodeCount: number
    edgeCount: number
    timelineCount: number
    branchDecisionCount: number
    waitCount: number
    approvalGateCount: number
  }
}
