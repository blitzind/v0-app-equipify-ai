/**
 * Deterministic operational timeline / incident intelligence for AIden (snapshot JSON).
 * All fields are derived from bounded work-order samples — no ML, no probabilistic scoring.
 */

export const OPERATIONAL_TIMELINE_SCHEMA_VERSION = "2026-05-12-v1"

/** Stable ids referenced in `methodology` and event `correlationRuleIds`. */
export type OperationalTimelineRuleId =
  | "RULE.PM_RECURRENCE_SAME_EQUIP_90D"
  | "RULE.REPEAT_ACTIVE_SAME_EQUIP_30D"
  | "RULE.INSPECTION_SCHEDULE_SLIP_ACTIVE"
  | "RULE.PRIORITY_INCREASE_SAME_EQUIP_14D"
  | "RULE.REFRIGERATION_SIGNAL_TITLE_OR_TYPE"
  | "RULE.RENTAL_READINESS_TITLE_VOCAB"
  | "RULE.CALIBRATION_TITLE_VOCAB"
  | "RULE.EMERGENCY_REPEAT_SAME_EQUIP_60D"
  | "RULE.WEEKLY_VOLUME_TREND"

export type OperationalTimelineEvent = {
  /** Monotonic index in the derived list (not DB id). */
  eventIndex: number
  workOrderId: string
  equipmentId: string | null
  customerId: string | null
  /** ISO timestamp used for ordering (prefer `created_at`). */
  occurredAt: string
  kind: string
  /** Human-readable, template-filled — safe for prompts. */
  summary: string
  /** DB-aligned hints only — no invented states. */
  workOrderType: string | null
  workOrderPriority: string | null
  workOrderStatus: string | null
  correlationRuleIds: OperationalTimelineRuleId[]
}

export type OperationalEquipmentThreadStep = {
  workOrderId: string
  createdAt: string
  type: string | null
  priority: string | null
  status: string | null
  scheduledOn: string | null
  titleSnippet: string
  labels: string[]
}

export type OperationalEquipmentThread = {
  equipmentId: string
  workOrderCount: number
  firstCreatedAt: string
  lastCreatedAt: string
  steps: OperationalEquipmentThreadStep[]
}

export type OperationalRecurringChain = {
  chainKind:
    | "pm_recurrence_same_equipment"
    | "emergency_repeat_same_equipment"
    | "repeat_active_same_equipment"
    | "refrigeration_emergency_cluster"
    | "calibration_title_cluster"
    | "rental_readiness_cluster"
  equipmentId: string | null
  customerId: string | null
  workOrderIds: string[]
  windowDays: number
  correlationRuleIds: OperationalTimelineRuleId[]
  summary: string
}

export type OperationalEscalationSequence = {
  equipmentId: string | null
  steps: Array<{
    workOrderId: string
    createdAt: string
    priority: string | null
    priorityRank: number
  }>
  correlationRuleIds: OperationalTimelineRuleId[]
  summary: string
}

export type OperationalEventGroup = {
  groupKey: string
  theme: string
  workOrderIds: string[]
  equipmentIds: string[]
  correlationRuleIds: OperationalTimelineRuleId[]
  summary: string
}

export type OperationalIncidentSummary = {
  id: string
  title: string
  body: string
  severity: "low" | "medium" | "high"
  relatedEquipmentIds: string[]
  relatedWorkOrderIds: string[]
  correlationRuleIds: OperationalTimelineRuleId[]
}

export type OperationalTrendPoint = {
  weekStartUtc: string
  emergency: number
  pm: number
  inspection: number
  other: number
}

export type OperationalTimelineMethodologyEntry = {
  ruleId: OperationalTimelineRuleId
  title: string
  explanation: string
}

export type OperationalTimelineIntelligence = {
  schemaVersion: typeof OPERATIONAL_TIMELINE_SCHEMA_VERSION
  generatedAt: string
  window: { createdAfterUtc: string; rowLimit: number; rowCount: number }
  industryKeyUsed: string | null
  methodology: OperationalTimelineMethodologyEntry[]
  operationalEvents: OperationalTimelineEvent[]
  equipmentOperationalThreads: OperationalEquipmentThread[]
  recurringIssueChains: OperationalRecurringChain[]
  repeatFailureHistory: OperationalRecurringChain[]
  escalationSequences: OperationalEscalationSequence[]
  operationalEventGroups: OperationalEventGroup[]
  incidentSummaries: OperationalIncidentSummary[]
  operationalTrendTimelines: Array<{ id: string; label: string; points: OperationalTrendPoint[] }>
  /** Read together with other snapshot keys — no merged scoring, navigation only. */
  deterministicCrossReads?: Array<{ snapshotPath: string; rationale: string }>
}
