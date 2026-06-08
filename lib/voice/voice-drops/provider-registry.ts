/** Voice drop provider registry — Phase 4B + VD-1A Twilio. */

import { ringlessVoiceDropProvider } from "@/lib/voice/voice-drops/ringless-voice-drop-provider"
import { stubVoiceDropProvider } from "@/lib/voice/voice-drops/stub-provider"
import { twilioVoiceDropProvider } from "@/lib/voice/voice-drops/twilio-voice-drop-provider"
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
