/** GE-AIOS-3A — Provider response normalization (client-safe). */

import type { UnifiedCompletionResponse } from "@/lib/ai/types"
import type {
  AiOsProviderId,
  AiOsProviderNormalizedResponse,
  AiOsProviderUsage,
} from "@/lib/growth/aios/ai-provider-types"

const TOKEN_COST_ESTIMATE: Record<AiOsProviderId, { prompt: number; completion: number }> = {
  openai: { prompt: 0.00000015, completion: 0.0000006 },
  anthropic: { prompt: 0.00000025, completion: 0.00000125 },
  google: { prompt: 0.000000075, completion: 0.0000003 },
}

export function estimateAiOsProviderCostUsd(input: {
  providerId: AiOsProviderId
  promptTokens: number
  completionTokens: number
}): number {
  const rates = TOKEN_COST_ESTIMATE[input.providerId]
  return Number(
    (input.promptTokens * rates.prompt + input.completionTokens * rates.completion).toFixed(6),
  )
}

export function normalizeAiOsProviderResponse(input: {
  providerId: AiOsProviderId
  modelId: string
  raw: UnifiedCompletionResponse
  failoverCount?: number
  attemptedProviders?: AiOsProviderId[]
}): AiOsProviderNormalizedResponse {
  const usage: AiOsProviderUsage = {
    promptTokens: input.raw.promptTokens,
    completionTokens: input.raw.completionTokens,
    estimatedCostUsd: estimateAiOsProviderCostUsd({
      providerId: input.providerId,
      promptTokens: input.raw.promptTokens,
      completionTokens: input.raw.completionTokens,
    }),
  }

  return {
    text: input.raw.text.trim(),
    finishReason: input.raw.finishReason ?? null,
    providerId: input.providerId,
    modelId: input.modelId,
    usage,
    failoverCount: input.failoverCount ?? 0,
    attemptedProviders: input.attemptedProviders ?? [input.providerId],
  }
}
