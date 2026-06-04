import "server-only"

import {
  GROWTH_OUTBOUND_MODE_ENV,
  parseGrowthOutboundMode,
  type GrowthOutboundMode,
} from "@/lib/growth/runtime/outbound-mode-types"

export {
  GROWTH_OUTBOUND_MODES,
  GROWTH_OUTBOUND_MODE_ENV,
  parseGrowthOutboundMode,
  growthOutboundModeLabel,
  type GrowthOutboundMode,
} from "@/lib/growth/runtime/outbound-mode-types"

/** Default `standalone` (native transport). Rollback: `adapter` + `GROWTH_ALLOW_ADAPTER_OUTBOUND=true`. */
export function getGrowthOutboundMode(): GrowthOutboundMode {
  return parseGrowthOutboundMode(process.env[GROWTH_OUTBOUND_MODE_ENV])
}

export function isGrowthOutboundStandaloneMode(): boolean {
  return getGrowthOutboundMode() === "standalone"
}

export function isGrowthOutboundAdapterMode(): boolean {
  return getGrowthOutboundMode() === "adapter"
}
