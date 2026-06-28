/**
 * Regression checks for Growth operational send plane milestone (v1).
 * Run: pnpm test:growth-operational-send-plane
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_CRON_EXECUTION_TELEMETRY_GRANTS_MIGRATION, GROWTH_CRON_EXECUTION_TELEMETRY_MIGRATION } from "../lib/growth/runtime/cron-telemetry-repository"
import {
  GROWTH_CRON_ROUTE_IDS,
  GROWTH_CRON_ROUTES_RETIRED_FROM_VERCEL,
  GROWTH_CRON_TELEMETRY_QA_MARKER,
  growthCronApiPath,
  type GrowthCronRouteId,
} from "../lib/growth/runtime/cron-telemetry-types"
import { GROWTH_INFRASTRUCTURE_READINESS_QA_MARKER } from "../lib/growth/infrastructure/infrastructure-readiness-types"
import {
  collectGrowthRuntimeDiagnostics,
  isGrowthTransportSimulationEnabled,
} from "../lib/growth/runtime/runtime-guards"
import { DEV_FALLBACK_CREDENTIAL_PEPPER, isUsingDevFallbackCredentialPepper } from "../lib/growth/outbound/credentials-crypto"

/** Handlers registered in telemetry; Vercel schedule is added at deploy time. */
const CRON_ROUTES_PENDING_VERCEL_SCHEDULE = [] as const satisfies readonly GrowthCronRouteId[]

/**
 * Growth crons scheduled in vercel.json but certified under runtime guardrails (GS-RG-1),
 * not the operational send-plane telemetry registry.
 */
const GROWTH_CRON_ROUTES_CERTIFIED_OUTSIDE_SEND_PLANE_REGISTRY = ["growth-event-retention"] as const

async function main(): Promise<void> {
  assert.equal(GROWTH_CRON_TELEMETRY_QA_MARKER, "growth-operational-send-plane-v1")
  assert.equal(GROWTH_INFRASTRUCTURE_READINESS_QA_MARKER, "growth-internal-outbound-ops-v1")

  assert.ok(GROWTH_CRON_ROUTE_IDS.length > 0, "growth cron registry must not be empty")
  assert.equal(
    new Set(GROWTH_CRON_ROUTE_IDS).size,
    GROWTH_CRON_ROUTE_IDS.length,
    "growth cron registry ids must be unique",
  )

  const vercel = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
    crons: Array<{ path: string }>
  }
  const vercelCronPaths = new Set(vercel.crons.map((cron) => cron.path))
  const exemptFromVercelSchedule = new Set<string>([
    ...(GROWTH_CRON_ROUTES_RETIRED_FROM_VERCEL as readonly string[]),
    ...CRON_ROUTES_PENDING_VERCEL_SCHEDULE,
  ])

  for (const routeId of GROWTH_CRON_ROUTE_IDS) {
    const apiPath = growthCronApiPath(routeId)
    assert.ok(
      fs.existsSync(path.join(process.cwd(), `app/api/cron/${routeId}/route.ts`)),
      `missing cron route file for ${routeId}`,
    )
    if (!exemptFromVercelSchedule.has(routeId)) {
      assert.ok(
        vercelCronPaths.has(apiPath),
        `missing vercel cron registration for ${apiPath}`,
      )
    }
  }

  const expectedVercelScheduledCount = GROWTH_CRON_ROUTE_IDS.length - exemptFromVercelSchedule.size
  const registeredInVercelCount = GROWTH_CRON_ROUTE_IDS.filter(
    (routeId) => !exemptFromVercelSchedule.has(routeId) && vercelCronPaths.has(growthCronApiPath(routeId)),
  ).length
  assert.equal(
    registeredInVercelCount,
    expectedVercelScheduledCount,
    "every non-exempt growth cron registry route must be scheduled in vercel.json",
  )

  for (const apiPath of vercelCronPaths) {
    if (!apiPath.startsWith("/api/cron/growth-")) continue
    const routeId = apiPath.replace("/api/cron/", "")
    if (
      (GROWTH_CRON_ROUTES_CERTIFIED_OUTSIDE_SEND_PLANE_REGISTRY as readonly string[]).includes(routeId)
    ) {
      assert.ok(
        fs.existsSync(path.join(process.cwd(), `app/api/cron/${routeId}/route.ts`)),
        `missing cron route file for ${routeId}`,
      )
      continue
    }
    assert.ok(
      GROWTH_CRON_ROUTE_IDS.some((registeredRouteId) => growthCronApiPath(registeredRouteId) === apiPath),
      `vercel cron ${apiPath} must be registered in GROWTH_CRON_ROUTE_IDS`,
    )
  }

  const eventRetentionRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/cron/growth-event-retention/route.ts"),
    "utf8",
  )
  assert.match(eventRetentionRoute, /runAllEventRetentionBatches/)
  assert.match(eventRetentionRoute, /runGrowthCronJob/)

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_CRON_EXECUTION_TELEMETRY_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /growth\.cron_execution_runs/)

  const grantsMigration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_CRON_EXECUTION_TELEMETRY_GRANTS_MIGRATION}`),
    "utf8",
  )
  assert.match(
    grantsMigration,
    /grant select, insert, update, delete on table growth\.cron_execution_runs to service_role/,
  )

  const cronRunner = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/runtime/growth-cron-runner.ts"),
    "utf8",
  )
  assert.match(cronRunner, /telemetry persist skipped/)

  const cronRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/cron/growth-outreach-execute/route.ts"),
    "utf8",
  )
  assert.match(cronRoute, /isGrowthOutreachExecuteCronEnabled/)
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

  const preSendOrder = preSend.indexOf("evaluatePreSendSuppression")
  const outboundSuppressionOrder = preSend.indexOf("isEmailSuppressed")
  assert.ok(preSendOrder >= 0 && outboundSuppressionOrder > preSendOrder, "pre-send must check compliance before outbound suppression")
  assert.doesNotMatch(preSend, /suppression-dual-write/)

  const dualWriteSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/compliance/suppression-dual-write.ts"),
    "utf8",
  )
  assert.match(dualWriteSource, /mirrorLegacySuppressionToCompliance/)
  assert.doesNotMatch(dualWriteSource, /suppression_entries/)

  console.log("growth operational send plane tests passed")
}

void main()
