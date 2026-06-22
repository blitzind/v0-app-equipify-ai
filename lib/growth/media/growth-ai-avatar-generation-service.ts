import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AI_AVATAR_DEFAULT_SETTINGS,
  type GrowthAiAvatarAiPayload,
  type GrowthAiAvatarGenerationInput,
  type GrowthAiAvatarJobView,
  type GrowthAiAvatarProviderStates,
  type GrowthAiAvatarSettings,
  type GrowthAiAvatarVoiceAssetOption,
} from "@/lib/growth/media/growth-ai-avatar-generation-types"
import {
  getGrowthAvatarProviderState,
  getGrowthAvatarProviderStates,
} from "@/lib/growth/media/growth-ai-avatar-provider-config"
import { buildAvatarVideoStoragePath } from "@/lib/growth/media/growth-media-video-writeback-service"
import {
  createMediaGenerationJob,
  getMediaGenerationJobById,
  listMediaGenerationJobs,
  patchMediaGenerationJob,
} from "@/lib/growth/media/growth-media-generation-job-service"
import {
  cancelAvatarGenerationRun,
  processAvatarGenerationRun,
} from "@/lib/growth/media/growth-media-generation-worker-service"
import { resolveMediaStorageProvider } from "@/lib/growth/media/media-asset-storage-providers"
import { getMediaAvatarById } from "@/lib/growth/media/media-avatar-types"
import { resolveVideoPageVoiceScript } from "@/lib/growth/media/growth-ai-voice-generation-service"
import { attachGeneratedMediaAssetToVideoPage } from "@/lib/growth/media/ge-v1-3-generated-video-page-attach"
import { buildGrowthVideoBrandingPreview } from "@/lib/growth/videos/growth-video-branding-service"
import type { GrowthMediaGenerationRun } from "@/lib/growth/media/growth-media-generation-types"

function normalizeSettings(input?: Partial<GrowthAiAvatarSettings>): GrowthAiAvatarSettings {
  return {
    resolution: input?.resolution ?? GROWTH_AI_AVATAR_DEFAULT_SETTINGS.resolution,
    background: input?.background ?? GROWTH_AI_AVATAR_DEFAULT_SETTINGS.background,
    theme: input?.theme ?? GROWTH_AI_AVATAR_DEFAULT_SETTINGS.theme,
  }
}

function mapRunToAvatarJobView(
  run: GrowthMediaGenerationRun,
  providerStates: GrowthAiAvatarProviderStates,
  videoUrl?: string | null,
): GrowthAiAvatarJobView {
  const providerRequest = run.input.provider_request ?? {}
  const outputPayload = run.output as Record<string, unknown>
  const aiPayload =
    outputPayload.ai_payload && typeof outputPayload.ai_payload === "object"
      ? (outputPayload.ai_payload as GrowthAiAvatarAiPayload)
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
    providerStates,
    scriptVersionId:
      typeof providerRequest.script_version_id === "string" ? providerRequest.script_version_id : null,
    avatarId: typeof providerRequest.avatar_id === "string" ? providerRequest.avatar_id : null,
    voiceMediaAssetId:
      typeof providerRequest.voice_media_asset_id === "string" ? providerRequest.voice_media_asset_id : null,
    settings: normalizeSettings(providerRequest as Partial<GrowthAiAvatarSettings>),
    progressTimeline: run.output.progress_timeline ?? [],
    outputMediaAssetId:
      (typeof writeback?.asset_id === "string" ? writeback.asset_id : null) ??
      aiPayload?.output_media_asset_id ??
      null,
    videoUrl: videoUrl ?? aiPayload?.video_url ?? null,
    downloadUrl: videoUrl ?? aiPayload?.video_url ?? null,
    aiPayload,
    error: run.error,
    retryCount: run.retryCount,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  }
}

