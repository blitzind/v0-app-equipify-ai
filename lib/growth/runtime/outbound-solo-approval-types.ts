/** Client-safe solo approval env parsing for standalone outbound. */

import type { GrowthOutboundMode } from "@/lib/growth/runtime/outbound-mode-types"
import { parseGrowthOutboundMode } from "@/lib/growth/runtime/outbound-mode-types"

export const GROWTH_OUTBOUND_SOLO_AUTO_APPROVE_ENV = "GROWTH_OUTBOUND_SOLO_AUTO_APPROVE" as const

export function parseGrowthOutboundSoloAutoApprove(raw: string | undefined | null): boolean {
  return raw?.trim().toLowerCase() === "true"
}

export function isGrowthOutboundSoloAutoApproveConfigured(
  rawSoloFlag: string | undefined | null,
  rawOutboundMode: string | undefined | null,
): boolean {
  return (
    parseGrowthOutboundSoloAutoApprove(rawSoloFlag) &&
    parseGrowthOutboundMode(rawOutboundMode) === "standalone"
  )
}

export function describeGrowthOutboundSoloApprovalGate(input: {
  outboundMode: GrowthOutboundMode
  soloAutoApprove: boolean
  platformAdmin: boolean
}): { enabled: boolean; reason: string | null } {
  if (input.outboundMode !== "standalone") {
    return { enabled: false, reason: "standalone_outbound_mode_required" }
  }
  if (!input.soloAutoApprove) {
    return { enabled: false, reason: "solo_auto_approve_disabled" }
  }
  if (!input.platformAdmin) {
    return { enabled: false, reason: "platform_admin_required" }
  }
  return { enabled: true, reason: null }
}
