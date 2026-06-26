/** GE-AIOS-3A — Model capability registry (client-safe). */

import type { AiOsModelTier, AiOsProviderId } from "@/lib/growth/aios/ai-provider-types"

export type AiOsModelCapability = {
  providerId: AiOsProviderId
  modelId: string
  tier: AiOsModelTier
  label: string
  maxOutputTokens: number
  structuredJson: boolean
  supportsMultimodal: boolean
}

export const AI_OS_MODEL_CAPABILITIES: readonly AiOsModelCapability[] = [
  {
    providerId: "openai",
    modelId: "gpt-4o-mini",
    tier: "fast",
    label: "OpenAI GPT-4o Mini",
    maxOutputTokens: 4096,
    structuredJson: true,
    supportsMultimodal: true,
  },
  {
    providerId: "openai",
    modelId: "gpt-4o",
    tier: "balanced",
    label: "OpenAI GPT-4o",
    maxOutputTokens: 8192,
    structuredJson: true,
    supportsMultimodal: true,
  },
  {
    providerId: "openai",
    modelId: "gpt-4o",
    tier: "reasoning",
    label: "OpenAI GPT-4o (reasoning)",
    maxOutputTokens: 8192,
    structuredJson: true,
    supportsMultimodal: true,
  },
  {
    providerId: "anthropic",
    modelId: "claude-3-5-haiku-20241022",
    tier: "fast",
    label: "Anthropic Claude 3.5 Haiku",
    maxOutputTokens: 4096,
    structuredJson: true,
    supportsMultimodal: false,
  },
  {
    providerId: "anthropic",
    modelId: "claude-3-5-sonnet-20241022",
    tier: "balanced",
    label: "Anthropic Claude 3.5 Sonnet",
    maxOutputTokens: 8192,
    structuredJson: true,
    supportsMultimodal: false,
  },
  {
    providerId: "anthropic",
    modelId: "claude-3-5-sonnet-20241022",
    tier: "reasoning",
    label: "Anthropic Claude 3.5 Sonnet (reasoning)",
    maxOutputTokens: 8192,
    structuredJson: true,
    supportsMultimodal: false,
  },
  {
    providerId: "google",
    modelId: "gemini-1.5-flash",
    tier: "fast",
    label: "Google Gemini 1.5 Flash",
    maxOutputTokens: 4096,
    structuredJson: true,
    supportsMultimodal: false,
  },
  {
    providerId: "google",
    modelId: "gemini-1.5-pro",
    tier: "balanced",
    label: "Google Gemini 1.5 Pro",
    maxOutputTokens: 8192,
    structuredJson: true,
    supportsMultimodal: false,
  },
  {
    providerId: "google",
    modelId: "gemini-1.5-pro",
    tier: "reasoning",
    label: "Google Gemini 1.5 Pro (reasoning)",
    maxOutputTokens: 8192,
    structuredJson: true,
    supportsMultimodal: false,
  },
] as const

const CAPABILITY_INDEX = new Map(
  AI_OS_MODEL_CAPABILITIES.map((entry) => [`${entry.providerId}:${entry.tier}`, entry]),
)

export function lookupAiOsModelCapability(
  providerId: AiOsProviderId,
  tier: AiOsModelTier,
): AiOsModelCapability | null {
  return CAPABILITY_INDEX.get(`${providerId}:${tier}`) ?? null
}

export function listAiOsModelCapabilitiesForProvider(providerId: AiOsProviderId): AiOsModelCapability[] {
  return AI_OS_MODEL_CAPABILITIES.filter((entry) => entry.providerId === providerId)
}

export function aiOsModelCapabilityCatalog() {
  return {
    entries: [...AI_OS_MODEL_CAPABILITIES],
    count: AI_OS_MODEL_CAPABILITIES.length,
  }
}
