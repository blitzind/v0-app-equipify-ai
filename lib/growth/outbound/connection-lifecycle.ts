import type { GrowthProviderLifecycleStatus } from "@/lib/growth/outbound/provider-types"

/** Map validation outcome to lifecycle status. */
export function resolveGrowthProviderLifecycleFromValidation(input: {
  healthy: boolean
  warnings: { code: string; message: string }[]
  temporarilyDegraded?: boolean
}): GrowthProviderLifecycleStatus {
  if (input.temporarilyDegraded) return "warning"
  if (!input.healthy) return "error"
  if (input.warnings.length > 0) return "warning"
  return "connected"
}

/** Legacy status column kept in sync with lifecycle for 5.1A consumers. */
export function mapGrowthProviderLegacyStatus(
  lifecycleStatus: GrowthProviderLifecycleStatus,
): "active" | "disabled" | "error" {
  if (lifecycleStatus === "disabled") return "disabled"
  if (lifecycleStatus === "error" || lifecycleStatus === "not_connected") return "error"
  return "active"
}

export function growthProviderHealthReason(input: {
  lifecycleStatus: GrowthProviderLifecycleStatus
  healthy: boolean
  warnings: { code: string; message: string }[]
  lastErrorMessage?: string | null
}): string | null {
  if (input.lifecycleStatus === "disabled") return "Provider connection disabled"
  if (!input.healthy && input.lastErrorMessage) return input.lastErrorMessage
  if (input.warnings.length > 0) return input.warnings[0]?.message ?? "Validation warnings present"
  if (input.lifecycleStatus === "connected") return null
  if (input.lifecycleStatus === "configuring") return "Awaiting validation"
  if (input.lifecycleStatus === "not_connected") return "Not connected"
  return null
}
