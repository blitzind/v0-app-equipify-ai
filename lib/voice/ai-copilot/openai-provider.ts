/** OpenAI AI copilot provider — Phase 3B (structured JSON only, deterministic fallback). */

import { validateAndSanitizeStructuredDrafts } from "@/lib/voice/ai-copilot/structured-output-validation"
import type { VoiceAiCopilotProvider, VoiceAiCopilotProviderResult } from "@/lib/voice/ai-copilot/provider-types"
import { generateDeterministicCopilotDrafts } from "@/lib/voice/ai-copilot/deterministic-template-provider"

export function isOpenAiCopilotConfigured(): boolean {
  return (
    process.env.VOICE_AI_COPILOT_PROVIDER?.trim() === "openai" &&
    process.env.VOICE_AI_COPILOT_OPENAI_ENABLED?.trim() === "true" &&
    Boolean(process.env.OPENAI_API_KEY?.trim())
  )
}

export const openAiCopilotProvider: VoiceAiCopilotProvider = {
  id: "openai",
  async generateSuggestions(context): Promise<VoiceAiCopilotProviderResult> {
    const fallback = generateDeterministicCopilotDrafts(context)

    if (!isOpenAiCopilotConfigured()) {
      return { provider: "deterministic_template", drafts: fallback }
    }

    // Structured OpenAI augmentation scaffold — bounded JSON array validated before use.
    // Until prompt wiring is approved, deterministic+strategy drafts remain authoritative.
    const structuredPlaceholder: unknown[] = []
    const sanitized = validateAndSanitizeStructuredDrafts(structuredPlaceholder)
    if (sanitized.length === 0) {
      return { provider: "openai", drafts: fallback }
    }

    return { provider: "openai", drafts: sanitized }
  },
}
