import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AI_VOICE_DEFAULT_SETTINGS,
  type GrowthAiVoiceAiPayload,
  type GrowthAiVoiceGenerationInput,
  type GrowthAiVoiceJobView,
  type GrowthAiVoiceProviderState,
  type GrowthAiVoiceSettings,
} from "@/lib/growth/media/growth-ai-voice-generation-types"
import { getGrowthElevenLabsVoiceProviderState } from "@/lib/growth/media/growth-ai-voice-provider-config"
import { buildVoiceoverStoragePath } from "@/lib/growth/media/growth-media-audio-writeback-service"
import {
  createMediaGenerationJob,
  getMediaGenerationJobById,
  patchMediaGenerationJob,
} from "@/lib/growth/media/growth-media-generation-job-service"
import {
  cancelVoiceGenerationRun,
  processVoiceGenerationRun,
} from "@/lib/growth/media/growth-media-generation-worker-service"
import { resolveMediaStorageProvider } from "@/lib/growth/media/media-asset-storage-providers"
import { validateMediaVoiceId } from "@/lib/growth/media/media-voice-types"
import { getGrowthVideoPageScriptState } from "@/lib/growth/videos/growth-video-script-generation-service"
import {
  getCurrentGrowthVideoScriptVersion,
  parseGrowthVideoScriptMetadata,
} from "@/lib/growth/videos/growth-video-script-version-service"
import type { GrowthMediaGenerationRun } from "@/lib/growth/media/growth-media-generation-types"
import { resolvePersonalizedVideoGenerationScript } from "@/lib/growth/media/ge-v1-3-prospect-script-resolution"
import type { GeV13ProspectGenerationInput } from "@/lib/growth/media/ge-v1-3-types"

function normalizeSettings(input?: Partial<GrowthAiVoiceSettings>): GrowthAiVoiceSettings {
  return {
    stability: input?.stability ?? GROWTH_AI_VOICE_DEFAULT_SETTINGS.stability,
    similarity: input?.similarity ?? GROWTH_AI_VOICE_DEFAULT_SETTINGS.similarity,
    speed: input?.speed ?? GROWTH_AI_VOICE_DEFAULT_SETTINGS.speed,
  }
}

function resolveScriptVersion(
  pageMetadata: ReturnType<typeof parseGrowthVideoScriptMetadata>,
  scriptVersionId?: string | null,
) {
  if (scriptVersionId) {
    return pageMetadata.versions.find((version) => version.id === scriptVersionId) ?? null
  }
  return getCurrentGrowthVideoScriptVersion(pageMetadata)
}

export async function resolveVideoPageVoiceScript(
  admin: SupabaseClient,
  input: {
    organizationId: string
    videoPageId: string
    scriptVersionId?: string | null
    prospect?: GeV13ProspectGenerationInput | null
  },
): Promise<{
  script: string
  scriptVersionId: string | null
  videoAssetId: string | null
  missingVariables?: string[]
  degraded?: boolean
}> {
  if (input.prospect) {
    const resolved = await resolvePersonalizedVideoGenerationScript(admin, {
      organizationId: input.organizationId,
      videoPageId: input.videoPageId,
      scriptVersionId: input.scriptVersionId,
      prospect: input.prospect,
    })
    return {
      script: resolved.mergedScript,
      scriptVersionId: resolved.scriptVersionId,
      videoAssetId: resolved.videoAssetId,
      missingVariables: resolved.missingVariables,
      degraded: resolved.degraded,
    }
  }

  const state = await getGrowthVideoPageScriptState(admin, {
    organizationId: input.organizationId,
    pageId: input.videoPageId,
  })

  const version = resolveScriptVersion(state.metadata, input.scriptVersionId)
  if (!version?.output?.script?.trim()) {
    throw new Error("script_version_not_found")
  }

  return {
    script: version.output.script.trim(),
    scriptVersionId: version.id,
    videoAssetId: state.page.videoAssetId,
  }
}

function mapRunToVoiceJobView(
  run: GrowthMediaGenerationRun,
  providerState: GrowthAiVoiceProviderState,
  audioUrl?: string | null,
): GrowthAiVoiceJobView {
  const providerRequest = run.input.provider_request ?? {}
  const outputPayload = run.output as Record<string, unknown>
  const aiPayload =
    outputPayload.ai_payload && typeof outputPayload.ai_payload === "object"
      ? (outputPayload.ai_payload as GrowthAiVoiceAiPayload)
      : null
  const writeback =
    outputPayload.storage_writeback && typeof outputPayload.storage_writeback === "object"
      ? (outputPayload.storage_writeback as Record<string, unknown>)
      : null

  return {
    runId: run.id,
    aiJobId: run.aiJobId,
    status: run.status,
    progressPercent: run.progressPercent,
    provider: run.provider,
    providerState,
    scriptVersionId:
      typeof providerRequest.script_version_id === "string" ? providerRequest.script_version_id : null,
    voiceId: typeof providerRequest.voice_id === "string" ? providerRequest.voice_id : null,
    settings: normalizeSettings(providerRequest as Partial<GrowthAiVoiceSettings>),
    progressTimeline: run.output.progress_timeline ?? [],
    outputMediaAssetId:
      (typeof writeback?.asset_id === "string" ? writeback.asset_id : null) ??
      aiPayload?.output_media_asset_id ??
      null,
    audioUrl: audioUrl ?? aiPayload?.audio_url ?? null,
    downloadUrl: audioUrl ?? aiPayload?.audio_url ?? null,
    aiPayload,
    error: run.error,
    retryCount: run.retryCount,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  }
}

