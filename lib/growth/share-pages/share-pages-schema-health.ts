import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SHARE_PAGES_MIGRATION,
  GROWTH_SHARE_PAGES_QA_MARKER,
} from "@/lib/growth/share-pages/share-page-types"

export const GROWTH_SHARE_PAGES_SCHEMA_SETUP_MESSAGE =
  `Share Pages tables are not ready. Apply migration ${GROWTH_SHARE_PAGES_MIGRATION}.`

export const GROWTH_SHARE_PAGES_SCHEMA_OBJECTS = [
  {
    table: "share_pages",
    label: "growth.share_pages",
    columns: [
      "id",
      "organization_id",
      "lead_id",
      "token_hash",
      "token_prefix",
      "preview_token_hash",
      "status",
      "source_channel",
      "requires_human_review",
    ],
  },
  {
    table: "share_page_views",
    label: "growth.share_page_views",
    columns: ["id", "share_page_id", "lead_id", "session_key", "duration_ms"],
  },
  {
    table: "share_page_events",
    label: "growth.share_page_events",
    columns: ["id", "share_page_id", "lead_id", "event_type", "occurred_at"],
  },
] as const

export async function isGrowthSharePagesSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all(
    GROWTH_SHARE_PAGES_SCHEMA_OBJECTS.map(({ table, columns }) =>
      admin
        .schema("growth")
        .from(table)
        .select(columns.join(", "))
        .limit(1),
    ),
  )
  return checks.every((result) => !result.error)
}

export async function probeGrowthSharePagesSchema(admin: SupabaseClient): Promise<{
  qa_marker: typeof GROWTH_SHARE_PAGES_QA_MARKER
  ready: boolean
  tables: Array<{ table: string; ok: boolean; error: string | null }>
}> {
  const tables = await Promise.all(
    GROWTH_SHARE_PAGES_SCHEMA_OBJECTS.map(async ({ table, columns }) => {
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
    qa_marker: GROWTH_SHARE_PAGES_QA_MARKER,
    ready: tables.every((entry) => entry.ok),
    tables,
  }
}
