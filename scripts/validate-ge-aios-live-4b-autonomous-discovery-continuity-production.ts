/**
 * GE-AIOS-LIVE-4B — Autonomous discovery continuity production validation (read-only).
 *
 * Run:
 *   pnpm validate:ge-aios-live-4b-autonomous-discovery-continuity-production
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { loadGrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-loader"
import {
  diffMissionVsPortfolioDatamoonRunMetadata,
  GROWTH_MISSION_DATAMOON_CANONICAL_DISCOVERY_HANDOFF_LIVE_4B_QA_MARKER,
  isDatamoonRunEligibleForCanonicalDiscoveryPoller,
} from "@/lib/growth/mission-center/growth-mission-datamoon-canonical-discovery-handoff-live-4b"
import {
  findActiveProductionBootstrapMission,
} from "@/lib/growth/mission-purpose/growth-autonomous-production-mission-bootstrap-2a"
import { getGrowthObjective, listGrowthObjectives } from "@/lib/growth/objectives/growth-objective-repository"
import { fetchGrowthAutonomySettings } from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import { fetchDatamoonAudienceImportRunById } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-repository"
import {
  findActiveAutonomousProspectSearchDatamoonRun,
  findLatestAutonomousProspectSearchDatamoonRun,
  readAutonomousProspectSearchDatamoonMetadata,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"

const PHASE = "GE-AIOS-LIVE-4B" as const
const MISSION_ID = "91eecd92-b6c4-4c3e-8fb3-eefc499e9cf6"
const ORPHAN_RUN_ID = "b61252c3-2b56-4da4-a710-7932a2d55169"

type ValidationGate = {
  id: string
  status: "pass" | "warn" | "fail" | "inconclusive"
  detail: string
}

function readOrchestratorSource(): string {
  return readFileSync(resolve("lib/growth/mission-center/growth-mission-runtime-orchestrator.ts"), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Autonomous discovery continuity production validation`)
  console.log(`QA marker: ${GROWTH_MISSION_DATAMOON_CANONICAL_DISCOVERY_HANDOFF_LIVE_4B_QA_MARKER}`)

  const gates: ValidationGate[] = []
  const orchestratorSource = readOrchestratorSource()

  gates.push({
    id: "single_polling_authority_code",
    status:
      !orchestratorSource.includes("pollDatamoonAudienceImportRun") &&
      orchestratorSource.includes("handoffMissionDatamoonDiscoveryCreationToCanonicalRuntime")
        ? "pass"
        : "fail",
    detail: "Mission orchestrator delegates to canonical discovery; no mission-side poll loop.",
  })

  gates.push({
    id: "no_duplicate_discovery_engine_code",
    status: orchestratorSource.includes("startDatamoonAudienceImportRun") ? "fail" : "pass",
    detail: "Mission orchestrator does not start DataMoon runs directly.",
  })

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    gates.push({
      id: "production_bootstrap",
      status: "fail",
      detail: "Production bootstrap unavailable — run via vercel-production-env-run.ts",
    })
    printGates(gates)
    process.exit(1)
  }

  const admin: SupabaseClient = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const generatedAt = new Date().toISOString()

  const [objectives, missionDiscovery, killSwitches, autonomy] = await Promise.all([
    listGrowthObjectives(admin, organizationId),
    loadGrowthHomeMissionDiscoverySnapshot(admin, { organizationId }),
    getRuntimeKillSwitchStates(admin),
    fetchGrowthAutonomySettings(admin, organizationId),
  ])

  const activeMission = findActiveProductionBootstrapMission(objectives)
  const mission =
    (await getGrowthObjective(admin, organizationId, MISSION_ID)) ?? activeMission ?? null
  const missionRuntime = mission?.executionContext?.missionRuntime ?? null
  const lastRunId = missionRuntime?.datamoon?.lastRunId ?? null

  gates.push({
    id: "production_mission_active",
    status: mission?.status === "active" ? "pass" : "fail",
    detail: mission
      ? `Mission ${mission.id} status=${mission.status}`
      : "Production mission not found.",
  })

  gates.push({
    id: "outbound_disabled",
    status: killSwitches.autonomy_outbound_enabled === false ? "pass" : "fail",
    detail: `autonomy_outbound_enabled=${killSwitches.autonomy_outbound_enabled}`,
  })

  const researchCapabilityOff = autonomy?.capabilityToggles.research === false
  const researchBudgetDisabled = (autonomy?.dailyBudgetLimits.autonomous_research_runs ?? 0) === 0
  gates.push({
    id: "research_policy_gate_identified",
    status: "pass",
    detail: researchCapabilityOff
      ? `Research capability toggle off; autonomous_research_runs budget=${autonomy?.dailyBudgetLimits.autonomous_research_runs ?? 0}. Separate from polling continuity — expect discover-stage block after imports.`
      : "Research capability enabled.",
  })

  let missionBoundRun = lastRunId ? await fetchDatamoonAudienceImportRunById(admin, lastRunId) : null
  const orphanRun = await fetchDatamoonAudienceImportRunById(admin, ORPHAN_RUN_ID).catch(() => null)

  if (missionBoundRun) {
    const diff = diffMissionVsPortfolioDatamoonRunMetadata({
      missionRunProviderMetadata: missionBoundRun.providerMetadata,
      portfolioRunProviderMetadata:
        (await findLatestAutonomousProspectSearchDatamoonRun(admin, organizationId))?.providerMetadata ??
        {},
    })

    gates.push({
      id: "mission_run_canonical_metadata",
      status: isDatamoonRunEligibleForCanonicalDiscoveryPoller(missionBoundRun, organizationId)
        ? "pass"
        : "warn",
      detail: isDatamoonRunEligibleForCanonicalDiscoveryPoller(missionBoundRun, organizationId)
        ? `Mission-bound run ${missionBoundRun.id} has canonical metadata (org=${readAutonomousProspectSearchDatamoonMetadata(missionBoundRun)?.organization_id}).`
        : `Mission-bound run ${missionBoundRun.id} missing canonical metadata: ${diff.missionMissingCanonicalFields.join(", ")}. Deploy LIVE-4B and next scheduler tick will enroll.`,
    })
  } else {
    gates.push({
      id: "mission_run_canonical_metadata",
      status: "warn",
      detail: "Mission has no bound DataMoon run id yet.",
    })
  }

  if (orphanRun) {
    gates.push({
      id: "orphan_run_b61252c3_metadata",
      status: isDatamoonRunEligibleForCanonicalDiscoveryPoller(orphanRun, organizationId)
        ? "pass"
        : "warn",
      detail: isDatamoonRunEligibleForCanonicalDiscoveryPoller(orphanRun, organizationId)
        ? `Orphan run ${ORPHAN_RUN_ID} enrolled in canonical lifecycle.`
        : `Orphan run ${ORPHAN_RUN_ID} status=${orphanRun.status} lastPoll=${orphanRun.lastPolledAt ?? "null"} — missing canonical metadata until LIVE-4B deploy + scheduler enroll.`,
    })
  }

  const activeCanonical = await findActiveAutonomousProspectSearchDatamoonRun(admin, organizationId)
  gates.push({
    id: "canonical_active_run_visibility",
    status: activeCanonical ? "pass" : missionBoundRun?.status === "building" ? "warn" : "pass",
    detail: activeCanonical
      ? `Portfolio poller sees active run ${activeCanonical.id} (status=${activeCanonical.status}, lastPoll=${activeCanonical.lastPolledAt ?? "null"}).`
      : missionBoundRun?.status === "building"
        ? "Building mission run exists but portfolio poller cannot see it until metadata enrollment."
        : "No active canonical run — expected when idle or between refreshes.",
  })

  if (activeCanonical?.status === "building" && activeCanonical.lastPolledAt) {
    const pollAgeMs = Date.now() - Date.parse(activeCanonical.lastPolledAt)
    gates.push({
      id: "poll_resume_not_stalled",
      status: pollAgeMs <= 30 * 60 * 1000 ? "pass" : "warn",
      detail: `Active run last polled ${Math.round(pollAgeMs / 60000)} minutes ago.`,
    })
  } else if (orphanRun?.status === "building" && orphanRun.lastPolledAt) {
    const pollAgeMs = Date.now() - Date.parse(orphanRun.lastPolledAt)
    gates.push({
      id: "poll_resume_not_stalled",
      status: "warn",
      detail: `Orphan building run last polled ${Math.round(pollAgeMs / 60000)} minutes ago — continuity repair required.`,
    })
  } else {
    gates.push({
      id: "poll_resume_not_stalled",
      status: "pass",
      detail: "No active building run requiring poll resume at validation time.",
    })
  }

  gates.push({
    id: "mission_discovery_projection",
    status: missionDiscovery?.lifecycleState === "finding_leads" ? "pass" : "warn",
    detail: `Home mission lifecycle=${missionDiscovery?.lifecycleState ?? "unknown"} recordsImported=${missionDiscovery?.recordsImported ?? 0}`,
  })

  gates.push({
    id: "mission_counters",
    status: "pass",
    detail: `recordsImported=${missionDiscovery?.recordsImported ?? 0} newCompaniesFound=${missionDiscovery?.newCompaniesFound ?? 0} generatedAt=${generatedAt}`,
  })

  printGates(gates)

  const failures = gates.filter((g) => g.status === "fail")
  if (failures.length > 0) {
    process.exit(1)
  }
}

function printGates(gates: ValidationGate[]): void {
  for (const gate of gates) {
    console.log(`[${gate.status.toUpperCase()}] ${gate.id}: ${gate.detail}`)
  }
  const passed = gates.filter((g) => g.status === "pass").length
  console.log(`\n[${PHASE}] ${passed}/${gates.length} gates passed`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
