/** GE-AIOS-AUTONOMOUS-PORTFOLIO-MANAGER-1A — Scheduler tick for autonomous portfolio replenishment (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { loadGrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-loader"
import { buildGrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a"
import { loadPortfolioDatamoonDiscoveryOperatorState } from "@/lib/growth/prospect-search/prospect-search-datamoon-discovery-state-loader-1a"
import { tickAutonomousPortfolioDiscoveryReplenishment } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a"
import type { AutonomousPortfolioDiscoveryTickResult } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a"
import { GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import { mapWithBoundedConcurrency } from "@/lib/growth/runtime-guardrails/growth-bounded-concurrency"
import { GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT } from "@/lib/growth/relationship/relationship-scale-limits"

export type AutonomousPortfolioManagerSchedulerTickResult = {
  qaMarker: typeof GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER
  organizationsAttempted: number
  organizationsReplenished: number
  discoveryResults: AutonomousPortfolioDiscoveryTickResult[]
}

export async function tickAutonomousPortfolioManagerForScheduler(
  admin: SupabaseClient,
  input: {
    organizationIds: string[]
    generatedAt?: string
    maxOrganizations?: number
  },
): Promise<AutonomousPortfolioManagerSchedulerTickResult> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const organizationIds = input.organizationIds.slice(
    0,
    input.maxOrganizations ?? GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT,
  )

  const discoveryResults = await mapWithBoundedConcurrency(organizationIds, 2, async (organizationId) => {
    try {
      const [snapshot, approvedProfileRow, missionDiscovery] = await Promise.all([
        buildGrowthAutonomousPortfolioWorkSnapshot(admin, { organizationId, generatedAt }),
        getActiveApprovedBusinessProfile(admin, organizationId).catch(() => null),
        loadGrowthHomeMissionDiscoverySnapshot(admin, { organizationId }).catch(() => null),
      ])

      if (!snapshot) {
        return {
          qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
          organizationId,
          ran: false,
          skippedReason: "Portfolio snapshot unavailable.",
          searched: 0,
          pushed: 0,
          alreadyExists: 0,
          suppressed: 0,
          failed: 0,
        } satisfies AutonomousPortfolioDiscoveryTickResult
      }

      const portfolioManager = buildGrowthPortfolioManagerSnapshot({
        organizationId,
        generatedAt,
        leads: snapshot.portfolioLeads,
        eligibleLeadCount: snapshot.eligibleLeadCount,
        approvedProfile: approvedProfileRow?.profile ?? null,
        organizationalMemory: snapshot.organizationalMemory.store,
        missionDiscovery,
      })

      const datamoonDiscovery = await loadPortfolioDatamoonDiscoveryOperatorState(admin, {
        organizationId,
        memory: portfolioManager.memory,
        nextBatchSize: portfolioManager.replenishment.batchSize,
        maximumDailyDiscovery: portfolioManager.target.maximumDailyDiscovery,
      })

      const portfolioManagerWithDatamoon = buildGrowthPortfolioManagerSnapshot({
        organizationId,
        generatedAt,
        leads: snapshot.portfolioLeads,
        eligibleLeadCount: snapshot.eligibleLeadCount,
        approvedProfile: approvedProfileRow?.profile ?? null,
        organizationalMemory: snapshot.organizationalMemory.store,
        missionDiscovery,
        datamoonDiscovery,
        discoveryAlreadyRunning: datamoonDiscovery.jobActive,
      })

      return tickAutonomousPortfolioDiscoveryReplenishment(admin, {
        organizationId,
        approvedProfile: approvedProfileRow?.profile ?? null,
        companyName: approvedProfileRow?.companyName ?? null,
        replenishment: portfolioManagerWithDatamoon.replenishment,
        memory: portfolioManagerWithDatamoon.memory,
        generatedAt,
        maximumDailyDiscovery: portfolioManagerWithDatamoon.target.maximumDailyDiscovery,
      })
    } catch (error) {
      logGrowthEngine("autonomous_portfolio_manager_tick_failed", {
        qa_marker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
        organization_id: organizationId,
        error_class: error instanceof Error ? error.name : "UnknownError",
      })
      return {
        qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
        organizationId,
        ran: false,
        skippedReason: "Portfolio manager tick failed.",
        searched: 0,
        pushed: 0,
        alreadyExists: 0,
        suppressed: 0,
        failed: 0,
      }
    }
  })

  const organizationsReplenished = discoveryResults.filter((row) => row.ran && row.pushed > 0).length

  return {
    qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
    organizationsAttempted: organizationIds.length,
    organizationsReplenished,
    discoveryResults,
  }
}
