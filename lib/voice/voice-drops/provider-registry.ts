/** Voice drop provider registry — Phase 4B. */

import { stubVoiceDropProvider } from "@/lib/voice/voice-drops/stub-provider"
import { ringlessVoiceDropProvider, twilioVoiceDropProvider } from "@/lib/voice/voice-drops/twilio-scaffold-provider"
import type { VoiceDropProvider } from "@/lib/voice/voice-drops/provider-types"
import type { VoiceDropProviderId } from "@/lib/voice/voice-drops/types"

export { stubVoiceDropProvider, twilioVoiceDropProvider, ringlessVoiceDropProvider }

export function resolveVoiceDropProvider(mode: VoiceDropProviderId): VoiceDropProvider {
  switch (mode) {
    case "twilio":
      return twilioVoiceDropProvider
    case "ringless_future":
      return ringlessVoiceDropProvider
    default:
      return stubVoiceDropProvider
  }
}
