import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AI_VOICE_DEFAULT_SETTINGS,
  type GrowthAiVoiceAiPayload,
  type GrowthAiVoiceSettings,
} from "@/lib/growth/media/growth-ai-voice-generation-types"
import {
  GROWTH_AI_AVATAR_DEFAULT_SETTINGS,
  type GrowthAiAvatarAiPayload,
  type GrowthAiAvatarSettings,
} from "@/lib/growth/media/growth-ai-avatar-generation-types"
import { getGrowthAvatarProviderState } from "@/lib/growth/media/growth-ai-avatar-provider-config"
import { getGrowthElevenLabsVoiceProviderState } from "@/lib/growth/media/growth-ai-voice-provider-config"
import { writebackGeneratedAudioAsset } from "@/lib/growth/media/growth-media-audio-writeback-service"
import { writebackGeneratedAvatarVideoAsset } from "@/lib/growth/media/growth-media-video-writeback-service"
import {
  cancelMediaGenerationJob,
  getMediaGenerationJobById,
} from "@/lib/growth/media/growth-media-generation-job-service"
import { recordMediaGenerationProgress } from "@/lib/growth/media/growth-media-generation-progress-service"
import { updateMediaGenerationRunRow } from "@/lib/growth/media/growth-media-generation-run-service"
import type { GrowthMediaGenerationRun } from "@/lib/growth/media/growth-media-generation-types"
import type { AIAvatarProvider } from "@/lib/growth/media/growth-media-provider-contracts"
import { getElevenLabsGrowthVoiceProvider } from "@/lib/growth/media/providers/elevenlabs-growth-voice-provider"
import { getElevenLabsGrowthAvatarProvider } from "@/lib/growth/media/providers/elevenlabs-growth-avatar-provider"
import { getRetellGrowthAvatarProvider } from "@/lib/growth/media/providers/retell-growth-avatar-provider"

function asSettings(raw: Record<string, unknown> | undefined): GrowthAiVoiceSettings {
  return {
    stability: Number(raw?.stability ?? GROWTH_AI_VOICE_DEFAULT_SETTINGS.stability),
    similarity: Number(raw?.similarity ?? GROWTH_AI_VOICE_DEFAULT_SETTINGS.similarity),
    speed: Number(raw?.speed ?? GROWTH_AI_VOICE_DEFAULT_SETTINGS.speed),
  }
}

function buildAiPayload(input: {
  run: GrowthMediaGenerationRun
  scriptVersionId: string | null
  voiceId: string
  outputMediaAssetId: string | null
  audioUrl: string | null
  dryRun: boolean
}): GrowthAiVoiceAiPayload {
  const providerRequest = input.run.input.provider_request ?? {}
  return {
    voice_generation_input: {
      videoPageId: input.run.input.metadata_hooks?.video_page_id ?? "",
      scriptVersionId: input.scriptVersionId,
      voiceId: input.voiceId,
      provider: input.run.provider,
      settings: asSettings(providerRequest),
      dryRun: input.dryRun,
    },
    script_version_id: input.scriptVersionId,
    provider: input.run.provider,
    voice_id: input.voiceId,
    job_id: input.run.aiJobId,
    media_generation_run_id: input.run.id,
    output_media_asset_id: input.outputMediaAssetId,
    audio_url: input.audioUrl,
    sources_used: [
      "growth_ai_voice_generation",
      input.dryRun ? "dry_run_mock_audio" : "elevenlabs_text_to_speech",
      "growth_media_audio_writeback",
    ],
    requires_human_review: true,
    autonomous_execution_enabled: false,
    dry_run: input.dryRun,
  }
}

