import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  countOpenGrowthDogfoodIssues,
  fetchLatestGrowthDogfoodRunsBySubsystem,
} from "@/lib/growth/dogfood/dogfood-repository"
import {
  buildGrowthDogfoodScorecard,
  computeOverallReadiness,
  GROWTH_DOGFOOD_VALIDATION_QA_MARKER,
  isReadyForBlitzUsage,
  readinessPercentForStatus,
  type GrowthDogfoodCommandSummary,
  type GrowthDogfoodReadinessDashboard,
  type GrowthDogfoodSubsystem,
  type GrowthDogfoodValidationStatus,
} from "@/lib/growth/dogfood/dogfood-types"

async function loadScorecardContext(admin: SupabaseClient) {
  const [latestRunMap, issueCounts] = await Promise.all([
    fetchLatestGrowthDogfoodRunsBySubsystem(admin),
    countOpenGrowthDogfoodIssues(admin),
  ])

  const latestRuns = new Map<
    GrowthDogfoodSubsystem,
    { status: GrowthDogfoodValidationStatus; runAt: string; ownerUserId: string | null; confidence: number }
  >()
  for (const [subsystem, run] of latestRunMap.entries()) {
    latestRuns.set(subsystem, {
      status: run.status,
      runAt: run.runAt,
      ownerUserId: run.ownerUserId,
      confidence: run.confidence,
    })
  }

  return { scorecard: buildGrowthDogfoodScorecard({ latestRuns, issueCounts: issueCounts.bySubsystem }), issueCounts }
}

export async function fetchGrowthDogfoodReadinessDashboard(
  admin: SupabaseClient,
): Promise<GrowthDogfoodReadinessDashboard> {
  const { scorecard, issueCounts } = await loadScorecardContext(admin)
  const overallReadinessPercent = computeOverallReadiness(scorecard)
  const subsystemReadiness = scorecard.map((entry) => ({
    subsystem: entry.subsystem,
    readinessPercent: readinessPercentForStatus(entry.status),
    status: entry.status,
  }))

  return {
    qaMarker: GROWTH_DOGFOOD_VALIDATION_QA_MARKER,
    overallReadinessPercent,
    subsystemReadiness,
    openBlockers: issueCounts.openBlockers,
    criticalBlockers: issueCounts.criticalBlockers,
    readyForBlitzUsage: isReadyForBlitzUsage({ scorecard, criticalBlockers: issueCounts.criticalBlockers }),
    scorecard,
  }
}

export async function fetchGrowthDogfoodCommandSummary(
  admin: SupabaseClient,
): Promise<GrowthDogfoodCommandSummary> {
  const dashboard = await fetchGrowthDogfoodReadinessDashboard(admin)
  return {
    qaMarker: dashboard.qaMarker,
    overallReadinessPercent: dashboard.overallReadinessPercent,
    openBlockers: dashboard.openBlockers,
    criticalBlockers: dashboard.criticalBlockers,
    failedSubsystems: dashboard.scorecard.filter((entry) => entry.status === "failed").length,
    readyForBlitzUsage: dashboard.readyForBlitzUsage,
  }
}
