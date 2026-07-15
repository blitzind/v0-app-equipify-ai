/** GE-AIOS-AUTONOMOUS-PORTFOLIO-MANAGER-1A — Operator-facing portfolio projection (client-safe). */

import {
  GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
  type GrowthPortfolioHealthReadModel,
  type GrowthPortfolioHealthState,
  type GrowthPortfolioManagerOperatorProjection,
  type GrowthPortfolioReplenishmentDecision,
  type GrowthPortfolioTargetProjection,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"

export const GROWTH_PORTFOLIO_MANAGER_MANUAL_FIND_OPTIONS = [10, 25, 50, 100] as const

const HEALTH_LABELS: Record<GrowthPortfolioHealthState, string> = {
  healthy: "Portfolio healthy. No action required.",
  needs_replenishment: "Portfolio needs more qualified companies.",
  critically_low: "Portfolio is critically low — discovery is prioritized.",
  operator_intervention_required: "Complete your Company Profile so Ava can manage the portfolio.",
}

export function buildPortfolioManagerOperatorProjection(input: {
  target: GrowthPortfolioTargetProjection
  health: GrowthPortfolioHealthReadModel
  replenishment: GrowthPortfolioReplenishmentDecision
  discoveryRunningCount?: number
  generatedAt?: string
}): GrowthPortfolioManagerOperatorProjection {
  const discoveryRunningCount =
    input.discoveryRunningCount ??
    (input.replenishment.shouldReplenish ? input.replenishment.batchSize : 0)

  let projectedCompletionLabel: string | null = null
  if (input.health.healthState !== "healthy" && input.replenishment.batchSize > 0) {
    const batchesRemaining = Math.ceil(
      input.health.needsCount / Math.max(1, input.target.replenishBatchSize),
    )
    const hoursRemaining = Math.max(1, batchesRemaining * 4)
    const base = input.generatedAt ? new Date(input.generatedAt) : new Date()
    const projected = new Date(base.getTime() + hoursRemaining * 60 * 60 * 1000)
    projectedCompletionLabel = projected.toLocaleString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    })
  } else if (input.health.healthState === "healthy") {
    projectedCompletionLabel = null
  }

  return {
    qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
    targetActiveCompanies: input.target.targetActiveCompanies,
    currentActiveCompanies: input.health.counts.activeCompanies,
    minimumHealthyCompanies: input.target.minimumHealthyCompanies,
    needsCount: input.health.needsCount,
    healthState: input.health.healthState,
    healthLabel: HEALTH_LABELS[input.health.healthState],
    discoveryRunning: input.health.discoveryRunning || input.replenishment.shouldReplenish,
    discoveryRunningCount: input.health.discoveryRunning ? discoveryRunningCount : input.replenishment.batchSize,
    researchRunning: input.health.researchRunning,
    researchRunningCount: input.health.counts.researching,
    admissionsPending: input.health.admissionsPending,
    projectedCompletionLabel,
    manualFindOptions: GROWTH_PORTFOLIO_MANAGER_MANUAL_FIND_OPTIONS,
  }
}

export function buildManualProspectSearchDiscoverHref(batchSize: number): string {
  const clamped = Math.max(1, Math.min(100, Math.floor(batchSize)))
  return `/growth/leads/prospect-search/discover?limit=${clamped}`
}
