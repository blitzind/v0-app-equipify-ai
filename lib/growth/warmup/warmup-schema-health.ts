import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_WARMUP_FOUNDATION_SCHEMA_MIGRATION = "20270127120000_growth_warmup_foundation.sql" as const

export async function isGrowthWarmupFoundationSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("warmup_profiles").select("id").limit(1)
  return !error
}
