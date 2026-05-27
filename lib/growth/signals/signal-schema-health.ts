import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_SIGNAL_FOUNDATION_SCHEMA_MIGRATION =
  "20270527120000_growth_engine_signal_foundation.sql" as const

export const GROWTH_SIGNAL_FOUNDATION_SCHEMA_SETUP_MESSAGE = `Intent signal foundation tables are not ready. Apply migration ${GROWTH_SIGNAL_FOUNDATION_SCHEMA_MIGRATION}.`

export async function isGrowthSignalFoundationSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const { error } = await admin.schema("growth").from("signals").select("id").limit(1)
  return !error
}
