/** Client-safe native outbound cutover (Phase 6.30D). */

export const GROWTH_NATIVE_OUTBOUND_CUTOVER_QA_MARKER = "growth-native-outbound-cutover-v1" as const

/** Rollback: set to `true` to re-enable adapter outreach_queue + Lemlist execute paths. */
export const GROWTH_ALLOW_ADAPTER_OUTBOUND_ENV = "GROWTH_ALLOW_ADAPTER_OUTBOUND" as const

export const ADAPTER_OUTBOUND_CUTOVER_DISABLED_CODE = "adapter_outbound_cutover_disabled" as const

export function parseGrowthAllowAdapterOutbound(raw: string | undefined | null): boolean {
  const normalized = raw?.trim().toLowerCase()
  return normalized === "true" || normalized === "1" || normalized === "yes"
}
