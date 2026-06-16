import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  canArchiveMediaAsset,
  canCreateUploadSession,
  GROWTH_MEDIA_ASSETS_QA_MARKER,
  type GrowthMediaAsset,
  type GrowthMediaAssetProvider,
  type GrowthMediaAssetRelationship,
  type GrowthMediaAssetRelationshipType,
  type GrowthMediaAssetSource,
  type GrowthMediaAssetStatus,
  type GrowthMediaAssetType,
  type GrowthMediaAssetUploadSession,
} from "@/lib/growth/media/media-asset-types"
import { buildStorageKey, resolveMediaStorageProvider } from "@/lib/growth/media/media-asset-storage-providers"

function assetsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("media_assets")
}

function relationshipsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("media_asset_relationships")
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.length > 0)
  }
  return []
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function mapAsset(row: Record<string, unknown>): GrowthMediaAsset {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id),
    createdBy: asString(row.created_by) || null,
    assetType: asString(row.asset_type) as GrowthMediaAssetType,
    provider: asString(row.provider) as GrowthMediaAssetProvider,
    status: asString(row.status) as GrowthMediaAssetStatus,
    title: asString(row.title),
    description: asString(row.description),
    storageKey: asString(row.storage_key) || null,
    originalFilename: asString(row.original_filename) || null,
    mimeType: asString(row.mime_type) || null,
    extension: asString(row.extension) || null,
    fileSizeBytes: asNumber(row.file_size_bytes),
    durationSeconds: asNumber(row.duration_seconds),
    width: asNumber(row.width),
    height: asNumber(row.height),
    thumbnailStorageKey: asString(row.thumbnail_storage_key) || null,
    waveformStorageKey: asString(row.waveform_storage_key) || null,
    metadata: asRecord(row.metadata_json),
    tags: asStringArray(row.tags),
    checksumSha256: asString(row.checksum_sha256) || null,
    source: (asString(row.source) || "manual") as GrowthMediaAssetSource,
    sourceReference: asString(row.source_reference) || null,
    requiresHumanReview: row.requires_human_review !== false,
    qaMarker: GROWTH_MEDIA_ASSETS_QA_MARKER,
    uploadedAt: asString(row.uploaded_at) || null,
    processedAt: asString(row.processed_at) || null,
    archivedAt: asString(row.archived_at) || null,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

function mapRelationship(row: Record<string, unknown>): GrowthMediaAssetRelationship {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id),
    assetId: asString(row.asset_id),
    relationshipType: asString(row.relationship_type) as GrowthMediaAssetRelationshipType,
    relationshipId: asString(row.relationship_id),
    metadata: asRecord(row.metadata_json),
    createdAt: asString(row.created_at),
  }
}

export type CreateMediaAssetInput = {
  organizationId: string
  createdBy?: string | null
  assetType: GrowthMediaAssetType
  provider?: GrowthMediaAssetProvider
  title?: string
  description?: string
  originalFilename?: string | null
  mimeType?: string | null
  extension?: string | null
  tags?: string[]
  source?: GrowthMediaAssetSource
  sourceReference?: string | null
  metadata?: Record<string, unknown>
}

export type UpdateMediaAssetInput = {
  title?: string
  description?: string
  tags?: string[]
  metadata?: Record<string, unknown>
  thumbnailStorageKey?: string | null
  waveformStorageKey?: string | null
  durationSeconds?: number | null
  width?: number | null
  height?: number | null
  status?: GrowthMediaAssetStatus
}

export type ListMediaAssetsInput = {
  organizationId: string
  assetType?: GrowthMediaAssetType
  status?: GrowthMediaAssetStatus
  provider?: GrowthMediaAssetProvider
  tag?: string
  search?: string
  limit?: number
  offset?: number
}

export type AttachMediaAssetInput = {
  organizationId: string
  assetId: string
  relationshipType: GrowthMediaAssetRelationshipType
  relationshipId: string
  metadata?: Record<string, unknown>
}

export type DetachMediaAssetInput = {
  organizationId: string
  assetId: string
  relationshipType: GrowthMediaAssetRelationshipType
  relationshipId: string
}

export type CreateUploadSessionInput = {
  organizationId: string
  assetId: string
  mimeType?: string | null
  extension?: string | null
  fileSizeBytes?: number | null
  signedUrlTtlSeconds?: number
}

export type CompleteUploadSessionInput = {
  organizationId: string
  assetId: string
  checksumSha256?: string | null
  fileSizeBytes?: number | null
}

