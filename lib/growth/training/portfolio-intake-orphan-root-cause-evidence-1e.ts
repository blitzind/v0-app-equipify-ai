/**
 * GE-AIOS-PORTFOLIO-INTAKE-ORPHAN-ROOT-CAUSE-1E — Production evidence loader (server-only, read-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchDatamoonAudienceImportRunById } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-repository"
import {
  findActiveAutonomousProspectSearchDatamoonRun,
  findLatestAutonomousProspectSearchDatamoonRun,
  readAutonomousProspectSearchDatamoonMetadata,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import {
  GROWTH_AIOS_PORTFOLIO_INTAKE_ORPHAN_ROOT_CAUSE_1E_QA_MARKER,
  PORTFOLIO_INTAKE_EXAMPLE_ORPHAN_SURVIVOR,
  PORTFOLIO_INTAKE_MISSING_TRANSITION,
} from "@/lib/growth/training/portfolio-intake-orphan-root-cause-1e"
import {
  loadPortfolioIntakeSurvivorsFromProduction,
  type LoadedPortfolioIntakeSurvivor,
} from "@/lib/growth/training/portfolio-intake-survivor-loader-1d"

export type PortfolioIntakeOrphanRuntimeTrace = {
  survivor: LoadedPortfolioIntakeSurvivor
  run: {
    id: string
    status: string
    createdAt: string
    completedAt: string | null
    audienceId: string | null
    batchSize: number | null
    intakeCompletedFlagPresent: boolean
    intakeCompletedValue: unknown
  }
  lifecycleAtAuditTime: {
    findActiveReturnsRun: boolean
    findActiveStatus: string | null
    findLatestStatus: string | null
    findLatestId: string | null
    latestMatchesSurvivorRun: boolean
  }
  promotionPathBlocked: {
    missingTransition: typeof PORTFOLIO_INTAKE_MISSING_TRANSITION
    wouldReachExecuteBulkPush: boolean
    blockingReason: string
  }
}

export async function loadPortfolioIntakeOrphanRuntimeTrace(input: {
  admin: SupabaseClient
  organizationId: string
  survivorCanonicalKey?: string
}): Promise<{
  qaMarker: typeof GROWTH_AIOS_PORTFOLIO_INTAKE_ORPHAN_ROOT_CAUSE_1E_QA_MARKER
  organizationId: string
  trace: PortfolioIntakeOrphanRuntimeTrace
  schedulerTimingEvidence: {
    runBuildDurationMinutes: number | null
    note: string
  }
}> {
  const survivorLoad = await loadPortfolioIntakeSurvivorsFromProduction(input)
  const targetKey =
    input.survivorCanonicalKey ?? PORTFOLIO_INTAKE_EXAMPLE_ORPHAN_SURVIVOR.canonicalCompanyKey
  const survivor =
    survivorLoad.survivors.find((row) => row.canonicalCompanyKey === targetKey) ??
    survivorLoad.survivors[0]
  if (!survivor) throw new Error("no_survivor_found_for_trace")

  const [runRow, activeRun, latestRun] = await Promise.all([
    fetchDatamoonAudienceImportRunById(input.admin, survivor.runId),
    findActiveAutonomousProspectSearchDatamoonRun(input.admin, input.organizationId),
    findLatestAutonomousProspectSearchDatamoonRun(input.admin, input.organizationId),
  ])

  const meta = runRow ? readAutonomousProspectSearchDatamoonMetadata(runRow) : null
  const providerMeta = runRow?.providerMetadata ?? {}
  const intakeCompletedValue = (providerMeta as Record<string, unknown>).intake_completed

  const runBuildDurationMinutes =
    runRow?.createdAt && runRow.completedAt
      ? (Date.parse(runRow.completedAt) - Date.parse(runRow.createdAt)) / (60 * 1000)
      : null

  const findActiveReturnsRun = activeRun != null

  return {
    qaMarker: GROWTH_AIOS_PORTFOLIO_INTAKE_ORPHAN_ROOT_CAUSE_1E_QA_MARKER,
    organizationId: input.organizationId,
    trace: {
      survivor,
      run: {
        id: survivor.runId,
        status: runRow?.status ?? survivor.runStatus,
        createdAt: runRow?.createdAt ?? survivor.discoveryDate,
        completedAt: runRow?.completedAt ?? null,
        audienceId: survivor.audienceId,
        batchSize: meta?.batch_size ?? survivor.batchSizeAtRun,
        intakeCompletedFlagPresent: "intake_completed" in providerMeta,
        intakeCompletedValue,
      },
      lifecycleAtAuditTime: {
        findActiveReturnsRun,
        findActiveStatus: activeRun?.status ?? null,
        findLatestStatus: latestRun?.status ?? null,
        findLatestId: latestRun?.id ?? null,
        latestMatchesSurvivorRun: latestRun?.id === survivor.runId,
      },
      promotionPathBlocked: {
        missingTransition: PORTFOLIO_INTAKE_MISSING_TRANSITION,
        wouldReachExecuteBulkPush: false,
        blockingReason:
          runRow?.status === "completed" && !findActiveReturnsRun
            ? "Run is completed — findActiveAutonomousProspectSearchDatamoonRun returns null, so runProspectSearchDatamoonAutonomousDiscovery starts a new job instead of resuming this run for intake"
            : findActiveReturnsRun
              ? "Run still active — promotion deferred until completion poll on a resume_active tick"
              : "Run status prevents promotion path",
      },
    },
    schedulerTimingEvidence: {
      runBuildDurationMinutes,
      note:
        runBuildDurationMinutes != null
          ? `Provider build took ~${runBuildDurationMinutes.toFixed(1)} minutes. If scheduler tick interval exceeds this window, completion occurs between ticks and the synchronous poll→intake path is missed.`
          : "Run timing unavailable",
    },
  }
}

export async function runPortfolioIntakeOrphanRootCauseAudit(input: {
  admin: SupabaseClient
  organizationId: string
}) {
  const traceResult = await loadPortfolioIntakeOrphanRuntimeTrace(input)
  const survivorLoad = await loadPortfolioIntakeSurvivorsFromProduction(input)

  return {
    ...traceResult,
    productionSummary: {
      cumulativeSurvivorInstances: survivorLoad.cumulativeSurvivorInstances,
      uniqueCanonicalSurvivors: survivorLoad.uniqueCanonicalSurvivors,
      completedRuns: survivorLoad.completedRunCount,
      runsWithZeroPromotionEvidence: survivorLoad.completedRunCount,
    },
  }
}
