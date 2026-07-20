/**
 * GE-AIOS-LIVE-2B — DataMoon Production configuration authority certification (local).
 *
 * Run:
 *   pnpm test:ge-aios-live-2b-datamoon-production-configuration
 */
import assert from "node:assert/strict"
import {
  auditDatamoonProductionEnvPresence,
  buildDatamoonProductionConfigurationAudit,
  GROWTH_DATAMOON_PRODUCTION_CONFIGURATION_AUDIT_2B_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-production-configuration-audit-2b"
import {
  autonomousDiscoveryStopReasonMessage,
  evaluateAutonomousProspectDiscoveryProviderPolicy,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-policy-1a"
import { buildDatamoonAutonomousDiscoveryOperatorState } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-operator-1a"
import { evaluateProductionMissionBootstrapRequirement } from "@/lib/growth/mission-purpose/growth-autonomous-production-mission-bootstrap-2a"

const PHASE = "GE-AIOS-LIVE-2B" as const

async function main(): Promise<void> {
  console.log(`[${PHASE}] DataMoon Production configuration authority certification`)

  const disabledEnv = {
    NODE_ENV: "production",
    VERCEL_ENV: "production",
    DATAMOON_PROVIDER_ENABLED: undefined,
  } as NodeJS.ProcessEnv

  const disabledAudit = buildDatamoonProductionConfigurationAudit({
    env: disabledEnv,
    approvedBusinessProfilePresent: true,
  })

  assert.equal(disabledAudit.stopReason, "datamoon_disabled")
  assert.equal(disabledAudit.statusLabel, "needs_configuration")
  assert.equal(disabledAudit.statusDisplay, autonomousDiscoveryStopReasonMessage("datamoon_disabled"))
  assert.match(disabledAudit.statusDisplay, /disabled for this environment/i)
  assert.equal(disabledAudit.configurationCompleteForProduction, false)
  assert.equal(disabledAudit.requiredEnv.DATAMOON_PROVIDER_ENABLED, "missing")
  console.log("  ✓ needs_configuration + disabled message originates from datamoon_disabled policy")

  const unconfiguredEnv = {
    NODE_ENV: "production",
    VERCEL_ENV: "production",
    DATAMOON_PROVIDER_ENABLED: "true",
    DATAMOON_DRY_RUN_ONLY: "false",
  } as NodeJS.ProcessEnv

  const unconfiguredAudit = buildDatamoonProductionConfigurationAudit({
    env: unconfiguredEnv,
    approvedBusinessProfilePresent: true,
  })
  assert.equal(unconfiguredAudit.stopReason, "datamoon_not_configured")
  assert.equal(unconfiguredAudit.statusLabel, "needs_configuration")
  console.log("  ✓ missing audience key maps to datamoon_not_configured")

  const liveEnv = {
    NODE_ENV: "production",
    VERCEL_ENV: "production",
    DATAMOON_PROVIDER_ENABLED: "true",
    DATAMOON_DRY_RUN_ONLY: "false",
    DATAMOON_DEFAULT_MODE: "ext",
    DATAMOON_AUDIENCE_EXT_API_KEY: "present-but-redacted-in-audit",
  } as NodeJS.ProcessEnv

  const liveAudit = buildDatamoonProductionConfigurationAudit({
    env: liveEnv,
    approvedBusinessProfilePresent: true,
  })
  assert.equal(liveAudit.stopReason, null)
  assert.equal(liveAudit.statusLabel, "idle")
  assert.equal(liveAudit.configurationCompleteForProduction, true)
  assert.equal(liveAudit.eligibleForAutonomousDiscovery, true)
  console.log("  ✓ complete Production configuration resolves to healthy idle state")

  const policy = evaluateAutonomousProspectDiscoveryProviderPolicy({
    authority: "autonomous_portfolio",
    env: disabledEnv,
  })
  const operator = buildDatamoonAutonomousDiscoveryOperatorState({ policy })
  assert.equal(operator.statusLabel, disabledAudit.statusLabel)
  assert.equal(operator.statusDisplay, disabledAudit.statusDisplay)
  console.log("  ✓ health endpoint and operator projection share one policy authority")

  const bootstrapRequired = evaluateProductionMissionBootstrapRequirement({
    approvedProfilePresent: true,
    portfolioHealth: {
      needsCount: 98,
      approvedProfilePresent: true,
      healthState: "needs_replenishment",
    } as never,
    autonomyEnabled: true,
    objectiveModeEnabled: true,
    activeProductionMission: null,
    bootstrapMissionReady: false,
  })
  assert.equal(bootstrapRequired.required, true)
  assert.equal(bootstrapRequired.portfolioDeficit, 98)
  console.log("  ✓ bootstrap requirement independent of DataMoon until configuration gate")

  const envPresence = auditDatamoonProductionEnvPresence(disabledEnv)
  assert.equal(envPresence.DATAMOON_PROVIDER_ENABLED, "missing")
  assert.equal(envPresence.DATAMOON_AUDIENCE_EXT_API_KEY, "missing")
  console.log("  ✓ env audit reports present/missing without exposing secret values")

  assert.equal(
    GROWTH_DATAMOON_PRODUCTION_CONFIGURATION_AUDIT_2B_QA_MARKER.includes("live-2b"),
    true,
  )
  console.log("  ✓ LIVE-2B QA marker present")

  console.log(`[${PHASE}] PASS`)
}

void main()
