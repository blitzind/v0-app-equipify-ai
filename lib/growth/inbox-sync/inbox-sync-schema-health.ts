import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_INBOX_SYNC_SCHEMA_MIGRATION = "20270413120000_growth_inbox_sync_thread_continuity.sql" as const

export async function isGrowthInboxSyncSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("inbox_sync_runs").select("id").limit(1),
    admin.schema("growth").from("inbox_provider_message_map").select("id").limit(1),
    admin.schema("growth").from("inbox_thread_links").select("id").limit(1),
  ])
  return checks.every((result) => !result.error)
}
