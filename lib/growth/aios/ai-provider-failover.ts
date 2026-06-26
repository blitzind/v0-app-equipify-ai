/** GE-AIOS-3A — Provider failover hooks (server-only). */

import "server-only"

import type { AiChatMessage } from "@/lib/ai/types"
import { invokeCoreProviderAdapter } from "@/lib/growth/aios/ai-provider-core-bridge"
import { normalizeAiOsProviderResponse } from "@/lib/growth/aios/ai-provider-normalizer"
import type {
  AiOsProviderId,
  AiOsProviderNormalizedResponse,
  AiOsProviderSelection,
} from "@/lib/growth/aios/ai-provider-types"

export type AiOsProviderFailoverInput = {
  candidates: AiOsProviderSelection[]
  messages: AiChatMessage[]
  temperature: number
  maxOutputTokens: number
  timeoutMs?: number
  maxRetries?: number
  onProviderDegraded?: (input: {
    providerId: AiOsProviderId
    error: Error
    attemptIndex: number
  }) => void | Promise<void>
  onProviderSwitched?: (input: {
    fromProviderId: AiOsProviderId | null
    toProviderId: AiOsProviderId
    attemptIndex: number
  }) => void | Promise<void>
}

export type AiOsProviderFailoverResult =
  | { ok: true; response: AiOsProviderNormalizedResponse }
  | { ok: false; error: Error; attemptedProviders: AiOsProviderId[] }

export async function invokeAiOsProviderWithFailover(
  input: AiOsProviderFailoverInput,
): Promise<AiOsProviderFailoverResult> {
  const attemptedProviders: AiOsProviderId[] = []
  let lastError: Error | null = null
  let previousProviderId: AiOsProviderId | null = null
  let failoverCount = 0

  for (let index = 0; index < input.candidates.length; index++) {
    const candidate = input.candidates[index]
    attemptedProviders.push(candidate.providerId)

    if (previousProviderId && previousProviderId !== candidate.providerId) {
      failoverCount++
      await input.onProviderSwitched?.({
        fromProviderId: previousProviderId,
        toProviderId: candidate.providerId,
        attemptIndex: index,
      })
    }

    try {
      const raw = await invokeCoreProviderAdapter(candidate.providerId, {
        model: candidate.modelId,
        messages: input.messages,
        temperature: input.temperature,
        maxOutputTokens: input.maxOutputTokens,
        structuredMode: "none",
        timeoutMs: input.timeoutMs ?? 60_000,
        maxRetries: input.maxRetries ?? 1,
      })

      return {
        ok: true,
        response: normalizeAiOsProviderResponse({
          providerId: candidate.providerId,
          modelId: candidate.modelId,
          raw,
          failoverCount,
          attemptedProviders,
        }),
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      await input.onProviderDegraded?.({
        providerId: candidate.providerId,
        error: lastError,
        attemptIndex: index,
      })
      previousProviderId = candidate.providerId
    }
  }

  return {
    ok: false,
    error: lastError ?? new Error("ai_provider_failover_exhausted"),
    attemptedProviders,
  }
}