export async function processVoiceGenerationRun(
  admin: SupabaseClient,
  input: {
    organizationId: string
    runId: string
    createdBy: string
    forceDryRun?: boolean
  },
): Promise<GrowthMediaGenerationRun> {
  const run = await getMediaGenerationJobById(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
  })
  if (!run) throw new Error("not_found")
  if (run.generationType !== "voice_generation") throw new Error("invalid_generation_type")

  const providerState = getGrowthElevenLabsVoiceProviderState()
  const dryRun = input.forceDryRun ?? providerState.dryRunOnly
  const providerRequest = run.input.provider_request ?? {}
  const voiceId =
    typeof providerRequest.voice_id === "string" ? providerRequest.voice_id : "elevenlabs-voice-jordan-clone"
  const script =
    typeof providerRequest.script === "string" ? providerRequest.script.trim() : ""
  const scriptVersionId =
    typeof providerRequest.script_version_id === "string" ? providerRequest.script_version_id : null

  if (!script) {
    await recordMediaGenerationProgress(admin, {
      organizationId: input.organizationId,
      runId: input.runId,
      step: "failed",
      progressPercent: 0,
      message: "Script text is required.",
      status: "failed",
    })
    await updateMediaGenerationRunRow(admin, {
      organizationId: input.organizationId,
      runId: input.runId,
      patch: { error: { message: "script_required" } },
    })
    throw new Error("script_required")
  }

  await recordMediaGenerationProgress(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    step: dryRun ? "dry_run_preparing" : "provider_preparing",
    progressPercent: 10,
    message: dryRun
      ? "Dry-run voice generation — provider disabled."
      : "ElevenLabs voice generation started.",
    status: "preparing",
  })

  const provider = getElevenLabsGrowthVoiceProvider()

  await recordMediaGenerationProgress(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    step: "provider_processing",
    progressPercent: 40,
    message: dryRun ? "Generating mock audio bytes." : "Calling ElevenLabs text-to-speech.",
    status: "processing",
  })

  let voiceResult
  try {
    voiceResult = await provider.generateVoice({
      organizationId: input.organizationId,
      runId: input.runId,
      script,
      voiceId,
      metadataHooks: run.input.metadata_hooks,
      providerRequest,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await recordMediaGenerationProgress(admin, {
      organizationId: input.organizationId,
      runId: input.runId,
      step: "failed",
      progressPercent: run.progressPercent,
      message,
      status: "failed",
    })
    await updateMediaGenerationRunRow(admin, {
      organizationId: input.organizationId,
      runId: input.runId,
      patch: { error: { message } },
    })
    throw error
  }

  await recordMediaGenerationProgress(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    step: "storage_writeback",
    progressPercent: 70,
    message: "Writing audio to media storage.",
    status: "processing",
  })

  const aiPayload = buildAiPayload({
    run,
    scriptVersionId,
    voiceId,
    outputMediaAssetId: null,
    audioUrl: null,
    dryRun: voiceResult.dryRun ?? dryRun,
  })

  const writeback = await writebackGeneratedAudioAsset(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    createdBy: input.createdBy,
    audioBytes: voiceResult.audioBytes ?? new Uint8Array(),
    mimeType: voiceResult.mimeType,
    title: `Voiceover ${scriptVersionId?.slice(0, 8) ?? input.runId.slice(0, 8)}`,
    metadataHooks: run.input.metadata_hooks as Record<string, unknown>,
    aiPayload,
    dryRun: voiceResult.dryRun ?? dryRun,
    videoPageId: run.input.metadata_hooks?.video_page_id ?? null,
  })

  const completedPayload = buildAiPayload({
    run,
    scriptVersionId,
    voiceId,
    outputMediaAssetId: writeback.assetId,
    audioUrl: writeback.signedUrl ?? null,
    dryRun: voiceResult.dryRun ?? dryRun,
  })

  const completed = await recordMediaGenerationProgress(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    step: "completed",
    progressPercent: 100,
    message: dryRun ? "Dry-run voice generation completed." : "Voice generation completed.",
    status: "completed",
  })

  return updateMediaGenerationRunRow(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    patch: {
      output: {
        ...completed.output,
        storage_writeback: {
          target: "media_asset",
          storage_path: writeback.storagePath,
          asset_id: writeback.assetId,
          mime_type: voiceResult.mimeType,
        },
        ai_payload: completedPayload,
      },
      error: {},
    },
  })
}

