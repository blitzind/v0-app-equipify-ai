/** OpenAI AI copilot provider scaffold — Phase 3A (structured outputs, evidence required). */

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
    if (!isOpenAiCopilotConfigured()) {
      return {
        provider: "deterministic_template",
        drafts: generateDeterministicCopilotDrafts(context),
      }
    }

    // Scaffold only — structured OpenAI outputs remain gated until prompt review is approved.
    // Safe fallback: deterministic templates with evidence requirements enforced downstream.
    return {
      provider: "openai",
      drafts: generateDeterministicCopilotDrafts(context),
    }
  },
}
