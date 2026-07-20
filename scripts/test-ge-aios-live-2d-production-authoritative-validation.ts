/**
 * GE-AIOS-LIVE-2D — Production-authoritative DataMoon validation certification (local).
 *
 * Run:
 *   pnpm test:ge-aios-live-2d-production-authoritative-validation
 */
import assert from "node:assert/strict"
import {
  buildInconclusiveProductionDatamoonConfiguration,
  GROWTH_PRODUCTION_AUTHORITATIVE_DATAMOON_VALIDATION_2D_QA_MARKER,
  interpretDeployedDatamoonDiscoveryHealthSnapshot,
  isLocalEncryptedProductionSecretsUnreadable,
  localEnvMustNotFailProductionConfiguration,
} from "@/lib/growth/qa/growth-production-authoritative-datamoon-validation-2d"
import { GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import { GROWTH_DATAMOON_DISCOVERY_HEALTH_ROUTE_PATH } from "@/lib/growth/qa/growth-datamoon-discovery-health-deployed-probe"

const PHASE = "GE-AIOS-LIVE-2D" as const

function baseSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
    organizationResolved: true,
    approvedBusinessProfilePresent: true,
    datamoonImplemented: true,
    datamoonConfigured: true,
    datamoonEnabled: true,
    datamoonBudgetAvailable: true,
    datamoonEligibleForAutonomousDiscovery: true,
    prospectSearchRoutesToDatamoon: true,
    fixtureFallbackBlockedInProduction: true,
    otherAutonomousProvidersDisabled: true,
    configurationCompleteForProduction: true,
    stopReason: null,
    statusLabel: "idle",
    statusDisplay: "Idle",
    ...overrides,
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production-authoritative DataMoon validation certification`)

  const unreadableEnv = {
    EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN: "1",
    VERCEL_ENV: "production",
    NODE_ENV: "production",
  } as NodeJS.ProcessEnv

  assert.equal(isLocalEncryptedProductionSecretsUnreadable(unreadableEnv), true)
  console.log("  ✓ local vercel env run with missing encrypted secrets is unreadable")

  const inconclusive = buildInconclusiveProductionDatamoonConfiguration()
  assert.equal(inconclusive.configurationUnknown, true)
  assert.equal(inconclusive.productionMisconfigured, false)
  assert.equal(
    localEnvMustNotFailProductionConfiguration(inconclusive, unreadableEnv),
    true,
  )
  console.log("  ✓ encrypted local placeholders never produce false Production misconfiguration failures")

  const healthy = interpretDeployedDatamoonDiscoveryHealthSnapshot(baseSnapshot())
  assert.equal(healthy.authority, "deployed_runtime")
  assert.equal(healthy.configurationCompleteForProduction, true)
  assert.equal(healthy.productionMisconfigured, false)
  console.log("  ✓ deployed healthy snapshot is authoritative and not misconfigured")

  const disabled = interpretDeployedDatamoonDiscoveryHealthSnapshot(
    baseSnapshot({
      ok: false,
      datamoonEnabled: false,
      datamoonConfigured: false,
      datamoonEligibleForAutonomousDiscovery: false,
      configurationCompleteForProduction: false,
      stopReason: "datamoon_disabled",
      statusLabel: "needs_configuration",
      statusDisplay: "DataMoon is disabled for this environment.",
    }),
  )
  assert.equal(disabled.productionMisconfigured, true)
  assert.equal(disabled.stopReason, "datamoon_disabled")
  console.log("  ✓ deployed disabled snapshot reports true Production misconfiguration")

  assert.equal(
    GROWTH_DATAMOON_DISCOVERY_HEALTH_ROUTE_PATH,
    "/api/platform/growth/ai-os/datamoon-discovery-health",
  )
  console.log("  ✓ reuses existing authenticated DataMoon health endpoint (no duplicate endpoint)")

  assert.equal(
    GROWTH_PRODUCTION_AUTHORITATIVE_DATAMOON_VALIDATION_2D_QA_MARKER,
    "ge-aios-live-2d-production-authoritative-datamoon-validation-v1",
  )
  console.log("  ✓ LIVE-2D QA marker present")

  console.log(`[${PHASE}] PASS`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
