import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_INBOX_TEAM_OWNERSHIP_SCHEMA_MIGRATION =
  "20270415120000_growth_inbox_team_ownership.sql" as const

export async function isGrowthInboxTeamOwnershipSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("inbox_assignment_settings").select("id").limit(1),
    admin.schema("growth").from("inbox_assignment_rules").select("id").limit(1),
    admin.schema("growth").from("inbox_thread_owner_history").select("id").limit(1),
    admin.schema("growth").from("inbox_threads").select("assigned_at").limit(1),
  ])
  return checks.every((result) => !result.error)
}
