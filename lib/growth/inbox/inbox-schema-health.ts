import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_UNIFIED_INBOX_SCHEMA_MIGRATION = "20270129120000_growth_unified_inbox.sql" as const

export async function isGrowthUnifiedInboxSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("inbox_threads").select("id").limit(1)
  return !error
}
