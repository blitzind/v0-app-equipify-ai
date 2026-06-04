"use client"

import Link from "next/link"
import React, { useCallback, useEffect, useState } from "react"
import { Activity, AlertTriangle, Loader2, RefreshCw, Server } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GrowthInfrastructureReadinessBadge,
  GrowthInfrastructureReadinessBanner,
} from "@/components/growth/growth-infrastructure-readiness-badge"
import type { GrowthOutboundOperationsDashboard } from "@/lib/growth/operations/outbound-operations-dashboard"
import {
  GROWTH_OUTBOUND_CRON_HEALTH_V2_QA_MARKER,
  GROWTH_OUTBOUND_QUEUE_ALERT_OPERATOR_LABELS,
  GROWTH_OUTBOUND_SETUP_AWARE_ALERTS_QA_MARKER,
  isOutboundSetupAwareAlertSeverity,
  outboundQueueAlertTone,
} from "@/lib/growth/operations/outbound-cron-health-operator-types"
import {
  GROWTH_OUTBOUND_OPERATIONS_RUNTIME_STABLE_QA_MARKER,
  GROWTH_OUTBOUND_RELIABILITY_H2_QA_MARKER,
  type GrowthOutboundOperationsFailureReason,
  type GrowthOutboundQueueHealthAlert,
} from "@/lib/growth/outbound/outbound-reliability-types"
import { GROWTH_CRON_TELEMETRY_QA_MARKER } from "@/lib/growth/runtime/cron-telemetry-types"
import { GrowthOperatorDiagnosticsDisclosure } from "@/components/growth/growth-operator-diagnostics-disclosure"
import { GROWTH_OPERATOR_UX_H3_QA_MARKER } from "@/lib/growth/operator-ux/operator-ux-h3-types"

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

function outboundCronOperatorBadgeTone(
  status: GrowthOutboundOperationsDashboard["outbound_cron_health"][number]["operator_status"],
): "healthy" | "attention" | "critical" | "neutral" {
  switch (status) {
    case "ready":
      return "healthy"
    case "stale":
    case "never_succeeded":
    case "outage":
      return "critical"
    case "pending_activation":
      return "neutral"
    default:
      return "neutral"
  }
}

function queueHealthAlertKey(alert: GrowthOutboundQueueHealthAlert): string {
  const cronRoute = alert.metadata.cron_route
  return typeof cronRoute === "string" ? `${alert.rule_id}:${cronRoute}` : `${alert.rule_id}:${alert.count}`
}

function queueHealthAlertBorderClass(alert: GrowthOutboundQueueHealthAlert): string {
  if (isOutboundSetupAwareAlertSeverity(alert.severity)) {
    return "border-border bg-muted/30"
  }
  if (alert.severity === "critical" || alert.severity === "high") {
    return "border-amber-200 bg-amber-50"
  }
  return "border-border bg-background"
}

function sanitizeOutboundOperationsUiError(message: string | null | undefined): string {
  const trimmed = message?.trim()
  if (!trimmed) return "Outbound operations data could not be loaded."
  if (/\bis not defined$/i.test(trimmed) || /^ReferenceError/i.test(trimmed)) {
    return "Outbound operations panel hit a configuration issue. Retry or open engineering diagnostics after deploy."
  }
  return trimmed
}

function degradedCopy(failureReason: GrowthOutboundOperationsFailureReason): {
  title: string
  message: string
  actions: string[]
} {
  switch (failureReason) {
    case "schema_not_ready":
      return {
        title: "Outbound operations setup incomplete",
        message: "Required Growth outbound tables or migrations are not ready on this Supabase project.",
        actions: [
          "Apply pending Growth Engine migrations",
          "Reload PostgREST schema cache",
          "Retry after migrations complete",
        ],
      }
    case "permission_blocked":
      return {
        title: "Outbound operations blocked by permissions",
        message: "The service role cannot read outbound queue or delivery tables required for this console.",
        actions: ["Verify service role grants on growth outbound tables", "Retry after grants are applied"],
      }
    case "render_error":
      return {
        title: "Outbound console panel unavailable",
        message: "One panel failed to render safely. Other admin areas remain available.",
        actions: ["Refresh the page", "Retry load", "Contact platform support if this persists"],
      }
    default:
      return {
        title: "Outbound operations degraded",
        message: "Live queue metrics could not be loaded right now.",
        actions: [
          "Retry load",
          "Open sequence approvals",
          "Check provider setup and deliverability protection",
        ],
      }
  }
}

