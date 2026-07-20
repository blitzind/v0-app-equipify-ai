/** GE-AIOS-LIVE-2A — Autonomous production mission bootstrap (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type { BusinessProfileRecord } from "@/lib/growth/business-profile/business-profile-types"
import {
  getActiveApprovedBusinessProfile,
  listOrganizationIdsWithApprovedBusinessProfiles,
} from "@/lib/growth/business-profile/business-profile-repository"
import { bindFindLeadsSearchToMission } from "@/lib/growth/mission-center/growth-mission-find-leads-binding-service"
import { missionLifecycleActivityLabel } from "@/lib/growth/mission-center/growth-mission-runtime-types"
import { isMissionRuntimeOrchestrationReady } from "@/lib/growth/mission-center/growth-mission-runtime-orchestration-readiness"
import { runGrowthMissionRuntimeOrchestration } from "@/lib/growth/mission-center/growth-mission-runtime-orchestrator"
import { LIVE_1B_EQUIPIFY_MISSION_TITLE } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import {
  evaluateProductionMissionBootstrapRequirement,
  findActiveProductionBootstrapMission,
  isProductionAcquisitionObjective,
  isProductionBootstrapMissionReady,
  selectCanonicalProductionBootstrapObjective,
} from "@/lib/growth/mission-purpose/growth-autonomous-production-mission-bootstrap-2a"
import { ensureCanonicalObjectiveMissionPurpose } from "@/lib/growth/mission-purpose/growth-mission-purpose-migration-1b"
import { readCanonicalObjectiveMissionPurpose } from "@/lib/growth/mission-purpose/growth-mission-purpose-canonical-1b"
import {
  GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER,
  type ProductionMissionBootstrapResult,
  type ProductionMissionBootstrapSchedulerTickResult,
} from "@/lib/growth/mission-purpose/growth-autonomous-production-mission-bootstrap-2a-types"
import { createGrowthObjectiveWithPlan } from "@/lib/growth/objectives/growth-objective-service"
import {
  getGrowthObjective,
  listGrowthObjectives,
  updateGrowthObjective,
} from "@/lib/growth/objectives/growth-objective-repository"
import {
  resumeGrowthObjectiveRuntime,
  startGrowthObjectiveRuntime,
} from "@/lib/growth/objectives/growth-objective-runtime-service"
import { GROWTH_AVA_LAUNCH_MISSION_DEFAULT_OBJECTIVE_TYPE } from "@/lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-1a"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile } from "@/lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a"
import { buildDatamoonProductionConfigurationAudit } from "@/lib/growth/prospect-search/prospect-search-datamoon-production-configuration-audit-2b"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT } from "@/lib/growth/relationship/relationship-scale-limits"
import { mapWithBoundedConcurrency } from "@/lib/growth/runtime-guardrails/growth-bounded-concurrency"

async function resolveOrganizationBootstrapOwnerUserId(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("organization_members")
    .select("user_id, role, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(20)

  if (error || !data?.length) return null

  const owner =
    data.find((row) => row.role === "owner") ??
    data.find((row) => row.role === "admin") ??
    data[0]

  return typeof owner?.user_id === "string" ? owner.user_id : null
}

async function markProductionMissionFindingLeads(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
): Promise<void> {
  const objective = await getGrowthObjective(admin, organizationId, objectiveId)
  const runtime = objective?.executionContext?.missionRuntime
  if (!objective || !runtime) return

  await updateGrowthObjective(admin, organizationId, objectiveId, {
    executionContext: {
      ...objective.executionContext!,
      missionRuntime: {
        ...runtime,
        lifecycleState: "finding_leads",
        activityLabel: missionLifecycleActivityLabel("finding_leads", runtime.counters),
      },
    },
  }).catch(() => undefined)
}

async function bindProductionMissionDiscoverySearch(
  admin: SupabaseClient,
  input: {
    organizationId: string
    objectiveId: string
    approvedProfile: BusinessProfileRecord
    batchSize: number
    generatedAt: string
  },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const projection = buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
    profile: input.approvedProfile.profile,
    companyName: input.approvedProfile.companyName,
    organizationId: input.organizationId,
    batchSize: input.batchSize,
    generatedAt: input.generatedAt,
  })

  const bound = await bindFindLeadsSearchToMission(admin, {
    organizationId: input.organizationId,
    missionId: input.objectiveId,
    datamoonRequest: projection.request,
    searchSummary:
      projection.request.name?.trim() ||
      projection.request.run_name?.trim() ||
      LIVE_1B_EQUIPIFY_MISSION_TITLE,
    source: "find_leads",
    approvedByUser: true,
    keepMonitoring: true,
    refreshCadence: "daily",
  })

  if (!bound.ok) {
    return { ok: false, reason: bound.error }
  }

  await markProductionMissionFindingLeads(admin, input.organizationId, input.objectiveId)
  await runGrowthMissionRuntimeOrchestration(admin, input.organizationId, input.objectiveId).catch(
    () => undefined,
  )

  return { ok: true }
}

async function ensureProductionBootstrapObjectiveMissionPurpose(
  admin: SupabaseClient,
  input: {
    organizationId: string
    objective: GrowthObjective
    generatedAt: string
  },
): Promise<GrowthObjective> {
  if (!isProductionAcquisitionObjective(input.objective)) {
    return input.objective
  }

  if (readCanonicalObjectiveMissionPurpose(input.objective.executionContext) === "production") {
    return input.objective
  }

  const ensured = await ensureCanonicalObjectiveMissionPurpose(admin, {
    organizationId: input.organizationId,
    objective: input.objective,
    generatedAt: input.generatedAt,
  })

  return ensured.objective
}

function buildBootstrapResult(
  partial: Omit<
    ProductionMissionBootstrapResult,
    "qaMarker" | "datamoonStopReason" | "datamoonStatusLabel" | "datamoonStatusDisplay" | "datamoonDiscoveryEligible"
  > & {
    datamoonAudit?: ReturnType<typeof buildDatamoonProductionConfigurationAudit>
  },
): ProductionMissionBootstrapResult {
  return {
    qaMarker: GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER,
    datamoonStopReason: partial.datamoonAudit?.stopReason ?? null,
    datamoonStatusLabel: partial.datamoonAudit?.statusLabel ?? null,
    datamoonStatusDisplay: partial.datamoonAudit?.statusDisplay ?? null,
    datamoonDiscoveryEligible: partial.datamoonAudit?.eligibleForAutonomousDiscovery ?? null,
    organizationId: partial.organizationId,
    action: partial.action,
    objectiveId: partial.objectiveId,
    missionPurpose: partial.missionPurpose,
    portfolioDeficit: partial.portfolioDeficit,
    reason: partial.reason,
    discoveryProvider: partial.discoveryProvider,
  }
}

export async function ensureAutonomousProductionMissionBootstrap(
  admin: SupabaseClient,
  input: {
    organizationId: string
    generatedAt?: string
    approvedProfile?: BusinessProfileRecord | null
    missionTitle?: string | null
  },
): Promise<ProductionMissionBootstrapResult> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const organizationId = input.organizationId
  const missionTitle = input.missionTitle?.trim() || LIVE_1B_EQUIPIFY_MISSION_TITLE

  const [killSwitches, approvedProfile, objectives, portfolioSnapshot] = await Promise.all([
    getRuntimeKillSwitchStates(admin),
    input.approvedProfile !== undefined
      ? input.approvedProfile
      : getActiveApprovedBusinessProfile(admin, organizationId).catch(() => null),
    listGrowthObjectives(admin, organizationId).catch(() => []),
    buildGrowthAutonomousPortfolioWorkSnapshot(admin, { organizationId, generatedAt }).catch(
      () => null,
    ),
  ])

  const portfolioManager = portfolioSnapshot?.portfolioManager ?? null
  const portfolioHealth = portfolioManager?.health ?? null
  const datamoonAudit = buildDatamoonProductionConfigurationAudit({
    discoveriesToday:
      portfolioManager?.memory.discoveriesTodayDate?.slice(0, 10) === generatedAt.slice(0, 10)
        ? portfolioManager.memory.discoveriesToday
        : 0,
    maximumDailyDiscovery: portfolioManager?.target.maximumDailyDiscovery,
    approvedBusinessProfilePresent: Boolean(approvedProfile),
  })
  const activeProductionMission = findActiveProductionBootstrapMission(objectives)
  const bootstrapMissionReady = Boolean(
    activeProductionMission && isProductionBootstrapMissionReady(activeProductionMission),
  )

  const requirement = evaluateProductionMissionBootstrapRequirement({
    approvedProfilePresent: Boolean(approvedProfile),
    portfolioHealth,
    autonomyEnabled: killSwitches.autonomy_enabled,
    objectiveModeEnabled: killSwitches.autonomy_objective_mode_enabled,
    activeProductionMission,
    bootstrapMissionReady,
  })

  if (!requirement.required) {
    return buildBootstrapResult({
      organizationId,
      action: "skipped",
      objectiveId: activeProductionMission?.id ?? null,
      missionPurpose: "production",
      portfolioDeficit: requirement.portfolioDeficit,
      reason: requirement.reason,
      discoveryProvider: null,
      datamoonAudit,
    })
  }

  if (!approvedProfile) {
    return buildBootstrapResult({
      organizationId,
      action: "blocked",
      objectiveId: null,
      missionPurpose: null,
      portfolioDeficit: requirement.portfolioDeficit,
      reason: "approved_profile_missing",
      discoveryProvider: null,
      datamoonAudit,
    })
  }

  if (!datamoonAudit.configurationCompleteForProduction) {
    return buildBootstrapResult({
      organizationId,
      action: "blocked",
      objectiveId: activeProductionMission?.id ?? null,
      missionPurpose: "production",
      portfolioDeficit: requirement.portfolioDeficit,
      reason: datamoonAudit.stopReason ?? "datamoon_not_configured",
      discoveryProvider: null,
      datamoonAudit,
    })
  }

  const batchSize = Math.max(
    1,
    portfolioManager?.replenishment.batchSize ??
      portfolioManager?.target.replenishBatchSize ??
      10,
  )

  let objective =
    activeProductionMission ??
    selectCanonicalProductionBootstrapObjective(objectives, missionTitle)

  if (objective) {
    objective = await ensureProductionBootstrapObjectiveMissionPurpose(admin, {
      organizationId,
      objective,
      generatedAt,
    })
  }

  let action: ProductionMissionBootstrapResult["action"] = "already_active"

  if (objective && isProductionBootstrapMissionReady(objective)) {
    return buildBootstrapResult({
      organizationId,
      action: "already_active",
      objectiveId: objective.id,
      missionPurpose: "production",
      portfolioDeficit: requirement.portfolioDeficit,
      reason: "production_mission_ready",
      discoveryProvider: "datamoon",
      datamoonAudit,
    })
  }

  if (objective && objective.runtime?.running !== true && !objective.emergencyStopActive) {
    const ownerUserId =
      objective.ownerUserId ?? (await resolveOrganizationBootstrapOwnerUserId(admin, organizationId))
    if (!ownerUserId) {
      return buildBootstrapResult({
        organizationId,
        action: "blocked",
        objectiveId: objective.id,
        missionPurpose: "production",
        portfolioDeficit: requirement.portfolioDeficit,
        reason: "missing_objective_owner_user",
        discoveryProvider: null,
        datamoonAudit,
      })
    }

    if (!objective.ownerUserId) {
      objective = await updateGrowthObjective(admin, organizationId, objective.id, {
        ownerUserId,
        title: objective.title.trim() === missionTitle ? objective.title : missionTitle,
      })
    }

    objective =
      objective.runtime?.running === true
        ? objective
        : objective.status === "active"
          ? await resumeGrowthObjectiveRuntime(admin, organizationId, objective.id, {
              actorUserId: ownerUserId,
            })
          : await startGrowthObjectiveRuntime(admin, organizationId, objective.id, {
              actorUserId: ownerUserId,
            })
    action = "resumed"
  }

  if (!objective) {
    const ownerUserId = await resolveOrganizationBootstrapOwnerUserId(admin, organizationId)
    if (!ownerUserId) {
      return buildBootstrapResult({
        organizationId,
        action: "blocked",
        objectiveId: null,
        missionPurpose: null,
        portfolioDeficit: requirement.portfolioDeficit,
        reason: "missing_objective_owner_user",
        discoveryProvider: null,
        datamoonAudit,
      })
    }

    const created = await createGrowthObjectiveWithPlan(
      admin,
      organizationId,
      {
        title: missionTitle,
        description: null,
        objectiveType: GROWTH_AVA_LAUNCH_MISSION_DEFAULT_OBJECTIVE_TYPE,
        targetValue: portfolioManager?.target.targetActiveCompanies ?? 25,
        ownerUserId,
        missionPurpose: "production",
      },
      {
        autoStart: true,
        actorUserId: ownerUserId,
      },
    )
    objective = created.objective
    action = "created"
  }

  objective = await ensureProductionBootstrapObjectiveMissionPurpose(admin, {
    organizationId,
    objective,
    generatedAt,
  })

  if (!isMissionRuntimeOrchestrationReady(objective)) {
    const bound = await bindProductionMissionDiscoverySearch(admin, {
      organizationId,
      objectiveId: objective.id,
      approvedProfile,
      batchSize,
      generatedAt,
    })

    if (!bound.ok) {
      return buildBootstrapResult({
        organizationId,
        action: "blocked",
        objectiveId: objective.id,
        missionPurpose: "production",
        portfolioDeficit: requirement.portfolioDeficit,
        reason: bound.reason,
        discoveryProvider: null,
        datamoonAudit,
      })
    }

    if (action === "already_active") {
      action = "bound_search"
    }
  }

  logGrowthEngine("growth_autonomous_production_mission_bootstrap", {
    qa_marker: GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER,
    organization_id: organizationId,
    objective_id: objective.id,
    action,
    portfolio_deficit: requirement.portfolioDeficit,
    discovery_provider: "datamoon",
  })

  return buildBootstrapResult({
    organizationId,
    action,
    objectiveId: objective.id,
    missionPurpose: "production",
    portfolioDeficit: requirement.portfolioDeficit,
    reason: null,
    discoveryProvider: "datamoon",
    datamoonAudit,
  })
}

export async function tickAutonomousProductionMissionBootstrapForScheduler(
  admin: SupabaseClient,
  input?: {
    generatedAt?: string
    maxOrganizations?: number
  },
): Promise<ProductionMissionBootstrapSchedulerTickResult> {
  const generatedAt = input?.generatedAt ?? new Date().toISOString()
  const killSwitches = await getRuntimeKillSwitchStates(admin)

  if (!killSwitches.autonomy_enabled || !killSwitches.autonomy_objective_mode_enabled) {
    return {
      qaMarker: GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER,
      organizationsAttempted: 0,
      organizationsBootstrapped: 0,
      results: [],
    }
  }

  const organizationIds = await listOrganizationIdsWithApprovedBusinessProfiles(admin, {
    limit: input?.maxOrganizations ?? GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT,
  })

  const results = await mapWithBoundedConcurrency(organizationIds, 2, async (organizationId) =>
    ensureAutonomousProductionMissionBootstrap(admin, {
      organizationId,
      generatedAt,
    }).catch(
      (error): ProductionMissionBootstrapResult =>
        buildBootstrapResult({
          organizationId,
          action: "blocked",
          objectiveId: null,
          missionPurpose: null,
          portfolioDeficit: 0,
          reason: error instanceof Error ? error.message : "bootstrap_failed",
          discoveryProvider: null,
        }),
    ),
  )

  const organizationsBootstrapped = results.filter(
    (row) => row.action === "created" || row.action === "resumed" || row.action === "bound_search",
  ).length

  return {
    qaMarker: GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER,
    organizationsAttempted: organizationIds.length,
    organizationsBootstrapped,
    results,
  }
}

export const GE_AIOS_LIVE_2A_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_QA_MARKER =
  GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER
