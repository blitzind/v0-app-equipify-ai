import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_SMS_SCHEMA_MIGRATION = "20270703120000_growth_sms_infrastructure_foundation.sql" as const

export const GROWTH_SMS_PLATFORM_SETTINGS_ID = "00000000-0000-4000-8000-000000005501" as const

export async function isGrowthSmsSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("sms_workspace_settings").select("id").limit(1),
    admin.schema("growth").from("sms_conversations").select("id").limit(1),
    admin.schema("growth").from("sms_messages").select("id").limit(1),
    admin.schema("growth").from("sms_delivery_attempts").select("id").limit(1),
    admin.schema("growth").from("sms_provider_events").select("id").limit(1),
  ])
  return checks.every((result) => !result.error)
}
