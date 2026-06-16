import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

const MEDIA_ASSET_EVENT_COLUMNS = [
  "id",
  "organization_id",
  "asset_id",
  "relationship_id",
  "event_type",
  "lead_id",
  "share_page_id",
  "template_id",
  "sequence_id",
  "session_id",
  "anonymous_id_hash",
  "event_timestamp",
  "progress_seconds",
  "progress_percent",
  "duration_seconds",
  "cta_key",
  "metadata_json",
  "created_at",
] as const

const MEDIA_ASSET_ROLLUP_COLUMNS = [
  "asset_id",
  "organization_id",
  "views",
  "unique_views",
  "play_starts",
  "completions",
  "completion_rate",
  "average_watch_seconds",
  "cta_clicks",
  "last_event_at",
  "updated_at",
] as const

export type GrowthMediaAssetAnalyticsSchemaProbe = {
  ready: boolean
  tables: Array<{ table: string; ok: boolean; error: string | null }>
}

export async function probeGrowthMediaAssetAnalyticsSchema(
  admin: SupabaseClient,
): Promise<GrowthMediaAssetAnalyticsSchemaProbe> {
  const tables = await Promise.all([
    (async () => {
      const { error } = await admin
        .schema("growth")
        .from("media_asset_events")
        .select(MEDIA_ASSET_EVENT_COLUMNS.join(", "))
        .limit(1)
      return { table: "media_asset_events", ok: !error, error: error?.message ?? null }
    })(),
    (async () => {
      const { error } = await admin
        .schema("growth")
        .from("media_asset_event_rollups")
        .select(MEDIA_ASSET_ROLLUP_COLUMNS.join(", "))
        .limit(1)
      return { table: "media_asset_event_rollups", ok: !error, error: error?.message ?? null }
    })(),
  ])

  return {
    ready: tables.every((entry) => entry.ok),
    tables,
  }
}

export async function isGrowthMediaAssetAnalyticsSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const probe = await probeGrowthMediaAssetAnalyticsSchema(admin)
  return probe.ready
}
