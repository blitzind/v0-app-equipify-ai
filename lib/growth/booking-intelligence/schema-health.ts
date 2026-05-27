import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_CALENDAR_BOOKING_INTELLIGENCE_SCHEMA_MIGRATION =
  "20270419120000_growth_calendar_booking_intelligence.sql" as const

export async function isGrowthCalendarBookingIntelligenceSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("booking_recommendations").select("id").limit(1),
    admin.schema("growth").from("booking_intent_signals").select("id").limit(1),
    admin.schema("growth").from("calendar_routing_rules").select("id").limit(1),
    admin.schema("growth").from("booking_attribution_events").select("id").limit(1),
    admin.schema("growth").from("meeting_conversion_events").select("id").limit(1),
  ])
  return checks.every((result) => !result.error)
}