export async function createMediaAsset(
  admin: SupabaseClient,
  input: CreateMediaAssetInput,
): Promise<GrowthMediaAsset> {
  const extension = input.extension?.trim() || null
  const assetId = randomUUID()
  const storageKey = buildStorageKey({
    organizationId: input.organizationId,
    assetId,
    extension,
  })

  const { data, error } = await assetsTable(admin)
    .insert({
      id: assetId,
      organization_id: input.organizationId,
      created_by: input.createdBy ?? null,
      asset_type: input.assetType,
      provider: input.provider ?? "local_stub",
      status: "draft",
      title: input.title?.trim() || "",
      description: input.description?.trim() || "",
      storage_key: buildStorageKey({ organizationId: input.organizationId, assetId, extension }),
      original_filename: input.originalFilename ?? null,
      mime_type: input.mimeType ?? null,
      extension,
      tags: input.tags ?? [],
      source: input.source ?? "manual",
      source_reference: input.sourceReference ?? null,
      metadata_json: input.metadata ?? {},
      qa_marker: GROWTH_MEDIA_ASSETS_QA_MARKER,
    })
    .select("*")
    .single()

  if (error || !data) throw new Error(error?.message ?? "asset_create_failed")
  return mapAsset(data as Record<string, unknown>)
}

export async function updateMediaAsset(
  admin: SupabaseClient,
  assetId: string,
  input: UpdateMediaAssetInput,
): Promise<GrowthMediaAsset> {
  const patch: Record<string, unknown> = {}
  if (input.title !== undefined) patch.title = input.title
  if (input.description !== undefined) patch.description = input.description
  if (input.tags !== undefined) patch.tags = input.tags
  if (input.metadata !== undefined) patch.metadata_json = input.metadata
  if (input.thumbnailStorageKey !== undefined) patch.thumbnail_storage_key = input.thumbnailStorageKey
  if (input.waveformStorageKey !== undefined) patch.waveform_storage_key = input.waveformStorageKey
  if (input.durationSeconds !== undefined) patch.duration_seconds = input.durationSeconds
  if (input.width !== undefined) patch.width = input.width
  if (input.height !== undefined) patch.height = input.height
  if (input.status !== undefined) patch.status = input.status

  const { data, error } = await assetsTable(admin).update(patch).eq("id", assetId).select("*").single()
  if (error || !data) throw new Error(error?.message ?? "asset_not_found")
  return mapAsset(data as Record<string, unknown>)
}

export async function archiveMediaAsset(admin: SupabaseClient, assetId: string): Promise<GrowthMediaAsset> {
  const existing = await getMediaAsset(admin, assetId)
  if (!existing) throw new Error("asset_not_found")
  if (!canArchiveMediaAsset(existing.status)) throw new Error("invalid_status")

  const { data, error } = await assetsTable(admin)
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", assetId)
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "asset_archive_failed")
  return mapAsset(data as Record<string, unknown>)
}

