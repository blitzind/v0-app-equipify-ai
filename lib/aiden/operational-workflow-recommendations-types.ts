/**
 * Deterministic workflow routing for AIden operational intelligence (no autonomous execution).
 * Deep links are relative app paths; the user must navigate and confirm actions in-product.
 */

import type { OperationalModuleContext } from "@/lib/aiden/operational-recommendations-schema"
import type { OperationalTimelineRuleId } from "@/lib/aiden/operational-timeline-types"

export const OPERATIONAL_WORKFLOW_REC_SCHEMA_VERSION = "2026-05-13-v1"

export type OperationalWorkflowExecutionMode = "manual_navigation_only"

/** Stable mapping keys for analytics / UI tests (not shown to operators as primary copy). */
export type OperationalWorkflowTemplateId =
  | "WF.PM_PLAN_FROM_REPEAT_EQUIPMENT"
  | "WF.PM_PLAN_FROM_PM_RECURRENCE_CHAIN"
  | "WF.INSPECTION_FROM_TIMELINE_SLIP"
  | "WF.DISPATCH_UNASSIGNED_ACTIVE"
  | "WF.DISPATCH_STALE_ACTIVE"
  | "WF.DISPATCH_PAST_SCHEDULED_ACTIVE"
  | "WF.READINESS_EQUIPMENT_REVIEW"
  | "WF.CLEANUP_REPEAT_OR_GROUPS"
  | "WF.CLEANUP_ESCALATION_SEQUENCE"
  | "WF.INVOICE_OVERDUE_REVIEW"

export type OperationalWorkflowRecommendationSeverity = "low" | "medium" | "high"

export type OperationalWorkflowSuggestedAutomation = {
  /** Stable key for settings / future automation registry — informational only. */
  automationKey: string
  label: string
  rationale: string
  /** Deep link into settings or automations UI when available. */
  href: string | null
}

export type OperationalWorkflowRecommendation = {
  id: string
  templateId: OperationalWorkflowTemplateId
  title: string
  rationale: string
  severity: OperationalWorkflowRecommendationSeverity
  /** Primary navigation target (relative path). */
  primaryHref: string
  secondaryHrefs: Array<{ label: string; href: string }>
  /** UUIDs copied from snapshot lists only — never invented. */
  targetRecordIds: string[]
  relatedModule: OperationalModuleContext
  /** JSON-pointer style paths into the operational snapshot for auditability. */
  evidencePaths: string[]
  correlationRuleIds: OperationalTimelineRuleId[]
  suggestedAutomation: OperationalWorkflowSuggestedAutomation | null
  executionMode: OperationalWorkflowExecutionMode
}

export type OperationalWorkflowRecommendationsReport = {
  schemaVersion: typeof OPERATIONAL_WORKFLOW_REC_SCHEMA_VERSION
  methodologyNote: string
  recommendations: OperationalWorkflowRecommendation[]
}