export async function listGrowthAiAvatarVoiceAssets(
  admin: SupabaseClient,
  input: { organizationId: string; videoPageId: string },
): Promise<GrowthAiAvatarVoiceAssetOption[]> {
  const runs = await listMediaGenerationJobs(admin, {
    organizationId: input.organizationId,
    generationType: "voice_generation",
    videoPageId: input.videoPageId,
    limit: 20,
  })

  return runs
    .map((run) => {
      const output = run.output as Record<string, unknown>
      const writeback =
        output.storage_writeback && typeof output.storage_writeback === "object"
          ? (output.storage_writeback as Record<string, unknown>)
          : null
      const aiPayload =
        output.ai_payload && typeof output.ai_payload === "object"
          ? (output.ai_payload as Record<string, unknown>)
          : null
      const assetId =
        (typeof writeback?.asset_id === "string" ? writeback.asset_id : null) ??
        (typeof aiPayload?.output_media_asset_id === "string" ? aiPayload.output_media_asset_id : null)
      if (!assetId) return null
      return {
        mediaAssetId: assetId,
        runId: run.id,
        title: `Voiceover ${run.id.slice(0, 8)}`,
        dryRun: Boolean(aiPayload?.dry_run),
      }
    })
    .filter((item): item is GrowthAiAvatarVoiceAssetOption => item != null)
}

export async function createGrowthAiAvatarGenerationJob(
  admin: SupabaseClient,
  input: {
    organizationId: string
    createdBy: string
    generation: GrowthAiAvatarGenerationInput
  },
): Promise<GrowthAiAvatarJobView> {
  const provider = input.generation.provider ?? "elevenlabs"
  const avatar = getMediaAvatarById(input.generation.avatarId)
  if (!avatar || avatar.provider !== provider) {
    throw new Error("invalid_avatar_id")
  }

  const providerState = getGrowthAvatarProviderState(provider)
  const providerStates = getGrowthAvatarProviderStates()
  const settings = normalizeSettings(input.generation.settings)
  const { script, scriptVersionId, videoAssetId, missingVariables, degraded } =
    await resolveVideoPageVoiceScript(admin, {
      organizationId: input.organizationId,
      videoPageId: input.generation.videoPageId,
      scriptVersionId: input.generation.scriptVersionId,
      prospect: input.generation.prospect,
    })

  const { data: pageRow } = await admin
    .schema("growth")
    .from("video_pages")
    .select("branding_json")
    .eq("organization_id", input.organizationId)
    .eq("id", input.generation.videoPageId)
    .maybeSingle()

  const pageBranding =
    pageRow?.branding_json && typeof pageRow.branding_json === "object"
      ? (pageRow.branding_json as Record<string, unknown>)
      : {}
  const brandingPreview = buildGrowthVideoBrandingPreview(
    {
      logoUrl: typeof pageBranding.logoUrl === "string" ? pageBranding.logoUrl : null,
      primaryColor: typeof pageBranding.primaryColor === "string" ? pageBranding.primaryColor : null,
      buttonLabelOverride:
        typeof pageBranding.buttonLabelOverride === "string" ? pageBranding.buttonLabelOverride : null,
    },
    null,
  )

  const hooks = {
    video_page_id: input.generation.videoPageId,
    video_asset_id: videoAssetId,
    script_version_id: scriptVersionId,
    voice_media_asset_id: input.generation.voiceMediaAssetId ?? null,
    lead_id: input.generation.prospect?.leadId ?? null,
    missing_variables: missingVariables ?? [],
    merge_degraded: degraded ?? false,
    attach_to_page_on_complete: Boolean(input.generation.attachToPageOnComplete),
  }

  const run = await createMediaGenerationJob(admin, {
    organizationId: input.organizationId,
    createdBy: input.createdBy,
    generationType: "avatar_generation",
    provider,
    metadataHooks: hooks,
    writebackTarget: "media_asset",
    providerRequest: {
      avatar_id: input.generation.avatarId,
      script,
      script_version_id: scriptVersionId,
      voice_media_asset_id: input.generation.voiceMediaAssetId ?? null,
      resolution: settings.resolution,
      background: settings.background,
      theme: settings.theme,
      branding: brandingPreview,
      dry_run: input.generation.dryRun ?? providerState.dryRunOnly,
    },
    notes: providerState.dryRunOnly
      ? "C2 dry-run avatar generation — provider disabled."
      : `C2 ${provider} avatar generation.`,
  })

  const processed = await processAvatarGenerationRun(admin, {
    organizationId: input.organizationId,
    runId: run.id,
    createdBy: input.createdBy,
    forceDryRun: input.generation.dryRun ?? providerState.dryRunOnly,
  })

  if (input.generation.attachToPageOnComplete && processed.status === "completed") {
    const output = processed.output as Record<string, unknown>
    const writeback =
      output.storage_writeback && typeof output.storage_writeback === "object"
        ? (output.storage_writeback as Record<string, unknown>)
        : null
    const mediaAssetId = typeof writeback?.asset_id === "string" ? writeback.asset_id : null
    if (mediaAssetId) {
      await attachGeneratedMediaAssetToVideoPage(admin, {
        organizationId: input.organizationId,
        createdBy: input.createdBy,
        videoPageId: input.generation.videoPageId,
        mediaAssetId,
        leadId: input.generation.prospect?.leadId ?? null,
        mediaGenerationRunId: processed.id,
      }).catch(() => undefined)
    }
  }

  const signedUrl = await resolveAvatarJobVideoUrl(admin, {
    organizationId: input.organizationId,
    run: processed,
  })

  return mapRunToAvatarJobView(processed, providerStates, signedUrl)
}

