import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-service"
import { extractGrowthRevenueDirectorSnapshot } from "@/lib/growth/aios/revenue-director/growth-revenue-director-engine"
import { fetchBusinessProfileWorkspaceState } from "@/lib/growth/business-profile/business-profile-service"
import { loadGrowthObjectiveDashboard } from "@/lib/growth/objectives/growth-objective-service"
import type { GrowthMissionCenterSourcesPayload } from "@/lib/growth/mission-center/growth-mission-center-types"
import { GROWTH_AVA_MISSION_CENTER_1A_QA_MARKER } from "@/lib/growth/mission-center/growth-mission-center-types"

/** Read-only batch loader — reuses existing services, no new runtime. */
export async function loadGrowthMissionCenterSources(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthMissionCenterSourcesPayload> {
  const [objectiveDashboard, commandCenter, businessProfile] = await Promise.all([
    loadGrowthObjectiveDashboard(admin, organizationId),
    fetchAiOsCommandCenterReadModel(admin, { organizationId }),
    fetchBusinessProfileWorkspaceState(admin, organizationId),
  ])

  const revenueDirectorSnapshot = extractGrowthRevenueDirectorSnapshot(commandCenter)

  return {
    ok: true,
    qaMarker: GROWTH_AVA_MISSION_CENTER_1A_QA_MARKER,
    objectiveDashboard,
    businessProfile: {
      schemaReady: businessProfile.schemaReady,
      activeApproved: businessProfile.activeApproved,
    },
    revenueDirectorSnapshot,
  }
}
