import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildGrowthInfrastructureReadinessCatalog } from "@/lib/growth/infrastructure/infrastructure-readiness"
import { GROWTH_INFRASTRUCTURE_READINESS_QA_MARKER } from "@/lib/growth/infrastructure/infrastructure-readiness-types"
import { listOutreachQueueRecoveryItems } from "@/lib/growth/outreach/outreach-queue-recovery"
import {
  GROWTH_OUTBOUND_RELIABILITY_H2_QA_MARKER,
  type GrowthOutreachQueueRecoveryItem,
  type GrowthOutboundQueueHealthAlert,
} from "@/lib/growth/outbound/outbound-reliability-types"
import {
  buildOutboundCronRouteOperatorHealth,
  createFallbackOutboundExecutionActivationState,
  GROWTH_OUTBOUND_CRON_HEALTH_V2_QA_MARKER,
  type GrowthOutboundCronRouteOperatorHealth,
  type GrowthOutboundExecutionActivationState,
} from "@/lib/growth/operations/outbound-cron-health-operator-types"
import { evaluateOutboundQueueHealthAlerts } from "@/lib/growth/operations/outbound-queue-health-alerts"
import { resolveOutboundExecutionActivationState } from "@/lib/growth/operations/outbound-execution-activation"
import { listProviderConnectionSettingsRows } from "@/lib/growth/provider-setup/dashboard"
import { collectGrowthRuntimeDiagnostics } from "@/lib/growth/runtime/runtime-guards"
import {
  isGrowthCronTelemetrySchemaReady,
  listRecentGrowthCronExecutionRuns,
  summarizeGrowthCronRouteHealth,
} from "@/lib/growth/runtime/cron-telemetry-repository"
import {
  GROWTH_CRON_TELEMETRY_QA_MARKER,
  growthCronApiPath,
  type GrowthCronRouteId,
} from "@/lib/growth/runtime/cron-telemetry-types"
import { GROWTH_CRON_ROUTE_IDS } from "@/lib/growth/runtime/cron-telemetry-types"

export type GrowthOutboundOperationsDashboard = {
  qa_marker: typeof GROWTH_CRON_TELEMETRY_QA_MARKER
  h2_qa_marker: typeof GROWTH_OUTBOUND_RELIABILITY_H2_QA_MARKER
  cron_health_qa_marker: typeof GROWTH_OUTBOUND_CRON_HEALTH_V2_QA_MARKER
  generated_at: string
  outbound_activation: GrowthOutboundExecutionActivationState
  outbound_cron_health: GrowthOutboundCronRouteOperatorHealth[]
  runtime: ReturnType<typeof collectGrowthRuntimeDiagnostics>
  cron_routes: Awaited<ReturnType<typeof summarizeGrowthCronRouteHealth>>
  recent_cron_runs: Awaited<ReturnType<typeof listRecentGrowthCronExecutionRuns>>
  outreach_queue: {
    pending_approval: number
    approved: number
    scheduled: number
    failed: number
    dead_letter: number
    executed_24h: number
    overdue_scheduled: number
    stuck_processing: number
  }
  sequence_jobs: {
    pending_approval: number
    approved_due: number
    failed_24h: number
  }
  transport: {
    failed_attempts_24h: number
    simulated_attempts_24h: number
    sent_attempts_24h: number
    adapter_attempts_24h: number
  }
  recovery_queue: GrowthOutreachQueueRecoveryItem[]
  queue_health_alerts: GrowthOutboundQueueHealthAlert[]
  webhooks: {
    events_24h: number
    failed_processing_24h: number
    endpoints_active: number
  }
  suppression: {
    compliance_active: number
    outbound_entries: number
    pre_send_blocks_24h: number
  }
  approvals: {
    outreach_pending_approval: number
    sequence_pending_approval: number
  }
  provider_setup: Array<{
    provider_family: string
    status: string
    oauth_account_email: string | null
    last_test_send_at: string | null
  }>
  readiness_catalog: ReturnType<typeof buildGrowthInfrastructureReadinessCatalog>
}

const REGISTERED_GROWTH_CRON_PATHS = new Set(GROWTH_CRON_ROUTE_IDS.map((id) => growthCronApiPath(id)))

function since24hIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

async function countOutreach(admin: SupabaseClient, status: string, since?: string): Promise<number> {
  try {
    let query = admin.schema("growth").from("outreach_queue").select("id", { count: "exact", head: true }).eq("status", status)
    if (since) query = query.gte("executed_at", since)
    const { count } = await query
    return count ?? 0
  } catch {
    return 0
  }
}

async function countTable(
  admin: SupabaseClient,
  table: string,
  apply?: (q: ReturnType<SupabaseClient["schema"]>["from"] extends (name: string) => infer Q ? Q : never) => unknown,
): Promise<number> {
  try {
    let query = admin.schema("growth").from(table).select("id", { count: "exact", head: true })
    if (apply) query = apply(query as never) as typeof query
    const { count } = await query
    return count ?? 0
  } catch {
    return 0
  }
}

