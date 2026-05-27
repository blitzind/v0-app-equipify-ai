import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_PROVIDER_DELIVERY_SCHEMA_MIGRATION = "20270130120000_growth_provider_delivery.sql" as const

export async function isGrowthProviderDeliverySchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("delivery_providers").select("id").limit(1)
  return !error
}
