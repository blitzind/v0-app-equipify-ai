import { GROWTH_OUTBOUND_STUB_PROVIDER } from "@/lib/growth/outbound/constants"
import {
  customOutboundProviderAdapter,
  emailbisonOutboundProviderAdapter,
  instantlyOutboundProviderAdapter,
  smartleadOutboundProviderAdapter,
} from "@/lib/growth/outbound/providers/families"
import { stubOutboundProviderAdapter } from "@/lib/growth/outbound/providers/stub"
import { lemlistOutboundProviderAdapter } from "@/lib/growth/outbound/providers/lemlist/lemlist-adapter"
import type { OutboundProviderAdapter } from "@/lib/growth/outbound/providers/types"

const REGISTRY = new Map<string, OutboundProviderAdapter>([
  [stubOutboundProviderAdapter.providerKey(), stubOutboundProviderAdapter],
  [lemlistOutboundProviderAdapter.providerKey(), lemlistOutboundProviderAdapter],
  [smartleadOutboundProviderAdapter.providerKey(), smartleadOutboundProviderAdapter],
  [instantlyOutboundProviderAdapter.providerKey(), instantlyOutboundProviderAdapter],
  [emailbisonOutboundProviderAdapter.providerKey(), emailbisonOutboundProviderAdapter],
  [customOutboundProviderAdapter.providerKey(), customOutboundProviderAdapter],
])

export function getOutboundProviderAdapter(provider: string): OutboundProviderAdapter {
  const adapter = REGISTRY.get(provider)
  if (!adapter) {
    throw new Error(`unknown_outbound_provider:${provider}`)
  }
  return adapter
}

export function listOutboundProviderAdapters(): Array<{
  providerKey: string
  providerName: string
  providerFamily: ReturnType<OutboundProviderAdapter["providerFamily"]>
}> {
  return [...REGISTRY.values()].map((adapter) => ({
    providerKey: adapter.providerKey(),
    providerName: adapter.providerName(),
    providerFamily: adapter.providerFamily(),
  }))
}

export function isKnownOutboundProvider(provider: string): boolean {
  return REGISTRY.has(provider) || provider === GROWTH_OUTBOUND_STUB_PROVIDER
}

export function resolveOutboundProviderAdapterForFamily(
  providerFamily: ReturnType<OutboundProviderAdapter["providerFamily"]>,
): OutboundProviderAdapter {
  const match = [...REGISTRY.values()].find((adapter) => adapter.providerFamily() === providerFamily)
  if (!match) throw new Error(`unknown_outbound_provider_family:${providerFamily}`)
  return match
}
