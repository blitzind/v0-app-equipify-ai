/** Growth Engine S2-F — avatar metadata catalog (static, no migration). Client-safe. */

export const GROWTH_MEDIA_AVATAR_QA_MARKER = "growth-media-avatars-s2f-v1" as const

export const GROWTH_MEDIA_AVATAR_PROVIDERS = ["elevenlabs", "retell"] as const

export type GrowthMediaAvatarProvider = (typeof GROWTH_MEDIA_AVATAR_PROVIDERS)[number]

export type GrowthMediaAvatarDefinition = {
  avatarId: string
  provider: GrowthMediaAvatarProvider
  displayName: string
  thumbnailUrl: string | null
  gender: "female" | "male" | "neutral" | null
  language: string
  accent: string | null
  supportedVoices: string[]
  supportedResolutions: string[]
  enabled: boolean
}

export const GROWTH_MEDIA_ELEVENLABS_AVATAR_CATALOG: GrowthMediaAvatarDefinition[] = [
  {
    avatarId: "elevenlabs-avatar-jordan",
    provider: "elevenlabs",
    displayName: "Jordan (Professional)",
    thumbnailUrl: null,
    gender: "neutral",
    language: "en-US",
    accent: "american",
    supportedVoices: ["jordan-professional"],
    supportedResolutions: ["720p", "1080p"],
    enabled: true,
  },
  {
    avatarId: "elevenlabs-avatar-maya",
    provider: "elevenlabs",
    displayName: "Maya (Warm)",
    thumbnailUrl: null,
    gender: "female",
    language: "en-US",
    accent: "american",
    supportedVoices: ["maya-warm"],
    supportedResolutions: ["720p", "1080p"],
    enabled: true,
  },
  {
    avatarId: "elevenlabs-avatar-alex",
    provider: "elevenlabs",
    displayName: "Alex (Executive)",
    thumbnailUrl: null,
    gender: "male",
    language: "en-US",
    accent: "british",
    supportedVoices: ["alex-executive"],
    supportedResolutions: ["720p"],
    enabled: true,
  },
]

export const GROWTH_MEDIA_RETELL_AVATAR_CATALOG: GrowthMediaAvatarDefinition[] = [
  {
    avatarId: "retell-avatar-jordan",
    provider: "retell",
    displayName: "Jordan (Retell Qualifier)",
    thumbnailUrl: null,
    gender: "neutral",
    language: "en-US",
    accent: "american",
    supportedVoices: ["retell-agent-jordan-qualifier"],
    supportedResolutions: ["720p", "1080p"],
    enabled: true,
  },
  {
    avatarId: "retell-avatar-maya",
    provider: "retell",
    displayName: "Maya (Retell Discovery)",
    thumbnailUrl: null,
    gender: "female",
    language: "en-US",
    accent: "american",
    supportedVoices: ["retell-agent-maya-discovery"],
    supportedResolutions: ["720p"],
    enabled: true,
  },
]

export const GROWTH_MEDIA_AVATAR_CATALOG: GrowthMediaAvatarDefinition[] = [
  ...GROWTH_MEDIA_ELEVENLABS_AVATAR_CATALOG,
  ...GROWTH_MEDIA_RETELL_AVATAR_CATALOG,
]

export function listEnabledMediaAvatars(
  provider: GrowthMediaAvatarProvider = "elevenlabs",
): GrowthMediaAvatarDefinition[] {
  return GROWTH_MEDIA_AVATAR_CATALOG.filter(
    (avatar) => avatar.provider === provider && avatar.enabled,
  )
}

export function getMediaAvatarById(avatarId: string | null | undefined): GrowthMediaAvatarDefinition | null {
  const trimmed = avatarId?.trim()
  if (!trimmed) return null
  return GROWTH_MEDIA_AVATAR_CATALOG.find((avatar) => avatar.avatarId === trimmed) ?? null
}

export function validateMediaAvatarId(avatarId: string | null | undefined): boolean {
  const avatar = getMediaAvatarById(avatarId)
  return avatar != null && avatar.enabled
}
