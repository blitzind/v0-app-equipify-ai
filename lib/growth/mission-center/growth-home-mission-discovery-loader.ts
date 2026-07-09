/** GE-AIOS-18G — Load mission discovery snapshot for Home workspace-summary (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthHomeLeadPoolSummary } from "@/lib/growth/home/growth-home-lead-pool-pagination"
import {
  buildGrowthHomeMissionDiscoverySnapshot,
  type GrowthHomeMissionDiscoverySnapshot,
} from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import { listActiveRunningGrowthObjectives } from "@/lib/growth/objectives/growth-objective-repository"

export async function loadGrowthHomeMissionDiscoverySnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadPool?: GrowthHomeLeadPoolSummary | null
  },
): Promise<GrowthHomeMissionDiscoverySnapshot | null> {
  const objectives = await listActiveRunningGrowthObjectives(admin).catch(() => [])
  const orgObjectives = objectives.filter((row) => row.organizationId === input.organizationId)
  return buildGrowthHomeMissionDiscoverySnapshot({
    objectives: orgObjectives,
    leadPool: input.leadPool ?? null,
  })
}
