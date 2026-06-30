/**
 * GROWTH-WORKSPACE-OPERATOR-SIMPLIFICATION-1E — operator-facing automation labels.
 * Internal status enums unchanged; display copy only.
 */

export const GROWTH_AUTOMATION_INSPECTOR_TAB_PUBLISH = "Publish" as const
export const GROWTH_AUTOMATION_INSPECTOR_TAB_MONITOR = "Monitor" as const

export const GROWTH_AUTOMATION_FLOW_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  runtime_active: "Active",
  runtime_paused: "Paused",
  archived: "Archived",
}

export const GROWTH_AUTOMATION_ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  enrolled: "Enrolled",
  completed: "Completed",
  duplicate: "Duplicate",
  cancelled: "Cancelled",
  blocked: "Blocked",
  failed: "Failed",
  draft: "Draft",
}

export const GROWTH_AUTOMATION_EXECUTION_STATUS_LABELS: Record<string, string> = {
  advanced: "Advanced",
  completed: "Completed",
  approval_required: "Needs approval",
  waiting: "Waiting",
  blocked: "Blocked",
  failed: "Failed",
  cancelled: "Cancelled",
}

export function formatGrowthAutomationFlowStatusLabel(status: string): string {
  return GROWTH_AUTOMATION_FLOW_STATUS_LABELS[status] ?? status.replace(/_/g, " ")
}

export function formatGrowthAutomationEnrollmentStatusLabel(status: string): string {
  return GROWTH_AUTOMATION_ENROLLMENT_STATUS_LABELS[status] ?? status.replace(/_/g, " ")
}

export function formatGrowthAutomationExecutionStatusLabel(status: string): string {
  return GROWTH_AUTOMATION_EXECUTION_STATUS_LABELS[status] ?? status.replace(/_/g, " ")
}
