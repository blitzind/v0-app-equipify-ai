import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_MULTICHANNEL_SEQUENCES_SCHEMA_MIGRATION =
  "20270420120000_growth_multichannel_sequences.sql" as const

export async function isGrowthMultichannelSequencesSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("sequence_channel_tasks").select("id").limit(1),
    admin.schema("growth").from("sequence_channel_task_events").select("id").limit(1),
    admin.schema("growth").from("channel_performance_snapshots").select("id").limit(1),
    admin.schema("growth").from("channel_routing_rules").select("id").limit(1),
  ])
  return checks.every((result) => !result.error)
}
