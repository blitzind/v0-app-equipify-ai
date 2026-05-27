import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_DNS_DELIVERABILITY_SCHEMA_MIGRATION =
  "20270126120000_growth_dns_deliverability.sql" as const

export async function isGrowthDnsDeliverabilitySchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("domain_dns_checks").select("id").limit(1)
  return !error
}
