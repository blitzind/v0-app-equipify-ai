import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_LIVE_PROVIDER_SETUP_SCHEMA_MIGRATION =
  "20270428120000_growth_live_provider_setup.sql" as const

export const GROWTH_LIVE_PROVIDER_SETUP_SCHEMA_SETUP_MESSAGE = `Live provider setup tables are not ready. Apply migration ${GROWTH_LIVE_PROVIDER_SETUP_SCHEMA_MIGRATION}.`

export async function isGrowthLiveProviderSetupSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("provider_connection_settings")
    .select("id")
    .limit(1)
  return !error
}
