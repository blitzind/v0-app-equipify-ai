import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_LIVE_PROVIDER_TRANSPORT_SCHEMA_MIGRATION =
  "20270408120000_growth_live_provider_transport.sql" as const

export async function isGrowthLiveProviderTransportSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("delivery_attempts").select("id").limit(1)
  return !error
}
