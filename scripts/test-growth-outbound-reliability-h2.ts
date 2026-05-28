/**
 * Regression checks for Growth Outbound Reliability H2.
 * Run: pnpm test:growth-outbound-reliability-h2
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { classifyProviderFailure, isRetryEligibleFailureClass } from "../lib/growth/outbound/provider-failure-classifier"
import {
  GROWTH_OUTBOUND_RELIABILITY_H2_MIGRATION,
  GROWTH_OUTBOUND_RELIABILITY_H2_QA_MARKER,
  GROWTH_OUTBOUND_RELIABILITY_MAX_RETRIES,
  GROWTH_PROVIDER_FAILURE_CLASSES,
} from "../lib/growth/outbound/outbound-reliability-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_OUTBOUND_RELIABILITY_H2_QA_MARKER, "growth-outbound-reliability-h2-v1")
  assert.equal(GROWTH_PROVIDER_FAILURE_CLASSES.length, 10)
  assert.equal(GROWTH_OUTBOUND_RELIABILITY_MAX_RETRIES, 3)

  const migration = readSource(`supabase/migrations/${GROWTH_OUTBOUND_RELIABILITY_H2_MIGRATION}`)
  assert.match(migration, /send_plane/)
  assert.match(migration, /outreach_queue_id/)
  assert.match(migration, /dead_letter/)
  assert.match(migration, /failure_class/)

  const reputationBlocked = classifyProviderFailure({
    message: "Blocked by deliverability reputation protection",
    blockCode: "reputation_paused",
  })
  assert.equal(reputationBlocked.failure_class, "reputation_blocked")
  assert.equal(reputationBlocked.retry_eligible, false)

  const rateLimit = classifyProviderFailure({ message: "429 rate limit exceeded", code: "rate_limit" })
  assert.equal(rateLimit.failure_class, "rate_limit")
  assert.equal(isRetryEligibleFailureClass(rateLimit.failure_class), true)

  const execute = readSource("lib/growth/outreach/execute-outreach.ts")
  assert.match(execute, /runOutreachExecutionGuard/)
  assert.match(execute, /beginAdapterDeliveryAttempt/)
  assert.match(execute, /markOutreachQueueFailure/)
  assert.match(execute, /assertGrowthProductionRuntimeSafe/)

  const guard = readSource("lib/growth/outreach/outreach-execution-guard.ts")
  assert.match(guard, /applyReputationSafeScheduleGate/)
  assert.match(guard, /runGrowthOutreachPreflight/)

  const recovery = readSource("lib/growth/outreach/outreach-queue-recovery.ts")
  assert.match(recovery, /replayGrowthOutreachQueueItem/)
  assert.match(recovery, /dead_letter/)

  const alerts = readSource("lib/growth/operations/outbound-queue-health-alerts.ts")
  assert.match(alerts, /scheduled_overdue/)
  assert.match(alerts, /queue_lag_high/)
  assert.match(alerts, /Outbound execution not enabled yet/)
  assert.match(alerts, /Scheduler inactive until outbound activation/)
  assert.match(alerts, /resolveOutboundExecutionActivationState/)

  const cronHealthTypes = readSource("lib/growth/operations/outbound-cron-health-operator-types.ts")
  assert.match(cronHealthTypes, /growth-outbound-cron-health-v2/)
  assert.match(cronHealthTypes, /growth-outbound-setup-aware-alerts-v1/)

  const {
    buildOutboundCronRouteOperatorHealth,
    isOutboundOutageAlert,
    partitionOutboundQueueHealthAlerts,
  } = await import("../lib/growth/operations/outbound-cron-health-operator-types")

  const setupActivation = {
    qa_marker: "growth-outbound-setup-aware-alerts-v1" as const,
    mode: "setup" as const,
    headline: "Setup",
    summary: "Setup summary",
    activation_cta_label: "Activate outbound execution",
    activation_cta_href: "/admin/growth/infrastructure/outbound-operations",
    blockers: [],
    connected_mailboxes: 0,
    connected_providers: 0,
    transport_live: true,
    cron_telemetry_ready: true,
    has_prior_outbound_cron_success: false,
    sent_24h: 0,
  }

  const setupRoutes = buildOutboundCronRouteOperatorHealth({
    activation: setupActivation,
    routes: [
      {
        routeId: "growth-outreach-execute",
        path: "/api/cron/growth-outreach-execute",
        category: "outbound",
        registered: true,
        lastSuccessAt: null,
        lastRunAt: null,
        lastDurationMs: null,
        failureCount24h: 0,
        successCount24h: 0,
        queueLagMinutes: null,
      },
    ],
  })
  assert.equal(setupRoutes[0]?.operator_status, "pending_activation")
  assert.match(setupRoutes[0]?.operator_summary ?? "", /Outbound execution not enabled yet/)

  const staleRoutes = buildOutboundCronRouteOperatorHealth({
    activation: { ...setupActivation, mode: "operational" },
    routes: [
      {
        routeId: "growth-outreach-execute",
        path: "/api/cron/growth-outreach-execute",
        category: "outbound",
        registered: true,
        lastSuccessAt: "2020-01-01T00:00:00.000Z",
        lastRunAt: "2020-01-01T00:00:00.000Z",
        lastDurationMs: 100,
        failureCount24h: 2,
        successCount24h: 0,
        queueLagMinutes: null,
      },
    ],
  })
  assert.equal(staleRoutes[0]?.operator_status, "stale")

  const setupAlert = {
    rule_id: "cron_stale" as const,
    severity: "setup" as const,
    alert_kind: "setup" as const,
    title: "Outbound execution not enabled yet",
    summary: "No successful run recorded.",
    count: 1,
    metadata: { cron_route: "growth-outreach-execute", last_success_at: null },
  }
  assert.equal(isOutboundOutageAlert(setupAlert), false)
  const outageAlert = {
    ...setupAlert,
    severity: "critical" as const,
    alert_kind: "outage" as const,
    title: "Cron stale",
  }
  assert.equal(isOutboundOutageAlert(outageAlert), true)
  const partitioned = partitionOutboundQueueHealthAlerts([setupAlert, outageAlert])
  assert.equal(partitioned.setup_alerts.length, 1)
  assert.equal(partitioned.outage_alerts.length, 1)

  const dashboard = readSource("lib/growth/operations/outbound-operations-dashboard.ts")
  assert.match(dashboard, /recovery_queue/)
  assert.match(dashboard, /h2_qa_marker/)
  assert.match(dashboard, /outbound_activation/)
  assert.match(dashboard, /resolveOutboundExecutionActivationState/)
  assert.match(dashboard, /createFallbackOutboundExecutionActivationState/)
  assert.doesNotMatch(dashboard, /activation: outboundActivation\)[\s\S]*const telemetryReady = await isGrowthCronTelemetrySchemaReady/)
  assert.match(dashboard, /outbound_cron_health/)

  const ui = readSource("components/growth/growth-outbound-operations-dashboard.tsx")
  assert.match(ui, /GROWTH_OUTBOUND_RELIABILITY_H2_QA_MARKER/)
  assert.match(ui, /GROWTH_OUTBOUND_OPERATIONS_RUNTIME_STABLE_QA_MARKER/)
  assert.match(ui, /GROWTH_OUTBOUND_CRON_HEALTH_V2_QA_MARKER/)
  assert.match(ui, /GROWTH_OUTBOUND_SETUP_AWARE_ALERTS_QA_MARKER/)
  assert.match(ui, /GrowthOutboundOperationsErrorBoundary/)
  assert.match(ui, /dashboard\.readiness_catalog\.find/)
  assert.match(ui, /Outbound cron health/)
  assert.match(ui, /activation_cta_label/)
  assert.doesNotMatch(ui, /const transportReadiness[\s\S]*if \(loading\)/)
  assert.match(ui, /Failed outreach recovery/)

  const attention = readSource("lib/growth/operator-ux/operator-attention-strip.ts")
  assert.match(attention, /isOutboundOutageAlert/)

  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/platform/growth/outreach/queue/[queueId]/replay/route.ts")))
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/platform/growth/outreach/queue/[queueId]/preflight/route.ts")))

  console.log("growth-outbound-reliability-h2: ok")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
