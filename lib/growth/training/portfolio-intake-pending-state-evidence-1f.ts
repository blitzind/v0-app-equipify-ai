/**
 * GE-AIOS-PORTFOLIO-INTAKE-PENDING-STATE-1F — Production replay evidence (server-only, read-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  findLatestIntakePendingAutonomousProspectSearchDatamoonRun,
  readAutonomousRunIntakeLifecycleFields,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import { isRunEligibleForIntakePromotion } from "@/lib/growth/prospect-search/prospect-search-datamoon-intake-lifecycle-1f"
import { runPortfolioIntakeProductionAudit } from "@/lib/growth/training/portfolio-intake-production-audit-1d"
import {
  GROWTH_AIOS_PORTFOLIO_INTAKE_PENDING_STATE_1F_QA_MARKER,
  PORTFOLIO_INTAKE_EXAMPLE_ORPHAN_REPLAY,
} from "@/lib/growth/training/portfolio-intake-pending-state-1f"
import { PORTFOLIO_INTAKE_EXAMPLE_ORPHAN_SURVIVOR } from "@/lib/growth/training/portfolio-intake-orphan-root-cause-1e"
import { loadPortfolioIntakeSurvivorsFromProduction } from "@/lib/growth/training/portfolio-intake-survivor-loader-1d"

export async function runPortfolioIntakePendingStateProductionEvidence(input: {
  admin: SupabaseClient
  organizationId: string
  generatedAt?: string
}) {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const [intakeAudit, survivorLoad, intakePendingRun] = await Promise.all([
    runPortfolioIntakeProductionAudit({
      admin: input.admin,
      organizationId: input.organizationId,
      generatedAt,
    }),
    loadPortfolioIntakeSurvivorsFromProduction(input),
    findLatestIntakePendingAutonomousProspectSearchDatamoonRun(
      input.admin,
      input.organizationId,
    ),
  ])

  const halliburtonSurvivor =
    survivorLoad.survivors.find(
      (row) => row.canonicalCompanyKey === PORTFOLIO_INTAKE_EXAMPLE_ORPHAN_SURVIVOR.canonicalCompanyKey,
    ) ??
    survivorLoad.survivors.find((row) =>
      row.company.company_name?.toLowerCase().includes("halliburton"),
    ) ??
    null

  const halliburtonRunId = halliburtonSurvivor?.runId ?? null
  const intakePendingMatchesHalliburton =
    intakePendingRun != null && intakePendingRun.id === halliburtonRunId

  const bugCount = intakeAudit.inventory.filter(
    (row) => row.leadStatus === "not_promoted" && row.classification === "bug",
  ).length
  const waitingForScheduler = intakeAudit.classificationSummary.find(
    (row) => row.classification === "waiting_for_scheduler",
  )?.count ?? 0

  const halliburtonIntake = halliburtonSurvivor
    ? {
        runId: halliburtonSurvivor.runId,
        runEligibleForIntakePromotion: halliburtonSurvivor.runEligibleForIntakePromotion,
        intake: halliburtonSurvivor.runIntake,
        classification:
          intakeAudit.inventory.find((row) => row.survivorKey === halliburtonSurvivor.survivorKey)
            ?.classification ?? null,
      }
    : null

  return {
    qaMarker: GROWTH_AIOS_PORTFOLIO_INTAKE_PENDING_STATE_1F_QA_MARKER,
    organizationId: input.organizationId,
    generatedAt,
    halliburtonReplay: {
      example: PORTFOLIO_INTAKE_EXAMPLE_ORPHAN_REPLAY,
      survivor: halliburtonSurvivor
        ? {
            company: halliburtonSurvivor.company.company_name,
            runId: halliburtonSurvivor.runId,
            runRank: halliburtonSurvivor.runRank,
            runSurvivorCount: halliburtonSurvivor.runSurvivorCount,
          }
        : null,
      intake: halliburtonIntake,
      findLatestIntakePendingRunId: intakePendingRun?.id ?? null,
      findLatestMatchesHalliburtonRun: intakePendingMatchesHalliburton,
      resumeWouldAvoidNewProviderJob:
        intakePendingRun != null &&
        isRunEligibleForIntakePromotion({
          runStatus: intakePendingRun.status,
          intake: readAutonomousRunIntakeLifecycleFields(intakePendingRun),
        }),
    },
    certification: {
      bugClassificationCount: bugCount,
      waitingForSchedulerCount: waitingForScheduler,
      orphanCount: bugCount,
      incorrectlyNotPromoted: intakeAudit.incorrectlyNotPromoted,
      allNonPromotedClassified: intakeAudit.classificationCheck.ok,
      unclassified: intakeAudit.classificationCheck.unclassified,
      classificationSummary: intakeAudit.classificationSummary,
    },
    intakeAuditSummary: {
      cumulativeInstances: intakeAudit.survivorStats.cumulativeInstances,
      uniqueCanonical: intakeAudit.survivorStats.uniqueCanonical,
      completedRuns: intakeAudit.survivorStats.completedRuns,
      runsOrphaned: intakeAudit.survivorStats.runsOrphaned,
      promotedInstances: intakeAudit.survivorStats.promotedInstances,
    },
    multiTenantNote:
      "Lifecycle is org-scoped via autonomous_prospect_search_1a.organization_id — no tenant-specific branching",
  }
}
