/**
 * Regression checks for Growth operational send plane milestone (v1).
 * Run: pnpm test:growth-operational-send-plane
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_CRON_EXECUTION_TELEMETRY_MIGRATION } from "../lib/growth/runtime/cron-telemetry-repository"
import {
  GROWTH_CRON_ROUTE_IDS,
  GROWTH_CRON_TELEMETRY_QA_MARKER,
  growthCronApiPath,
} from "../lib/growth/runtime/cron-telemetry-types"
import { GROWTH_INFRASTRUCTURE_READINESS_QA_MARKER } from "../lib/growth/infrastructure/infrastructure-readiness-types"
import {
  collectGrowthRuntimeDiagnostics,
  isGrowthTransportSimulationEnabled,
} from "../lib/growth/runtime/runtime-guards"
import { DEV_FALLBACK_CREDENTIAL_PEPPER, isUsingDevFallbackCredentialPepper } from "../lib/growth/outbound/credentials-crypto"

async function main(): Promise<void> {
  assert.equal(GROWTH_CRON_TELEMETRY_QA_MARKER, "growth-operational-send-plane-v1")
  assert.equal(GROWTH_INFRASTRUCTURE_READINESS_QA_MARKER, "growth-internal-outbound-ops-v1")
  assert.equal(GROWTH_CRON_ROUTE_IDS.length, 14)

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_CRON_EXECUTION_TELEMETRY_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /growth\.cron_execution_runs/)

  const vercel = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
    crons: Array<{ path: string }>
  }
  for (const routeId of GROWTH_CRON_ROUTE_IDS) {
    const apiPath = growthCronApiPath(routeId)
    assert.ok(
      vercel.crons.some((cron) => cron.path === apiPath),
      `missing vercel cron registration for ${apiPath}`,
    )
    assert.ok(
      fs.existsSync(path.join(process.cwd(), `app/api/cron/${routeId}/route.ts`)),
      `missing cron route file for ${routeId}`,
    )
  }

  const cronRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/cron/growth-outreach-execute/route.ts"),
    "utf8",
  )
  assert.match(cronRoute, /runGrowthCronJob/)
  assert.match(cronRoute, /growth-cron-runner/)
  assert.match(cronRoute, /export async function GET/)

  const transport = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/providers/transport/transport-orchestrator.ts"),
    "utf8",
  )
  assert.match(transport, /assertPreSendAllowed/)
  assert.match(transport, /assertGrowthProductionRuntimeSafe/)

  const preSend = fs.readFileSync(path.join(process.cwd(), "lib/growth/compliance/pre-send-assertion.ts"), "utf8")
  assert.match(preSend, /growth-internal-outbound-ops-v1|GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER/)
  assert.match(preSend, /evaluatePreSendSuppression/)
  assert.match(preSend, /isEmailSuppressed/)

  const readiness = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/infrastructure/infrastructure-readiness.ts"),
    "utf8",
  )
  assert.match(readiness, /buildGrowthInfrastructureReadinessCatalog/)
  assert.match(readiness, /resolveTransportSendReadiness/)

  const opsPage = fs.readFileSync(
    path.join(process.cwd(), "app/(admin)/admin/growth/operations/outbound/page.tsx"),
    "utf8",
  )
  assert.match(opsPage, /GROWTH_CRON_TELEMETRY_QA_MARKER/)
  assert.match(opsPage, /data-qa-marker/)

  const previousSim = process.env.GROWTH_TRANSPORT_SIMULATE
  process.env.GROWTH_TRANSPORT_SIMULATE = "true"
  assert.equal(isGrowthTransportSimulationEnabled(), true)
  if (previousSim) process.env.GROWTH_TRANSPORT_SIMULATE = previousSim
  else delete process.env.GROWTH_TRANSPORT_SIMULATE

  assert.equal(typeof isUsingDevFallbackCredentialPepper(), "boolean")
  assert.equal(DEV_FALLBACK_CREDENTIAL_PEPPER, "growth_provider_credentials_pepper_dev_only")

  const diagnostics = collectGrowthRuntimeDiagnostics()
  assert.ok(Array.isArray(diagnostics.violations))
  assert.ok(Array.isArray(diagnostics.warnings))

  const activation = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/operations/outbound-execution-activation.ts"),
    "utf8",
  )
  assert.match(activation, /resolveOutboundExecutionActivationState/)
  assert.match(activation, /GROWTH_OUTBOUND_SETUP_AWARE_ALERTS_QA_MARKER/)

  const cronHealthAlerts = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/operations/outbound-queue-health-alerts.ts"),
    "utf8",
  )
  assert.match(cronHealthAlerts, /alert_kind: "setup"/)
  assert.match(cronHealthAlerts, /alert_kind === "setup"/)

  const outboundUi = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-outbound-operations-dashboard.tsx"),
    "utf8",
  )
  assert.match(outboundUi, /GROWTH_OUTBOUND_CRON_HEALTH_V2_QA_MARKER/)
  assert.match(outboundUi, /GROWTH_OUTBOUND_SETUP_AWARE_ALERTS_QA_MARKER/)

  console.log("growth operational send plane tests passed")
}

void main()
