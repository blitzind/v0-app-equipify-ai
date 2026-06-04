import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_PHONE_DISCOVERY_MIGRATION } from "@/lib/growth/phone-discovery/phone-discovery-types"

export { GROWTH_PHONE_DISCOVERY_MIGRATION }

export async function isGrowthPhoneDiscoverySchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("phone_discovery_runs").select("id").limit(1)
  return !error
}
