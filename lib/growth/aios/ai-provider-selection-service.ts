/** GE-AIOS-3A — Provider selection (server-only). */

import "server-only"

import { isProviderAvailable, listAvailableProvidersInPreferenceOrder } from "@/lib/ai/providers"
import { lookupAiOsModelCapability } from "@/lib/growth/aios/ai-provider-model-registry"
import { listAiOsProviderRegistryEntries, lookupAiOsProviderRegistryEntry } from "@/lib/growth/aios/ai-provider-registry"
import type { AiOsModelTier, AiOsProviderId, AiOsProviderSelection } from "@/lib/growth/aios/ai-provider-types"

export type AiOsProviderSelectionInput = {
  preferredProvider?: AiOsProviderId
  modelTier?: AiOsModelTier
  requiresMultimodal?: boolean
}

export function selectAiOsProviderCandidates(
  input: AiOsProviderSelectionInput = {},
): AiOsProviderSelection[] {
  const tier = input.modelTier ?? "balanced"
  const availableCore = new Set(listAvailableProvidersInPreferenceOrder())
  const registryOrder = listAiOsProviderRegistryEntries()

  const orderedProviderIds: AiOsProviderId[] = []
  if (input.preferredProvider && availableCore.has(input.preferredProvider)) {
    orderedProviderIds.push(input.preferredProvider)
  }
  for (const entry of registryOrder) {
    if (!orderedProviderIds.includes(entry.providerId) && availableCore.has(entry.providerId)) {
      orderedProviderIds.push(entry.providerId)
    }
  }

  const candidates: AiOsProviderSelection[] = []
  let rank = 0
  for (const providerId of orderedProviderIds) {
    const registryEntry = lookupAiOsProviderRegistryEntry(providerId)
    if (!registryEntry) continue
    if (input.requiresMultimodal && !registryEntry.supportsMultimodal) continue

    const capability =
      lookupAiOsModelCapability(providerId, tier) ??
      lookupAiOsModelCapability(providerId, "fast")

    const modelId = capability?.modelId ?? registryEntry.defaultModelForTier(tier)
    candidates.push({
      providerId,
      modelId,
      tier,
      rank: rank++,
    })
  }

  return candidates
}

export function selectPrimaryAiOsProvider(
  input: AiOsProviderSelectionInput = {},
): AiOsProviderSelection | null {
  return selectAiOsProviderCandidates(input)[0] ?? null
}

export function isAiOsProviderAvailable(providerId: AiOsProviderId): boolean {
  return isProviderAvailable(providerId)
}
