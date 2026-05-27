import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_PROVIDER_CACHE_SCHEMA_MIGRATION =
  "20270328120000_growth_engine_provider_query_cache.sql" as const

export async function isGrowthProviderCacheSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("provider_query_cache")
    .select("id")
    .limit(1)
  return !error
}
