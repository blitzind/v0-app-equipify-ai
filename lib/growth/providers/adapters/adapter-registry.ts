import type { GrowthDeliveryProviderFamily } from "@/lib/growth/providers/provider-types"
import { googleProviderAdapter } from "@/lib/growth/providers/adapters/google-provider"
import { microsoftProviderAdapter } from "@/lib/growth/providers/adapters/microsoft-provider"
import { resendProviderAdapter } from "@/lib/growth/providers/adapters/resend-provider"
import { sesProviderAdapter } from "@/lib/growth/providers/adapters/ses-provider"
import { smtpProviderAdapter } from "@/lib/growth/providers/adapters/smtp-provider"
import type { GrowthProviderAdapter } from "@/lib/growth/providers/adapters/provider-adapter-types"

const TRANSPORT_ADAPTERS: Partial<Record<GrowthDeliveryProviderFamily, GrowthProviderAdapter>> = {
  google: googleProviderAdapter,
  microsoft: microsoftProviderAdapter,
  smtp: smtpProviderAdapter,
  ses: sesProviderAdapter,
  resend: resendProviderAdapter,
}

export function getTransportAdapter(family: GrowthDeliveryProviderFamily): GrowthProviderAdapter | null {
  return TRANSPORT_ADAPTERS[family] ?? null
}

export function listTransportAdapterFamilies(): GrowthDeliveryProviderFamily[] {
  return Object.keys(TRANSPORT_ADAPTERS) as GrowthDeliveryProviderFamily[]
}

export function supportsLiveTransport(family: GrowthDeliveryProviderFamily): boolean {
  return family in TRANSPORT_ADAPTERS
}
