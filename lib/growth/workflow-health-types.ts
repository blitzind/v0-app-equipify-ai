/** Client-safe Growth Engine workflow health types. */

export const GROWTH_WORKFLOW_HEALTH_STATUSES = [
  "healthy",
  "needs_attention",
  "stalled",
  "blocked",
] as const

export type GrowthWorkflowHealthStatus = (typeof GROWTH_WORKFLOW_HEALTH_STATUSES)[number]

export type GrowthWorkflowHealthResult = {
  status: GrowthWorkflowHealthStatus
  reason: string
}
