/** GE-AIOS-AUTONOMOUS-PORTFOLIO-MANAGER-1A — Portfolio target projection from Business Profile (client-safe). */

import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import {
  DEFAULT_PORTFOLIO_MAXIMUM_CONCURRENT_RESEARCH,
  DEFAULT_PORTFOLIO_MAXIMUM_DAILY_DISCOVERY,
  DEFAULT_PORTFOLIO_MAXIMUM_QUEUED_ADMISSIONS,
  DEFAULT_PORTFOLIO_MINIMUM_HEALTHY_COMPANIES,
  DEFAULT_PORTFOLIO_REPLENISH_BATCH_SIZE,
  DEFAULT_PORTFOLIO_TARGET_ACTIVE_COMPANIES,
  GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
  type BusinessProfilePortfolioManagementSection,
  type GrowthPortfolioTargetProjection,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"

function clampPositiveInt(value: unknown, fallback: number, max = 10_000): number {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.floor(parsed), max)
}

export function defaultPortfolioManagementSection(): BusinessProfilePortfolioManagementSection {
  return {
    targetActiveCompanies: DEFAULT_PORTFOLIO_TARGET_ACTIVE_COMPANIES,
    minimumHealthyCompanies: DEFAULT_PORTFOLIO_MINIMUM_HEALTHY_COMPANIES,
    replenishBatchSize: DEFAULT_PORTFOLIO_REPLENISH_BATCH_SIZE,
    maximumDailyDiscovery: DEFAULT_PORTFOLIO_MAXIMUM_DAILY_DISCOVERY,
    maximumConcurrentResearch: DEFAULT_PORTFOLIO_MAXIMUM_CONCURRENT_RESEARCH,
    maximumQueuedAdmissions: DEFAULT_PORTFOLIO_MAXIMUM_QUEUED_ADMISSIONS,
  }
}

export function resolvePortfolioTargetFromBusinessProfile(
  profile: Pick<BusinessProfileDraftContent, "portfolioManagement"> | null | undefined,
): GrowthPortfolioTargetProjection {
  const configured = profile?.portfolioManagement
  const defaults = defaultPortfolioManagementSection()
  const merged = configured
    ? {
        targetActiveCompanies: clampPositiveInt(
          configured.targetActiveCompanies,
          defaults.targetActiveCompanies,
        ),
        minimumHealthyCompanies: clampPositiveInt(
          configured.minimumHealthyCompanies,
          defaults.minimumHealthyCompanies,
        ),
        replenishBatchSize: clampPositiveInt(configured.replenishBatchSize, defaults.replenishBatchSize, 100),
        maximumDailyDiscovery: clampPositiveInt(
          configured.maximumDailyDiscovery,
          defaults.maximumDailyDiscovery,
        ),
        maximumConcurrentResearch: clampPositiveInt(
          configured.maximumConcurrentResearch,
          defaults.maximumConcurrentResearch,
        ),
        maximumQueuedAdmissions: clampPositiveInt(
          configured.maximumQueuedAdmissions,
          defaults.maximumQueuedAdmissions,
        ),
      }
    : defaults

  return {
    qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
    ...merged,
    source: configured ? "business_profile" : "defaults",
  }
}

export function mergePortfolioManagementSection(
  current: BusinessProfilePortfolioManagementSection | undefined,
  patch: Partial<BusinessProfilePortfolioManagementSection>,
): BusinessProfilePortfolioManagementSection {
  const base = current ?? defaultPortfolioManagementSection()
  return {
    targetActiveCompanies: clampPositiveInt(
      patch.targetActiveCompanies ?? base.targetActiveCompanies,
      base.targetActiveCompanies,
    ),
    minimumHealthyCompanies: clampPositiveInt(
      patch.minimumHealthyCompanies ?? base.minimumHealthyCompanies,
      base.minimumHealthyCompanies,
    ),
    replenishBatchSize: clampPositiveInt(patch.replenishBatchSize ?? base.replenishBatchSize, base.replenishBatchSize, 100),
    maximumDailyDiscovery: clampPositiveInt(
      patch.maximumDailyDiscovery ?? base.maximumDailyDiscovery,
      base.maximumDailyDiscovery,
    ),
    maximumConcurrentResearch: clampPositiveInt(
      patch.maximumConcurrentResearch ?? base.maximumConcurrentResearch,
      base.maximumConcurrentResearch,
    ),
    maximumQueuedAdmissions: clampPositiveInt(
      patch.maximumQueuedAdmissions ?? base.maximumQueuedAdmissions,
      base.maximumQueuedAdmissions,
    ),
  }
}
