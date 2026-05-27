import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_TEMPLATE_SNIPPET_SYSTEM_SCHEMA_MIGRATION =
  "20270424120000_growth_template_snippet_system.sql" as const

export async function isGrowthContentLibrarySchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("content_templates").select("id").limit(1),
    admin.schema("growth").from("content_template_versions").select("id").limit(1),
    admin.schema("growth").from("content_snippets").select("id").limit(1),
    admin.schema("growth").from("content_snippet_versions").select("id").limit(1),
    admin.schema("growth").from("content_variable_registry").select("id").limit(1),
    admin.schema("growth").from("content_approval_events").select("id").limit(1),
  ])
  return checks.every((result) => !result.error)
}