function GrowthOutboundOperationsDegradedState({
  failureReason,
  message,
  onRetry,
}: {
  failureReason: GrowthOutboundOperationsFailureReason
  message: string
  onRetry: () => void
}) {
  const copy = degradedCopy(failureReason)

  return (
    <div
      className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950"
      data-qa={GROWTH_OUTBOUND_OPERATIONS_RUNTIME_STABLE_QA_MARKER}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{copy.title}</p>
          <p className="mt-1">{copy.message}</p>
          <p className="mt-2 text-xs opacity-90">{sanitizeOutboundOperationsUiError(message)}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
            {copy.actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="mr-2 size-3.5" />
              Retry
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/admin/growth/sequences/execution">Open sequence approvals</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/admin/growth/providers/setup">Provider setup</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

class GrowthOutboundOperationsErrorBoundary extends React.Component<
  { children: React.ReactNode; onRetry: () => void },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error(`[${GROWTH_OUTBOUND_OPERATIONS_RUNTIME_STABLE_QA_MARKER}] panel render failed`, error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <GrowthOutboundOperationsDegradedState
          failureReason="render_error"
          message="Outbound console panel failed to render safely."
          onRetry={() => {
            this.setState({ hasError: false })
            this.props.onRetry()
          }}
        />
      )
    }
    return this.props.children
  }
}

