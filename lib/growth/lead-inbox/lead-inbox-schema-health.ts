import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_LEAD_INBOX_SCHEMA_SETUP_MESSAGE =
  "Lead Inbox table is not ready. Apply migration 20270317120000_growth_engine_lead_inbox.sql."

export async function isGrowthLeadInboxSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("lead_inbox").select("id").limit(1)
  return !error
}
