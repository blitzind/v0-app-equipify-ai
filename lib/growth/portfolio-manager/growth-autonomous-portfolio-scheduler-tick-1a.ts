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
import { GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT } from "@/lib/growth/relationship/relationship-scale-limits"
import { GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A } from "@/lib/growth/objectives/growth-objective-scheduler-telemetry-1a-types"
import { withSchedulerWorkTimeout } from "@/lib/growth/runtime-guardrails/growth-scheduler-runtime-budget-1a"

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
    startedAt?: number
    maxRuntimeMs?: number
  },
): Promise<AutonomousPortfolioManagerSchedulerTickResult> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const startedAt = input.startedAt ?? Date.now()
  const maxRuntimeMs =
    input.maxRuntimeMs ?? GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A.budgets.portfolioManagerMs
  const organizationIds = input.organizationIds.slice(
    0,
    input.maxOrganizations ?? GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT,
  )

  const discoveryResults: AutonomousPortfolioDiscoveryTickResult[] = []

  for (const organizationId of organizationIds) {
    if (Date.now() - startedAt >= maxRuntimeMs) break

    try {
      const result = await withSchedulerWorkTimeout(
        runPortfolioOrganizationTick(admin, {
          organizationId,
          generatedAt,
        }),
        Math.max(
          1_000,
          Math.min(
            GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A.budgets.orgWorkTimeoutMs,
            maxRuntimeMs - (Date.now() - startedAt),
          ),
        ),
        "autonomous_portfolio_manager_org",
      )
      discoveryResults.push(result)
    } catch (error) {
      logGrowthEngine("autonomous_portfolio_manager_tick_failed", {
        qa_marker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
        organization_id: organizationId,
        error_class: error instanceof Error ? error.name : "UnknownError",
      })
      discoveryResults.push({
        qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
        organizationId,
        ran: false,
        skippedReason: "Portfolio manager tick failed.",
        searched: 0,
        pushed: 0,
        alreadyExists: 0,
        suppressed: 0,
        failed: 0,
      })
    }
  }

  const organizationsReplenished = discoveryResults.filter((row) => row.ran && row.pushed > 0).length

  return {
    qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
    organizationsAttempted: organizationIds.length,
    organizationsReplenished,
    discoveryResults,
  }
}

async function runPortfolioOrganizationTick(
  admin: SupabaseClient,
  input: {
    organizationId: string
    generatedAt: string
  },
): Promise<AutonomousPortfolioDiscoveryTickResult> {
  const { organizationId, generatedAt } = input
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
    }
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
}
