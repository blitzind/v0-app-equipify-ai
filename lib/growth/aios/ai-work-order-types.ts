/** GE-AIOS-2A — AI Work Order types (client-safe). Constitutional §16.1. */

export const GROWTH_AIOS_2A_PHASE = "GE-AIOS-2A" as const

export const GROWTH_AI_WORK_ORDER_QA_MARKER = "growth-aios-2a-ai-work-order-v1" as const

export const GROWTH_AI_WORK_ORDER_SCHEMA_MIGRATION =
  "20271001120000_growth_aios_2a_ai_work_orders.sql" as const

/** Constitutional lifecycle statuses (§16.1). */
export const AI_WORK_ORDER_STATUSES = [
  "issued",
  "planning",
  "awaiting_decision",
  "awaiting_approval",
  "executing",
  "waiting",
  "monitoring",
  "escalated",
  "completed",
  "cancelled",
  "failed",
] as const

export type AiWorkOrderStatus = (typeof AI_WORK_ORDER_STATUSES)[number]

export const AI_WORK_ORDER_TERMINAL_STATUSES = ["completed", "cancelled"] as const satisfies readonly AiWorkOrderStatus[]

export const AI_WORK_ORDER_RECOVERABLE_STATUSES = ["failed"] as const satisfies readonly AiWorkOrderStatus[]

/** Sixteen constitutional agents + executive_brain as requester (not executor). */
export const AI_WORK_ORDER_AGENTS = [
  "prospecting",
  "research",
  "qualification",
  "strategy",
  "personalization",
  "outreach",
  "conversation",
  "meeting",
  "opportunity",
  "learning",
  "executive_reporting",
  "compliance",
  "budget",
  "provider",
  "warmup",
  "deliverability",
  "executive_brain",
] as const

export type AiWorkOrderAgent = (typeof AI_WORK_ORDER_AGENTS)[number]

/** Initial catalog — extensible via migration amendment. */
export const AI_WORK_ORDER_TYPES = [
  "research_company",
  "generate_buying_committee",
  "verify_email",
  "generate_email",
  "generate_video",
  "enroll_sequence",
  "pause_sequence",
  "analyze_reply",
  "prepare_meeting",
  "create_opportunity",
  "update_memory",
  "run_learning_cycle",
  "custom",
] as const

export type AiWorkOrderType = (typeof AI_WORK_ORDER_TYPES)[number]

export type AiWorkOrderEntityRef = {
  entityType: string | null
  entityId: string | null
}

/** Placeholder for future Decision Record binding (GE-AI-2A). */
export type AiWorkOrderDecisionRef = {
  decisionRecordIds: string[]
}

/** Placeholder for Memory Registry binding (GE-AIOS-2F). */
export type AiWorkOrderMemoryRef = {
  memoryType: string
  memoryId: string
  snapshotAt?: string | null
}

export type AiWorkOrder = {
  id: string
  organizationId: string
  missionId: string
  ownerAgent: AiWorkOrderAgent
  assignedAgent: AiWorkOrderAgent
  workOrderType: AiWorkOrderType
  entityType: string | null
  entityId: string | null
  priority: number
  status: AiWorkOrderStatus
  decisionRecordIds: string[]
  memoryRefs: AiWorkOrderMemoryRef[]
  payload: Record<string, unknown>
  dependsOn: string[]
  retryCount: number
  maxRetries: number
  timeoutAt: string | null
  executionWindowStart: string | null
  executionWindowEnd: string | null
  approvalId: string | null
  checkpoint: Record<string, unknown> | null
  requestedBy: string | null
  result: Record<string, unknown> | null
  failureReason: string | null
  auditMetadata: Record<string, unknown>
  issuedAt: string
  startedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  archivedAt: string | null
  qaMarker: string
  createdAt: string
  updatedAt: string
}

export type AiWorkOrderCreateInput = {
  organizationId: string
  missionId: string
  ownerAgent: AiWorkOrderAgent
  assignedAgent?: AiWorkOrderAgent
  workOrderType: AiWorkOrderType
  entityType?: string | null
  entityId?: string | null
  priority?: number
  payload?: Record<string, unknown>
  dependsOn?: string[]
  maxRetries?: number
  timeoutAt?: string | null
  executionWindowStart?: string | null
  executionWindowEnd?: string | null
  requestedBy?: string | null
  decisionRecordIds?: string[]
  memoryRefs?: AiWorkOrderMemoryRef[]
  auditMetadata?: Record<string, unknown>
}

export type AiWorkOrderTransitionInput = {
  workOrderId: string
  organizationId: string
  toStatus: AiWorkOrderStatus
  actingAgent?: AiWorkOrderAgent | null
  reason?: string | null
  result?: Record<string, unknown> | null
  failureReason?: string | null
  checkpoint?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
}

export type AiWorkOrderCancelInput = {
  workOrderId: string
  organizationId: string
  reason?: string | null
  requestedBy?: string | null
}

export type AiWorkOrderRetryInput = {
  workOrderId: string
  organizationId: string
  reason?: string | null
  requestedBy?: string | null
}

export type AiWorkOrderArchiveInput = {
  workOrderId: string
  organizationId: string
  reason?: string | null
}

export type AiWorkOrderEventSeverity = "info" | "low" | "medium" | "high" | "critical"

export type AiWorkOrderEvent = {
  id: string
  workOrderId: string
  organizationId: string
  eventType: string
  fromStatus: AiWorkOrderStatus | null
  toStatus: AiWorkOrderStatus | null
  severity: AiWorkOrderEventSeverity
  title: string
  description: string
  metadata: Record<string, unknown>
  createdAt: string
}

export type AiWorkOrderListFilter = {
  organizationId: string
  missionId?: string
  status?: AiWorkOrderStatus | AiWorkOrderStatus[]
  ownerAgent?: AiWorkOrderAgent
  workOrderType?: AiWorkOrderType
  includeArchived?: boolean
  limit?: number
}

export function isAiWorkOrderAgent(value: unknown): value is AiWorkOrderAgent {
  return typeof value === "string" && (AI_WORK_ORDER_AGENTS as readonly string[]).includes(value)
}

export function isAiWorkOrderType(value: unknown): value is AiWorkOrderType {
  return typeof value === "string" && (AI_WORK_ORDER_TYPES as readonly string[]).includes(value)
}

export function isAiWorkOrderStatus(value: unknown): value is AiWorkOrderStatus {
  return typeof value === "string" && (AI_WORK_ORDER_STATUSES as readonly string[]).includes(value)
}

export function clampAiWorkOrderPriority(value: number): number {
  if (!Number.isFinite(value)) return 500
  return Math.max(0, Math.min(1000, Math.round(value)))
}

export function isAiWorkOrderTerminalStatus(status: AiWorkOrderStatus): boolean {
  return (AI_WORK_ORDER_TERMINAL_STATUSES as readonly string[]).includes(status)
}

export function isAiWorkOrderActiveStatus(status: AiWorkOrderStatus): boolean {
  return !isAiWorkOrderTerminalStatus(status) && status !== "failed"
}
