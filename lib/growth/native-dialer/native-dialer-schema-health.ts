import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_NATIVE_DIALER_SCHEMA_SETUP_MESSAGE =
  "Native dialer tables are not ready. Apply migration 20270315120000_growth_engine_native_dialer.sql."

export async function isGrowthNativeDialerSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("native_call_workspace_sessions").select("id").limit(1)
  return !error
}
