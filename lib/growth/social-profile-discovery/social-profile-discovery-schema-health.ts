import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_SOCIAL_PROFILE_DISCOVERY_MIGRATION } from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"

export { GROWTH_SOCIAL_PROFILE_DISCOVERY_MIGRATION }

export async function isGrowthSocialProfileDiscoverySchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("social_profile_discovery_runs")
    .select("id")
    .limit(1)
  return !error
}
