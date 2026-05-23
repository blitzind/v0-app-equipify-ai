import type { GrowthProviderCapabilitySnapshot } from "@/lib/growth/outbound/provider-types"
import { GROWTH_PROVIDER_CAPABILITY_KEYS } from "@/lib/growth/outbound/provider-types"

/** Default capability snapshot — all unavailable until validated. */
export function emptyGrowthProviderCapabilitySnapshot(): GrowthProviderCapabilitySnapshot {
  return Object.fromEntries(
    GROWTH_PROVIDER_CAPABILITY_KEYS.map((key) => [key, "unavailable" as const]),
  ) as GrowthProviderCapabilitySnapshot
}

/** Merge declared + probed capabilities; probed wins when present. */
export function mergeGrowthProviderCapabilities(
  declared: GrowthProviderCapabilitySnapshot,
  probed: Partial<GrowthProviderCapabilitySnapshot>,
): GrowthProviderCapabilitySnapshot {
  const merged = { ...declared }
  for (const key of GROWTH_PROVIDER_CAPABILITY_KEYS) {
    const value = probed[key]
    if (value) merged[key] = value
  }
  return merged
}

export function parseGrowthProviderCapabilitySnapshot(raw: unknown): GrowthProviderCapabilitySnapshot {
  const base = emptyGrowthProviderCapabilitySnapshot()
  if (!raw || typeof raw !== "object") return base
  const obj = raw as Record<string, unknown>
  for (const key of GROWTH_PROVIDER_CAPABILITY_KEYS) {
    const value = obj[key]
    if (
      value === "supported" ||
      value === "partial" ||
      value === "unavailable" ||
      value === "disabled"
    ) {
      base[key] = value
    }
  }
  return base
}
