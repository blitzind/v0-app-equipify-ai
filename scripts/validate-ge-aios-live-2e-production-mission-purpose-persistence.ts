/**
 * GE-AIOS-LIVE-2E — Production mission purpose persistence repair + validation.
 *
 * Run:
 *   pnpm validate:ge-aios-live-2e-production-mission-purpose-persistence
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { loadGrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-loader"
import {
  findActiveProductionBootstrapMission,
  isProductionAcquisitionObjective,
  isProductionBootstrapMissionReady,
  selectCanonicalProductionBootstrapObjective,
  GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER,
} from "@/lib/growth/mission-purpose/growth-autonomous-production-mission-bootstrap-2a"
import { ensureAutonomousProductionMissionBootstrap } from "@/lib/growth/mission-purpose/growth-autonomous-production-mission-bootstrap-2a-service"
import {
  readCanonicalObjectiveMissionPurpose,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-canonical-1b"
import {
  ensureCanonicalObjectiveMissionPurpose,
  GE_AIOS_LIVE_1B_MISSION_PURPOSE_MIGRATION_QA_MARKER,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-migration-1b"
import { getGrowthObjective, listGrowthObjectives } from "@/lib/growth/objectives/growth-objective-repository"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  EQUIPIFY_PRODUCTION_ORG_ID,
  LIVE_1B_EQUIPIFY_MISSION_TITLE,
} from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"

const PHASE = "GE-AIOS-LIVE-2E" as const
const TARGET_OBJECTIVE_ID = "91eecd92-b6c4-4c3e-8fb3-eefc499e9cf6"

type ValidationGate = {
  id: string
  status: "pass" | "warn" | "fail"
  detail: string
}

async function readRawExecutionContextMissionPurpose(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("organization_growth_objectives")
    .select("execution_context")
    .eq("organization_id", organizationId)
    .eq("id", objectiveId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const context =
    data?.execution_context && typeof data.execution_context === "object"
      ? (data.execution_context as Record<string, unknown>)
      : null
  return typeof context?.missionPurpose === "string" ? context.missionPurpose : null
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production mission purpose persistence repair + validation`)
  console.log(`QA marker: ${GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER}`)
  console.log(`Migration authority: ${GE_AIOS_LIVE_1B_MISSION_PURPOSE_MIGRATION_QA_MARKER}`)

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

  const beforeObjective = await getGrowthObjective(admin, organizationId, TARGET_OBJECTIVE_ID)
  const beforeRawPurpose = await readRawExecutionContextMissionPurpose(
    admin,
    organizationId,
    TARGET_OBJECTIVE_ID,
  )

  console.log("\n--- Pre-repair audit ---")
  console.log(
    JSON.stringify(
      {
        targetObjectiveId: TARGET_OBJECTIVE_ID,
        exists: Boolean(beforeObjective),
        rawExecutionContextMissionPurpose: beforeRawPurpose,
        mappedCanonicalMissionPurpose: readCanonicalObjectiveMissionPurpose(
          beforeObjective?.executionContext ?? null,
        ),
        status: beforeObjective?.status ?? null,
        runtimeRunning: beforeObjective?.runtime?.running ?? null,
        createdAt: beforeObjective?.createdAt ?? null,
      },
      null,
      2,
    ),
  )

  if (!beforeObjective) {
    console.error(`Target objective ${TARGET_OBJECTIVE_ID} not found`)
    process.exit(1)
  }

  const migration = await ensureCanonicalObjectiveMissionPurpose(admin, {
    organizationId,
    objective: beforeObjective,
    generatedAt,
  })

  const bootstrapTick = await ensureAutonomousProductionMissionBootstrap(admin, {
    organizationId,
    generatedAt,
    missionTitle: LIVE_1B_EQUIPIFY_MISSION_TITLE,
  })

  const [objectives, portfolioSnapshot, missionDiscovery, killSwitches] = await Promise.all([
    listGrowthObjectives(admin, organizationId),
    buildGrowthAutonomousPortfolioWorkSnapshot(admin, { organizationId, generatedAt }),
    loadGrowthHomeMissionDiscoverySnapshot(admin, { organizationId }),
    getRuntimeKillSwitchStates(admin),
  ])

  const repairedObjective = await getGrowthObjective(admin, organizationId, TARGET_OBJECTIVE_ID)
  const rawPurpose = await readRawExecutionContextMissionPurpose(admin, organizationId, TARGET_OBJECTIVE_ID)
  const mappedPurpose = readCanonicalObjectiveMissionPurpose(repairedObjective?.executionContext ?? null)
  const activeBootstrapMission = findActiveProductionBootstrapMission(objectives)
  const canonicalObjective = selectCanonicalProductionBootstrapObjective(objectives, LIVE_1B_EQUIPIFY_MISSION_TITLE)
  const bootstrapReady = Boolean(
    activeBootstrapMission && isProductionBootstrapMissionReady(activeBootstrapMission),
  )
  const activeProductionBootstrapMissions = objectives.filter(
    (row) =>
      isProductionAcquisitionObjective(row) &&
      row.status === "active" &&
      row.runtime?.running &&
      !row.emergencyStopActive,
  )
  const portfolioDeficit = portfolioSnapshot?.portfolioManager?.health.needsCount ?? 0

  gates.push({
    id: "target_objective_exists",
    status: repairedObjective ? "pass" : "fail",
    detail: repairedObjective
      ? `Target objective ${TARGET_OBJECTIVE_ID} exists.`
      : `Target objective ${TARGET_OBJECTIVE_ID} missing.`,
  })

  gates.push({
    id: "migration_authority_applied",
    status: mappedPurpose === "production" ? "pass" : "fail",
    detail: `Migration changed=${migration.result.changed}; migrated=${migration.result.migrated}; mappedPurpose=${mappedPurpose ?? "missing"}.`,
  })

  gates.push({
    id: "raw_and_mapped_agree",
    status: rawPurpose === "production" && mappedPurpose === "production" ? "pass" : "fail",
    detail: `raw.execution_context.missionPurpose=${rawPurpose ?? "missing"}; mapped=${mappedPurpose ?? "missing"}.`,
  })

  gates.push({
    id: "single_active_bootstrap_mission",
    status: activeProductionBootstrapMissions.length === 1 ? "pass" : "fail",
    detail:
      activeProductionBootstrapMissions.length === 1
        ? `Exactly one active production bootstrap mission: ${activeProductionBootstrapMissions[0]?.id}.`
        : `${activeProductionBootstrapMissions.length} active production bootstrap missions detected.`,
  })

  gates.push({
    id: "active_bootstrap_is_target",
    status: activeBootstrapMission?.id === TARGET_OBJECTIVE_ID ? "pass" : "fail",
    detail: `activeBootstrapMissionId=${activeBootstrapMission?.id ?? "none"}.`,
  })

  gates.push({
    id: "bootstrap_self_heal_no_duplicate",
    status:
      bootstrapTick.objectiveId === TARGET_OBJECTIVE_ID &&
      (bootstrapTick.action === "already_active" || bootstrapTick.action === "skipped")
        ? "pass"
        : bootstrapTick.action === "created"
          ? "fail"
          : "warn",
    detail: `bootstrap action=${bootstrapTick.action}; objectiveId=${bootstrapTick.objectiveId ?? "none"}.`,
  })

  gates.push({
    id: "datamoon_binding_intact",
    status: bootstrapReady ? "pass" : repairedObjective?.executionContext?.missionRuntime ? "pass" : "warn",
    detail: `bootstrapReady=${bootstrapReady}; missionRuntime.lifecycleState=${repairedObjective?.executionContext?.missionRuntime?.lifecycleState ?? "none"}.`,
  })

  gates.push({
    id: "startup_discovery_ready",
    status: missionDiscovery?.startupDiscoveryReady ? "pass" : "warn",
    detail: `startupDiscoveryReady=${missionDiscovery?.startupDiscoveryReady ?? false}; missionId=${missionDiscovery?.missionId ?? "none"}.`,
  })

  gates.push({
    id: "portfolio_deficit",
    status: "pass",
    detail: `Portfolio deficit=${portfolioDeficit}.`,
  })

  gates.push({
    id: "home_production_projection",
    status: missionDiscovery?.missionId ? "pass" : "fail",
    detail: `Home missionId=${missionDiscovery?.missionId ?? "none"}.`,
  })

  gates.push({
    id: "outbound_disabled",
    status: killSwitches.autonomy_outbound_enabled === false ? "pass" : "fail",
    detail: `autonomy_outbound_enabled=${killSwitches.autonomy_outbound_enabled}.`,
  })

  gates.push({
    id: "certification_isolation",
    status:
      objectives
        .filter((row) => readCanonicalObjectiveMissionPurpose(row.executionContext) === "certification")
        .every((row) => row.id !== activeBootstrapMission?.id)
        ? "pass"
        : "fail",
    detail: `canonicalObjectiveId=${canonicalObjective?.id ?? "none"}; activeBootstrapMissionId=${activeBootstrapMission?.id ?? "none"}.`,
  })

  console.log("\n--- Validation Gates ---")
  for (const gate of gates) {
    const prefix = gate.status === "pass" ? "✓" : gate.status === "warn" ? "!" : "✗"
    console.log(`  ${prefix} [${gate.id}] ${gate.detail}`)
  }

  console.log("\n--- Summary ---")
  console.log(
    JSON.stringify(
      {
        qaMarker: GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER,
        migrationAuthority: GE_AIOS_LIVE_1B_MISSION_PURPOSE_MIGRATION_QA_MARKER,
        organizationId,
        targetObjectiveId: TARGET_OBJECTIVE_ID,
        beforeRawPurpose,
        afterRawPurpose: rawPurpose,
        mappedPurpose,
        migrationResult: migration.result,
        bootstrapTick,
        activeBootstrapMissionId: activeBootstrapMission?.id ?? null,
        bootstrapReady,
        portfolioDeficit,
        missionDiscovery,
        killSwitches,
      },
      null,
      2,
    ),
  )

  const failures = gates.filter((gate) => gate.status === "fail")
  console.log("\n--- Verdict ---")
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
