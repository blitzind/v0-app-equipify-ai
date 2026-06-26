/** GE-AIOS-3A — Core provider bridge (server-only). Reuses lib/ai adapters — no duplicate SDK clients. */

import "server-only"

import { getProviderAdapter } from "@/lib/ai/providers"
import type { UnifiedCompletionRequest, UnifiedCompletionResponse } from "@/lib/ai/types"
import type { AiOsProviderId } from "@/lib/growth/aios/ai-provider-types"

export async function invokeCoreProviderAdapter(
  providerId: AiOsProviderId,
  request: UnifiedCompletionRequest,
): Promise<UnifiedCompletionResponse> {
  const adapter = getProviderAdapter(providerId)
  return adapter.complete(request)
}

export function coreProviderAdapterAvailable(providerId: AiOsProviderId): boolean {
  try {
    getProviderAdapter(providerId)
    return true
  } catch {
    return false
  }
}
