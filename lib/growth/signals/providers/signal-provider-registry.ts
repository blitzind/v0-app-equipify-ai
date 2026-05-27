import { createManualImportSignalAdapter } from "@/lib/growth/signals/providers/adapters/manual-import-adapter"
import { createNewsManualSignalAdapter } from "@/lib/growth/signals/providers/adapters/news-signal-adapter"
import type {
  GrowthSignalPollContext,
  GrowthSignalProvider,
  GrowthSignalProviderPollResult,
  GrowthSignalProviderStatus,
} from "@/lib/growth/signals/providers/signal-provider-types"

export type GrowthSignalProviderRegistryEntry = {
  provider_key: string
  display_name: string
  status: GrowthSignalProviderStatus
  supported_signal_types: GrowthSignalProvider["supported_signal_types"]
  configured: boolean
}

export function listSignalProviders(): GrowthSignalProvider[] {
  return [createManualImportSignalAdapter(), createNewsManualSignalAdapter()]
}

export function getSignalProvider(providerKey: string): GrowthSignalProvider | null {
  return listSignalProviders().find((provider) => provider.provider_key === providerKey) ?? null
}

export function summarizeSignalProviderRegistry(): GrowthSignalProviderRegistryEntry[] {
  return listSignalProviders().map((provider) => ({
    provider_key: provider.provider_key,
    display_name: provider.display_name,
    status: provider.status,
    supported_signal_types: provider.supported_signal_types,
    configured: provider.isConfigured(),
  }))
}

export async function pollSignalProvider(
  providerKey: string,
  context: GrowthSignalPollContext,
): Promise<GrowthSignalProviderPollResult> {
  const provider = getSignalProvider(providerKey)
  if (!provider) {
    return {
      ok: false,
      status: "failed",
      provider_key: providerKey,
      drafts: [],
      message: `Unknown provider: ${providerKey}`,
    }
  }
  if (!provider.isConfigured()) {
    return {
      ok: false,
      status: "skipped",
      provider_key: provider.provider_key,
      drafts: [],
      message: "Provider is not configured.",
    }
  }
  return provider.poll(context)
}

