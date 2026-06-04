import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_OUTREACH_PERFORMANCE_SCHEMA_MIGRATION =
  "20270622120000_growth_outreach_performance_intelligence.sql" as const

export async function isGrowthOutreachPerformanceSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("outreach_performance_attributions")
    .select("attribution_id")
    .limit(1)
  return !error
}