function GrowthOutboundOperationsDashboardContent() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [failureReason, setFailureReason] = useState<GrowthOutboundOperationsFailureReason>("unknown")
  const [dashboard, setDashboard] = useState<GrowthOutboundOperationsDashboard | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/operations/outbound", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthOutboundOperationsDashboard | null
        message?: string
        failureReason?: GrowthOutboundOperationsFailureReason
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        setFailureReason(data.failureReason ?? "fetch_failed")
        throw new Error(data.message ?? "Could not load outbound operations dashboard.")
      }
      setDashboard(data.dashboard)
      setFailureReason("unknown")
    } catch (e) {
      setDashboard(null)
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading outbound operations…
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <GrowthOutboundOperationsDegradedState
        failureReason={failureReason}
        message={error ?? "Dashboard unavailable."}
        onRetry={() => void load()}
      />
    )
  }

  const transportReadiness =
    dashboard.readiness_catalog.find((entry) => entry.surfaceId === "transport_send")?.readiness ?? {
      status: "internal" as const,
      label: "Internal",
      detail: "Transport readiness unavailable.",
    }

  return (
    <div
      className="flex flex-col gap-5"
      data-qa={GROWTH_OUTBOUND_OPERATIONS_RUNTIME_STABLE_QA_MARKER}
      data-qa-marker={GROWTH_CRON_TELEMETRY_QA_MARKER}
      data-h2-qa={dashboard.h2_qa_marker}
      data-h3-qa={GROWTH_OPERATOR_UX_H3_QA_MARKER}
      data-cron-health-qa={dashboard.cron_health_qa_marker}
      data-setup-aware-alerts-qa={dashboard.outbound_activation.qa_marker}
    >
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/admin/growth/sequences/execution">
            Sequence approvals ({dashboard.approvals.sequence_pending_approval})
          </Link>
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/admin/growth/copilot/personalization">AI personalization</Link>
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/admin/growth/copilot/reply-drafts">Reply drafts</Link>
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/admin/growth/deliverability">Protection</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Outreach pending approval" value={String(dashboard.approvals.outreach_pending_approval)} />
        <StatTile label="Sequence pending approval" value={String(dashboard.approvals.sequence_pending_approval)} />
        <StatTile label="Failed sends (24h)" value={String(dashboard.transport.failed_attempts_24h)} />
        <StatTile label="Suppression blocks (24h)" value={String(dashboard.suppression.pre_send_blocks_24h)} />
      </div>

      <GrowthOperatorDiagnosticsDisclosure title="Engineering diagnostics" description="Cron telemetry, runtime guards, and infrastructure readiness catalog.">
        <GrowthInfrastructureReadinessBanner title="Transport send plane" readiness={transportReadiness} />

        {dashboard.runtime.violations.length > 0 ? (
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4" />
              Production runtime guard violations
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {dashboard.runtime.violations.map((v) => (
                <li key={v.code}>{v.message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <GrowthEngineCard title="Cron execution health" icon={<Activity size={16} />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Route</th>
                  <th className="py-2 pr-3 font-medium">Registered</th>
                  <th className="py-2 pr-3 font-medium">Last success</th>
                  <th className="py-2 pr-3 font-medium">Failures 24h</th>
                  <th className="py-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.cron_routes.map((route) => (
                  <tr key={route.routeId} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-mono">{route.routeId}</td>
                    <td className="py-2 pr-3">
                      <GrowthBadge label={route.registered ? "yes" : "no"} tone={route.registered ? "healthy" : "critical"} />
                    </td>
                    <td className="py-2 pr-3">{formatDate(route.lastSuccessAt)}</td>
                    <td className="py-2 pr-3">{route.failureCount24h}</td>
                    <td className="py-2">{route.lastDurationMs != null ? `${route.lastDurationMs}ms` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Infrastructure readiness catalog" icon={<Server size={16} />}>
          <ul className="space-y-2">
            {dashboard.readiness_catalog.map((entry, index) => (
              <li
                key={`${entry.surfaceId}-${entry.title}-${index}`}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{entry.title}</p>
                  {entry.readiness.detail ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{entry.readiness.detail}</p>
                  ) : null}
                </div>
                <GrowthInfrastructureReadinessBadge readiness={entry.readiness} />
              </li>
            ))}
          </ul>
        </GrowthEngineCard>
      </GrowthOperatorDiagnosticsDisclosure>

      <GrowthEngineCard
        title="Outbound cron health"
        icon={<Activity size={16} />}
        data-qa={GROWTH_OUTBOUND_CRON_HEALTH_V2_QA_MARKER}
        data-qa-marker={GROWTH_OUTBOUND_SETUP_AWARE_ALERTS_QA_MARKER}
      >
        {dashboard.outbound_activation.mode === "setup" ? (
          <div className="mb-4 rounded-xl border border-border bg-muted/30 p-4 text-sm">
            <p className="font-semibold">{dashboard.outbound_activation.headline}</p>
            <p className="mt-1 text-xs text-muted-foreground">{dashboard.outbound_activation.summary}</p>
            {dashboard.outbound_activation.blockers.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {dashboard.outbound_activation.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="mt-4" asChild>
              <Link href={dashboard.outbound_activation.activation_cta_href}>
                {dashboard.outbound_activation.activation_cta_label}
              </Link>
            </Button>
          </div>
        ) : (
          <p className="mb-4 text-xs text-muted-foreground">{dashboard.outbound_activation.headline}</p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Route</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Last successful run</th>
                <th className="py-2 pr-3 font-medium">Failures 24h</th>
                <th className="py-2 font-medium">Summary</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.outbound_cron_health.map((route) => (
                <tr key={route.routeId} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-mono">{route.routeId}</td>
                  <td className="py-2 pr-3">
                    <GrowthBadge
                      label={route.operator_label}
                      tone={outboundCronOperatorBadgeTone(route.operator_status)}
                    />
                  </td>
                  <td className="py-2 pr-3">{formatDate(route.lastSuccessAt)}</td>
                  <td className="py-2 pr-3">{route.failureCount24h}</td>
                  <td className="py-2 text-muted-foreground">{route.operator_summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GrowthEngineCard title="Queue health">
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Outreach scheduled</dt>
              <dd className="font-semibold">{dashboard.outreach_queue.scheduled}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Outreach failed</dt>
              <dd className="font-semibold">{dashboard.outreach_queue.failed}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Dead letter</dt>
              <dd className="font-semibold">{dashboard.outreach_queue.dead_letter}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Overdue scheduled</dt>
              <dd className="font-semibold">{dashboard.outreach_queue.overdue_scheduled}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Stuck processing</dt>
              <dd className="font-semibold">{dashboard.outreach_queue.stuck_processing}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Adapter attempts (24h)</dt>
              <dd className="font-semibold">{dashboard.transport.adapter_attempts_24h}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sequence jobs due</dt>
              <dd className="font-semibold">{dashboard.sequence_jobs.approved_due}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Webhook events (24h)</dt>
              <dd className="font-semibold">{dashboard.webhooks.events_24h}</dd>
            </div>
          </dl>
        </GrowthEngineCard>

        <GrowthEngineCard title="Provider setup">
          <ul className="space-y-2 text-xs">
            {dashboard.provider_setup.length === 0 ? (
              <li className="text-muted-foreground">No provider connections configured.</li>
            ) : (
              dashboard.provider_setup.map((row) => (
                <li key={row.provider_family} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2">
                  <span className="font-medium capitalize">{row.provider_family}</span>
                  <GrowthBadge label={row.status} tone={row.status === "connected" ? "healthy" : "neutral"} />
                </li>
              ))
            )}
          </ul>
          <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
            <Link href="/admin/growth/providers/setup">Open provider setup</Link>
          </Button>
        </GrowthEngineCard>
      </div>

      {dashboard.queue_health_alerts.length > 0 ? (
        <GrowthEngineCard title="Queue health alerts">
          <ul className="space-y-2 text-sm">
            {dashboard.queue_health_alerts.map((alert) => (
              <li key={queueHealthAlertKey(alert)} className={`rounded-lg border p-3 ${queueHealthAlertBorderClass(alert)}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{alert.title}</span>
                  <GrowthBadge
                    label={GROWTH_OUTBOUND_QUEUE_ALERT_OPERATOR_LABELS[alert.severity]}
                    tone={outboundQueueAlertTone(alert.severity)}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{alert.summary}</p>
                {typeof alert.metadata.last_success_at === "string" ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last success: {formatDate(alert.metadata.last_success_at)}
                  </p>
                ) : alert.rule_id === "cron_stale" ? (
                  <p className="mt-1 text-xs text-muted-foreground">Last success: —</p>
                ) : null}
              </li>
            ))}
          </ul>
        </GrowthEngineCard>
      ) : null}

      <GrowthEngineCard title="Failed outreach recovery">
        <p className="mb-3 text-xs text-muted-foreground" data-qa-marker={GROWTH_OUTBOUND_RELIABILITY_H2_QA_MARKER}>
          Operator recovery for failed and dead-letter queue items. Replays re-run suppression and deliverability gates.
        </p>
        {dashboard.recovery_queue.length === 0 ? (
          <p className="text-sm text-muted-foreground">No failed or dead-letter outreach items.</p>
        ) : (
          <div className="space-y-3">
            {dashboard.recovery_queue.map((item) => (
              <div key={item.queue_id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{item.company_name ?? item.queue_id.slice(0, 8)}</span>
                  <GrowthBadge label={item.status} tone={item.status === "dead_letter" ? "critical" : "attention"} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.failure_class ?? "unknown"} · retries {item.retry_count}/{3}
                  {item.retry_eligible ? " · eligible for replay" : " · not retry eligible"}
                </p>
                {item.failure_reason ? <p className="mt-1 text-xs">{item.failure_reason}</p> : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.retry_eligible ? (
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link href={`/admin/growth/sequences/execution?replay=${item.queue_id}`}>Review in execution</Link>
                    </Button>
                  ) : null}
                  <Button type="button" variant="ghost" size="sm" asChild>
                    <Link href="/admin/growth/deliverability">Deliverability protection</Link>
                  </Button>
                  <Button type="button" variant="ghost" size="sm" asChild>
                    <Link href="/admin/growth/providers/setup">Provider setup</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>

      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 size-3.5" />
          Refresh
        </Button>
      </div>
    </div>
  )
}

export function GrowthOutboundOperationsDashboard() {
  const [retryKey, setRetryKey] = useState(0)

  return (
    <GrowthOutboundOperationsErrorBoundary onRetry={() => setRetryKey((value) => value + 1)}>
      <GrowthOutboundOperationsDashboardContent key={retryKey} />
    </GrowthOutboundOperationsErrorBoundary>
  )
}
