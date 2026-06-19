/** Growth Engine F2 — Voice/avatar metadata-only generation draft builders (client-safe). */

import type {
  GrowthVideoAutopilotDraftBuildInput,
  GrowthVideoAutopilotMediaJobDraft,
} from "@/lib/growth/videos/growth-video-autopilot-draft-types"
import type { GrowthVideoAutopilotRecommendation } from "@/lib/growth/videos/growth-video-autopilot-types"

export function buildGrowthVideoAutopilotVoiceDraft(input: {
  build: GrowthVideoAutopilotDraftBuildInput
  recommendation: GrowthVideoAutopilotRecommendation
  videoPageId?: string | null
  videoAssetId?: string | null
}): GrowthVideoAutopilotMediaJobDraft | null {
  if (!input.recommendation.recommended.voiceEnabled) return null

  return {
    status: "draft",
    generationType: "voice",
    queued: false,
    workerExecutionEnabled: false,
    mediaGenerationRunId: null,
    aiJobId: null,
    mediaAssetId: null,
    provider: "elevenlabs",
    metadataHooks: {
      video_page_id: input.videoPageId ?? null,
      video_asset_id: input.videoAssetId ?? input.build.videoAssetId ?? null,
      lead_id: input.recommendation.leadId,
      script_version_id: null,
      voice_media_asset_id: null,
    },
    notes: "F2 metadata-only voice draft — worker execution disabled until operator approval.",
  }
}

export function buildGrowthVideoAutopilotAvatarDraft(input: {
  build: GrowthVideoAutopilotDraftBuildInput
  recommendation: GrowthVideoAutopilotRecommendation
  videoPageId?: string | null
  videoAssetId?: string | null
  voiceMediaAssetId?: string | null
}): GrowthVideoAutopilotMediaJobDraft | null {
  if (!input.recommendation.recommended.avatarEnabled) return null

  return {
    status: "draft",
    generationType: "avatar",
    queued: false,
    workerExecutionEnabled: false,
    mediaGenerationRunId: null,
    aiJobId: null,
    mediaAssetId: null,
    provider: "retell",
    metadataHooks: {
      video_page_id: input.videoPageId ?? null,
      video_asset_id: input.videoAssetId ?? input.build.videoAssetId ?? null,
      lead_id: input.recommendation.leadId,
      voice_media_asset_id: input.voiceMediaAssetId ?? null,
      script_version_id: null,
    },
    notes: "F2 metadata-only avatar draft — worker execution disabled until operator approval.",
  }
}
