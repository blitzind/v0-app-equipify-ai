import "server-only"

import type {
  GrowthAiAvatarProvider,
  GrowthAiAvatarProviderState,
  GrowthAiAvatarProviderStates,
} from "@/lib/growth/media/growth-ai-avatar-generation-types"

export function isGrowthElevenLabsAvatarEnabled(): boolean {
  const featureEnabled = process.env.GROWTH_ELEVENLABS_AVATAR_ENABLED?.trim() === "true"
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  return featureEnabled && Boolean(apiKey)
}

export function isGrowthRetellAvatarEnabled(): boolean {
  const featureEnabled = process.env.GROWTH_RETELL_AVATAR_ENABLED?.trim() === "true"
  const apiKey = process.env.RETELL_API_KEY?.trim()
  return featureEnabled && Boolean(apiKey)
}

export function getGrowthElevenLabsAvatarProviderState(): GrowthAiAvatarProviderState {
  const featureFlagEnabled = process.env.GROWTH_ELEVENLABS_AVATAR_ENABLED?.trim() === "true"
  const hasApiKey = Boolean(process.env.ELEVENLABS_API_KEY?.trim())
  const enabled = featureFlagEnabled && hasApiKey

  return {
    provider: "elevenlabs",
    enabled,
    hasApiKey,
    featureFlagEnabled,
    dryRunOnly: !enabled,
  }
}

export function getGrowthRetellAvatarProviderState(): GrowthAiAvatarProviderState {
  const featureFlagEnabled = process.env.GROWTH_RETELL_AVATAR_ENABLED?.trim() === "true"
  const hasApiKey = Boolean(process.env.RETELL_API_KEY?.trim())
  const enabled = featureFlagEnabled && hasApiKey

  return {
    provider: "retell",
    enabled,
    hasApiKey,
    featureFlagEnabled,
    dryRunOnly: !enabled,
  }
}

export function getGrowthAvatarProviderStates(): GrowthAiAvatarProviderStates {
  return {
    elevenlabs: getGrowthElevenLabsAvatarProviderState(),
    retell: getGrowthRetellAvatarProviderState(),
  }
}

export function getGrowthAvatarProviderState(provider: GrowthAiAvatarProvider): GrowthAiAvatarProviderState {
  return provider === "retell" ? getGrowthRetellAvatarProviderState() : getGrowthElevenLabsAvatarProviderState()
}

export function isGrowthAvatarProviderEnabled(provider: GrowthAiAvatarProvider): boolean {
  return getGrowthAvatarProviderState(provider).enabled
}

export function resolveElevenLabsApiAvatarId(catalogAvatarId: string): string {
  const trimmed = catalogAvatarId.trim()
  const override = process.env.ELEVENLABS_DEFAULT_AVATAR_ID?.trim()
  if (override) return override
  return trimmed.replace(/^elevenlabs-avatar-/, "")
}