export async function getMediaAsset(admin: SupabaseClient, assetId: string): Promise<GrowthMediaAsset | null> {
  const { data, error } = await assetsTable(admin).select("*").eq("id", assetId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapAsset(data as Record<string, unknown>)
}

export async function listMediaAssets(
  admin: SupabaseClient,
  input: ListMediaAssetsInput,
): Promise<{ items: GrowthMediaAsset[]; total: number }> {
  let query = assetsTable(admin).select("*", { count: "exact" }).eq("organization_id", input.organizationId)

  if (input.assetType) query = query.eq("asset_type", input.assetType)
  if (input.status) query = query.eq("status", input.status)
  if (input.provider) query = query.eq("provider", input.provider)
  if (input.tag) query = query.contains("tags", [input.tag])
  if (input.search?.trim()) {
    const term = input.search.trim()
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%,original_filename.ilike.%${term}%`)
  }

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)
  const offset = Math.max(input.offset ?? 0, 0)
  query = query.order("updated_at", { ascending: false }).range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return {
    items: (data ?? []).map((row) => mapAsset(row as Record<string, unknown>)),
    total: count ?? 0,
  }
}

export async function attachMediaAsset(
  admin: SupabaseClient,
  input: AttachMediaAssetInput,
): Promise<GrowthMediaAssetRelationship> {
  const asset = await getMediaAsset(admin, input.assetId)
  if (!asset) throw new Error("asset_not_found")
  if (asset.organizationId !== input.organizationId) throw new Error("organization_scope_mismatch")

  const { data, error } = await relationshipsTable(admin)
    .insert({
      organization_id: input.organizationId,
      asset_id: input.assetId,
      relationship_type: input.relationshipType,
      relationship_id: input.relationshipId,
      metadata_json: input.metadata ?? {},
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapRelationship(data as Record<string, unknown>)
}

export async function detachMediaAsset(admin: SupabaseClient, input: DetachMediaAssetInput): Promise<void> {
  const asset = await getMediaAsset(admin, input.assetId)
  if (!asset) throw new Error("asset_not_found")
  if (asset.organizationId !== input.organizationId) throw new Error("organization_scope_mismatch")

  const { error } = await relationshipsTable(admin)
    .delete()
    .eq("asset_id", input.assetId)
    .eq("relationship_type", input.relationshipType)
    .eq("relationship_id", input.relationshipId)

  if (error) throw new Error(error.message)
}

export async function listRelationships(
  admin: SupabaseClient,
  input: {
    organizationId: string
    assetId?: string
    relationshipType?: GrowthMediaAssetRelationshipType
    relationshipId?: string
  },
): Promise<GrowthMediaAssetRelationship[]> {
  let query = relationshipsTable(admin).select("*").eq("organization_id", input.organizationId)
  if (input.assetId) query = query.eq("asset_id", input.assetId)
  if (input.relationshipType) query = query.eq("relationship_type", input.relationshipType)
  if (input.relationshipId) query = query.eq("relationship_id", input.relationshipId)
  query = query.order("created_at", { ascending: false })

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRelationship(row as Record<string, unknown>))
}

export async function createUploadSession(
  admin: SupabaseClient,
  input: CreateUploadSessionInput,
): Promise<{ asset: GrowthMediaAsset; session: GrowthMediaAssetUploadSession }> {
  const asset = await getMediaAsset(admin, input.assetId)
  if (!asset) throw new Error("asset_not_found")
  if (asset.organizationId !== input.organizationId) throw new Error("organization_scope_mismatch")
  if (!canCreateUploadSession(asset.status)) throw new Error("invalid_status")

  const provider = resolveMediaStorageProvider(asset.provider, admin)
  const storageKey =
    asset.storageKey ??
    buildStorageKey({
      organizationId: asset.organizationId,
      assetId: asset.id,
      extension: input.extension ?? asset.extension,
    })

  const session = await provider.createUploadSession({
    organizationId: input.organizationId,
    assetId: asset.id,
    storageKey,
    mimeType: input.mimeType ?? asset.mimeType,
    fileSizeBytes: input.fileSizeBytes ?? asset.fileSizeBytes,
    signedUrlTtlSeconds: input.signedUrlTtlSeconds,
  })

  const metadata = {
    ...asset.metadata,
    upload_session: session,
  }

  const { data, error } = await assetsTable(admin)
    .update({
      status: "upload_pending",
      storage_key: session.storageKey,
      mime_type: input.mimeType ?? asset.mimeType,
      extension: input.extension ?? asset.extension,
      file_size_bytes: input.fileSizeBytes ?? asset.fileSizeBytes,
      metadata_json: metadata,
    })
    .eq("id", asset.id)
    .select("*")
    .single()

  if (error || !data) throw new Error(error?.message ?? "upload_session_failed")
  return { asset: mapAsset(data as Record<string, unknown>), session }
}

export async function completeUploadSession(
  admin: SupabaseClient,
  input: CompleteUploadSessionInput,
): Promise<GrowthMediaAsset> {
  const asset = await getMediaAsset(admin, input.assetId)
  if (!asset) throw new Error("asset_not_found")
  if (asset.organizationId !== input.organizationId) throw new Error("organization_scope_mismatch")
  if (asset.status !== "upload_pending" && asset.status !== "draft") throw new Error("invalid_status")

  const sessionRaw = asset.metadata.upload_session
  if (!sessionRaw || typeof sessionRaw !== "object") throw new Error("upload_session_not_found")
  const session = sessionRaw as GrowthMediaAssetUploadSession

  const provider = resolveMediaStorageProvider(asset.provider, admin)
  const completed = await provider.completeUpload({
    organizationId: input.organizationId,
    assetId: asset.id,
    storageKey: asset.storageKey ?? session.storageKey,
    sessionId: session.sessionId,
    checksumSha256: input.checksumSha256 ?? null,
    fileSizeBytes: input.fileSizeBytes ?? asset.fileSizeBytes,
  })

  const metadata = {
    ...asset.metadata,
    upload_session: session,
    upload_completion: completed.metadata,
  }

  const { data, error } = await assetsTable(admin)
    .update({
      status: "ready",
      storage_key: completed.storageKey,
      checksum_sha256: input.checksumSha256 ?? asset.checksumSha256,
      file_size_bytes: input.fileSizeBytes ?? asset.fileSizeBytes,
      uploaded_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      metadata_json: metadata,
    })
    .eq("id", asset.id)
    .select("*")
    .single()

  if (error || !data) throw new Error(error?.message ?? "upload_complete_failed")
  return mapAsset(data as Record<string, unknown>)
}

export async function generateMediaAssetSignedReadUrl(
  admin: SupabaseClient,
  input: { organizationId: string; assetId: string; signedUrlTtlSeconds?: number },
): Promise<{ url: string; expiresAt: string }> {
  const asset = await getMediaAsset(admin, input.assetId)
  if (!asset) throw new Error("asset_not_found")
  if (asset.organizationId !== input.organizationId) throw new Error("organization_scope_mismatch")
  if (!asset.storageKey) throw new Error("storage_key_missing")

  const provider = resolveMediaStorageProvider(asset.provider, admin)
  return provider.generateSignedReadUrl({
    organizationId: input.organizationId,
    assetId: asset.id,
    storageKey: asset.storageKey,
    signedUrlTtlSeconds: input.signedUrlTtlSeconds,
  })
}