export async function createGrowthAiVoiceGenerationJob(
  admin: SupabaseClient,
  input: {
    organizationId: string
    createdBy: string
    generation: GrowthAiVoiceGenerationInput
  },
): Promise<GrowthAiVoiceJobView> {
  if (!validateMediaVoiceId(input.generation.voiceId)) {
    throw new Error("invalid_voice_id")
  }

  const providerState = getGrowthElevenLabsVoiceProviderState()
  const settings = normalizeSettings(input.generation.settings)
  const { script, scriptVersionId, videoAssetId, missingVariables, degraded } =
    await resolveVideoPageVoiceScript(admin, {
      organizationId: input.organizationId,
      videoPageId: input.generation.videoPageId,
      scriptVersionId: input.generation.scriptVersionId,
      prospect: input.generation.prospect,
    })

  const hooks = {
    video_page_id: input.generation.videoPageId,
    video_asset_id: videoAssetId,
    script_version_id: scriptVersionId,
    lead_id: input.generation.prospect?.leadId ?? null,
    missing_variables: missingVariables ?? [],
    merge_degraded: degraded ?? false,
  }

  const run = await createMediaGenerationJob(admin, {
    organizationId: input.organizationId,
    createdBy: input.createdBy,
    generationType: "voice_generation",
    provider: input.generation.provider ?? "elevenlabs",
    metadataHooks: hooks,
    writebackTarget: "media_asset",
    providerRequest: {
      voice_id: input.generation.voiceId,
      script,
      script_version_id: scriptVersionId,
      stability: settings.stability,
      similarity: settings.similarity,
      speed: settings.speed,
      dry_run: input.generation.dryRun ?? providerState.dryRunOnly,
    },
    notes: providerState.dryRunOnly
      ? "C1 dry-run voice generation — provider disabled."
      : "C1 ElevenLabs voice generation.",
  })

  const processed = await processVoiceGenerationRun(admin, {
    organizationId: input.organizationId,
    runId: run.id,
    createdBy: input.createdBy,
    forceDryRun: input.generation.dryRun ?? providerState.dryRunOnly,
  })

  const signedUrl = await resolveVoiceJobAudioUrl(admin, {
    organizationId: input.organizationId,
    run: processed,
  })

  return mapRunToVoiceJobView(processed, providerState, signedUrl)
}

export async function getGrowthAiVoiceGenerationJob(
  admin: SupabaseClient,
  input: { organizationId: string; runId: string },
): Promise<GrowthAiVoiceJobView | null> {
  const run = await getMediaGenerationJobById(admin, input)
  if (!run || run.generationType !== "voice_generation") return null

  const providerState = getGrowthElevenLabsVoiceProviderState()
  const signedUrl = await resolveVoiceJobAudioUrl(admin, {
    organizationId: input.organizationId,
    run,
  })

  return mapRunToVoiceJobView(run, providerState, signedUrl)
}

export async function retryGrowthAiVoiceGenerationJob(
  admin: SupabaseClient,
  input: { organizationId: string; runId: string; createdBy: string },
): Promise<GrowthAiVoiceJobView> {
  await patchMediaGenerationJob(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    retry: true,
    retryReason: "Operator retry",
  })

  const processed = await processVoiceGenerationRun(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    createdBy: input.createdBy,
  })

  const providerState = getGrowthElevenLabsVoiceProviderState()
  const signedUrl = await resolveVoiceJobAudioUrl(admin, {
    organizationId: input.organizationId,
    run: processed,
  })

  return mapRunToVoiceJobView(processed, providerState, signedUrl)
}

export async function cancelGrowthAiVoiceGenerationJob(
  admin: SupabaseClient,
  input: { organizationId: string; runId: string; reason?: string | null },
): Promise<GrowthAiVoiceJobView> {
  const run = await cancelVoiceGenerationRun(admin, input)
  const providerState = getGrowthElevenLabsVoiceProviderState()
  return mapRunToVoiceJobView(run, providerState, null)
}

async function resolveVoiceJobAudioUrl(
  admin: SupabaseClient,
  input: { organizationId: string; run: GrowthMediaGenerationRun },
): Promise<string | null> {
  const output = input.run.output as Record<string, unknown>
  const aiPayload =
    output.ai_payload && typeof output.ai_payload === "object"
      ? (output.ai_payload as GrowthAiVoiceAiPayload)
      : null
  if (aiPayload?.audio_url) return aiPayload.audio_url

  const writeback =
    output.storage_writeback && typeof output.storage_writeback === "object"
      ? (output.storage_writeback as Record<string, unknown>)
      : null
  const assetId = typeof writeback?.asset_id === "string" ? writeback.asset_id : null
  const storagePath =
    typeof writeback?.storage_path === "string"
      ? writeback.storage_path
      : buildVoiceoverStoragePath({ organizationId: input.organizationId, runId: input.run.id })

  if (!assetId) return null

  try {
    const storage = resolveMediaStorageProvider("supabase_storage", admin)
    const signed = await storage.generateSignedReadUrl({
      organizationId: input.organizationId,
      assetId,
      storageKey: storagePath,
    })
    return signed.url
  } catch {
    return null
  }
}

export function getGrowthAiVoiceProviderStateForUi(): GrowthAiVoiceProviderState {
  return getGrowthElevenLabsVoiceProviderState()
}
