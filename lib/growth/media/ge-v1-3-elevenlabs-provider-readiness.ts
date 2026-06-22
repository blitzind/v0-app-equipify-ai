import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GE_V1_3_ELEVENLABS_LIVE_QA_MARKER } from "@/lib/growth/media/ge-v1-3-types"
import { getGrowthAvatarProviderStates } from "@/lib/growth/media/growth-ai-avatar-provider-config"
import { getGrowthElevenLabsVoiceProviderState } from "@/lib/growth/media/growth-ai-voice-provider-config"
import { probeGrowthMediaGenerationRunsSchema } from "@/lib/growth/media/growth-media-generation-schema-health"
import { probeGrowthMediaAssetsSchema } from "@/lib/growth/media/media-asset-schema-health"
import {
  getElevenLabsGrowthAvatarProviderCapabilities,
} from "@/lib/growth/media/providers/elevenlabs-growth-avatar-provider"
import {
  getElevenLabsGrowthVoiceProviderCapabilities,
} from "@/lib/growth/media/providers/elevenlabs-growth-voice-provider"
import {
  isGrowthVideoAssetsSchemaReady,
  isGrowthVideoPagesSchemaReady,
} from "@/lib/growth/videos/growth-video-schema-health"

export type GeV13ElevenLabsProviderReadinessReport = {
  qaMarker: typeof GE_V1_3_ELEVENLABS_LIVE_QA_MARKER
  ready: boolean
  dryRunOnly: boolean
  voice: ReturnType<typeof getGrowthElevenLabsVoiceProviderState> & {
    defaultVoiceIdConfigured: boolean
    capabilities: ReturnType<typeof getElevenLabsGrowthVoiceProviderCapabilities>
  }
  avatar: ReturnType<typeof getGrowthAvatarProviderStates>["elevenlabs"] & {
    defaultAvatarIdConfigured: boolean
    capabilities: ReturnType<typeof getElevenLabsGrowthAvatarProviderCapabilities>
  }
  schema: {
    mediaGenerationRunsReady: boolean
    mediaAssetsReady: boolean
    videoAssetsReady: boolean
    videoPagesReady: boolean
  }
  warnings: string[]
  blockers: string[]
  diagnostics: {
    env: {
      ELEVENLABS_API_KEY: boolean
      GROWTH_ELEVENLABS_VOICE_ENABLED: boolean
      GROWTH_ELEVENLABS_AVATAR_ENABLED: boolean
      ELEVENLABS_DEFAULT_VOICE_ID: boolean
      ELEVENLABS_DEFAULT_AVATAR_ID: boolean
    }
    gracefulDegradation: string
    humanApprovalGatesEnabled: true
    autonomousSendingEnabled: false
  }
}

function buildWarnings(input: {
  voiceEnabled: boolean
  avatarEnabled: boolean
  voiceDryRun: boolean
  avatarDryRun: boolean
}): string[] {
  const warnings: string[] = []
  if (!process.env.ELEVENLABS_API_KEY?.trim()) {
    warnings.push("ELEVENLABS_API_KEY is not configured — voice and avatar generation run in dry-run mode.")
  }
  if (!input.voiceEnabled && process.env.ELEVENLABS_API_KEY?.trim()) {
    warnings.push("Set GROWTH_ELEVENLABS_VOICE_ENABLED=true to enable live ElevenLabs voice generation.")
  }
  if (!input.avatarEnabled && process.env.ELEVENLABS_API_KEY?.trim()) {
    warnings.push("Set GROWTH_ELEVENLABS_AVATAR_ENABLED=true to enable live ElevenLabs avatar video generation.")
  }
  if (input.voiceDryRun) {
    warnings.push("Voice provider is in dry-run mode — mock MP3 bytes will be written to media_assets.")
  }
  if (input.avatarDryRun) {
    warnings.push("Avatar provider is in dry-run mode — mock MP4 bytes will be written to media_assets.")
  }
  if (!process.env.ELEVENLABS_DEFAULT_VOICE_ID?.trim()) {
    warnings.push("ELEVENLABS_DEFAULT_VOICE_ID is unset — catalog voice IDs map to ElevenLabs fallback voice.")
  }
  if (!process.env.ELEVENLABS_DEFAULT_AVATAR_ID?.trim()) {
    warnings.push("ELEVENLABS_DEFAULT_AVATAR_ID is unset — catalog avatar IDs strip the elevenlabs-avatar- prefix.")
  }
  return warnings
}

