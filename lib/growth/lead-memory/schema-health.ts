import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_LEAD_MEMORY_ENGINE_SCHEMA_MIGRATION =
  "20270425120000_growth_lead_memory_engine.sql" as const

export async function isGrowthLeadMemoryEngineSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("lead_memory_profiles").select("id").limit(1),
    admin.schema("growth").from("lead_memory_events").select("id").limit(1),
    admin.schema("growth").from("lead_objection_memory").select("id").limit(1),
    admin.schema("growth").from("lead_preference_memory").select("id").limit(1),
    admin.schema("growth").from("relationship_context").select("id").limit(1),
    admin.schema("growth").from("committee_relationship_context").select("id").limit(1),
    admin.schema("growth").from("relationship_summary_snapshots").select("id").limit(1),
  ])
  return checks.every((result) => !result.error)
}
