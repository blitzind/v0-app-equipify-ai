import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  attachMediaAsset,
  createMediaAsset,
  updateMediaAsset,
} from "@/lib/growth/media/media-asset-repository"
import { resolveMediaStorageProvider } from "@/lib/growth/media/media-asset-storage-providers"
import { GROWTH_MEDIA_ASSETS_BUCKET } from "@/lib/growth/media/media-asset-types"
import {
  GROWTH_AI_VOICE_MEDIA_SUBTYPE,
  type GrowthAiVoiceAiPayload,
} from "@/lib/growth/media/growth-ai-voice-generation-types"
import type { AIMediaStorageWritebackRequest, AIMediaStorageWritebackResult } from "@/lib/growth/media/growth-media-provider-contracts"

export function buildVoiceoverStoragePath(input: { organizationId: string; runId: string }): string {
  return `organizations/${input.organizationId}/media/voice/${input.runId}/voiceover.mp3`
}

export async function writebackGeneratedAudioAsset(
  admin: SupabaseClient,
  input: {
    organizationId: string
    runId: string
    createdBy: string
    audioBytes: Uint8Array
    mimeType: string
    title: string
    metadataHooks?: Record<string, unknown>
    aiPayload: GrowthAiVoiceAiPayload
    dryRun: boolean
    videoPageId?: string | null
  },
): Promise<AIMediaStorageWritebackResult & { assetId: string }> {
  const storagePath = buildVoiceoverStoragePath({
    organizationId: input.organizationId,
    runId: input.runId,
  })

  const asset = await createMediaAsset(admin, {
    organizationId: input.organizationId,
    createdBy: input.createdBy,
    assetType: "generated_audio",
    provider: "supabase_storage",
    title: input.title,
    description: "AI voiceover generated from Growth Video script.",
    originalFilename: "voiceover.mp3",
    mimeType: input.mimeType,
    extension: "mp3",
    source: "generated",
    sourceReference: input.runId,
    metadata: {
      media_subtype: GROWTH_AI_VOICE_MEDIA_SUBTYPE,
      media_generation_run_id: input.runId,
      dry_run: input.dryRun,
      ai_payload: input.aiPayload,
      metadata_hooks: input.metadataHooks ?? {},
    },
    tags: ["voiceover", "growth_video", input.dryRun ? "dry_run" : "live"],
  })

  await updateMediaAsset(admin, asset.id, {
    status: "upload_pending",
    metadata: {
      ...asset.metadata,
      storage_path_override: storagePath,
    },
  })

  const upload = await admin.storage.from(GROWTH_MEDIA_ASSETS_BUCKET).upload(storagePath, input.audioBytes, {
    contentType: input.mimeType,
    upsert: true,
  })

  if (upload.error) {
    await updateMediaAsset(admin, asset.id, {
      status: "failed",
      metadata: {
        ...asset.metadata,
        upload_error: upload.error.message,
      },
    })
    throw new Error(`audio_upload_failed:${upload.error.message}`)
  }

  const readyAsset = await updateMediaAsset(admin, asset.id, {
    status: "ready",
    durationSeconds: null,
    metadata: {
      ...asset.metadata,
      storage_path_override: storagePath,
      uploaded_at: new Date().toISOString(),
      dry_run: input.dryRun,
    },
  })

  await admin
    .schema("growth")
    .from("media_assets")
    .update({ storage_key: storagePath, uploaded_at: new Date().toISOString() })
    .eq("id", asset.id)

  if (input.videoPageId) {
    await attachMediaAsset(admin, {
      organizationId: input.organizationId,
      assetId: asset.id,
      relationshipType: "other",
      relationshipId: input.videoPageId,
      metadata: {
        link_type: "growth_video_voiceover",
        media_generation_run_id: input.runId,
      },
    }).catch(() => undefined)
  }

  const storage = resolveMediaStorageProvider("supabase_storage", admin)
  const signed = await storage.generateSignedReadUrl({
    organizationId: input.organizationId,
    assetId: asset.id,
    storageKey: storagePath,
  })

  return {
    assetId: readyAsset.id,
    storagePath,
    signedUrl: signed.url,
  }
}

export async function writebackGeneratedMediaViaContract(
  admin: SupabaseClient,
  input: AIMediaStorageWritebackRequest & {
    createdBy: string
    audioBytes: Uint8Array
    title: string
    aiPayload: GrowthAiVoiceAiPayload
    dryRun: boolean
  },
): Promise<AIMediaStorageWritebackResult> {
  const result = await writebackGeneratedAudioAsset(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    createdBy: input.createdBy,
    audioBytes: input.audioBytes,
    mimeType: input.mimeType,
    title: input.title,
    metadataHooks: input.metadataHooks as Record<string, unknown> | undefined,
    aiPayload: input.aiPayload,
    dryRun: input.dryRun,
    videoPageId:
      typeof input.metadataHooks?.video_page_id === "string" ? input.metadataHooks.video_page_id : null,
  })

  return {
    assetId: result.assetId,
    storagePath: result.storagePath,
    signedUrl: result.signedUrl ?? null,
  }
}
