import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listMailboxConnections } from "@/lib/growth/mailboxes/mailbox-repository"
import {
  GROWTH_OUTBOUND_SETUP_AWARE_ALERTS_QA_MARKER,
  type GrowthOutboundExecutionActivationState,
} from "@/lib/growth/operations/outbound-cron-health-operator-types"
import { listProviderConnectionSettingsRows } from "@/lib/growth/provider-setup/dashboard"
import {
  isGrowthCronTelemetrySchemaReady,
  listRecentGrowthCronExecutionRuns,
} from "@/lib/growth/runtime/cron-telemetry-repository"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"
import { isGrowthTransportSimulationEnabled } from "@/lib/growth/runtime/runtime-guards"

const OUTBOUND_CRON_ROUTE_IDS = [
  "growth-outreach-execute",
  "growth-sequence-safe-execute",
  "growth-sequence-scheduler",
] as const

function since24hIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

export async function resolveOutboundExecutionActivationState(
  admin: SupabaseClient,
): Promise<GrowthOutboundExecutionActivationState> {
  const since24h = since24hIso()
  const outboundCronPaths = new Set(OUTBOUND_CRON_ROUTE_IDS.map((id) => growthCronApiPath(id)))

  const [mailboxes, providerSetup, cronTelemetryReady, cronRuns, sent24h, executedOutreach24h] =
    await Promise.all([
      listMailboxConnections(admin).catch(() => []),
      listProviderConnectionSettingsRows(admin).catch(() => []),
      isGrowthCronTelemetrySchemaReady(admin),
      isGrowthCronTelemetrySchemaReady(admin).then((ready) =>
        ready ? listRecentGrowthCronExecutionRuns(admin, { limit: 200 }) : [],
      ),
      admin
        .schema("growth")
        .from("delivery_attempts")
        .select("id", { count: "exact", head: true })
        .in("status", ["sent", "delivered"])
        .gte("created_at", since24h)
        .then((res) => res.count ?? 0)
        .catch(() => 0),
      admin
        .schema("growth")
        .from("outreach_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "executed")
        .gte("executed_at", since24h)
        .then((res) => res.count ?? 0)
        .catch(() => 0),
    ])

  const connectedMailboxes = mailboxes.filter((row) => row.status === "connected").length
  const connectedProviders = providerSetup.filter((row) => row.status === "connected").length
  const transportLive = !isGrowthTransportSimulationEnabled()
  const hasPriorOutboundCronSuccess = cronRuns.some(
    (run) => run.ok && outboundCronPaths.has(run.cronRoute),
  )

  const blockers: string[] = []
  if (!transportLive) blockers.push("Transport simulation is enabled — live outbound execution is inactive.")
  if (connectedProviders <= 0) blockers.push("No mailbox provider is connected yet.")
  if (connectedMailboxes <= 0) blockers.push("No connected sending mailboxes yet.")
  if (!cronTelemetryReady) blockers.push("Cron telemetry schema is not ready — successful runs cannot be recorded yet.")

  const mode =
    sent24h > 0 ||
    executedOutreach24h > 0 ||
    (hasPriorOutboundCronSuccess && connectedMailboxes > 0 && transportLive)
      ? "operational"
      : "setup"

  const headline =
    mode === "operational"
      ? "Outbound execution is active — cron freshness reflects live scheduler health."
      : "Outbound execution is still in setup — scheduler alerts stay informational until activation."

  const summary =
    mode === "operational"
      ? "Use cron timestamps below to confirm outreach, sequence scheduling, and safe execution are running on schedule."
      : blockers[0] ??
        "Complete provider setup and connect sending mailboxes before expecting live cron execution."

  return {
    qa_marker: GROWTH_OUTBOUND_SETUP_AWARE_ALERTS_QA_MARKER,
    mode,
    headline,
    summary,
    activation_cta_label: "Activate outbound execution",
    activation_cta_href: "/admin/growth/infrastructure/outbound-operations",
    blockers,
    connected_mailboxes: connectedMailboxes,
    connected_providers: connectedProviders,
    transport_live: transportLive,
    cron_telemetry_ready: cronTelemetryReady,
    has_prior_outbound_cron_success: hasPriorOutboundCronSuccess,
    sent_24h: sent24h,
  }
}
