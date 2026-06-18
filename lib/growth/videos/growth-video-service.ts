import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_VIDEO_ASSETS_QA_MARKER,
  GROWTH_VIDEO_FOUNDATION_QA_MARKER,
  type GrowthVideoAsset,
  type GrowthVideoAssetStatus,
  type GrowthVideoCaptionsStatus,
  type GrowthVideoSourceType,
  type GrowthVideoStorageProvider,
  type GrowthVideoTranscriptStatus,
  type GrowthVideoUploadStatus,
} from "@/lib/growth/videos/growth-video-types"
import { isGrowthVideoAssetsSchemaReady } from "@/lib/growth/videos/growth-video-schema-health"

const ASSET_SELECT =
  "id, organization_id, created_by, title, description, status, source_type, duration_seconds, storage_provider, storage_path, thumbnail_path, transcript_status, captions_status, original_filename, mime_type, file_size_bytes, upload_status, processing_error, metadata_json, created_at, updated_at"

type VideoAssetRow = {
  id: string
  organization_id: string
  created_by: string | null
  title: string
  description: string | null
  status: string
  source_type: string
  duration_seconds: number | null
  storage_provider: string | null
  storage_path: string | null
  thumbnail_path: string | null
  transcript_status: string
  captions_status: string
  original_filename: string | null
  mime_type: string | null
  file_size_bytes: number | null
  upload_status: string | null
  processing_error: string | null
  metadata_json: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

function mapAssetRow(row: VideoAssetRow): GrowthVideoAsset {
  return {
    id: row.id,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    status: row.status as GrowthVideoAssetStatus,
    sourceType: row.source_type as GrowthVideoSourceType,
    durationSeconds: row.duration_seconds,
    storageProvider: (row.storage_provider as GrowthVideoStorageProvider | null) ?? null,
    storagePath: row.storage_path,
    thumbnailPath: row.thumbnail_path,
    transcriptStatus: row.transcript_status as GrowthVideoTranscriptStatus,
    captionsStatus: row.captions_status as GrowthVideoCaptionsStatus,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    uploadStatus: (row.upload_status as GrowthVideoUploadStatus | null) ?? "pending",
    processingError: row.processing_error,
    metadata: row.metadata_json ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export type GrowthVideoServiceDeps = {
  admin: SupabaseClient
}

export type CreateGrowthVideoAssetInput = {
  organizationId: string
  createdBy?: string | null
  title: string
  description?: string | null
  sourceType: GrowthVideoSourceType
  originalFilename?: string | null
  mimeType?: string | null
  fileSizeBytes?: number | null
  storageProvider?: GrowthVideoStorageProvider | null
  storagePath?: string | null
  thumbnailPath?: string | null
  status?: GrowthVideoAssetStatus
  uploadStatus?: GrowthVideoUploadStatus
}

export type UpdateGrowthVideoAssetPatch = {
  title?: string
  description?: string | null
  status?: GrowthVideoAssetStatus
  durationSeconds?: number | null
  storagePath?: string | null
  thumbnailPath?: string | null
  mimeType?: string | null
  fileSizeBytes?: number | null
  uploadStatus?: GrowthVideoUploadStatus
  processingError?: string | null
}

export class GrowthVideoService {
  constructor(private readonly deps: GrowthVideoServiceDeps) {}

  async listAssets(input: {
    organizationId: string
    limit?: number
    status?: GrowthVideoAssetStatus
    search?: string
  }): Promise<{ ok: true; items: GrowthVideoAsset[] } | { ok: false; error: string }> {
    if (!(await isGrowthVideoAssetsSchemaReady(this.deps.admin))) {
      return { ok: false, error: "schema_not_ready" }
    }

    let query = this.deps.admin
      .schema("growth")
      .from("video_assets")
      .select(ASSET_SELECT)
      .eq("organization_id", input.organizationId)
      .order("updated_at", { ascending: false })
      .limit(input.limit ?? 50)

    if (input.status) {
      query = query.eq("status", input.status)
    }

    if (input.search?.trim()) {
      query = query.ilike("title", `%${input.search.trim()}%`)
    }

    const { data, error } = await query
    if (error) return { ok: false, error: error.message }

    return { ok: true, items: (data as VideoAssetRow[]).map(mapAssetRow) }
  }

  async getAssetById(input: {
    organizationId: string
    assetId: string
  }): Promise<{ ok: true; asset: GrowthVideoAsset } | { ok: false; error: string }> {
    if (!(await isGrowthVideoAssetsSchemaReady(this.deps.admin))) {
      return { ok: false, error: "schema_not_ready" }
    }

    const { data, error } = await this.deps.admin
      .schema("growth")
      .from("video_assets")
      .select(ASSET_SELECT)
      .eq("organization_id", input.organizationId)
      .eq("id", input.assetId)
      .maybeSingle()

    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: "not_found" }

    return { ok: true, asset: mapAssetRow(data as VideoAssetRow) }
  }

  async createAsset(
    input: CreateGrowthVideoAssetInput,
  ): Promise<{ ok: true; asset: GrowthVideoAsset } | { ok: false; error: string }> {
    if (!(await isGrowthVideoAssetsSchemaReady(this.deps.admin))) {
      return { ok: false, error: "schema_not_ready" }
    }

    const { data, error } = await this.deps.admin
      .schema("growth")
      .from("video_assets")
      .insert({
        organization_id: input.organizationId,
        created_by: input.createdBy ?? null,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? "draft",
        source_type: input.sourceType,
        storage_provider: input.storageProvider ?? "supabase_storage",
        storage_path: input.storagePath ?? null,
        thumbnail_path: input.thumbnailPath ?? null,
        original_filename: input.originalFilename ?? null,
        mime_type: input.mimeType ?? null,
        file_size_bytes: input.fileSizeBytes ?? null,
        upload_status: input.uploadStatus ?? "pending",
        metadata_json: { qa_marker: GROWTH_VIDEO_ASSETS_QA_MARKER },
      })
      .select(ASSET_SELECT)
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, asset: mapAssetRow(data as VideoAssetRow) }
  }

  async updateAsset(input: {
    organizationId: string
    assetId: string
    patch: UpdateGrowthVideoAssetPatch
  }): Promise<{ ok: true; asset: GrowthVideoAsset } | { ok: false; error: string }> {
    const existing = await this.getAssetById({
      organizationId: input.organizationId,
      assetId: input.assetId,
    })
    if (!existing.ok) return existing

    const row: Record<string, unknown> = {}
    if (input.patch.title !== undefined) row.title = input.patch.title
    if (input.patch.description !== undefined) row.description = input.patch.description
    if (input.patch.status !== undefined) row.status = input.patch.status
    if (input.patch.durationSeconds !== undefined) row.duration_seconds = input.patch.durationSeconds
    if (input.patch.storagePath !== undefined) row.storage_path = input.patch.storagePath
    if (input.patch.thumbnailPath !== undefined) row.thumbnail_path = input.patch.thumbnailPath
    if (input.patch.mimeType !== undefined) row.mime_type = input.patch.mimeType
    if (input.patch.fileSizeBytes !== undefined) row.file_size_bytes = input.patch.fileSizeBytes
    if (input.patch.uploadStatus !== undefined) row.upload_status = input.patch.uploadStatus
    if (input.patch.processingError !== undefined) row.processing_error = input.patch.processingError

    if (Object.keys(row).length === 0) {
      return existing
    }

    const { data, error } = await this.deps.admin
      .schema("growth")
      .from("video_assets")
      .update(row)
      .eq("organization_id", input.organizationId)
      .eq("id", input.assetId)
      .select(ASSET_SELECT)
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, asset: mapAssetRow(data as VideoAssetRow) }
  }

  async archiveAsset(input: {
    organizationId: string
    assetId: string
  }): Promise<{ ok: true; asset: GrowthVideoAsset } | { ok: false; error: string }> {
    return this.updateAsset({
      organizationId: input.organizationId,
      assetId: input.assetId,
      patch: { status: "archived" },
    })
  }

  async deleteAsset(input: {
    organizationId: string
    assetId: string
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    const existing = await this.getAssetById({
      organizationId: input.organizationId,
      assetId: input.assetId,
    })
    if (!existing.ok) return existing

    const { error } = await this.deps.admin
      .schema("growth")
      .from("video_assets")
      .delete()
      .eq("organization_id", input.organizationId)
      .eq("id", input.assetId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }

  buildDiagnosticsPayload() {
    return {
      qa_marker: GROWTH_VIDEO_FOUNDATION_QA_MARKER,
      assets_qa_marker: GROWTH_VIDEO_ASSETS_QA_MARKER,
      service: "growth_video_service",
      persistence: "growth.video_assets",
    }
  }
}

export function createGrowthVideoService(admin: SupabaseClient): GrowthVideoService {
  return new GrowthVideoService({ admin })
}