export async function fetchGrowthOutboundOperationsDashboard(
  admin: SupabaseClient,
): Promise<GrowthOutboundOperationsDashboard> {
  const since24h = since24hIso()
  const [telemetryReady, outboundActivation] = await Promise.all([
    isGrowthCronTelemetrySchemaReady(admin),
    resolveOutboundExecutionActivationState(admin).catch((error) =>
      createFallbackOutboundExecutionActivationState(
        error instanceof Error
          ? `Activation telemetry unavailable — ${error.message}`
          : "Activation telemetry unavailable.",
      ),
    ),
  ])

  const [
    cronRoutes,
    recentCronRuns,
    providerSetup,
    pendingApproval,
    approvedQueue,
    scheduledQueue,
    failedQueue,
    deadLetterQueue,
    executed24h,
    overdueScheduled,
    stuckProcessing,
    seqPending,
    seqApprovedDue,
    seqFailed24h,
    transportFailed24h,
    transportSent24h,
    webhookEvents24h,
    webhookFailed24h,
    webhookEndpointsActive,
    complianceSuppressions,
    outboundSuppressions,
    transportBlocks24h,
  ] = await Promise.all([
    summarizeGrowthCronRouteHealth(admin, REGISTERED_GROWTH_CRON_PATHS),
    telemetryReady ? listRecentGrowthCronExecutionRuns(admin, { limit: 20 }) : Promise.resolve([]),
    listProviderConnectionSettingsRows(admin).catch(() => []),
    countOutreach(admin, "pending_approval"),
    countOutreach(admin, "approved"),
    countOutreach(admin, "scheduled"),
    countOutreach(admin, "failed"),
    countOutreach(admin, "dead_letter"),
    countOutreach(admin, "executed", since24h),
    admin
      .schema("growth")
      .from("outreach_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled")
      .lte("scheduled_for", new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .then((res) => res.count ?? 0)
      .catch(() => 0),
    admin
      .schema("growth")
      .from("outreach_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .not("processing_started_at", "is", null)
      .lte("processing_started_at", new Date(Date.now() - 20 * 60 * 1000).toISOString())
      .then((res) => res.count ?? 0)
      .catch(() => 0),
    countTable(admin, "sequence_execution_jobs", (q) => q.eq("status", "pending_approval")),
    countTable(admin, "sequence_execution_jobs", (q) =>
      q.eq("status", "approved").lte("scheduled_for", new Date().toISOString()),
    ),
    countTable(admin, "sequence_execution_jobs", (q) => q.eq("status", "failed").gte("updated_at", since24h)),
    countTable(admin, "delivery_attempts", (q) => q.eq("status", "failed").gte("created_at", since24h)),
    countTable(admin, "delivery_attempts", (q) => q.in("status", ["sent", "delivered"]).gte("created_at", since24h)),
    countTable(admin, "provider_delivery_events", (q) => q.gte("created_at", since24h)),
    countTable(admin, "provider_delivery_events", (q) =>
      q.eq("processing_status", "failed").gte("created_at", since24h),
    ),
    countTable(admin, "provider_webhook_endpoints", (q) => q.eq("status", "active")),
    countTable(admin, "delivery_suppressions", (q) => q.eq("active", true)),
    countTable(admin, "suppression_entries"),
    countTable(admin, "delivery_attempts", (q) =>
      q.eq("status", "failed").gte("created_at", since24h).ilike("failure_reason", "%suppression%"),
    ),
  ])

  const { count: simulatedCount } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since24h)
    .contains("metadata", { simulated: true })
    .then((res) => res.count ?? 0)
    .catch(() => 0)

  const [recoveryQueue, queueAlerts, adapterAttempts24h] = await Promise.all([
    listOutreachQueueRecoveryItems(admin, 12).catch(() => []),
    evaluateOutboundQueueHealthAlerts(admin, { activation: outboundActivation }).catch(() => []),
    countTable(admin, "delivery_attempts", (q) =>
      q.eq("send_plane", "adapter").gte("created_at", since24h),
    ).catch(() => 0),
  ])

  const outboundCronHealth = buildOutboundCronRouteOperatorHealth({
    routes: cronRoutes,
    activation: outboundActivation,
  })

  return {
    qa_marker: GROWTH_CRON_TELEMETRY_QA_MARKER,
    h2_qa_marker: GROWTH_OUTBOUND_RELIABILITY_H2_QA_MARKER,
    cron_health_qa_marker: GROWTH_OUTBOUND_CRON_HEALTH_V2_QA_MARKER,
    generated_at: new Date().toISOString(),
    outbound_activation: outboundActivation,
    outbound_cron_health: outboundCronHealth,
    runtime: collectGrowthRuntimeDiagnostics(),
    cron_routes: cronRoutes,
    recent_cron_runs: recentCronRuns,
    outreach_queue: {
      pending_approval: pendingApproval,
      approved: approvedQueue,
      scheduled: scheduledQueue,
      failed: failedQueue,
      dead_letter: deadLetterQueue,
      executed_24h: executed24h,
      overdue_scheduled: overdueScheduled,
      stuck_processing: stuckProcessing,
    },
    sequence_jobs: {
      pending_approval: seqPending,
      approved_due: seqApprovedDue,
      failed_24h: seqFailed24h,
    },
    transport: {
      failed_attempts_24h: transportFailed24h,
      simulated_attempts_24h: simulatedCount ?? 0,
      sent_attempts_24h: transportSent24h,
      adapter_attempts_24h: adapterAttempts24h,
    },
    recovery_queue: recoveryQueue,
    queue_health_alerts: queueAlerts,
    webhooks: {
      events_24h: webhookEvents24h,
      failed_processing_24h: webhookFailed24h,
      endpoints_active: webhookEndpointsActive,
    },
    suppression: {
      compliance_active: complianceSuppressions,
      outbound_entries: outboundSuppressions,
      pre_send_blocks_24h: transportBlocks24h,
    },
    approvals: {
      outreach_pending_approval: pendingApproval,
      sequence_pending_approval: seqPending,
    },
    provider_setup: providerSetup.map((row) => ({
      provider_family: row.provider_family,
      status: row.status,
      oauth_account_email: row.oauth_account_email,
      last_test_send_at: row.last_test_send_at,
    })),
    readiness_catalog: buildGrowthInfrastructureReadinessCatalog(),
  }
}

export { GROWTH_INFRASTRUCTURE_READINESS_QA_MARKER }
