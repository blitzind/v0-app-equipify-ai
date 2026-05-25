import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_HUMAN_EXECUTION_SCHEMA_SETUP_MESSAGE =
  "Human-approved execution tables are not ready. Apply migration 20270313120000_growth_engine_human_approved_execution.sql."

export async function isGrowthHumanExecutionSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("human_execution_approvals").select("id").limit(1)
  return !error
}
