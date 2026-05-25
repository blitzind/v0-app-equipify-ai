import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_MEETING_OUTCOME_SCHEMA_SETUP_MESSAGE =
  "Meeting outcome intelligence tables are not ready. Apply migration 20270314120000_growth_engine_meeting_outcome_intelligence.sql."

export async function isGrowthMeetingOutcomeSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("meeting_outcome_intelligence_scores")
    .select("id")
    .limit(1)
  return !error
}
