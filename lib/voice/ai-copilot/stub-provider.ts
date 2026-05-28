/** Stub AI copilot provider — Phase 3A fallback. */

import type { VoiceAiCopilotProvider, VoiceAiCopilotProviderResult } from "@/lib/voice/ai-copilot/provider-types"

export const stubCopilotProvider: VoiceAiCopilotProvider = {
  id: "stub",
  async generateSuggestions(): Promise<VoiceAiCopilotProviderResult> {
    return { provider: "stub", drafts: [] }
  },
}
