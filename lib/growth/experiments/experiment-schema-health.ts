import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_SEQUENCE_AB_TESTING_SCHEMA_MIGRATION =
  "20270416120000_growth_sequence_ab_testing.sql" as const

export async function isGrowthSequenceAbTestingSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("sequence_experiments").select("id").limit(1),
    admin.schema("growth").from("sequence_experiment_variants").select("id").limit(1),
    admin.schema("growth").from("sequence_experiment_assignments").select("id").limit(1),
    admin.schema("growth").from("sequence_experiment_results").select("id").limit(1),
    admin.schema("growth").from("sequence_experiment_events").select("id").limit(1),
  ])
  return checks.every((result) => !result.error)
}
