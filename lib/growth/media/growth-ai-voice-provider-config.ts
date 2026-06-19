import "server-only"

import type { GrowthAiVoiceProviderState } from "@/lib/growth/media/growth-ai-voice-generation-types"

export function isGrowthElevenLabsVoiceEnabled(): boolean {
  const featureEnabled = process.env.GROWTH_ELEVENLABS_VOICE_ENABLED?.trim() === "true"
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  return featureEnabled && Boolean(apiKey)
}

export function getGrowthElevenLabsVoiceProviderState(): GrowthAiVoiceProviderState {
  const featureFlagEnabled = process.env.GROWTH_ELEVENLABS_VOICE_ENABLED?.trim() === "true"
  const hasApiKey = Boolean(process.env.ELEVENLABS_API_KEY?.trim())
  const enabled = featureFlagEnabled && hasApiKey

  return {
    enabled,
    hasApiKey,
    featureFlagEnabled,
    dryRunOnly: !enabled,
    provider: "elevenlabs",
  }
}

export function resolveElevenLabsApiVoiceId(catalogVoiceId: string): string {
  const trimmed = catalogVoiceId.trim()
  if (/^[a-zA-Z0-9]{20,}$/.test(trimmed) && trimmed.includes("-") === false) {
    return trimmed
  }
  const override = process.env.ELEVENLABS_DEFAULT_VOICE_ID?.trim()
  if (override) return override
  return "21m00Tcm4TlvDq8ikWAM"
}
