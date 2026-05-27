/** Client-safe infrastructure readiness labels (operational send plane v1). */

export const GROWTH_INFRASTRUCTURE_READINESS_QA_MARKER = "growth-internal-outbound-ops-v1" as const

export const GROWTH_INFRASTRUCTURE_READINESS_STATUSES = [
  "live",
  "stub",
  "simulated",
  "preview_only",
  "disabled",
  "internal",
  "error",
  "degraded",
] as const

export type GrowthInfrastructureReadinessStatus = (typeof GROWTH_INFRASTRUCTURE_READINESS_STATUSES)[number]

export type GrowthInfrastructureReadinessDescriptor = {
  status: GrowthInfrastructureReadinessStatus
  label: string
  detail?: string
}

export const GROWTH_INFRASTRUCTURE_READINESS_LABELS: Record<GrowthInfrastructureReadinessStatus, string> = {
  live: "Live",
  stub: "Stub",
  simulated: "Simulated",
  preview_only: "Preview only",
  disabled: "Disabled",
  internal: "Internal",
  error: "Error",
  degraded: "Degraded",
}

export function growthInfrastructureReadinessLabel(
  status: GrowthInfrastructureReadinessStatus,
): string {
  return GROWTH_INFRASTRUCTURE_READINESS_LABELS[status]
}

export type GrowthInfrastructureSurfaceId =
  | "mailbox_provider"
  | "delivery_provider"
  | "dns_validation"
  | "inbox_sync"
  | "warmup"
  | "outbound_provider"
  | "webhook_ingestion"
  | "deliverability"
  | "transport_send"

export type GrowthInfrastructureReadinessCatalogEntry = {
  surfaceId: GrowthInfrastructureSurfaceId
  title: string
  readiness: GrowthInfrastructureReadinessDescriptor
}
