import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SHARE_PAGE_TEMPLATES_MIGRATION,
  GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
} from "@/lib/growth/share-pages/share-page-template-types"

export const GROWTH_SHARE_PAGE_TEMPLATES_SCHEMA_SETUP_MESSAGE =
  `Share Page Template tables are not ready. Apply migration ${GROWTH_SHARE_PAGE_TEMPLATES_MIGRATION}.`

export const GROWTH_SHARE_PAGE_TEMPLATES_SCHEMA_OBJECTS = [
  {
    table: "share_page_templates",
    label: "growth.share_page_templates",
    columns: [
      "id",
      "organization_id",
      "created_by",
      "name",
      "description",
      "category",
      "tags",
      "preview_image_url",
      "status",
      "published_at",
      "archived_at",
      "current_version_id",
      "published_version_id",
      "requires_human_review",
      "qa_marker",
      "created_at",
      "updated_at",
    ],
  },
  {
    table: "share_page_template_versions",
    label: "growth.share_page_template_versions",
    columns: [
      "id",
      "template_id",
      "version_number",
      "status",
      "blocks_json",
      "theme_json",
      "default_booking_page_id",
      "merge_fields_used",
      "change_summary",
      "is_immutable",
      "created_by",
      "published_by",
      "published_at",
      "created_at",
    ],
  },
] as const

export async function isGrowthSharePageTemplatesSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all(
    GROWTH_SHARE_PAGE_TEMPLATES_SCHEMA_OBJECTS.map(({ table, columns }) =>
      admin
        .schema("growth")
        .from(table)
        .select(columns.join(", "))
        .limit(1),
    ),
  )
  return checks.every((result) => !result.error)
}

export async function probeGrowthSharePageTemplatesSchema(admin: SupabaseClient): Promise<{
  qa_marker: typeof GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER
  ready: boolean
  tables: Array<{ table: string; ok: boolean; error: string | null }>
}> {
  const tables = await Promise.all(
    GROWTH_SHARE_PAGE_TEMPLATES_SCHEMA_OBJECTS.map(async ({ table, columns }) => {
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
    qa_marker: GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
    ready: tables.every((entry) => entry.ok),
    tables,
  }
}