export async function buildGeV13ElevenLabsProviderReadinessReport(
  admin: SupabaseClient,
): Promise<GeV13ElevenLabsProviderReadinessReport> {
  const voiceState = getGrowthElevenLabsVoiceProviderState()
  const avatarStates = getGrowthAvatarProviderStates()
  const avatarState = avatarStates.elevenlabs

  const [mediaGenProbe, mediaAssetsProbe, videoAssetsReady, videoPagesReady] = await Promise.all([
    probeGrowthMediaGenerationRunsSchema(admin),
    probeGrowthMediaAssetsSchema(admin),
    isGrowthVideoAssetsSchemaReady(admin),
    isGrowthVideoPagesSchemaReady(admin),
  ])

  const schema = {
    mediaGenerationRunsReady: mediaGenProbe.media_generation_runs_ready,
    mediaAssetsReady: mediaAssetsProbe.ready,
    videoAssetsReady,
    videoPagesReady,
  }

  const blockers: string[] = []
  if (!schema.mediaGenerationRunsReady) blockers.push("media_generation_runs_schema_not_ready")
  if (!schema.mediaAssetsReady) blockers.push("media_assets_schema_not_ready")
  if (!schema.videoAssetsReady) blockers.push("video_assets_schema_not_ready")
  if (!schema.videoPagesReady) blockers.push("video_pages_schema_not_ready")

  const dryRunOnly = voiceState.dryRunOnly && avatarState.dryRunOnly
  const liveCapable = voiceState.enabled || avatarState.enabled
  const ready = blockers.length === 0 && (liveCapable || dryRunOnly)

  const warnings = buildWarnings({
    voiceEnabled: voiceState.enabled,
    avatarEnabled: avatarState.enabled,
    voiceDryRun: voiceState.dryRunOnly,
    avatarDryRun: avatarState.dryRunOnly,
  })

  return {
    qaMarker: GE_V1_3_ELEVENLABS_LIVE_QA_MARKER,
    ready,
    dryRunOnly: !liveCapable,
    voice: {
      ...voiceState,
      defaultVoiceIdConfigured: Boolean(process.env.ELEVENLABS_DEFAULT_VOICE_ID?.trim()),
      capabilities: getElevenLabsGrowthVoiceProviderCapabilities(),
    },
    avatar: {
      ...avatarState,
      defaultAvatarIdConfigured: Boolean(process.env.ELEVENLABS_DEFAULT_AVATAR_ID?.trim()),
      capabilities: getElevenLabsGrowthAvatarProviderCapabilities(),
    },
    schema,
    warnings,
    blockers,
    diagnostics: {
      env: {
        ELEVENLABS_API_KEY: Boolean(process.env.ELEVENLABS_API_KEY?.trim()),
        GROWTH_ELEVENLABS_VOICE_ENABLED: process.env.GROWTH_ELEVENLABS_VOICE_ENABLED?.trim() === "true",
        GROWTH_ELEVENLABS_AVATAR_ENABLED: process.env.GROWTH_ELEVENLABS_AVATAR_ENABLED?.trim() === "true",
        ELEVENLABS_DEFAULT_VOICE_ID: Boolean(process.env.ELEVENLABS_DEFAULT_VOICE_ID?.trim()),
        ELEVENLABS_DEFAULT_AVATAR_ID: Boolean(process.env.ELEVENLABS_DEFAULT_AVATAR_ID?.trim()),
      },
      gracefulDegradation:
        liveCapable
          ? "Live ElevenLabs execution enabled for configured modalities."
          : "Providers degrade to deterministic dry-run output when flags or API key are missing.",
      humanApprovalGatesEnabled: true,
      autonomousSendingEnabled: false,
    },
  }
}
