/** GE-AIOS-3A — AI OS Provider types (client-safe). */

import type { AiContextPackage } from "@/lib/growth/aios/ai-context-assembly-types"

export const GROWTH_AIOS_3A_PHASE = "GE-AIOS-3A" as const

export const GROWTH_AI_PROVIDER_ADAPTERS_QA_MARKER =
  "growth-aios-3a-provider-adapters-v1" as const

export const GROWTH_AI_PROVIDER_ADAPTERS_SCHEMA_MIGRATION =
  "20271001200000_growth_aios_3a_provider_adapters.sql" as const

/** AI OS provider IDs — aligned with Core `AiProviderId` (excluding mock). */
export const AI_OS_PROVIDER_IDS = ["openai", "anthropic", "google"] as const

export type AiOsProviderId = (typeof AI_OS_PROVIDER_IDS)[number]

export const AI_OS_MODEL_TIERS = ["fast", "balanced", "reasoning"] as const

export type AiOsModelTier = (typeof AI_OS_MODEL_TIERS)[number]

export const AI_OS_PROVIDER_REQUEST_STATUSES = ["pending", "completed", "failed"] as const

export type AiOsProviderRequestStatus = (typeof AI_OS_PROVIDER_REQUEST_STATUSES)[number]

export type AiOsProviderModelRef = {
  providerId: AiOsProviderId
  modelId: string
  tier: AiOsModelTier
}

export type AiOsProviderInvokeInput = {
  organizationId: string
  contextPackage: AiContextPackage
  purpose: string
  preferredProvider?: AiOsProviderId
  modelTier?: AiOsModelTier
  maxOutputTokens?: number
  temperature?: number
  source?: string
}

export type AiOsProviderUsage = {
  promptTokens: number
  completionTokens: number
  estimatedCostUsd: number
}

/** Normalized provider response — all adapters return this shape. */
export type AiOsProviderNormalizedResponse = {
  text: string
  finishReason: string | null
  providerId: AiOsProviderId
  modelId: string
  usage: AiOsProviderUsage
  failoverCount: number
  attemptedProviders: AiOsProviderId[]
}

export type AiOsProviderInvokeResult = {
  requestId: string
  response: AiOsProviderNormalizedResponse
}

export type AiOsProviderSelection = {
  providerId: AiOsProviderId
  modelId: string
  tier: AiOsModelTier
  rank: number
}

export type AiOsProviderHealthStatus = {
  providerId: AiOsProviderId
  available: boolean
  degraded: boolean
  message: string | null
}

export type AiOsProviderRuntime = {
  id: string
  organizationId: string
  degraded: boolean
  degradedReason: string | null
  activeProvider: AiOsProviderId | null
  requestCount: number
  failureCount: number
  failoverCount: number
  lastRequestAt: string | null
  lastSuccessAt: string | null
  metadata: Record<string, unknown>
  qaMarker: string
  createdAt: string
  updatedAt: string
}

/** AI OS components must invoke providers only through this layer. */
export const AI_OS_PROVIDER_RUNTIME_RULE =
  "AI OS Provider Abstraction is the sole gateway for LLM requests — Decision Engine and Executive Brain never call providers directly; Context Package is the only AI input." as const

/** Contract for provider adapters registered in AI OS. */
export interface AiOsProviderAdapter {
  providerId: AiOsProviderId
  label: string
  supportsMultimodal: boolean
  defaultModelForTier(tier: AiOsModelTier): string
}
