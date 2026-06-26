/** GE-AIOS-3A — Provider registry (client-safe). */

import type { AiOsModelTier, AiOsProviderAdapter, AiOsProviderId } from "@/lib/growth/aios/ai-provider-types"
import { lookupAiOsModelCapability } from "@/lib/growth/aios/ai-provider-model-registry"

export type AiOsProviderRegistryEntry = AiOsProviderAdapter & {
  description: string
  preferenceRank: number
}

export const AI_OS_PROVIDER_REGISTRY: readonly AiOsProviderRegistryEntry[] = [
  {
    providerId: "openai",
    label: "OpenAI",
    description: "OpenAI chat completions via Core adapter",
    preferenceRank: 1,
    supportsMultimodal: true,
    defaultModelForTier(tier: AiOsModelTier) {
      return lookupAiOsModelCapability("openai", tier)?.modelId ?? "gpt-4o-mini"
    },
  },
  {
    providerId: "anthropic",
    label: "Anthropic",
    description: "Anthropic Claude via Core adapter",
    preferenceRank: 2,
    supportsMultimodal: false,
    defaultModelForTier(tier: AiOsModelTier) {
      return lookupAiOsModelCapability("anthropic", tier)?.modelId ?? "claude-3-5-haiku-20241022"
    },
  },
  {
    providerId: "google",
    label: "Google Gemini",
    description: "Google Gemini via Core adapter",
    preferenceRank: 3,
    supportsMultimodal: false,
    defaultModelForTier(tier: AiOsModelTier) {
      return lookupAiOsModelCapability("google", tier)?.modelId ?? "gemini-1.5-flash"
    },
  },
] as const

const REGISTRY_BY_ID = new Map(AI_OS_PROVIDER_REGISTRY.map((entry) => [entry.providerId, entry]))

export function lookupAiOsProviderRegistryEntry(
  providerId: AiOsProviderId,
): AiOsProviderRegistryEntry | null {
  return REGISTRY_BY_ID.get(providerId) ?? null
}

export function listAiOsProviderRegistryEntries(): AiOsProviderRegistryEntry[] {
  return [...AI_OS_PROVIDER_REGISTRY].sort((a, b) => a.preferenceRank - b.preferenceRank)
}

export function isAiOsProviderId(value: unknown): value is AiOsProviderId {
  return typeof value === "string" && REGISTRY_BY_ID.has(value as AiOsProviderId)
}

export function aiOsProviderRegistryCatalog() {
  return {
    entries: listAiOsProviderRegistryEntries(),
    count: AI_OS_PROVIDER_REGISTRY.length,
  }
}
