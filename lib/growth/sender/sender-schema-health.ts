import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_SENDER_INFRASTRUCTURE_SCHEMA_MIGRATION =
  "20270124120000_growth_sender_infrastructure.sql" as const

export async function isGrowthSenderInfrastructureSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("sender_accounts").select("id").limit(1)
  return !error
}
