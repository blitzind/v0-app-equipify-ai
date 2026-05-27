import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_ENGAGEMENT_TRACKING_SCHEMA_MIGRATION =
  "20270409120000_growth_engagement_tracking.sql" as const

export async function isGrowthEngagementTrackingSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("email_opens").select("id").limit(1),
    admin.schema("growth").from("email_clicks").select("id").limit(1),
    admin.schema("growth").from("engagement_scores").select("id").limit(1),
  ])
  return checks.every((result) => !result.error)
}
