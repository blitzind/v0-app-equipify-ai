import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_AI_PERSONALIZATION_SCHEMA_MIGRATION =
  "20270427120000_growth_ai_personalization.sql" as const

export async function isGrowthAiPersonalizationSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("personalization_profiles").select("id").limit(1),
    admin.schema("growth").from("personalization_generations").select("id").limit(1),
    admin.schema("growth").from("personalization_evidence").select("id").limit(1),
    admin.schema("growth").from("personalization_risk_events").select("id").limit(1),
    admin.schema("growth").from("personalization_feedback").select("id").limit(1),
    admin.schema("growth").from("personalization_performance_snapshots").select("id").limit(1),
  ])
  return checks.every((result) => !result.error)
}
