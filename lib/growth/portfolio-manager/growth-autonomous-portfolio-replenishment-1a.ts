/** GE-AIOS-AUTONOMOUS-PORTFOLIO-MANAGER-1A — Portfolio replenishment decision (client-safe). */

import {
  GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
  type AutonomousPortfolioDiscoveryExecutionAction,
  type GrowthPortfolioHealthReadModel,
  type GrowthPortfolioManagerMemory,
  type GrowthPortfolioReplenishmentDecision,
  type GrowthPortfolioTargetProjection,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import { shouldPortfolioManagerTriggerDiscovery } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-health-1a"

function sameUtcDay(a: string | null, b: string): boolean {
  if (!a) return false
  return a.slice(0, 10) === b.slice(0, 10)
}

export function evaluatePortfolioReplenishmentDecision(input: {
  target: GrowthPortfolioTargetProjection
  health: GrowthPortfolioHealthReadModel
  memory: GrowthPortfolioManagerMemory
  generatedAt: string
  discoveryAlreadyRunning?: boolean
}): GrowthPortfolioReplenishmentDecision {
  const today = input.generatedAt.slice(0, 10)
  const discoveriesToday = sameUtcDay(input.memory.discoveriesTodayDate, today)
    ? input.memory.discoveriesToday
    : 0

  const blockedByDailyLimit = discoveriesToday >= input.target.maximumDailyDiscovery
  const blockedByQueueLimit =
    input.health.admissionsPending >= input.target.maximumQueuedAdmissions
  const blockedByResearchLimit =
    input.health.counts.researching >= input.target.maximumConcurrentResearch

  const duplicateDiscoveryPrevented = input.discoveryAlreadyRunning === true

  const gapToHealthy = Math.max(
    0,
    input.target.minimumHealthyCompanies - input.health.counts.activeCompanies,
  )
  const gapToTarget = Math.max(
    0,
    input.target.targetActiveCompanies - input.health.counts.activeCompanies,
  )
  const need = Math.max(gapToHealthy, gapToTarget > 0 ? Math.min(gapToTarget, input.target.replenishBatchSize) : 0)

  const rawBatch = need > 0 ? Math.min(input.target.replenishBatchSize, need) : 0
  const remainingDaily = Math.max(0, input.target.maximumDailyDiscovery - discoveriesToday)
  const plannedBatchSize = rawBatch > 0 ? Math.min(rawBatch, remainingDaily) : 0

  const shouldReplenish =
    shouldPortfolioManagerTriggerDiscovery(input.health) &&
    plannedBatchSize > 0 &&
    !blockedByDailyLimit &&
    !blockedByQueueLimit &&
    !blockedByResearchLimit &&
    !duplicateDiscoveryPrevented

  const shouldResumeActiveDiscovery = duplicateDiscoveryPrevented
  const resumeBatchSize = shouldResumeActiveDiscovery
    ? plannedBatchSize > 0
      ? plannedBatchSize
      : Math.min(input.target.replenishBatchSize, remainingDaily || input.target.replenishBatchSize)
    : 0

  let reason: string | null = null
  if (!input.health.approvedProfilePresent) {
    reason = "Approved Business Profile required before autonomous discovery."
  } else if (input.health.healthState === "healthy") {
    reason = "Portfolio is healthy."
  } else if (duplicateDiscoveryPrevented) {
    reason = "Discovery already running."
  } else if (blockedByDailyLimit) {
    reason = "Daily discovery limit reached."
  } else if (blockedByQueueLimit) {
    reason = "Admission queue is full."
  } else if (blockedByResearchLimit) {
    reason = "Research concurrency limit reached."
  } else if (shouldReplenish) {
    reason = `Replenish ${plannedBatchSize} companies toward target of ${input.target.targetActiveCompanies}.`
  } else if (shouldResumeActiveDiscovery) {
    reason = "Resume active DataMoon discovery job."
  }

  return {
    qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
    shouldReplenish,
    shouldResumeActiveDiscovery,
    batchSize: shouldReplenish ? plannedBatchSize : 0,
    resumeBatchSize,
    reason,
    blockedByDailyLimit,
    blockedByQueueLimit,
    blockedByResearchLimit,
    duplicateDiscoveryPrevented,
  }
}

export function resolveAutonomousPortfolioDiscoveryExecutionPlan(
  replenishment: GrowthPortfolioReplenishmentDecision,
): {
  action: AutonomousPortfolioDiscoveryExecutionAction
  batchSize: number
  reason: string | null
} {
  if (replenishment.shouldResumeActiveDiscovery && replenishment.resumeBatchSize > 0) {
    return {
      action: "resume_active",
      batchSize: replenishment.resumeBatchSize,
      reason: replenishment.reason,
    }
  }

  if (replenishment.shouldReplenish && replenishment.batchSize > 0) {
    return {
      action: "start_new",
      batchSize: replenishment.batchSize,
      reason: replenishment.reason,
    }
  }

  return {
    action: "skip",
    batchSize: 0,
    reason: replenishment.reason,
  }
}
