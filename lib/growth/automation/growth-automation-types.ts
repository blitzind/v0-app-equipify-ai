/** Growth Engine S5-B — automation visual builder types (client-safe). */

export const GROWTH_AUTOMATION_BUILDER_QA_MARKER = "growth-automation-builder-s5b-v1" as const

export const GROWTH_AUTOMATION_BUILDER_MIGRATION =
  "20270827121000_growth_automation_builder_s5b.sql" as const

export const GROWTH_AUTOMATION_BUILDER_CONFIRM = "RUN_GROWTH_AUTOMATION_BUILDER_CERTIFICATION" as const

export const GROWTH_AUTOMATION_FLOW_STATUSES = [
  "draft",
  "published",
  "runtime_active",
  "runtime_paused",
  "archived",
] as const
export type GrowthAutomationFlowStatus = (typeof GROWTH_AUTOMATION_FLOW_STATUSES)[number]

export const GROWTH_AUTOMATION_VERSION_LIFECYCLES = ["draft", "published", "superseded"] as const
export type GrowthAutomationVersionLifecycle = (typeof GROWTH_AUTOMATION_VERSION_LIFECYCLES)[number]

export const GROWTH_AUTOMATION_NODE_TYPES = [
  "trigger",
  "condition",
  "wait",
  "branch",
  "action",
  "approval",
  "exit",
] as const
export type GrowthAutomationNodeType = (typeof GROWTH_AUTOMATION_NODE_TYPES)[number]

export const GROWTH_AUTOMATION_EDGE_TYPES = [
  "default",
  "conditional_true",
  "conditional_false",
  "timeout",
  "fallback",
] as const
export type GrowthAutomationEdgeType = (typeof GROWTH_AUTOMATION_EDGE_TYPES)[number]

export const GROWTH_AUTOMATION_NODE_VALIDATION_STATES = [
  "pending",
  "valid",
  "warning",
  "error",
] as const
export type GrowthAutomationNodeValidationState =
  (typeof GROWTH_AUTOMATION_NODE_VALIDATION_STATES)[number]

export const GROWTH_AUTOMATION_VALIDATION_SEVERITIES = ["error", "warning", "info"] as const
export type GrowthAutomationValidationSeverity = (typeof GROWTH_AUTOMATION_VALIDATION_SEVERITIES)[number]

export const GROWTH_AUTOMATION_SEND_ACTION_TYPES = [
  "send_email",
  "send_sms",
  "send_voice_drop",
  "notify_operator",
] as const
export type GrowthAutomationSendActionType = (typeof GROWTH_AUTOMATION_SEND_ACTION_TYPES)[number]

export const GROWTH_AUTOMATION_API_SAFETY_FLAGS = {
  read_only_runtime: true,
  compiler_execution_enabled: false,
  simulation_execution_enabled: false,
  automation_execution_enabled: false,
  no_notifications: true,
  no_sequence_execution: true,
  no_provider_execution: true,
} as const

export type GrowthAutomationFlow = {
  id: string
  organizationId: string
  name: string
  description: string
  status: GrowthAutomationFlowStatus
  currentVersionId: string | null
  publishedVersionId: string | null
  qaMarker: typeof GROWTH_AUTOMATION_BUILDER_QA_MARKER
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export type GrowthAutomationFlowVersion = {
  id: string
  flowId: string
  versionNumber: number
  lifecycle: GrowthAutomationVersionLifecycle
  canvasLayoutJson: Record<string, unknown>
  compiledPatternId: string | null
  publishedAt: string | null
  publishedBy: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthAutomationNode = {
  id: string
  versionId: string
  nodeType: GrowthAutomationNodeType
  label: string
  positionX: number
  positionY: number
  configJson: Record<string, unknown>
  validationState: GrowthAutomationNodeValidationState
  compiledPatternStepId: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthAutomationEdge = {
  id: string
  versionId: string
  fromNodeId: string
  toNodeId: string
  edgeType: GrowthAutomationEdgeType
  priority: number
  conditionId: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthAutomationValidationIssue = {
  severity: GrowthAutomationValidationSeverity
  ruleCode: string
  message: string
  nodeId?: string | null
  metadata?: Record<string, unknown>
}

export type GrowthAutomationValidationResult = {
  ok: boolean
  errors: GrowthAutomationValidationIssue[]
  warnings: GrowthAutomationValidationIssue[]
  graphStats: {
    nodeCount: number
    edgeCount: number
    triggerCount: number
    exitCount: number
    unreachableNodeCount: number
    orphanNodeCount: number
  }
}

export function canArchiveAutomationFlow(status: GrowthAutomationFlowStatus): boolean {
  return status !== "archived"
}

export function canEditAutomationDraftVersion(lifecycle: GrowthAutomationVersionLifecycle): boolean {
  return lifecycle === "draft"
}

export function isSendAutomationActionConfig(config: Record<string, unknown>): boolean {
  const actionType = typeof config.actionType === "string" ? config.actionType : ""
  return (GROWTH_AUTOMATION_SEND_ACTION_TYPES as readonly string[]).includes(actionType)
}
