/** Voice AI Copilot provider registry — Phase 3A. */

import { deterministicTemplateCopilotProvider } from "@/lib/voice/ai-copilot/deterministic-template-provider"
import { isOpenAiCopilotConfigured, openAiCopilotProvider } from "@/lib/voice/ai-copilot/openai-provider"
import type { VoiceAiCopilotProvider } from "@/lib/voice/ai-copilot/provider-types"
import { stubCopilotProvider } from "@/lib/voice/ai-copilot/stub-provider"
import type { VoiceAiCopilotProviderId } from "@/lib/voice/ai-copilot/types"
import { VOICE_AI_COPILOT_PROVIDER_TIMEOUT_MS } from "@/lib/voice/ai-copilot/types"

const PROVIDERS: Record<VoiceAiCopilotProviderId, VoiceAiCopilotProvider> = {
  deterministic_template: deterministicTemplateCopilotProvider,
  openai: openAiCopilotProvider,
  stub: stubCopilotProvider,
}

export function resolveVoiceAiCopilotProviderMode(): VoiceAiCopilotProviderId {
  const configured = process.env.VOICE_AI_COPILOT_PROVIDER?.trim()
  if (configured === "openai" && isOpenAiCopilotConfigured()) return "openai"
  if (configured === "stub") return "stub"
  return "deterministic_template"
}

export function resolveVoiceAiCopilotProvider(): VoiceAiCopilotProvider {
  return PROVIDERS[resolveVoiceAiCopilotProviderMode()] ?? deterministicTemplateCopilotProvider
}

export async function generateCopilotSuggestionsWithTimeout(
  provider: VoiceAiCopilotProvider,
  context: Parameters<VoiceAiCopilotProvider["generateSuggestions"]>[0],
) {
  const timeoutMs = VOICE_AI_COPILOT_PROVIDER_TIMEOUT_MS
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined

  try {
    const result = await Promise.race([
      provider.generateSuggestions(context),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error("copilot_provider_timeout")), timeoutMs)
      }),
    ])
    return result
  } catch {
    return deterministicTemplateCopilotProvider.generateSuggestions(context)
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
  }
}
