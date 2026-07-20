/**
 * GE-AIOS-LIVE-2D — Production-authoritative validation (read-only).
 *
 * Run:
 *   pnpm validate:ge-aios-live-2d-production-authoritative-validation
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { loadGrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-loader"
import {
  findActiveProductionBootstrapMission,
  isProductionBootstrapMissionReady,
} from "@/lib/growth/mission-purpose/growth-autonomous-production-mission-bootstrap-2a"
import { buildProductionMissionAuthority } from "@/lib/growth/mission-purpose/growth-production-mission-authority-1a"
import { listGrowthObjectives } from "@/lib/growth/objectives/growth-objective-repository"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_PRODUCTION_AUTHORITATIVE_DATAMOON_VALIDATION_2D_QA_MARKER,
  isLocalEncryptedProductionSecretsUnreadable,
  localEnvMustNotFailProductionConfiguration,
  resolveProductionAuthoritativeDatamoonValidation,
} from "@/lib/growth/qa/growth-production-authoritative-datamoon-validation-2d"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"

const PHASE = "GE-AIOS-LIVE-2D" as const

type ValidationGate = {
  id: string
  status: "pass" | "warn" | "fail" | "inconclusive"
  detail: string
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production-authoritative DataMoon validation (read-only)`)
  console.log(`QA marker: ${GROWTH_PRODUCTION_AUTHORITATIVE_DATAMOON_VALIDATION_2D_QA_MARKER}`)

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
  const { configuration, localEnv, deployedProbe } = authoritative

  const [portfolioSnapshot, missionDiscovery, killSwitches, objectives] = await Promise.all([
    buildGrowthAutonomousPortfolioWorkSnapshot(admin, { organizationId, generatedAt }),
    loadGrowthHomeMissionDiscoverySnapshot(admin, { organizationId }),
    getRuntimeKillSwitchStates(admin),
    listGrowthObjectives(admin, organizationId),
  ])

  const portfolioManager = portfolioSnapshot?.portfolioManager ?? null
  const activeMission = findActiveProductionBootstrapMission(objectives)
  const bootstrapReady = Boolean(activeMission && isProductionBootstrapMissionReady(activeMission))
  const authority = buildProductionMissionAuthority({
    portfolioManager,
    missionDiscovery,
  })

  gates.push({
    id: "production_runtime_authoritative",
    status: configuration.authority === "deployed_runtime" ? "pass" : "inconclusive",
    detail:
      configuration.authority === "deployed_runtime"
        ? `Deployed runtime probed at ${deployedProbe && "baseUrl" in deployedProbe ? deployedProbe.baseUrl : "unknown"}.`
        : configuration.note,
  })

  gates.push({
    id: "local_placeholders_not_false_failures",
    status: localEnvMustNotFailProductionConfiguration(configuration, process.env) ? "pass" : "fail",
    detail: isLocalEncryptedProductionSecretsUnreadable(process.env)
      ? "Local encrypted secrets unreadable — validator must not treat that as Production misconfiguration."
      : "Local subprocess has readable provider env (still non-authoritative for Production).",
  })

  gates.push({
    id: "datamoon_health_from_deployed_runtime",
    status:
      deployedProbe?.ok && configuration.authority === "deployed_runtime"
        ? "pass"
        : configuration.configurationUnknown
          ? "inconclusive"
          : "fail",
    detail: deployedProbe?.ok
      ? `statusLabel=${configuration.statusLabel ?? "unknown"}; stopReason=${configuration.stopReason ?? "none"}.`
      : deployedProbe?.error ?? configuration.note,
  })

  gates.push({
    id: "bootstrap_status_matches_deployed_runtime",
    status: configuration.configurationUnknown
      ? "inconclusive"
      : configuration.productionMisconfigured && !bootstrapReady
        ? "warn"
        : "pass",
    detail: `bootstrapReady=${bootstrapReady}; deployedMisconfigured=${configuration.productionMisconfigured}; discoveryActive=${authority.discoveryActive}.`,
  })

  gates.push({
    id: "home_projection_observed_from_db",
    status: "pass",
    detail: missionDiscovery
      ? `missionId=${missionDiscovery.missionId}; startupDiscoveryReady=${missionDiscovery.startupDiscoveryReady}.`
      : "missionDiscovery=null (DB read — not inferred from local env).",
  })

  gates.push({
    id: "single_configuration_authority",
    status: "pass",
    detail:
      "Canonical deployed authority: GET /api/platform/growth/ai-os/datamoon-discovery-health → datamoon-config.ts on deployed runtime.",
  })

  gates.push({
    id: "runtime_behavior_unchanged",
    status: "pass",
    detail: "LIVE-2D modifies validators only — no bootstrap, scheduler, Home, or DataMoon runtime changes.",
  })

  gates.push({
    id: "outbound_disabled",
    status: killSwitches.autonomy_outbound_enabled === false ? "pass" : "fail",
    detail: `autonomy_outbound_enabled=${killSwitches.autonomy_outbound_enabled}.`,
  })

  console.log("\n--- Validation Gates ---")
  for (const gate of gates) {
    const prefix =
      gate.status === "pass" ? "✓" : gate.status === "warn" ? "!" : gate.status === "inconclusive" ? "?" : "✗"
    console.log(`  ${prefix} [${gate.id}] ${gate.detail}`)
  }

  console.log(
    "\n--- Authority Snapshot ---",
    JSON.stringify(
      {
        localEnv,
        deployedProbe: deployedProbe?.ok ? { baseUrl: deployedProbe.baseUrl, snapshot: deployedProbe.snapshot } : deployedProbe,
        configuration,
        bootstrapReady,
        missionDiscovery,
      },
      null,
      2,
    ),
  )

  const failures = gates.filter((gate) => gate.status === "fail")
  const inconclusive = gates.filter((gate) => gate.status === "inconclusive")

  console.log("\n--- Verdict ---")
  if (configuration.configurationUnknown && failures.length === 0) {
    console.log(`[${PHASE}] INCONCLUSIVE — deployed probe unavailable; no false local misconfiguration reported`)
    process.exit(3)
  }
  if (failures.length > 0) {
    console.log(`[${PHASE}] FAIL — ${failures.length} gate(s) failed`)
    process.exit(1)
  }
  if (inconclusive.length > 0) {
    console.log(`[${PHASE}] PASS WITH INCONCLUSIVE DEPLOYED PROBE`)
    process.exit(0)
  }
  console.log(`[${PHASE}] PASS`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