export async function cancelVoiceGenerationRun(
  admin: SupabaseClient,
  input: { organizationId: string; runId: string; reason?: string | null },
): Promise<GrowthMediaGenerationRun> {
  const provider = getElevenLabsGrowthVoiceProvider()
  await provider.cancelGeneration(input.runId).catch(() => undefined)
  return cancelMediaGenerationJob(admin, input)
}

function asAvatarSettings(raw: Record<string, unknown> | undefined): GrowthAiAvatarSettings {
  return {
    resolution:
      typeof raw?.resolution === "string" ? raw.resolution : GROWTH_AI_AVATAR_DEFAULT_SETTINGS.resolution,
    background:
      typeof raw?.background === "string" ? raw.background : GROWTH_AI_AVATAR_DEFAULT_SETTINGS.background,
    theme: typeof raw?.theme === "string" ? raw.theme : GROWTH_AI_AVATAR_DEFAULT_SETTINGS.theme,
  }
}

function resolveAvatarProvider(provider: string): AIAvatarProvider {
  if (provider === "retell") return getRetellGrowthAvatarProvider()
  return getElevenLabsGrowthAvatarProvider()
}

function buildAvatarAiPayload(input: {
  run: GrowthMediaGenerationRun
  scriptVersionId: string | null
  avatarId: string
  voiceMediaAssetId: string | null
  outputMediaAssetId: string | null
  videoUrl: string | null
  dryRun: boolean
}): GrowthAiAvatarAiPayload {
  const providerRequest = input.run.input.provider_request ?? {}
  const settings = asAvatarSettings(providerRequest)
  return {
    avatar_generation_input: {
      videoPageId: input.run.input.metadata_hooks?.video_page_id ?? "",
      scriptVersionId: input.scriptVersionId,
      avatarId: input.avatarId,
      provider: (input.run.provider === "retell" ? "retell" : "elevenlabs") as "elevenlabs" | "retell",
      voiceMediaAssetId: input.voiceMediaAssetId,
      settings,
      dryRun: input.dryRun,
    },
    script_version_id: input.scriptVersionId,
    voice_media_asset_id: input.voiceMediaAssetId,
    provider: input.run.provider,
    avatar_id: input.avatarId,
    job_id: input.run.aiJobId,
    media_generation_run_id: input.run.id,
    output_media_asset_id: input.outputMediaAssetId,
    video_url: input.videoUrl,
    sources_used: [
      "growth_ai_avatar_generation",
      input.dryRun ? "dry_run_mock_video" : `${input.run.provider}_avatar_video`,
      "growth_media_video_writeback",
    ],
    requires_human_review: true,
    autonomous_execution_enabled: false,
    dry_run: input.dryRun,
  }
}

