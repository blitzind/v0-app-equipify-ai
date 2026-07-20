/**
 * GE-AIOS-LIVE-2A — Production read-only bootstrap validation.
 *
 * Run:
 *   pnpm validate:ge-aios-live-2a-autonomous-production-mission-bootstrap-production
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { loadGrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-loader"
import {
  findActiveProductionBootstrapMission,
  isProductionBootstrapMissionReady,
  isProductionAcquisitionObjective,
  selectCanonicalProductionBootstrapObjective,
  GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER,
} from "@/lib/growth/mission-purpose/growth-autonomous-production-mission-bootstrap-2a"
import { buildProductionMissionAuthority } from "@/lib/growth/mission-purpose/growth-production-mission-authority-1a"
import { readCanonicalObjectiveMissionPurpose } from "@/lib/growth/mission-purpose/growth-mission-purpose-canonical-1b"
import { listGrowthObjectives } from "@/lib/growth/objectives/growth-objective-repository"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { loadPortfolioDatamoonDiscoveryOperatorState } from "@/lib/growth/prospect-search/prospect-search-datamoon-discovery-state-loader-1a"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  EQUIPIFY_PRODUCTION_ORG_ID,
  LIVE_1B_EQUIPIFY_MISSION_TITLE,
} from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"

const PHASE = "GE-AIOS-LIVE-2A" as const

type ValidationGate = {
  id: string
  status: "pass" | "warn" | "fail" | "blocked"
  detail: string
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Autonomous production mission bootstrap validation (read-only)`)
  console.log(`QA marker: ${GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER}`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin: SupabaseClient = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const generatedAt = new Date().toISOString()
  const gates: ValidationGate[] = []

  const [approvedProfile, objectives, killSwitches, portfolioSnapshot, missionDiscovery] =
    await Promise.all([
      getActiveApprovedBusinessProfile(admin, organizationId),
      listGrowthObjectives(admin, organizationId),
      getRuntimeKillSwitchStates(admin),
      buildGrowthAutonomousPortfolioWorkSnapshot(admin, { organizationId, generatedAt }),
      loadGrowthHomeMissionDiscoverySnapshot(admin, { organizationId }),
    ])

  gates.push({
    id: "approved_growth_profile",
    status: approvedProfile ? "pass" : "fail",
    detail: approvedProfile
      ? `Approved profile ${approvedProfile.id} present.`
      : "No approved Growth Profile found.",
  })

  const productionObjectives = objectives.filter(isProductionAcquisitionObjective)
  const canonicalObjective = selectCanonicalProductionBootstrapObjective(
    objectives,
    LIVE_1B_EQUIPIFY_MISSION_TITLE,
  )
  const activeBootstrapMission = findActiveProductionBootstrapMission(objectives)
  const bootstrapReady = Boolean(
    activeBootstrapMission && isProductionBootstrapMissionReady(activeBootstrapMission),
  )

  gates.push({
    id: "canonical_production_objective",
    status: canonicalObjective ? "pass" : productionObjectives.length > 0 ? "warn" : "fail",
    detail: canonicalObjective
      ? `Canonical production objective ${canonicalObjective.id} (${canonicalObjective.title}).`
      : "No canonical production acquisition objective found.",
  })

  const activeProductionBootstrapMissions = objectives.filter(
    (row) =>
      isProductionAcquisitionObjective(row) &&
      row.status === "active" &&
      row.runtime?.running &&
      !row.emergencyStopActive,
  )

  gates.push({
    id: "single_active_bootstrap_mission",
    status: activeProductionBootstrapMissions.length === 1 ? "pass" : activeProductionBootstrapMissions.length === 0 ? "warn" : "fail",
    detail:
      activeProductionBootstrapMissions.length === 1
        ? `Exactly one active production bootstrap mission: ${activeProductionBootstrapMissions[0]?.id}.`
        : `${activeProductionBootstrapMissions.length} active production bootstrap missions detected.`,
  })

  gates.push({
    id: "mission_purpose_production",
    status:
      activeBootstrapMission &&
      readCanonicalObjectiveMissionPurpose(activeBootstrapMission.executionContext) === "production"
        ? "pass"
        : activeBootstrapMission
          ? "fail"
          : "warn",
    detail: activeBootstrapMission
      ? `Active mission purpose=${readCanonicalObjectiveMissionPurpose(activeBootstrapMission.executionContext) ?? "missing"}.`
      : "No active production bootstrap mission to inspect.",
  })

  const portfolioManager = portfolioSnapshot?.portfolioManager ?? null
  const portfolioDeficit = portfolioManager?.health.needsCount ?? 0
  gates.push({
    id: "portfolio_deficit",
    status: "pass",
    detail: `Portfolio deficit=${portfolioDeficit}; health=${portfolioManager?.health.healthState ?? "unknown"}.`,
  })

  const authority = buildProductionMissionAuthority({
    portfolioManager,
    missionDiscovery,
  })

  const portfolioBelowTarget = portfolioDeficit > 0
  gates.push({
    id: "ava_not_idle_while_below_target",
    status:
      !portfolioBelowTarget || bootstrapReady || authority.discoveryActive
        ? "pass"
        : killSwitches.autonomy_enabled === false
          ? "blocked"
          : "fail",
    detail: portfolioBelowTarget
      ? bootstrapReady || authority.discoveryActive
        ? "Below target with active/ready production mission or discovery."
        : "Portfolio below target but no ready production mission or discovery activity."
      : "Portfolio is at/above target — idle is acceptable.",
  })

  const datamoonDiscovery = portfolioManager
    ? await loadPortfolioDatamoonDiscoveryOperatorState(admin, {
        organizationId,
        memory: portfolioManager.memory,
        nextBatchSize: portfolioManager.replenishment.batchSize,
        maximumDailyDiscovery: portfolioManager.target.maximumDailyDiscovery,
      })
    : null

  gates.push({
    id: "datamoon_discovery_state",
    status:
      datamoonDiscovery?.provider === "datamoon" || datamoonDiscovery?.jobActive || bootstrapReady
        ? "pass"
        : portfolioBelowTarget
          ? "warn"
          : "pass",
    detail: datamoonDiscovery
      ? `DataMoon status=${datamoonDiscovery.statusLabel}; jobActive=${datamoonDiscovery.jobActive}; provider=${datamoonDiscovery.provider}.`
      : "DataMoon operator state unavailable.",
  })

  gates.push({
    id: "outbound_disabled",
    status: killSwitches.autonomy_outbound_enabled === false ? "pass" : "fail",
    detail: `autonomy_outbound_enabled=${killSwitches.autonomy_outbound_enabled}.`,
  })

  gates.push({
    id: "home_production_work_projection",
    status:
      !portfolioBelowTarget || (missionDiscovery?.startupDiscoveryReady && missionDiscovery.missionId)
        ? "pass"
        : bootstrapReady
          ? "warn"
          : "fail",
    detail: missionDiscovery
      ? `missionDiscovery.missionId=${missionDiscovery.missionId}; startupDiscoveryReady=${missionDiscovery.startupDiscoveryReady}; action=${missionDiscovery.discoveryAction}.`
      : "Home missionDiscovery snapshot is null.",
  })

  const certificationBleed = objectives.filter(
    (row) => readCanonicalObjectiveMissionPurpose(row.executionContext) === "certification",
  )
  gates.push({
    id: "certification_isolation",
    status:
      certificationBleed.every((row) => row.id !== activeBootstrapMission?.id) ? "pass" : "fail",
    detail: `${certificationBleed.length} certification objectives; active bootstrap mission=${activeBootstrapMission?.id ?? "none"}.`,
  })

  console.log("\n--- Validation Gates ---")
  for (const gate of gates) {
    const prefix =
      gate.status === "pass" ? "✓" : gate.status === "warn" ? "!" : gate.status === "blocked" ? "○" : "✗"
    console.log(`  ${prefix} [${gate.id}] ${gate.detail}`)
  }

  const failures = gates.filter((gate) => gate.status === "fail")
  const blockers = gates.filter((gate) => gate.status === "blocked")

  console.log("\n--- Summary ---")
  console.log(
    JSON.stringify(
      {
        qaMarker: GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER,
        organizationId,
        approvedProfileId: approvedProfile?.id ?? null,
        canonicalObjectiveId: canonicalObjective?.id ?? null,
        activeBootstrapMissionId: activeBootstrapMission?.id ?? null,
        bootstrapReady,
        portfolioDeficit,
        discoveryActive: authority.discoveryActive,
        killSwitches,
        datamoon: datamoonDiscovery,
      },
      null,
      2,
    ),
  )

  console.log("\n--- Verdict ---")
  if (blockers.length > 0) {
    console.log(`[${PHASE}] BLOCKED — external policy prevents bootstrap (${blockers.map((g) => g.id).join(", ")})`)
    process.exit(2)
  }
  if (failures.length > 0) {
    console.log(`[${PHASE}] FAIL — ${failures.length} gate(s) failed`)
    process.exit(1)
  }
  console.log(`[${PHASE}] PASS`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
