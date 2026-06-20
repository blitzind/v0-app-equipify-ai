import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SENDR_LIMITS,
  GROWTH_SENDR_QA_MARKER,
  type GrowthSendrMediaAssetType,
} from "@/lib/growth/sendr/growth-sendr-config"
import type { GrowthSendrMediaAsset, GrowthSendrMediaAssetVersion } from "@/lib/growth/sendr/growth-sendr-types"

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function assetsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_media_assets")
}

function versionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_media_asset_versions")
}

function accessLogsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_media_asset_access_logs")
}

function mapAsset(row: Record<string, unknown>): GrowthSendrMediaAsset {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownerUserId: String(row.owner_user_id),
    assetType: String(row.asset_type) as GrowthSendrMediaAssetType,
    name: String(row.name),
    slug: asString(row.slug),
    status: String(row.status) as GrowthSendrMediaAsset["status"],
    publishedVersionId: asString(row.published_version_id),
    legacyMediaAssetId: asString(row.legacy_media_asset_id),
    legacySharePageId: asString(row.legacy_share_page_id),
    legacyVideoAssetId: asString(row.legacy_video_asset_id),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    deletedAt: asString(row.deleted_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapVersion(row: Record<string, unknown>): GrowthSendrMediaAssetVersion {
  return {
    id: String(row.id),
    mediaAssetId: String(row.media_asset_id),
    organizationId: String(row.organization_id),
    versionNumber: Number(row.version_number),
    status: String(row.status) as GrowthSendrMediaAssetVersion["status"],
    isImmutable: Boolean(row.is_immutable),
    storageMetadata: (row.storage_metadata as Record<string, unknown>) ?? {},
    publishedAt: asString(row.published_at),
    publishedBy: asString(row.published_by),
    createdAt: String(row.created_at),
  }
}

export async function createGrowthSendrMediaAsset(
  admin: SupabaseClient,
  input: {
    organizationId: string
    ownerUserId: string
    assetType: GrowthSendrMediaAssetType
    name: string
    slug?: string | null
    metadata?: Record<string, unknown>
    legacyMediaAssetId?: string | null
    legacySharePageId?: string | null
    legacyVideoAssetId?: string | null
  },
): Promise<GrowthSendrMediaAsset> {
  const { data, error } = await assetsTable(admin)
    .insert({
      organization_id: input.organizationId,
      owner_user_id: input.ownerUserId,
      asset_type: input.assetType,
      name: input.name,
      slug: input.slug ?? null,
      metadata: input.metadata ?? {},
      legacy_media_asset_id: input.legacyMediaAssetId ?? null,
      legacy_share_page_id: input.legacySharePageId ?? null,
      legacy_video_asset_id: input.legacyVideoAssetId ?? null,
      qa_marker: GROWTH_SENDR_QA_MARKER,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapAsset(data as Record<string, unknown>)
}

export async function createGrowthSendrMediaAssetVersion(
  admin: SupabaseClient,
  input: {
    mediaAssetId: string
    organizationId: string
    storageMetadata?: Record<string, unknown>
  },
): Promise<GrowthSendrMediaAssetVersion> {
  const { count } = await versionsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("media_asset_id", input.mediaAssetId)
  const versionNumber = Math.min((count ?? 0) + 1, GROWTH_SENDR_LIMITS.MAX_MEDIA_ASSET_VERSIONS_PER_ASSET)

  const { data, error } = await versionsTable(admin)
    .insert({
      media_asset_id: input.mediaAssetId,
      organization_id: input.organizationId,
      version_number: versionNumber,
      storage_metadata: input.storageMetadata ?? {},
      qa_marker: GROWTH_SENDR_QA_MARKER,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapVersion(data as Record<string, unknown>)
}

export async function publishGrowthSendrMediaAssetVersion(
  admin: SupabaseClient,
  input: {
    mediaAssetId: string
    versionId: string
    publishedBy: string
  },
): Promise<GrowthSendrMediaAsset> {
  await versionsTable(admin)
    .update({
      status: "published",
      is_immutable: true,
      published_at: new Date().toISOString(),
      published_by: input.publishedBy,
    })
    .eq("id", input.versionId)
    .eq("media_asset_id", input.mediaAssetId)

  const { data, error } = await assetsTable(admin)
    .update({
      status: "published",
      published_version_id: input.versionId,
    })
    .eq("id", input.mediaAssetId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapAsset(data as Record<string, unknown>)
}

export async function softDeleteGrowthSendrMediaAsset(
  admin: SupabaseClient,
  mediaAssetId: string,
): Promise<void> {
  const { error } = await assetsTable(admin)
    .update({ deleted_at: new Date().toISOString(), status: "archived" })
    .eq("id", mediaAssetId)
  if (error) throw new Error(error.message)
}

export async function logGrowthSendrMediaAssetAccess(
  admin: SupabaseClient,
  input: {
    mediaAssetId: string
    organizationId: string
    accessKind: "read" | "write" | "publish" | "archive"
    actorUserId?: string | null
    sessionId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await accessLogsTable(admin).insert({
    media_asset_id: input.mediaAssetId,
    organization_id: input.organizationId,
    access_kind: input.accessKind,
    actor_user_id: input.actorUserId ?? null,
    session_id: input.sessionId ?? null,
    metadata: input.metadata ?? {},
    qa_marker: GROWTH_SENDR_QA_MARKER,
  })
  if (error) throw new Error(error.message)
}

export async function countGrowthSendrMediaAssetsCreatedToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<number> {
  const { count, error } = await assetsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", dayStart)
  if (error) return 0
  return count ?? 0
}

export async function getGrowthSendrMediaAsset(
  admin: SupabaseClient,
  mediaAssetId: string,
): Promise<GrowthSendrMediaAsset | null> {
  const { data, error } = await assetsTable(admin)
    .select("*")
    .eq("id", mediaAssetId)
    .is("deleted_at", null)
    .maybeSingle()
  if (error || !data) return null
  return mapAsset(data as Record<string, unknown>)
}

export async function listGrowthSendrMediaAssets(
  admin: SupabaseClient,
  input: {
    organizationId: string
    limit?: number
    offset?: number
  },
): Promise<{ items: GrowthSendrMediaAsset[]; total: number }> {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100)
  const offset = Math.max(input.offset ?? 0, 0)
  const { data, error, count } = await assetsTable(admin)
    .select("*", { count: "exact" })
    .eq("organization_id", input.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw new Error(error.message)
  return {
    items: (data ?? []).map((row) => mapAsset(row as Record<string, unknown>)),
    total: count ?? 0,
  }
}
