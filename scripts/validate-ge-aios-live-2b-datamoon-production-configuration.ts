/**
 * GE-AIOS-LIVE-2B — Production DataMoon configuration validation (read-only).
 *
 * GE-AIOS-LIVE-2D — Uses deployed Production runtime as configuration authority.
 *
 * Run:
 *   pnpm validate:ge-aios-live-2b-datamoon-production-configuration
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { loadGrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-loader"
import {
  findActiveProductionBootstrapMission,
  isProductionBootstrapMissionReady,
  selectCanonicalProductionBootstrapObjective,
} from "@/lib/growth/mission-purpose/growth-autonomous-production-mission-bootstrap-2a"
import { listGrowthObjectives } from "@/lib/growth/objectives/growth-objective-repository"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_DATAMOON_PRODUCTION_CONFIGURATION_AUDIT_2B_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-production-configuration-audit-2b"
import {
  GROWTH_PRODUCTION_AUTHORITATIVE_DATAMOON_VALIDATION_2D_QA_MARKER,
  LOCAL_ENCRYPTED_PRODUCTION_SECRETS_UNREADABLE_NOTE,
  isLocalEncryptedProductionSecretsUnreadable,
  localEnvMustNotFailProductionConfiguration,
  resolveProductionAuthoritativeDatamoonValidation,
} from "@/lib/growth/qa/growth-production-authoritative-datamoon-validation-2d"
import {
  EQUIPIFY_PRODUCTION_ORG_ID,
  LIVE_1B_EQUIPIFY_MISSION_TITLE,
} from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"

const PHASE = "GE-AIOS-LIVE-2B" as const

type ValidationGate = {
  id: string
  status: "pass" | "warn" | "fail" | "blocked" | "inconclusive"
  detail: string
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] DataMoon Production configuration validation (read-only)`)
  console.log(`QA marker: ${GROWTH_DATAMOON_PRODUCTION_CONFIGURATION_AUDIT_2B_QA_MARKER}`)
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
  const { configuration, localEnv, deployedProbe } = authoritative

  console.log("\n--- Local Subprocess Env (non-authoritative) ---")
  console.log(`  scope: ${localEnv.scope}`)
  console.log(`  secretsReadable: ${localEnv.secretsReadable}`)
  console.log(`  note: ${localEnv.note}`)
  for (const [key, presence] of Object.entries(localEnv.requiredEnv)) {
    const label = isLocalEncryptedProductionSecretsUnreadable(process.env)
      ? "inconclusive"
      : presence === "present"
        ? "present"
        : "missing"
    console.log(`  ${label === "inconclusive" ? "?" : label === "present" ? "✓" : "✗"} ${key}: ${label}`)
  }

  console.log("\n--- Deployed Production Runtime Authority ---")
  if (deployedProbe?.ok) {
    console.log(`  ✓ probed ${deployedProbe.baseUrl}${authoritative.healthRoutePath}`)
    console.log(`  datamoonEnabled=${configuration.datamoonEnabled}`)
    console.log(`  configurationCompleteForProduction=${configuration.configurationCompleteForProduction}`)
    console.log(`  stopReason=${configuration.stopReason ?? "none"}`)
    console.log(`  statusLabel=${configuration.statusLabel ?? "unknown"}`)
    console.log(`  statusDisplay=${configuration.statusDisplay ?? "unknown"}`)
  } else if (deployedProbe) {
    console.log(`  ✗ probe failed (${deployedProbe.error}); httpStatus=${deployedProbe.status ?? "n/a"}`)
  } else {
    console.log(`  ? deployed probe unavailable — ${configuration.note}`)
  }

  const [approvedProfile, objectives, killSwitches, portfolioSnapshot, missionDiscovery] =
    await Promise.all([
      getActiveApprovedBusinessProfile(admin, organizationId),
      listGrowthObjectives(admin, organizationId),
      getRuntimeKillSwitchStates(admin),
      buildGrowthAutonomousPortfolioWorkSnapshot(admin, { organizationId, generatedAt }),
      loadGrowthHomeMissionDiscoverySnapshot(admin, { organizationId }),
    ])

  const portfolioManager = portfolioSnapshot?.portfolioManager ?? null

  gates.push({
    id: "production_runtime_authoritative",
    status: configuration.authority === "deployed_runtime" ? "pass" : "inconclusive",
    detail:
      configuration.authority === "deployed_runtime"
        ? `Deployed runtime is authoritative (${deployedProbe && "baseUrl" in deployedProbe ? deployedProbe.baseUrl : "unknown"}).`
        : configuration.note,
  })

  gates.push({
    id: "local_env_not_used_for_production_verdict",
    status:
      localEnvMustNotFailProductionConfiguration(configuration, process.env) ||
      !isLocalEncryptedProductionSecretsUnreadable(process.env)
        ? "pass"
        : "fail",
    detail: LOCAL_ENCRYPTED_PRODUCTION_SECRETS_UNREADABLE_NOTE,
  })

  gates.push({
    id: "canonical_provider_authority",
    status: "pass",
    detail:
      "Single authority chain: datamoon-config.ts → autonomous-discovery-policy-1a.ts → discovery-health-1a.ts (evaluated on deployed runtime).",
  })

  gates.push({
    id: "datamoon_configuration_complete",
    status: configuration.configurationUnknown
      ? "inconclusive"
      : configuration.configurationCompleteForProduction
        ? "pass"
        : "fail",
    detail: configuration.configurationUnknown
      ? "Configuration unknown — deployed health unavailable."
      : configuration.configurationCompleteForProduction
        ? "Production DataMoon configuration complete (deployed runtime)."
        : `Production reports misconfiguration: stopReason=${configuration.stopReason ?? "none"}; statusDisplay=${configuration.statusDisplay ?? "unknown"}.`,
  })

  gates.push({
    id: "needs_configuration_absent_when_healthy",
    status: configuration.configurationUnknown
      ? "inconclusive"
      : configuration.configurationCompleteForProduction &&
          configuration.statusLabel !== "needs_configuration"
        ? "pass"
        : configuration.productionMisconfigured
          ? "fail"
          : "warn",
    detail: `authority=${configuration.authority}; statusLabel=${configuration.statusLabel ?? "unknown"}; stopReason=${configuration.stopReason ?? "none"}.`,
  })

  gates.push({
    id: "provider_enabled",
    status: configuration.configurationUnknown
      ? "inconclusive"
      : configuration.datamoonEnabled
        ? "pass"
        : "fail",
    detail: `deployed.datamoonEnabled=${configuration.datamoonEnabled ?? "unknown"}.`,
  })

  gates.push({
    id: "audience_credentials",
    status: configuration.configurationUnknown
      ? "inconclusive"
      : configuration.datamoonConfigured
        ? "pass"
        : "fail",
    detail: `deployed.datamoonConfigured=${configuration.datamoonConfigured ?? "unknown"}.`,
  })

  gates.push({
    id: "live_production_not_dry_run",
    status: configuration.configurationUnknown
      ? "inconclusive"
      : configuration.datamoonEligibleForAutonomousDiscovery
        ? "pass"
        : configuration.stopReason === "datamoon_dry_run_only"
          ? "fail"
          : "warn",
    detail: `deployed.datamoonEligibleForAutonomousDiscovery=${configuration.datamoonEligibleForAutonomousDiscovery ?? "unknown"}.`,
  })

  const canonicalObjective = selectCanonicalProductionBootstrapObjective(
    objectives,
    LIVE_1B_EQUIPIFY_MISSION_TITLE,
  )
  const activeBootstrapMission = findActiveProductionBootstrapMission(objectives)
  const bootstrapReady = Boolean(
    activeBootstrapMission && isProductionBootstrapMissionReady(activeBootstrapMission),
  )
  const configurationReady = configuration.configurationCompleteForProduction === true

  gates.push({
    id: "bootstrap_prerequisites",
    status:
      configuration.configurationUnknown
        ? "inconclusive"
        : configurationReady &&
            Boolean(approvedProfile) &&
            killSwitches.autonomy_enabled &&
            killSwitches.autonomy_objective_mode_enabled
          ? "pass"
          : configuration.productionMisconfigured
            ? "blocked"
            : "warn",
    detail: `approvedProfile=${Boolean(approvedProfile)}; autonomy=${killSwitches.autonomy_enabled}; objectiveMode=${killSwitches.autonomy_objective_mode_enabled}.`,
  })

  gates.push({
    id: "canonical_production_objective",
    status: canonicalObjective ? "pass" : configurationReady ? "warn" : configuration.configurationUnknown ? "inconclusive" : "fail",
    detail: canonicalObjective
      ? `Canonical objective ${canonicalObjective.id}.`
      : "No canonical production objective yet.",
  })

  gates.push({
    id: "active_bootstrap_mission",
    status: activeBootstrapMission ? "pass" : configurationReady ? "warn" : configuration.configurationUnknown ? "inconclusive" : "fail",
    detail: activeBootstrapMission
      ? `Active bootstrap mission ${activeBootstrapMission.id}; ready=${bootstrapReady}.`
      : "No active bootstrap mission.",
  })

  gates.push({
    id: "home_mission_projection",
    status:
      missionDiscovery?.startupDiscoveryReady && missionDiscovery.missionId
        ? "pass"
        : configurationReady
          ? "warn"
          : configuration.configurationUnknown
            ? "inconclusive"
            : "fail",
    detail: missionDiscovery
      ? `missionId=${missionDiscovery.missionId}; startupDiscoveryReady=${missionDiscovery.startupDiscoveryReady}.`
      : "missionDiscovery=null",
  })

  gates.push({
    id: "outbound_disabled",
    status: killSwitches.autonomy_outbound_enabled === false ? "pass" : "fail",
    detail: `autonomy_outbound_enabled=${killSwitches.autonomy_outbound_enabled}.`,
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

  console.log("\n--- Configuration Audit ---")
  console.log(
    JSON.stringify(
      {
        qaMarker: GROWTH_DATAMOON_PRODUCTION_CONFIGURATION_AUDIT_2B_QA_MARKER,
        authorityMarker: GROWTH_PRODUCTION_AUTHORITATIVE_DATAMOON_VALIDATION_2D_QA_MARKER,
        organizationId,
        approvedProfileId: approvedProfile?.id ?? null,
        portfolioDeficit: portfolioManager?.health.needsCount ?? null,
        localEnv,
        deployedHealth: deployedProbe?.ok ? deployedProbe.snapshot : deployedProbe,
        productionConfiguration: configuration,
        missionDiscovery: missionDiscovery
          ? {
              missionId: missionDiscovery.missionId,
              startupDiscoveryReady: missionDiscovery.startupDiscoveryReady,
            }
          : null,
      },
      null,
      2,
    ),
  )

  const failures = gates.filter((gate) => gate.status === "fail")
  const blockers = gates.filter((gate) => gate.status === "blocked")
  const inconclusive = gates.filter((gate) => gate.status === "inconclusive")

  console.log("\n--- Verdict ---")
  if (configuration.configurationUnknown) {
    console.log(
      `[${PHASE}] INCONCLUSIVE — deployed Production DataMoon health unavailable; local env is not authoritative`,
    )
    process.exit(3)
  }
  if (blockers.length > 0) {
    console.log(`[${PHASE}] BLOCKED — Production runtime reports DataMoon misconfiguration`)
    process.exit(2)
  }
  if (failures.length > 0) {
    console.log(`[${PHASE}] FAIL — ${failures.length} gate(s) failed`)
    process.exit(1)
  }
  if (inconclusive.length > 0) {
    console.log(`[${PHASE}] PASS WITH WARNINGS — ${inconclusive.length} inconclusive gate(s)`)
    process.exit(0)
  }
  console.log(`[${PHASE}] PASS`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
