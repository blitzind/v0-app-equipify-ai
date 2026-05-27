import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_PROVIDER_WEBHOOK_SCHEMA_MIGRATION = "20270411120000_growth_provider_webhook_ingestion.sql" as const

export async function isGrowthProviderWebhookSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("provider_delivery_events").select("id").limit(1),
    admin.schema("growth").from("provider_webhook_endpoints").select("id").limit(1),
  ])
  return checks.every((result) => !result.error)
}
