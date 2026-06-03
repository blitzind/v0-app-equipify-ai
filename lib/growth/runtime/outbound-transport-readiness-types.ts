/** Client-safe outbound transport readiness types (scheduler + Provider Setup alignment). */

export const GROWTH_OUTBOUND_TRANSPORT_READINESS_QA_MARKER = "growth-outbound-transport-readiness-v1" as const

export const GROWTH_OUTBOUND_TRANSPORT_BLOCK_REASONS = [
  "no_enabled_delivery_route",
  "sender_pending",
  "sender_disabled",
  "mailbox_not_linked",
  "provider_disconnected",
] as const

export type GrowthOutboundTransportBlockReason = (typeof GROWTH_OUTBOUND_TRANSPORT_BLOCK_REASONS)[number]

export type GrowthOutboundTransportReadiness = {
  qaMarker: typeof GROWTH_OUTBOUND_TRANSPORT_READINESS_QA_MARKER
  ready: boolean
  blockReason: GrowthOutboundTransportBlockReason | null
  label: string
  message: string
  senderAccountId: string | null
  deliveryRouteId: string | null
  providerFamily: string | null
}

export function formatGrowthOutboundTransportBlockMessage(
  reason: GrowthOutboundTransportBlockReason,
): string {
  switch (reason) {
    case "no_enabled_delivery_route":
      return "No enabled delivery route."
    case "sender_pending":
      return "Sender account is pending activation."
    case "sender_disabled":
      return "Sender account is disabled or in error state."
    case "mailbox_not_linked":
      return "Mailbox is not linked to this provider."
    case "provider_disconnected":
      return "Provider OAuth connection is not active."
    default:
      return "Outbound transport is not routable."
  }
}

export function formatGrowthOutboundTransportReadinessLabel(input: {
  ready: boolean
  blockReason: GrowthOutboundTransportBlockReason | null
  oauthConnected?: boolean
}): string {
  if (input.ready) return "Connected and routable"
  if (input.oauthConnected && input.blockReason) return "Connected but not routable"
  switch (input.blockReason) {
    case "no_enabled_delivery_route":
      return "No delivery route"
    case "sender_pending":
      return "Sender pending"
    case "sender_disabled":
      return "Sender disabled"
    case "mailbox_not_linked":
      return "Mailbox not linked"
    case "provider_disconnected":
      return "Provider disconnected"
    default:
      return "Transport not routable"
  }
}

export function growthOutboundTransportReadinessCardStatus(input: {
  ready: boolean
  blockReason: GrowthOutboundTransportBlockReason | null
}): "pass" | "fail" | "warning" {
  if (input.ready) return "pass"
  if (input.blockReason === "sender_pending" || input.blockReason === "no_enabled_delivery_route") {
    return "warning"
  }
  return "fail"
}
