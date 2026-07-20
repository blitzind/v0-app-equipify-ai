/** GE-AIOS-18G — Load mission discovery snapshot for Home workspace-summary (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthHomeLeadPoolSummary } from "@/lib/growth/home/growth-home-lead-pool-pagination"
import {
  buildGrowthHomeMissionDiscoverySnapshot,
  type GrowthHomeMissionDiscoverySnapshot,
} from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import { listActiveRunningGrowthObjectives } from "@/lib/growth/objectives/growth-objective-repository"
import { GROWTH_HOME_MISSION_DISCOVERY_OBJECTIVE_LIMIT } from "@/lib/growth/relationship/relationship-scale-limits"

export async function loadGrowthHomeMissionDiscoveryObjectives(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthObjective[]> {
  const objectives = await listActiveRunningGrowthObjectives(admin).catch(() => [])
  return objectives
    .filter((row) => row.organizationId === organizationId)
    .slice(0, GROWTH_HOME_MISSION_DISCOVERY_OBJECTIVE_LIMIT)
}

export async function loadGrowthHomeMissionDiscoverySnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadPool?: GrowthHomeLeadPoolSummary | null
  },
): Promise<GrowthHomeMissionDiscoverySnapshot | null> {
  const orgObjectives = await loadGrowthHomeMissionDiscoveryObjectives(admin, input.organizationId)
  return buildGrowthHomeMissionDiscoverySnapshot({
    objectives: orgObjectives,
    leadPool: input.leadPool ?? null,
  })
}
