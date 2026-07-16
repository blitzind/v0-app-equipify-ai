/**
 * GE-AIOS-FIRST-CUSTOMER-PORTFOLIO-INTAKE-1D — Survivor classification helpers (client-safe).
 */

import {
  PORTFOLIO_INTAKE_SURVIVOR_CLASSIFICATIONS,
  type PortfolioIntakeClassificationSummary,
  type PortfolioIntakeDecisionTrace,
  type PortfolioIntakeSurvivorClassification,
  type PortfolioIntakeSurvivorInventoryRow,
  type PortfolioIntakeThroughputProjection,
} from "@/lib/growth/training/portfolio-intake-survivor-types-1d"

export const COMPLETED_RUN_ORPHAN_INTAKE_TRACE: PortfolioIntakeDecisionTrace = {
  function: "findActiveAutonomousProspectSearchDatamoonRun",
  file: "lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a.ts",
  condition: 'run.status not in ("pending_build","building") — completed runs excluded from ACTIVE_STATUSES',
  returnPath:
    "runProspectSearchDatamoonAutonomousDiscovery → startDatamoonAudienceImportRun (new job) instead of resume/push",
  stoppingReason:
    "Completed DataMoon run survivors never selected for executeBulkPushToLeadInbox on subsequent scheduler ticks",
}

export const INTAKE_PENDING_RESUME_TRACE: PortfolioIntakeDecisionTrace = {
  function: "findLatestIntakePendingAutonomousProspectSearchDatamoonRun",
  file: "lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a.ts",
  condition: "completed run with intake_completed !== true — eligible for portfolio promotion resume",
  returnPath:
    "resumeAutonomousProspectSearchDatamoonDiscoveryFromIntakePendingRun → executeBulkPushToLeadInbox",
  stoppingReason:
    "Survivor awaits next scheduler tick — portfolio manager will resume intake without new provider job",
}

export const BUILDING_RUN_DEFERRED_PUSH_TRACE: PortfolioIntakeDecisionTrace = {
  function: "runAutonomousPortfolioDiscoveryBatch",
  file: "lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts",
  condition: "datamoon.datamoonJobActive === true",
  returnPath: "buildPortfolioDiscoveryTickResult({ pushed: 0, searched: 0 })",
  stoppingReason: "DataMoon job still building — push deferred until completion tick",
}

export const BATCH_RANK_CUTOFF_TRACE: PortfolioIntakeDecisionTrace = {
  function: "runAutonomousPortfolioDiscoveryBatch",
  file: "lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts",
  condition: "company index >= batchSize in search.companies.slice(0, batchSize)",
  returnPath: "executeBulkPushToLeadInbox never receives selection ref",
  stoppingReason: "Survivor ranked below autonomous portfolio batch promotion cutoff",
}

export const REPLENISHMENT_SKIP_TRACE: PortfolioIntakeDecisionTrace = {
  function: "tickAutonomousPortfolioDiscoveryReplenishment",
  file: "lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts",
  condition: 'resolveAutonomousPortfolioDiscoveryExecutionPlan → action === "skip"',
  returnPath: "buildPortfolioDiscoveryTickResult({ ran: false, pushed: 0 })",
  stoppingReason: "Portfolio replenishment skipped — scheduler did not attempt promotion",
}

export function buildClassificationSummary(
  rows: PortfolioIntakeSurvivorInventoryRow[],
): PortfolioIntakeClassificationSummary[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (row.leadStatus === "promoted") continue
    counts.set(row.classification, (counts.get(row.classification) ?? 0) + 1)
  }
  return PORTFOLIO_INTAKE_SURVIVOR_CLASSIFICATIONS.map((classification) => ({
    classification,
    count: counts.get(classification) ?? 0,
  })).filter((row) => row.count > 0)
}

export function assertAllNonPromotedClassified(rows: PortfolioIntakeSurvivorInventoryRow[]): {
  ok: boolean
  unclassified: number
  nonPromotedTotal: number
} {
  const nonPromoted = rows.filter((row) => row.leadStatus === "not_promoted")
  const unclassified = nonPromoted.filter(
    (row) =>
      row.classification === "unknown" ||
      !PORTFOLIO_INTAKE_SURVIVOR_CLASSIFICATIONS.includes(
        row.classification as PortfolioIntakeSurvivorClassification,
      ),
  ).length
  return { ok: unclassified === 0, unclassified, nonPromotedTotal: nonPromoted.length }
}

export function splitPromotionCorrectness(rows: PortfolioIntakeSurvivorInventoryRow[]): {
  correctlyNotPromoted: PortfolioIntakeSurvivorInventoryRow[]
  incorrectlyNotPromoted: PortfolioIntakeSurvivorInventoryRow[]
} {
  const nonPromoted = rows.filter((row) => row.leadStatus === "not_promoted")
  return {
    correctlyNotPromoted: nonPromoted.filter((row) => row.promotionCorrect === true),
    incorrectlyNotPromoted: nonPromoted.filter((row) => row.promotionCorrect === false),
  }
}

export function projectIntakeThroughputFromEvidence(input: {
  uniqueCanonicalSurvivors: number
  promotedLeads: number
  incorrectlyNotPromoted: number
  currentResearchStarted: number
  currentOutreachEligible: number
  currentPackagesReady: number
  incorrectBugCount: number
}): PortfolioIntakeThroughputProjection {
  const recoverable = input.incorrectlyNotPromoted
  return {
    prospectSearchSurvivors: input.uniqueCanonicalSurvivors,
    leadsCreated: input.promotedLeads + recoverable,
    researchInitiated: input.currentResearchStarted + recoverable,
    approvalPackages: input.currentPackagesReady,
    outreachReady: input.currentOutreachEligible,
    basis: `Production-only: ${input.promotedLeads} current leads + ${recoverable} incorrectly withheld (${input.incorrectBugCount} orphaned completed-run survivors). Approval/outreach counts unchanged — no production evidence for post-intake conversion rates.`,
  }
}
