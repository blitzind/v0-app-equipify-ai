import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

const MEDIA_ASSET_COLUMNS = [
  "id",
  "organization_id",
  "created_by",
  "asset_type",
  "provider",
  "status",
  "title",
  "description",
  "storage_key",
  "original_filename",
  "mime_type",
  "extension",
  "file_size_bytes",
  "duration_seconds",
  "width",
  "height",
  "thumbnail_storage_key",
  "waveform_storage_key",
  "metadata_json",
  "tags",
  "checksum_sha256",
  "source",
  "source_reference",
  "uploaded_at",
  "processed_at",
  "archived_at",
  "created_at",
  "updated_at",
] as const

const MEDIA_ASSET_RELATIONSHIP_COLUMNS = [
  "id",
  "organization_id",
  "asset_id",
  "relationship_type",
  "relationship_id",
  "metadata_json",
  "created_at",
] as const

export type GrowthMediaAssetsSchemaProbe = {
  ready: boolean
  tables: Array<{ table: string; ok: boolean; error: string | null }>
}

export async function probeGrowthMediaAssetsSchema(admin: SupabaseClient): Promise<GrowthMediaAssetsSchemaProbe> {
  const tables = await Promise.all([
    (async () => {
      const { error } = await admin
        .schema("growth")
        .from("media_assets")
        .select(MEDIA_ASSET_COLUMNS.join(", "))
        .limit(1)
      return { table: "media_assets", ok: !error, error: error?.message ?? null }
    })(),
    (async () => {
      const { error } = await admin
        .schema("growth")
        .from("media_asset_relationships")
        .select(MEDIA_ASSET_RELATIONSHIP_COLUMNS.join(", "))
        .limit(1)
      return { table: "media_asset_relationships", ok: !error, error: error?.message ?? null }
    })(),
  ])

  return {
    ready: tables.every((entry) => entry.ok),
    tables,
  }
}

export async function isGrowthMediaAssetsSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const probe = await probeGrowthMediaAssetsSchema(admin)
  return probe.ready
}
