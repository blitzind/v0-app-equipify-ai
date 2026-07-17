/** GE-AVA-OPERATOR-WORKSPACE-1 — Ava operator approval workspace (client-safe). */

export const GROWTH_AVA_OPERATOR_WORKSPACE_1_QA_MARKER = "ge-ava-operator-workspace-1-v1" as const

export const GROWTH_AVA_OPERATOR_SEQUENCE_APPROVAL_HREF = "/growth/campaigns/sequences" as const

export const GROWTH_AVA_OPERATOR_PACKAGE_ACTION_API_PREFIX =
  "/api/platform/growth/ai-os/autonomous-outreach-preparation-pilot/packages" as const

export function buildAvaOperatorPackageActionApiPath(packageId: string): string {
  return `${GROWTH_AVA_OPERATOR_PACKAGE_ACTION_API_PREFIX}/${encodeURIComponent(packageId)}/action`
}

export function buildAvaOperatorExecutionRequestRetryApiPath(requestId: string): string {
  return `/api/platform/growth/ai-os/autonomous-outreach-preparation-pilot/execution-requests/${encodeURIComponent(requestId)}/retry`
}

export function buildAvaOperatorPackageDraftsApiPath(packageId: string): string {
  return `${GROWTH_AVA_OPERATOR_PACKAGE_ACTION_API_PREFIX}/${encodeURIComponent(packageId)}/drafts`
}

export function buildAvaOperatorPackageMemoryActionsApiPath(packageId: string): string {
  return `/api/platform/growth/ai-os/completed-work/packages/${encodeURIComponent(packageId)}/memory-actions`
}

export const GROWTH_AVA_OPERATOR_SUCCESS_PIPELINE_STEPS = [
  "Package Approved",
  "Execution Request Created",
  "Sequence Job Waiting",
  "Transport Approval Required",
  "Reply Monitoring Automatic",
  "Follow-up Automatic",
] as const