export async function getGrowthAiAvatarGenerationJob(
  admin: SupabaseClient,
  input: { organizationId: string; runId: string },
): Promise<GrowthAiAvatarJobView | null> {
  const run = await getMediaGenerationJobById(admin, input)
  if (!run || run.generationType !== "avatar_generation") return null

  const providerStates = getGrowthAvatarProviderStates()
  const signedUrl = await resolveAvatarJobVideoUrl(admin, {
    organizationId: input.organizationId,
    run,
  })

  return mapRunToAvatarJobView(run, providerStates, signedUrl)
}

export async function retryGrowthAiAvatarGenerationJob(
  admin: SupabaseClient,
  input: { organizationId: string; runId: string; createdBy: string },
): Promise<GrowthAiAvatarJobView> {
  await patchMediaGenerationJob(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    retry: true,
    retryReason: "Operator retry",
  })

  const processed = await processAvatarGenerationRun(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    createdBy: input.createdBy,
  })

  const providerStates = getGrowthAvatarProviderStates()
  const signedUrl = await resolveAvatarJobVideoUrl(admin, {
    organizationId: input.organizationId,
    run: processed,
  })

  return mapRunToAvatarJobView(processed, providerStates, signedUrl)
}

export async function cancelGrowthAiAvatarGenerationJob(
  admin: SupabaseClient,
  input: { organizationId: string; runId: string; reason?: string | null },
): Promise<GrowthAiAvatarJobView> {
  const run = await cancelAvatarGenerationRun(admin, input)
  const providerStates = getGrowthAvatarProviderStates()
  return mapRunToAvatarJobView(run, providerStates, null)
}

async function resolveAvatarJobVideoUrl(
  admin: SupabaseClient,
  input: { organizationId: string; run: GrowthMediaGenerationRun },
): Promise<string | null> {
  const output = input.run.output as Record<string, unknown>
  const aiPayload =
    output.ai_payload && typeof output.ai_payload === "object"
      ? (output.ai_payload as GrowthAiAvatarAiPayload)
      : null
  if (aiPayload?.video_url) return aiPayload.video_url

  const writeback =
    output.storage_writeback && typeof output.storage_writeback === "object"
      ? (output.storage_writeback as Record<string, unknown>)
      : null
  const assetId = typeof writeback?.asset_id === "string" ? writeback.asset_id : null
  const storagePath =
    typeof writeback?.storage_path === "string"
      ? writeback.storage_path
      : buildAvatarVideoStoragePath({ organizationId: input.organizationId, runId: input.run.id })

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

export function getGrowthAiAvatarProviderStatesForUi(): GrowthAiAvatarProviderStates {
  return getGrowthAvatarProviderStates()
}
