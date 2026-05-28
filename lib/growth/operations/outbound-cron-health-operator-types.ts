/** Client-safe outbound cron health + setup-aware operator alerts. */

import type {
  GrowthOutboundQueueHealthAlert,
  GrowthOutboundQueueHealthAlertSeverity,
} from "@/lib/growth/outbound/outbound-reliability-types"
import type { GrowthCronRouteHealth } from "@/lib/growth/runtime/cron-telemetry-types"

export const GROWTH_OUTBOUND_CRON_HEALTH_V2_QA_MARKER = "growth-outbound-cron-health-v2" as const
export const GROWTH_OUTBOUND_SETUP_AWARE_ALERTS_QA_MARKER = "growth-outbound-setup-aware-alerts-v1" as const

export const GROWTH_OUTBOUND_EXECUTION_CRON_ROUTE_IDS = [
  "growth-outreach-execute",
  "growth-sequence-safe-execute",
  "growth-sequence-scheduler",
] as const

export type GrowthOutboundExecutionCronRouteId = (typeof GROWTH_OUTBOUND_EXECUTION_CRON_ROUTE_IDS)[number]

export type GrowthOutboundExecutionActivationMode = "setup" | "operational"

export type GrowthOutboundExecutionActivationState = {
  qa_marker: typeof GROWTH_OUTBOUND_SETUP_AWARE_ALERTS_QA_MARKER
  mode: GrowthOutboundExecutionActivationMode
  headline: string
  summary: string
  activation_cta_label: string
  activation_cta_href: string
  blockers: string[]
  connected_mailboxes: number
  connected_providers: number
  transport_live: boolean
  cron_telemetry_ready: boolean
  has_prior_outbound_cron_success: boolean
  sent_24h: number
}

export function createFallbackOutboundExecutionActivationState(
  summary = "Using safe setup defaults until activation telemetry is available.",
): GrowthOutboundExecutionActivationState {
  return {
    qa_marker: GROWTH_OUTBOUND_SETUP_AWARE_ALERTS_QA_MARKER,
    mode: "setup",
    headline: "Outbound execution is still in setup — scheduler alerts stay informational until activation.",
    summary,
    activation_cta_label: "Activate outbound execution",
    activation_cta_href: "/admin/growth/infrastructure/outbound-operations",
    blockers: [summary],
    connected_mailboxes: 0,
    connected_providers: 0,
    transport_live: false,
    cron_telemetry_ready: false,
    has_prior_outbound_cron_success: false,
    sent_24h: 0,
  }
}

export type GrowthOutboundCronRouteOperatorHealth = GrowthCronRouteHealth & {
  operator_status: "ready" | "pending_activation" | "stale" | "never_succeeded" | "outage"
  operator_label: string
  operator_summary: string
}

export const GROWTH_OUTBOUND_QUEUE_ALERT_OPERATOR_LABELS: Record<
  GrowthOutboundQueueHealthAlertSeverity,
  string
> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  setup: "Setup required",
  informational: "Informational",
  pending_activation: "Pending activation",
}

export function outboundQueueAlertTone(
  severity: GrowthOutboundQueueHealthAlertSeverity,
): "healthy" | "attention" | "critical" | "neutral" {
  switch (severity) {
    case "critical":
    case "high":
      return "critical"
    case "medium":
      return "attention"
    case "setup":
    case "pending_activation":
    case "informational":
    case "low":
      return "neutral"
    default:
      return "neutral"
  }
}

export function isOutboundSetupAwareAlertSeverity(
  severity: GrowthOutboundQueueHealthAlertSeverity,
): boolean {
  return severity === "setup" || severity === "informational" || severity === "pending_activation"
}

export function isOutboundOutageAlert(alert: GrowthOutboundQueueHealthAlert): boolean {
  if (alert.alert_kind === "setup" || alert.alert_kind === "informational") return false
  if (isOutboundSetupAwareAlertSeverity(alert.severity)) return false
  return alert.severity === "critical" || alert.severity === "high"
}

export function buildOutboundCronRouteOperatorHealth(input: {
  routes: GrowthCronRouteHealth[]
  activation: GrowthOutboundExecutionActivationState
  staleThresholdMs?: number
}): GrowthOutboundCronRouteOperatorHealth[] {
  const staleThresholdMs = input.staleThresholdMs ?? 2 * 60 * 60 * 1000
  const staleBefore = Date.now() - staleThresholdMs
  const routeIds = new Set(GROWTH_OUTBOUND_EXECUTION_CRON_ROUTE_IDS)

  return input.routes
    .filter((route) => routeIds.has(route.routeId as GrowthOutboundExecutionCronRouteId))
    .map((route) => {
      const lastSuccessAt = route.lastSuccessAt
      const lastSuccessMs = lastSuccessAt ? Date.parse(lastSuccessAt) : Number.NaN
      const isStale = !lastSuccessAt || lastSuccessMs < staleBefore

      if (!isStale) {
        return {
          ...route,
          operator_status: "ready",
          operator_label: "Ready",
          operator_summary: lastSuccessAt
            ? `Last successful run ${lastSuccessAt}.`
            : "Recent successful run recorded.",
        }
      }

      if (input.activation.mode === "setup" && !lastSuccessAt) {
        return {
          ...route,
          operator_status: "pending_activation",
          operator_label: "Pending activation",
          operator_summary:
            route.routeId === "growth-outreach-execute"
              ? "Outbound execution not enabled yet."
              : "Scheduler inactive until outbound activation.",
        }
      }

      if (lastSuccessAt) {
        return {
          ...route,
          operator_status: "stale",
          operator_label: "Stale",
          operator_summary: `Last success ${lastSuccessAt} — exceeds the freshness threshold.`,
        }
      }

      if (input.activation.mode === "operational") {
        return {
          ...route,
          operator_status: "never_succeeded",
          operator_label: "Never succeeded",
          operator_summary:
            "No successful run recorded while outbound is active. Verify CRON_SECRET and Vercel cron deployment.",
        }
      }

      return {
        ...route,
        operator_status: "pending_activation",
        operator_label: "Pending activation",
        operator_summary: "Waiting for outbound setup before scheduler telemetry is expected.",
      }
    })
}

export function partitionOutboundQueueHealthAlerts(alerts: GrowthOutboundQueueHealthAlert[]): {
  operator_alerts: GrowthOutboundQueueHealthAlert[]
  outage_alerts: GrowthOutboundQueueHealthAlert[]
  setup_alerts: GrowthOutboundQueueHealthAlert[]
} {
  const setup_alerts = alerts.filter(
    (alert) => alert.alert_kind === "setup" || alert.alert_kind === "informational" || isOutboundSetupAwareAlertSeverity(alert.severity),
  )
  const outage_alerts = alerts.filter((alert) => isOutboundOutageAlert(alert))
  const operator_alerts = alerts
  return { operator_alerts, outage_alerts, setup_alerts }
}
