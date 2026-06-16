/** Growth Engine S2-G — voice profile metadata catalog (static, no migration). Client-safe. */

export const GROWTH_MEDIA_VOICE_QA_MARKER = "growth-media-voices-s2g-v1" as const

export const GROWTH_MEDIA_VOICE_PROVIDERS = ["elevenlabs"] as const

export type GrowthMediaVoiceProvider = (typeof GROWTH_MEDIA_VOICE_PROVIDERS)[number]

export type GrowthMediaVoiceDefinition = {
  voiceId: string
  provider: GrowthMediaVoiceProvider
  displayName: string
  thumbnailUrl: string | null
  gender: "female" | "male" | "neutral" | null
  language: string
  accent: string | null
  description: string | null
  category: "cloned" | "professional" | "narration" | "conversational"
  supportedModels: string[]
  enabled: boolean
}

export const GROWTH_MEDIA_ELEVENLABS_VOICE_CATALOG: GrowthMediaVoiceDefinition[] = [
  {
    voiceId: "elevenlabs-voice-jordan-clone",
    provider: "elevenlabs",
    displayName: "Jordan Clone (Professional)",
    thumbnailUrl: null,
    gender: "neutral",
    language: "en-US",
    accent: "american",
    description: "Warm professional clone suitable for outbound video intros.",
    category: "cloned",
    supportedModels: ["eleven_multilingual_v2", "eleven_turbo_v2"],
    enabled: true,
  },
  {
    voiceId: "elevenlabs-voice-maya-clone",
    provider: "elevenlabs",
    displayName: "Maya Clone (Conversational)",
    thumbnailUrl: null,
    gender: "female",
    language: "en-US",
    accent: "american",
    description: "Conversational clone for personalized follow-ups.",
    category: "conversational",
    supportedModels: ["eleven_multilingual_v2"],
    enabled: true,
  },
  {
    voiceId: "elevenlabs-voice-alex-narration",
    provider: "elevenlabs",
    displayName: "Alex Narration",
    thumbnailUrl: null,
    gender: "male",
    language: "en-GB",
    accent: "british",
    description: "Executive narration voice for lower-thirds and CTA overlays.",
    category: "narration",
    supportedModels: ["eleven_turbo_v2"],
    enabled: true,
  },
]

export function listEnabledMediaVoices(
  provider: GrowthMediaVoiceProvider = "elevenlabs",
): GrowthMediaVoiceDefinition[] {
  return GROWTH_MEDIA_ELEVENLABS_VOICE_CATALOG.filter(
    (voice) => voice.provider === provider && voice.enabled,
  )
}

export function getMediaVoiceById(voiceId: string | null | undefined): GrowthMediaVoiceDefinition | null {
  const trimmed = voiceId?.trim()
  if (!trimmed) return null
  return GROWTH_MEDIA_ELEVENLABS_VOICE_CATALOG.find((voice) => voice.voiceId === trimmed) ?? null
}

export function validateMediaVoiceId(voiceId: string | null | undefined): boolean {
  const voice = getMediaVoiceById(voiceId)
  return voice != null && voice.enabled
}
