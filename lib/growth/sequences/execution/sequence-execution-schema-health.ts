import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_SEQUENCE_SAFE_EXECUTION_SCHEMA_MIGRATION =
  "20270412120000_growth_sequence_safe_execution.sql" as const

export async function isGrowthSequenceSafeExecutionSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("sequence_execution_jobs").select("id").limit(1),
    admin.schema("growth").from("sequence_execution_job_events").select("id").limit(1),
  ])
  return checks.every((result) => !result.error)
}
