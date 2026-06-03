/** Client-safe Growth outbound mode types and parsing. */

export const GROWTH_OUTBOUND_MODES = ["adapter", "standalone"] as const
export type GrowthOutboundMode = (typeof GROWTH_OUTBOUND_MODES)[number]

export const GROWTH_OUTBOUND_MODE_ENV = "GROWTH_OUTBOUND_MODE" as const

const DEFAULT_OUTBOUND_MODE: GrowthOutboundMode = "adapter"

export function parseGrowthOutboundMode(raw: string | undefined | null): GrowthOutboundMode {
  const normalized = raw?.trim().toLowerCase()
  if (normalized === "standalone") return "standalone"
  if (normalized === "adapter") return "adapter"
  return DEFAULT_OUTBOUND_MODE
}

export function growthOutboundModeLabel(mode: GrowthOutboundMode): string {
  return mode === "standalone" ? "standalone (transport)" : "adapter (outreach queue)"
}
