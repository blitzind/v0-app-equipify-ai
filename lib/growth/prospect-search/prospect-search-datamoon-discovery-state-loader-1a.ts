/** GE-AIOS-DATAMOON-AUTONOMOUS-DISCOVERY-CUTOVER-1A — Load DataMoon discovery state for portfolio surfaces (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateAutonomousProspectDiscoveryProviderPolicy } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-policy-1a"
import { buildDatamoonAutonomousDiscoveryOperatorState } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-operator-1a"
import {
  findActiveAutonomousProspectSearchDatamoonRun,
  findLatestAutonomousProspectSearchDatamoonRun,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import type { DatamoonAutonomousDiscoveryOperatorState } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import type { GrowthPortfolioManagerMemory } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"

export async function loadPortfolioDatamoonDiscoveryOperatorState(
  admin: SupabaseClient,
  input: {
    organizationId: string
    memory: GrowthPortfolioManagerMemory
    nextBatchSize?: number | null
    maximumDailyDiscovery?: number
  },
): Promise<DatamoonAutonomousDiscoveryOperatorState> {
  const discoveriesToday =
    input.memory.discoveriesTodayDate?.slice(0, 10) === new Date().toISOString().slice(0, 10)
      ? input.memory.discoveriesToday
      : 0

  const policy = evaluateAutonomousProspectDiscoveryProviderPolicy({
    authority: "autonomous_portfolio",
    discoveriesToday,
    maximumDailyDiscovery: input.maximumDailyDiscovery,
  })

  const [activeRun, latestRun] = await Promise.all([
    findActiveAutonomousProspectSearchDatamoonRun(admin, input.organizationId),
    findLatestAutonomousProspectSearchDatamoonRun(admin, input.organizationId),
  ])

  const recentZeroResult =
    latestRun?.status === "completed" &&
    latestRun.previewCount === 0 &&
    latestRun.completedAt != null &&
    Date.now() - new Date(latestRun.completedAt).getTime() < 24 * 60 * 60 * 1000

  return buildDatamoonAutonomousDiscoveryOperatorState({
    policy,
    activeRun,
    latestRun,
    nextBatchSize: input.nextBatchSize ?? null,
    lastCompletedCount: input.memory.lastDiscoveryCount > 0 ? input.memory.lastDiscoveryCount : null,
    recentZeroResult,
  })
}
