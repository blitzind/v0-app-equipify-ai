import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_EMAIL_DISCOVERY_MIGRATION } from "@/lib/growth/email-discovery/email-discovery-types"

export { GROWTH_EMAIL_DISCOVERY_MIGRATION }

export async function isGrowthEmailDiscoverySchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("email_discovery_runs").select("id").limit(1)
  return !error
}

export async function isGrowthEmailDiscoveryJobQueueSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const { error } = await admin.schema("growth").from("email_discovery_jobs").select("id").limit(1)
  return !error
}

export async function isGrowthEmailDiscoveryRuntimeSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const [runsReady, jobsReady] = await Promise.all([
    isGrowthEmailDiscoverySchemaReady(admin),
    isGrowthEmailDiscoveryJobQueueSchemaReady(admin),
  ])
  return runsReady && jobsReady
}
