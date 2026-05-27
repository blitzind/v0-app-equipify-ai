import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_MAILBOX_CONNECTION_SCHEMA_MIGRATION =
  "20270125120000_growth_mailbox_connections.sql" as const

export async function isGrowthMailboxConnectionSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("mailbox_connections").select("id").limit(1)
  return !error
}
