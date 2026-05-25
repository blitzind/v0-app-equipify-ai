import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_DOGFOOD_SCHEMA_SETUP_MESSAGE =
  "Dogfood validation tables are not ready. Apply migration 20270302120000_growth_engine_dogfood_validation.sql."

export async function isGrowthDogfoodSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("dogfood_validation_runs").select("id").limit(1)
  return !error
}