export async function processAvatarGenerationRun(
  admin: SupabaseClient,
  input: {
    organizationId: string
    runId: string
    createdBy: string
    forceDryRun?: boolean
  },
): Promise<GrowthMediaGenerationRun> {
  const run = await getMediaGenerationJobById(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
  })
  if (!run) throw new Error("not_found")
  if (run.generationType !== "avatar_generation") throw new Error("invalid_generation_type")

  const providerName = run.provider === "retell" ? "retell" : "elevenlabs"
  const providerState = getGrowthAvatarProviderState(providerName)
  const dryRun = input.forceDryRun ?? providerState.dryRunOnly
  const providerRequest = run.input.provider_request ?? {}
  const avatarId =
    typeof providerRequest.avatar_id === "string" ? providerRequest.avatar_id : "elevenlabs-avatar-jordan"
  const script =
    typeof providerRequest.script === "string" ? providerRequest.script.trim() : ""
  const scriptVersionId =
    typeof providerRequest.script_version_id === "string" ? providerRequest.script_version_id : null
  const voiceMediaAssetId =
    typeof providerRequest.voice_media_asset_id === "string" ? providerRequest.voice_media_asset_id : null

  if (!script) {
    await recordMediaGenerationProgress(admin, {
      organizationId: input.organizationId,
      runId: input.runId,
      step: "failed",
      progressPercent: 0,
      message: "Script text is required.",
      status: "failed",
    })
    await updateMediaGenerationRunRow(admin, {
      organizationId: input.organizationId,
      runId: input.runId,
      patch: { error: { message: "script_required" } },
    })
    throw new Error("script_required")
  }

  await recordMediaGenerationProgress(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    step: dryRun ? "dry_run_preparing" : "provider_preparing",
    progressPercent: 10,
    message: dryRun
      ? "Dry-run avatar generation — provider disabled."
      : `${providerName} avatar generation started.`,
    status: "preparing",
  })

  const provider = resolveAvatarProvider(providerName)

  await recordMediaGenerationProgress(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    step: "provider_processing",
    progressPercent: 40,
    message: dryRun ? "Generating mock MP4 bytes." : `Calling ${providerName} avatar video API.`,
    status: "processing",
  })

  let avatarResult
  try {
    avatarResult = await provider.generateAvatarVideo({
      organizationId: input.organizationId,
      runId: input.runId,
      script,
      avatarId,
      metadataHooks: run.input.metadata_hooks,
      providerRequest,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await recordMediaGenerationProgress(admin, {
      organizationId: input.organizationId,
      runId: input.runId,
      step: "failed",
      progressPercent: run.progressPercent,
      message,
      status: "failed",
    })
    await updateMediaGenerationRunRow(admin, {
      organizationId: input.organizationId,
      runId: input.runId,
      patch: { error: { message } },
    })
    throw error
  }

  await recordMediaGenerationProgress(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    step: "storage_writeback",
    progressPercent: 70,
    message: "Writing avatar video to media storage.",
    status: "processing",
  })

  const aiPayload = buildAvatarAiPayload({
    run,
    scriptVersionId,
    avatarId,
    voiceMediaAssetId,
    outputMediaAssetId: null,
    videoUrl: null,
    dryRun: avatarResult.dryRun ?? dryRun,
  })

  const writeback = await writebackGeneratedAvatarVideoAsset(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    createdBy: input.createdBy,
    videoBytes: avatarResult.videoBytes ?? new Uint8Array(),
    mimeType: avatarResult.mimeType,
    title: `Avatar ${scriptVersionId?.slice(0, 8) ?? input.runId.slice(0, 8)}`,
    metadataHooks: run.input.metadata_hooks as Record<string, unknown>,
    aiPayload,
    dryRun: avatarResult.dryRun ?? dryRun,
    videoPageId: run.input.metadata_hooks?.video_page_id ?? null,
  })

  const completedPayload = buildAvatarAiPayload({
    run,
    scriptVersionId,
    avatarId,
    voiceMediaAssetId,
    outputMediaAssetId: writeback.assetId,
    videoUrl: writeback.signedUrl ?? null,
    dryRun: avatarResult.dryRun ?? dryRun,
  })

  const completed = await recordMediaGenerationProgress(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    step: "completed",
    progressPercent: 100,
    message: dryRun ? "Dry-run avatar generation completed." : "Avatar generation completed.",
    status: "completed",
  })

  return updateMediaGenerationRunRow(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    patch: {
      output: {
        ...completed.output,
        storage_writeback: {
          target: "media_asset",
          storage_path: writeback.storagePath,
          asset_id: writeback.assetId,
          mime_type: avatarResult.mimeType,
        },
        ai_payload: completedPayload,
      },
      error: {},
    },
  })
}

export async function cancelAvatarGenerationRun(
  admin: SupabaseClient,
  input: { organizationId: string; runId: string; reason?: string | null },
): Promise<GrowthMediaGenerationRun> {
  const run = await getMediaGenerationJobById(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
  })
  if (run) {
    const provider = resolveAvatarProvider(run.provider === "retell" ? "retell" : "elevenlabs")
    await provider.cancelGeneration(input.runId).catch(() => undefined)
  }
  return cancelMediaGenerationJob(admin, input)
}
