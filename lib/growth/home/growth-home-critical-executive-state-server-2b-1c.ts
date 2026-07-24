/**
 * AVA-GROWTH-HOTFIX-2B-1C — Home critical executive state server builder.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import { projectCanonicalActiveMissionsForHome } from "@/lib/growth/aios/missions/growth-canonical-mission-1a-home"
import { buildCanonicalOperatorTask } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import {
  buildGrowthHomeExecutiveFirstLoadDiagnostics,
  buildGrowthHomeExecutiveLoadMetadata,
  type GrowthHomeExecutiveSourceAvailability,
} from "@/lib/growth/home/growth-home-critical-executive-load-2b-1a"
import { loadGrowthHomeCriticalExecutiveStage } from "@/lib/growth/home/growth-home-critical-executive-stage-server-2b-1a"
import {
  AVA_GROWTH_HOTFIX_2B_1C_QA_MARKER,
  buildGrowthHomeCriticalApprovalPackageSummaries,
  type GrowthHomeCriticalExecutiveLoad,
  type GrowthHomeCriticalExecutiveStatePayload,
} from "@/lib/growth/home/growth-home-critical-executive-state-2b-1c"
import type { GrowthHomeLoaderTiming } from "@/lib/growth/home/growth-home-workspace-loader-budget"
import { buildGrowthAvaActivationFallbackFromTrainingProjection } from "@/lib/growth/training/growth-canonical-organization-training-projection-1d-hotfix"

function buildCriticalLoadFromStage(input: {
  approvalsAvailability: GrowthHomeExecutiveSourceAvailability
  trainingAvailability: GrowthHomeExecutiveSourceAvailability
  approvalSnapshot: ReturnType<typeof loadGrowthHomeCriticalExecutiveStage> extends Promise<infer T>
    ? T["approvalSnapshot"]
    : never
}): GrowthHomeCriticalExecutiveLoad {
  const packages = buildGrowthHomeCriticalApprovalPackageSummaries(input.approvalSnapshot)
  const pendingCount = input.approvalSnapshot?.pendingApprovalCount ?? null

  if (input.approvalsAvailability === "unavailable") {
    return {
      availability: "unavailable",
      errorCode: "approval_snapshot_unavailable",
      retryable: true,
    }
  }

  if (input.trainingAvailability === "unavailable" && input.approvalsAvailability !== "unavailable") {
    if (input.approvalsAvailability === "confirmed_empty") {
      return {
        availability: "partial",
        pendingApprovalCount: 0,
        packages: [],
        confirmedFields: ["approvals"],
        unavailableFields: ["training", "activation"],
      }
    }
    return {
      availability: "partial",
      pendingApprovalCount: pendingCount,
      packages,
      confirmedFields: ["approvals", "packages"],
      unavailableFields: ["training", "activation"],
    }
  }

  if ((pendingCount ?? 0) > 0) {
    return {
      availability: "confirmed",
      pendingApprovalCount: pendingCount ?? 0,
      packages,
    }
  }

  return {
    availability: "confirmed_empty",
    pendingApprovalCount: 0,
    packages: [],
  }
}

export async function buildGrowthHomeCriticalExecutiveState(input: {
  admin: SupabaseClient
  actorUserId: string
  requestGeneration?: number | null
  retryAttempt?: number | null
}): Promise<GrowthHomeCriticalExecutiveStatePayload> {
  const startedAt = Date.now()
  const generatedAt = new Date().toISOString()
  const organizationId = getGrowthEngineAiOrgId()
  const stageTimings: GrowthHomeLoaderTiming[] = []

  const criticalExecutiveStage = await loadGrowthHomeCriticalExecutiveStage({
    admin: input.admin,
    organizationId,
    actorUserId: input.actorUserId,
    generatedAt,
    lightweightApprovalLoader: true,
  })

  stageTimings.push(...criticalExecutiveStage.timings)
  stageTimings.push({
    label: "critical_executive_state_wall",
    durationMs: Date.now() - startedAt,
    timedOut: false,
  })

  let approvalsAvailability = criticalExecutiveStage.approvalsAvailability
  const canonicalOperatorApproval = criticalExecutiveStage.approvalSnapshot
  if (canonicalOperatorApproval) {
    approvalsAvailability =
      canonicalOperatorApproval.pendingApprovalCount > 0 ? "confirmed" : "confirmed_empty"
  } else if (organizationId) {
    approvalsAvailability = "unavailable"
  }

  const canonicalOperatorTask = canonicalOperatorApproval?.topPackage
    ? buildCanonicalOperatorTask({ approvalSnapshot: canonicalOperatorApproval })
    : null

  const canonicalActiveMissions =
    organizationId && canonicalOperatorApproval
      ? projectCanonicalActiveMissionsForHome({
          organizationId,
          canonicalOperatorApproval,
          canonicalHeroDecision: null,
          canonicalOperatorTask,
          heroLeadCompanyName: canonicalOperatorApproval.topPackage?.companyName ?? null,
        })
      : null

  let avaActivation = null
  if (
    criticalExecutiveStage.trainingProjection &&
    input.actorUserId?.trim() &&
    input.actorUserId !== "undefined"
  ) {
    avaActivation = buildGrowthAvaActivationFallbackFromTrainingProjection({
      projection: criticalExecutiveStage.trainingProjection,
      autonomyEnabled: false,
      objectiveModeEnabled: false,
    })
  }

  const missionsAvailability: GrowthHomeExecutiveSourceAvailability =
    canonicalActiveMissions && (canonicalActiveMissions.totalMissionCount ?? 0) > 0
      ? "confirmed"
      : canonicalActiveMissions
        ? "confirmed_empty"
        : approvalsAvailability === "unavailable"
          ? "unavailable"
          : "confirmed_empty"

  const recommendationAvailability: GrowthHomeExecutiveSourceAvailability =
    canonicalOperatorTask
      ? "confirmed"
      : approvalsAvailability === "unavailable"
        ? "unavailable"
        : "confirmed_empty"

  const activationAvailability: GrowthHomeExecutiveSourceAvailability = avaActivation
    ? "confirmed"
    : criticalExecutiveStage.trainingAvailability === "unavailable"
      ? "unavailable"
      : "confirmed_empty"

  const firstLoadDiagnostics = buildGrowthHomeExecutiveFirstLoadDiagnostics({
    approvalAvailability: approvalsAvailability,
    approvalSource: criticalExecutiveStage.approvalSource,
    pendingApprovalCount: canonicalOperatorApproval?.pendingApprovalCount ?? null,
    approvalLoaderTimedOut: criticalExecutiveStage.approvalLoaderTimedOut,
    approvalLoaderDurationMs: criticalExecutiveStage.approvalLoaderDurationMs,
  })

  const executiveLoad = buildGrowthHomeExecutiveLoadMetadata({
    criticalStageMs: criticalExecutiveStage.durationMs,
    secondaryStageMs: null,
    approvals: approvalsAvailability,
    training: criticalExecutiveStage.trainingAvailability,
    activation: activationAvailability,
    missions: missionsAvailability,
    recommendation: recommendationAvailability,
    firstLoad: firstLoadDiagnostics,
  })

  const criticalLoad = buildCriticalLoadFromStage({
    approvalsAvailability,
    trainingAvailability: criticalExecutiveStage.trainingAvailability,
    approvalSnapshot: canonicalOperatorApproval,
  })

  logGrowthEngine("growth_home_critical_executive_state", {
    organizationId,
    requestGeneration: input.requestGeneration ?? null,
    retryAttempt: input.retryAttempt ?? null,
    durationMs: Date.now() - startedAt,
    criticalAvailability: criticalLoad.availability,
    approvalAvailability: approvalsAvailability,
    pendingApprovalCount: canonicalOperatorApproval?.pendingApprovalCount ?? null,
    approvalLoaderTimedOut: criticalExecutiveStage.approvalLoaderTimedOut,
    approvalLoaderDurationMs: criticalExecutiveStage.approvalLoaderDurationMs,
    trainingAvailability: criticalExecutiveStage.trainingAvailability,
    idleEligible: firstLoadDiagnostics.idleEligible,
    stageTimingsMs: Object.fromEntries(stageTimings.map((row) => [row.label, row.durationMs])),
  })

  return {
    ok: true,
    qaMarker: AVA_GROWTH_HOTFIX_2B_1C_QA_MARKER,
    generatedAt,
    requestGeneration: input.requestGeneration ?? null,
    retryAttempt: input.retryAttempt ?? null,
    criticalLoad,
    canonicalOperatorApproval,
    canonicalOperatorTask,
    canonicalActiveMissions,
    canonicalOrganizationTraining: criticalExecutiveStage.trainingProjection,
    avaActivation,
    executiveLoad,
    stageTimingsMs: Object.fromEntries(stageTimings.map((row) => [row.label, row.durationMs])),
  }
}
