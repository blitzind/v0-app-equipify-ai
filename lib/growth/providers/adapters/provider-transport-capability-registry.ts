/** Live transport capability registry — client-safe, no adapter imports. */

import type { GrowthDeliveryProviderFamily } from "@/lib/growth/providers/provider-types"

export const GROWTH_LIVE_TRANSPORT_FAMILIES = [
  "google",
  "microsoft",
  "smtp",
  "ses",
  "resend",
] as const satisfies readonly GrowthDeliveryProviderFamily[]

export type GrowthLiveTransportFamily = (typeof GROWTH_LIVE_TRANSPORT_FAMILIES)[number]

const LIVE_TRANSPORT_FAMILY_SET = new Set<GrowthDeliveryProviderFamily>(GROWTH_LIVE_TRANSPORT_FAMILIES)

export function listTransportAdapterFamilies(): GrowthLiveTransportFamily[] {
  return [...GROWTH_LIVE_TRANSPORT_FAMILIES]
}

export function supportsLiveTransport(family: GrowthDeliveryProviderFamily): boolean {
  return LIVE_TRANSPORT_FAMILY_SET.has(family)
}

export function liveTransportFamilyLabel(family: GrowthLiveTransportFamily): string {
  switch (family) {
    case "google":
      return "Google Workspace"
    case "microsoft":
      return "Microsoft 365"
    case "smtp":
      return "SMTP"
    case "ses":
      return "Amazon SES"
    case "resend":
      return "Resend"
    default:
      return family
  }
}
