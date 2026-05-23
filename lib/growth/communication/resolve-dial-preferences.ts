import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveGrowthPlatformAdminDialPreferences } from "@/lib/growth/communication/call-dial"
import {
  fetchGrowthPlatformCommunicationSettings,
  toGrowthCommunicationDefaults,
} from "@/lib/growth/communication/settings-repository"
import {
  fetchGrowthPlatformAdminCommunicationPreferences,
  toGrowthCommunicationUserOverrides,
} from "@/lib/growth/communication/user-preferences-repository"
import type { ResolvedGrowthDialPreferences } from "@/lib/growth/communication/types"

/** Platform-admin internal: user → platform defaults → tel. Not for customer org routes. */
export async function resolveGrowthPlatformAdminDialPreferencesForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<ResolvedGrowthDialPreferences> {
  const [platformDefaults, adminUserOverrides] = await Promise.all([
    fetchGrowthPlatformCommunicationSettings(admin),
    fetchGrowthPlatformAdminCommunicationPreferences(admin, userId),
  ])

  return resolveGrowthPlatformAdminDialPreferences({
    platformDefaults: toGrowthCommunicationDefaults(platformDefaults),
    adminUserOverrides: adminUserOverrides ? toGrowthCommunicationUserOverrides(adminUserOverrides) : null,
  })
}

/** @deprecated Use resolveGrowthPlatformAdminDialPreferencesForUser */
export const resolveGrowthDialPreferencesForUser = resolveGrowthPlatformAdminDialPreferencesForUser
