import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_SEQUENCE_EXECUTION_SCHEMA_MIGRATION = "20270128120000_growth_sequence_execution.sql" as const

export async function isGrowthSequenceExecutionSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("sequence_templates").select("id").limit(1)
  return !error
}
