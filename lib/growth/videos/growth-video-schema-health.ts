import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_VIDEO_FOUNDATION_MIGRATION,
  GROWTH_VIDEO_ASSETS_UPLOAD_MIGRATION,
  GROWTH_VIDEO_PAGES_MIGRATION,
  GROWTH_VIDEO_ANALYTICS_MIGRATION,
  GROWTH_VIDEO_FOUNDATION_QA_MARKER,
  GROWTH_VIDEOS_STORAGE_BUCKET,
} from "@/lib/growth/videos/growth-video-types"
import { probeGrowthVideoStorageBucket } from "@/lib/growth/videos/growth-video-upload-service"

export const GROWTH_VIDEO_SCHEMA_SETUP_MESSAGE =
  `Video Recording Studio tables are not ready. Apply migration ${GROWTH_VIDEO_FOUNDATION_MIGRATION}.`

export const GROWTH_VIDEO_SCHEMA_OBJECTS = [
  {
    table: "video_assets",
    label: "growth.video_assets",
    columns: [
      "id",
      "organization_id",
      "created_by",
      "title",
      "status",
      "source_type",
      "storage_path",
      "transcript_status",
      "captions_status",
      "upload_status",
      "mime_type",
      "file_size_bytes",
    ],
  },
  {
    table: "video_templates",
    label: "growth.video_templates",
    columns: ["id", "organization_id", "name", "configuration_json"],
  },
  {
    table: "video_views",
    label: "growth.video_views",
    columns: [
      "id",
      "organization_id",
      "video_asset_id",
      "watched_seconds",
      "percent_watched",
      "cta_clicked",
      "meeting_booked",
    ],
  },
  {
    table: "video_pages",
    label: "growth.video_pages",
    columns: [
      "id",
      "organization_id",
      "video_asset_id",
      "slug",
      "title",
      "status",
      "cta_label",
      "cta_url",
      "calendar_url",
      "published_at",
    ],
  },
  {
    table: "video_page_events",
    label: "growth.video_page_events",
    columns: ["id", "organization_id", "video_page_id", "video_asset_id", "event_type", "session_id"],
  },
  {
    table: "video_engagement_summaries",
    label: "growth.video_engagement_summaries",
    columns: [
      "id",
      "organization_id",
      "video_asset_id",
      "video_page_id",
      "session_id",
      "engagement_score",
      "total_views",
    ],
  },
] as const

export async function isGrowthVideoAssetsSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const object = GROWTH_VIDEO_SCHEMA_OBJECTS.find((entry) => entry.table === "video_assets")
  if (!object) return false
  const { error } = await admin
    .schema("growth")
    .from(object.table)
    .select(object.columns.join(", "))
    .limit(1)
  return !error
}

export async function isGrowthVideoTemplatesSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const object = GROWTH_VIDEO_SCHEMA_OBJECTS.find((entry) => entry.table === "video_templates")
  if (!object) return false
  const { error } = await admin
    .schema("growth")
    .from(object.table)
    .select(object.columns.join(", "))
    .limit(1)
  return !error
}

export async function isGrowthVideoViewsSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const object = GROWTH_VIDEO_SCHEMA_OBJECTS.find((entry) => entry.table === "video_views")
  if (!object) return false
  const { error } = await admin
    .schema("growth")
    .from(object.table)
    .select(object.columns.join(", "))
    .limit(1)
  return !error
}

export async function isGrowthVideoPagesSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const object = GROWTH_VIDEO_SCHEMA_OBJECTS.find((entry) => entry.table === "video_pages")
  if (!object) return false
  const { error } = await admin
    .schema("growth")
    .from(object.table)
    .select(object.columns.join(", "))
    .limit(1)
  return !error
}

export async function isGrowthVideoPageEventsSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const object = GROWTH_VIDEO_SCHEMA_OBJECTS.find((entry) => entry.table === "video_page_events")
  if (!object) return false
  const { error } = await admin
    .schema("growth")
    .from(object.table)
    .select(object.columns.join(", "))
    .limit(1)
  return !error
}

export async function isGrowthVideoAnalyticsSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const object = GROWTH_VIDEO_SCHEMA_OBJECTS.find((entry) => entry.table === "video_engagement_summaries")
  if (!object) return false
  const { error } = await admin
    .schema("growth")
    .from(object.table)
    .select(object.columns.join(", "))
    .limit(1)
  return !error
}

export async function isGrowthVideoFoundationSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    isGrowthVideoAssetsSchemaReady(admin),
    isGrowthVideoTemplatesSchemaReady(admin),
    isGrowthVideoViewsSchemaReady(admin),
    isGrowthVideoPagesSchemaReady(admin),
    isGrowthVideoPageEventsSchemaReady(admin),
  ])
  return checks.every(Boolean)
}

export async function isGrowthVideoAssetsUploadSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("video_assets")
    .select("upload_status, mime_type, file_size_bytes, original_filename, processing_error")
    .limit(1)
  return !error
}

export async function probeGrowthVideoStorageBucketHealth(admin: SupabaseClient): Promise<{
  bucket: typeof GROWTH_VIDEOS_STORAGE_BUCKET
  ok: boolean
  error: string | null
}> {
  const result = await probeGrowthVideoStorageBucket(admin)
  return {
    bucket: GROWTH_VIDEOS_STORAGE_BUCKET,
    ok: result.ok,
    error: result.error,
  }
}

export async function probeGrowthVideoFoundationSchema(admin: SupabaseClient): Promise<{
  qa_marker: typeof GROWTH_VIDEO_FOUNDATION_QA_MARKER
  ready: boolean
  upload_schema_ready: boolean
  pages_schema_ready: boolean
  analytics_schema_ready: boolean
  migration: typeof GROWTH_VIDEO_FOUNDATION_MIGRATION
  upload_migration: typeof GROWTH_VIDEO_ASSETS_UPLOAD_MIGRATION
  pages_migration: typeof GROWTH_VIDEO_PAGES_MIGRATION
  analytics_migration: typeof GROWTH_VIDEO_ANALYTICS_MIGRATION
  storage_bucket: Awaited<ReturnType<typeof probeGrowthVideoStorageBucketHealth>>
  tables: Array<{ table: string; ok: boolean; error: string | null }>
}> {
  const tables = await Promise.all(
    GROWTH_VIDEO_SCHEMA_OBJECTS.map(async ({ table, columns }) => {
      const { error } = await admin
        .schema("growth")
        .from(table)
        .select(columns.join(", "))
        .limit(1)
      return {
        table,
        ok: !error,
        error: error?.message ?? null,
      }
    }),
  )

  return {
    qa_marker: GROWTH_VIDEO_FOUNDATION_QA_MARKER,
    ready: tables.every((entry) => entry.ok),
    upload_schema_ready: await isGrowthVideoAssetsUploadSchemaReady(admin),
    pages_schema_ready: await isGrowthVideoPagesSchemaReady(admin),
    analytics_schema_ready: await isGrowthVideoAnalyticsSchemaReady(admin),
    migration: GROWTH_VIDEO_FOUNDATION_MIGRATION,
    upload_migration: GROWTH_VIDEO_ASSETS_UPLOAD_MIGRATION,
    pages_migration: GROWTH_VIDEO_PAGES_MIGRATION,
    analytics_migration: GROWTH_VIDEO_ANALYTICS_MIGRATION,
    storage_bucket: await probeGrowthVideoStorageBucketHealth(admin),
    tables,
  }
}
