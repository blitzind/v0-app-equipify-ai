import "server-only"

import type { AiProviderAdapter, AiProviderId } from "@/lib/ai/types"
import { createAnthropicAdapter } from "@/lib/ai/providers/anthropic"
import { createGoogleAdapter } from "@/lib/ai/providers/google"
import { createOpenAiAdapter } from "@/lib/ai/providers/openai"
import { getAiEnvConfig, isProviderEnabled } from "@/lib/ai/config"
import { hasProviderCredentials } from "@/lib/ai/providers/credentials"

const cache = new Map<AiProviderId, AiProviderAdapter>()

function buildAdapter(id: AiProviderId): AiProviderAdapter {
  switch (id) {
    case "openai":
      return createOpenAiAdapter()
    case "anthropic":
      return createAnthropicAdapter()
    case "google":
      return createGoogleAdapter()
    default: {
      const _exhaustive: never = id
      return _exhaustive
    }
  }
}

export function getProviderAdapter(id: AiProviderId): AiProviderAdapter {
  let a = cache.get(id)
  if (!a) {
    a = buildAdapter(id)
    cache.set(id, a)
  }
  return a
}

/** Provider is listed in env and has API credentials. */
export function isProviderAvailable(id: AiProviderId): boolean {
  if (!isProviderEnabled(id)) return false
  return hasProviderCredentials(id)
}

/** Preference order intersected with availability — for future multi-hop routing. */
export function listAvailableProvidersInPreferenceOrder(): AiProviderId[] {
  const { providerPreference } = getAiEnvConfig()
  return providerPreference.filter((p) => isProviderAvailable(p))
}
