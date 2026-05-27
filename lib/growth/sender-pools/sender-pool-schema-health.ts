import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_SENDER_POOL_INTELLIGENCE_SCHEMA_MIGRATION =
  "20270422120000_growth_sender_pool_intelligence.sql" as const

export async function isGrowthSenderPoolIntelligenceSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("sender_pools").select("id").limit(1),
    admin.schema("growth").from("sender_pool_members").select("id").limit(1),
    admin.schema("growth").from("sender_rotation_decisions").select("id").limit(1),
    admin.schema("growth").from("sender_fatigue_events").select("id").limit(1),
    admin.schema("growth").from("sender_pool_performance_snapshots").select("id").limit(1),
  ])
  return checks.every((result) => !result.error)
}
