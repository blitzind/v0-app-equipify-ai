import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_SENDR_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import type { GrowthSendrVideoAsset } from "@/lib/growth/sendr/growth-sendr-types"

function videoAssetsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_video_assets")
}

function videoEventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_video_asset_events")
}

function mapVideoAsset(row: Record<string, unknown>): GrowthSendrVideoAsset {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownerUserId: String(row.owner_user_id),
    mediaAssetId: row.media_asset_id ? String(row.media_asset_id) : null,
    sourceUrl: row.source_url ? String(row.source_url) : null,
    durationSeconds: row.duration_seconds != null ? Number(row.duration_seconds) : null,
    width: row.width != null ? Number(row.width) : null,
    height: row.height != null ? Number(row.height) : null,
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    posterUrl: row.poster_url ? String(row.poster_url) : null,
    transcriptStatus: String(row.transcript_status) as GrowthSendrVideoAsset["transcriptStatus"],
    captionsStatus: String(row.captions_status) as GrowthSendrVideoAsset["captionsStatus"],
    legacyVideoAssetId: row.legacy_video_asset_id ? String(row.legacy_video_asset_id) : null,
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    createdAt: String(row.created_at),
  }
}

export async function registerGrowthSendrVideoAssetMetadata(
  admin: SupabaseClient,
  input: {
    organizationId: string
    ownerUserId: string
    mediaAssetId?: string | null
    sourceUrl?: string | null
    durationSeconds?: number | null
    width?: number | null
    height?: number | null
    sizeBytes?: number | null
    posterUrl?: string | null
    legacyVideoAssetId?: string | null
    transcriptStatus?: GrowthSendrVideoAsset["transcriptStatus"]
    captionsStatus?: GrowthSendrVideoAsset["captionsStatus"]
  },
): Promise<GrowthSendrVideoAsset> {
  const { data, error } = await videoAssetsTable(admin)
    .insert({
      organization_id: input.organizationId,
      owner_user_id: input.ownerUserId,
      media_asset_id: input.mediaAssetId ?? null,
      source_url: input.sourceUrl ?? null,
      duration_seconds: input.durationSeconds ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      size_bytes: input.sizeBytes ?? null,
      poster_url: input.posterUrl ?? null,
      transcript_status: input.transcriptStatus ?? "none",
      captions_status: input.captionsStatus ?? "none",
      legacy_video_asset_id: input.legacyVideoAssetId ?? null,
      qa_marker: GROWTH_SENDR_QA_MARKER,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapVideoAsset(data as Record<string, unknown>)
}

export async function getGrowthSendrVideoAsset(
  admin: SupabaseClient,
  videoAssetId: string,
): Promise<GrowthSendrVideoAsset | null> {
  const { data, error } = await videoAssetsTable(admin)
    .select("*")
    .eq("id", videoAssetId)
    .is("deleted_at", null)
    .maybeSingle()
  if (error || !data) return null
  return mapVideoAsset(data as Record<string, unknown>)
}

export async function updateGrowthSendrVideoAssetMetadata(
  admin: SupabaseClient,
  input: {
    videoAssetId: string
    organizationId: string
    sourceUrl?: string | null
    posterUrl?: string | null
    mediaAssetId?: string | null
    transcriptStatus?: GrowthSendrVideoAsset["transcriptStatus"]
    captionsStatus?: GrowthSendrVideoAsset["captionsStatus"]
  },
): Promise<GrowthSendrVideoAsset> {
  const patch: Record<string, unknown> = {}
  if (input.sourceUrl !== undefined) patch.source_url = input.sourceUrl
  if (input.posterUrl !== undefined) patch.poster_url = input.posterUrl
  if (input.mediaAssetId !== undefined) patch.media_asset_id = input.mediaAssetId
  if (input.transcriptStatus !== undefined) patch.transcript_status = input.transcriptStatus
  if (input.captionsStatus !== undefined) patch.captions_status = input.captionsStatus

  const { data, error } = await videoAssetsTable(admin)
    .update(patch)
    .eq("id", input.videoAssetId)
    .eq("organization_id", input.organizationId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapVideoAsset(data as Record<string, unknown>)
}

export async function appendGrowthSendrVideoAssetEvent(
  admin: SupabaseClient,
  input: {
    videoAssetId: string
    organizationId: string
    sessionId: string
    eventType: "video_start" | "video_progress" | "video_complete"
    progressPct?: number | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await videoEventsTable(admin).insert({
    video_asset_id: input.videoAssetId,
    organization_id: input.organizationId,
    session_id: input.sessionId,
    event_type: input.eventType,
    progress_pct: input.progressPct ?? null,
    metadata: input.metadata ?? {},
    qa_marker: GROWTH_SENDR_QA_MARKER,
  })
  if (error) throw new Error(error.message)
}

export async function countGrowthSendrVideoEventsToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<number> {
  const { count, error } = await videoEventsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", dayStart)
  if (error) return 0
  return count ?? 0
}
