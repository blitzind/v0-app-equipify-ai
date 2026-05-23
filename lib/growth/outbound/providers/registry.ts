import { GROWTH_OUTBOUND_STUB_PROVIDER } from "@/lib/growth/outbound/constants"
import { stubOutboundProviderAdapter } from "@/lib/growth/outbound/providers/stub"
import type { OutboundProviderAdapter } from "@/lib/growth/outbound/providers/types"

const REGISTRY = new Map<string, OutboundProviderAdapter>([[stubOutboundProviderAdapter.providerKey(), stubOutboundProviderAdapter]])

export function getOutboundProviderAdapter(provider: string): OutboundProviderAdapter {
  const adapter = REGISTRY.get(provider)
  if (!adapter) {
    throw new Error(`unknown_outbound_provider:${provider}`)
  }
  return adapter
}

export function listOutboundProviderAdapters(): Array<{ providerKey: string; providerName: string }> {
  return [...REGISTRY.values()].map((adapter) => ({
    providerKey: adapter.providerKey(),
    providerName: adapter.providerName(),
  }))
}

export function isKnownOutboundProvider(provider: string): boolean {
  return provider === GROWTH_OUTBOUND_STUB_PROVIDER
}
