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
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_PRODUCTION_AUTHORITATIVE_DATAMOON_VALIDATION_2D_QA_MARKER,
  isLocalEncryptedProductionSecretsUnreadable,
  resolveProductionAuthoritativeDatamoonValidation,
} from "@/lib/growth/qa/growth-production-authoritative-datamoon-validation-2d"
import {
  EQUIPIFY_PRODUCTION_ORG_ID,
  LIVE_1B_EQUIPIFY_MISSION_TITLE,
} from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"

const PHASE = "GE-AIOS-LIVE-2A" as const

type ValidationGate = {
  id: string
  status: "pass" | "warn" | "fail" | "blocked" | "inconclusive"
  detail: string
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Autonomous production mission bootstrap validation (read-only)`)
  console.log(`QA marker: ${GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER}`)
  console.log(`Authority marker: ${GROWTH_PRODUCTION_AUTHORITATIVE_DATAMOON_VALIDATION_2D_QA_MARKER}`)

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

  const authoritative = await resolveProductionAuthoritativeDatamoonValidation({
    supabaseUrl: bootstrap.url,
    serviceRoleKey: bootstrap.jwt,
    env: process.env,
    admin,
    organizationId,
  })
  const { configuration } = authoritative
  const deployedDatamoonStatusLabel = configuration.statusLabel
  const deployedDatamoonJobEligible = configuration.datamoonEligibleForAutonomousDiscovery === true

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
    id: "production_runtime_authoritative",
    status: configuration.authority === "deployed_runtime" ? "pass" : "inconclusive",
    detail:
      configuration.authority === "deployed_runtime"
        ? "Deployed Production runtime is authoritative for DataMoon configuration."
        : configuration.note,
  })

  gates.push({
    id: "local_env_not_used_for_datamoon_verdict",
    status:
      !isLocalEncryptedProductionSecretsUnreadable(process.env) ||
      configuration.authority === "deployed_runtime" ||
      configuration.configurationUnknown
        ? "pass"
        : "fail",
    detail:
      "Local vercel env run must not produce false Production DataMoon misconfiguration conclusions.",
  })

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
          : configuration.configurationUnknown
            ? "inconclusive"
            : "fail",
    detail: portfolioBelowTarget
      ? bootstrapReady || authority.discoveryActive
        ? "Below target with active/ready production mission or discovery."
        : configuration.configurationUnknown
          ? "Portfolio below target; bootstrap state unknown pending deployed DataMoon probe."
          : "Portfolio below target but no ready production mission or discovery activity."
      : "Portfolio is at/above target — idle is acceptable.",
  })

  gates.push({
    id: "datamoon_discovery_state",
    status:
      configuration.configurationUnknown
        ? "inconclusive"
        : deployedDatamoonStatusLabel !== "needs_configuration" ||
            deployedDatamoonJobEligible ||
            bootstrapReady
          ? "pass"
          : portfolioBelowTarget
            ? configuration.productionMisconfigured
              ? "blocked"
              : "fail"
            : "pass",
    detail: configuration.configurationUnknown
      ? configuration.note
      : `deployed.statusLabel=${deployedDatamoonStatusLabel ?? "unknown"}; display=${configuration.statusDisplay ?? "unknown"}; eligible=${deployedDatamoonJobEligible}.`,
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
      gate.status === "pass"
        ? "✓"
        : gate.status === "warn"
          ? "!"
          : gate.status === "blocked"
            ? "○"
            : gate.status === "inconclusive"
              ? "?"
              : "✗"
    console.log(`  ${prefix} [${gate.id}] ${gate.detail}`)
  }

  const failures = gates.filter((gate) => gate.status === "fail")
  const blockers = gates.filter((gate) => gate.status === "blocked")
  const inconclusive = gates.filter((gate) => gate.status === "inconclusive")

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
        deployedDatamoon: configuration,
        missionDiscovery,
      },
      null,
      2,
    ),
  )

  console.log("\n--- Verdict ---")
  if (configuration.configurationUnknown && inconclusive.length > 0 && failures.length === 0) {
    console.log(`[${PHASE}] INCONCLUSIVE — deployed DataMoon health unavailable; local env not authoritative`)
    process.exit(3)
  }
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
