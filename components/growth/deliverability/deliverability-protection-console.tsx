"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Loader2, RefreshCw, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthOperatorDiagnosticsDisclosure } from "@/components/growth/growth-operator-diagnostics-disclosure"
import {
  DeliverabilityModuleShell,
  useDeliverabilityModule,
} from "@/components/growth/deliverability/deliverability-module-shell"
import {
  GROWTH_DELIVERABILITY_DEGRADED_MODE_QA_MARKER,
  GROWTH_DELIVERABILITY_DNS_HEALTH_QA_MARKER,
  GROWTH_DELIVERABILITY_OPS_V2_QA_MARKER,
  GROWTH_DELIVERABILITY_QUEUE_OPS_QA_MARKER,
  GROWTH_DELIVERABILITY_SENDER_HEALTH_QA_MARKER,
  GROWTH_DELIVERABILITY_WIDGET_FALLBACK_QA_MARKER,
  type GrowthDeliverabilityDnsHealthModule,
  type GrowthDeliverabilityOpsAlert,
  type GrowthDeliverabilityProtectionConsoleSnapshot,
  type GrowthDeliverabilityQueueOpsModule,
  type GrowthDeliverabilityReputationModule,
  type GrowthDeliverabilitySenderHealthModule,
  type GrowthDeliverabilitySequenceSafetyModule,
} from "@/lib/growth/deliverability/deliverability-protection-console-types"
import {
  DELIVERABILITY_SETUP_ONBOARDING_MESSAGE,
  GROWTH_DELIVERABILITY_SETUP_IN_PROGRESS_QA_MARKER,
  hasDeliverabilitySetupInProgress,
  isDeliverabilityConsoleDegraded,
} from "@/lib/growth/deliverability/deliverability-console-state"
import { GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_QA_MARKER } from "@/lib/growth/deliverability/reputation-protection-types"
import { mailboxHealthStateLabel } from "@/lib/growth/deliverability/mailbox-health-score"
import type { GrowthMailboxHealthState } from "@/lib/growth/deliverability/mailbox-health-score-types"

function healthStateTone(state: string): "healthy" | "attention" | "critical" | "neutral" | "blocked" {
  switch (state) {
    case "healthy":
      return "healthy"
    case "warning":
      return "attention"
    case "at_risk":
      return "attention"
    case "critical":
      return "critical"
    case "disabled":
      return "blocked"
    default:
      return "neutral"
  }
}

function alertTone(severity: GrowthDeliverabilityOpsAlert["severity"]) {
  switch (severity) {
    case "critical":
      return "critical" as const
    case "high":
      return "high" as const
    case "medium":
      return "medium" as const
    default:
      return "low" as const
  }
}

function SenderHealthWidget() {
  const { loading, module, reload } = useDeliverabilityModule<GrowthDeliverabilitySenderHealthModule>("sender_health")
  const data = module?.data

  return (
    <DeliverabilityModuleShell
      moduleId="sender_health"
      title="Sender health"
      description="Active mailboxes, pause state, warming, limits, and provider warnings."
      qaMarker={GROWTH_DELIVERABILITY_SENDER_HEALTH_QA_MARKER}
      loading={loading}
      module={module}
      onRetry={reload}
      emptyContent="No mailbox telemetry connected. Add sender accounts to begin reputation monitoring."
    >
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatTile label="Active" value={String(data.summary.active_mailboxes)} />
            <StatTile label="Paused" value={String(data.summary.paused_mailboxes)} />
            <StatTile label="Warming" value={String(data.summary.warming_mailboxes)} />
            <StatTile label="At-risk domains" value={String(data.summary.unhealthy_domains)} />
            <StatTile label="Avg risk" value={`${data.summary.average_risk_score}/100`} />
          </div>
          {data.paused.length > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-destructive">Paused mailboxes</p>
              {data.paused.slice(0, 4).map((row) => (
                <div key={row.email} className="rounded border border-destructive/20 p-2 text-xs">
                  <p className="font-medium">{row.email}</p>
                  <p className="text-muted-foreground">{row.pause_reason}</p>
                  <p className="mt-1">{row.recommended_action}</p>
                </div>
              ))}
            </div>
          ) : null}
          {data.at_risk.length > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-amber-800">At-risk senders</p>
              {data.at_risk.slice(0, 3).map((row) => (
                <div key={row.email} className="rounded border border-amber-200/60 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{row.email}</span>
                    <GrowthBadge label={row.health_tier.replace(/_/g, " ")} tone="attention" />
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Risk {row.risk_score} · bounce {row.bounce_rate.toFixed(1)}% · complaints {row.complaint_rate.toFixed(2)}%
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          {data.mailbox_rows && data.mailbox_rows.length > 0 ? (
            <div className="mt-4 overflow-x-auto" data-qa-marker={data.mailbox_health_intel_qa_marker}>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Mailbox health intelligence</p>
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Mailbox</th>
                    <th className="px-2 py-2 font-medium">Health</th>
                    <th className="px-2 py-2 font-medium">Warmup</th>
                    <th className="px-2 py-2 font-medium">Capacity</th>
                    <th className="px-2 py-2 font-medium">Today</th>
                    <th className="px-2 py-2 font-medium">Bounce</th>
                    <th className="px-2 py-2 font-medium">Reply</th>
                    <th className="px-2 py-2 font-medium">Delivery</th>
                    <th className="px-2 py-2 font-medium">Throttle</th>
                    <th className="px-2 py-2 font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {data.mailbox_rows.map((row) => (
                    <tr key={row.email} className="border-b border-border/60">
                      <td className="px-2 py-2 font-medium">{row.email}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <span>{row.health_score}</span>
                          <GrowthBadge
                            label={mailboxHealthStateLabel(row.health_state as GrowthMailboxHealthState)}
                            tone={healthStateTone(row.health_state)}
                          />
                        </div>
                      </td>
                      <td className="px-2 py-2">{row.warmup_status ?? "—"}</td>
                      <td className="px-2 py-2">{row.daily_capacity}</td>
                      <td className="px-2 py-2">{row.sends_today}</td>
                      <td className="px-2 py-2">{row.bounce_rate.toFixed(1)}%</td>
                      <td className="px-2 py-2">{row.reply_rate.toFixed(1)}%</td>
                      <td className="px-2 py-2">{row.delivery_success_rate.toFixed(0)}%</td>
                      <td className="px-2 py-2">
                        <GrowthBadge label={row.throttle_status} tone={healthStateTone(row.throttle_status === "ok" ? "healthy" : "critical")} />
                      </td>
                      <td className="px-2 py-2 capitalize text-muted-foreground">{row.trend_direction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </DeliverabilityModuleShell>
  )
}

function QueueOpsWidget() {
  const { loading, module, reload } = useDeliverabilityModule<GrowthDeliverabilityQueueOpsModule>("queue_ops")
  const data = module?.data

  return (
    <DeliverabilityModuleShell
      moduleId="queue_ops"
      title="Queue operations"
      description="Pending outbound, failures, dead-letter, approvals, and recovery queue."
      qaMarker={GROWTH_DELIVERABILITY_QUEUE_OPS_QA_MARKER}
      loading={loading}
      module={module}
      onRetry={reload}
      emptyContent="No outbound queue telemetry available yet."
    >
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Pending" value={String(data.pending_outbound)} />
            <StatTile label="Failed" value={String(data.failed_sends)} />
            <StatTile label="Dead letter" value={String(data.dead_letter_queue)} />
            <StatTile label="Approvals" value={String(data.approval_bottlenecks)} />
          </div>
          {(data.overdue_scheduled > 0 || data.stuck_processing > 0) ? (
            <p className="mt-2 text-xs text-amber-800">
              {data.overdue_scheduled} overdue scheduled · {data.stuck_processing} stuck processing
            </p>
          ) : null}
          {data.recovery_items.length > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium">Recovery queue</p>
              {data.recovery_items.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">{item.label}</span>
                  <GrowthBadge label={item.status} tone={item.status === "dead_letter" ? "critical" : "attention"} />
                </div>
              ))}
            </div>
          ) : null}
          <Link href="/admin/growth/operations/outbound" className="mt-3 inline-block text-xs text-primary underline-offset-2 hover:underline">
            Open outbound console →
          </Link>
        </>
      ) : null}
    </DeliverabilityModuleShell>
  )
}

function ReputationWidget() {
  const { loading, module, reload } = useDeliverabilityModule<GrowthDeliverabilityReputationModule>("reputation_protection")
  const data = module?.data

  return (
    <DeliverabilityModuleShell
      moduleId="reputation_protection"
      title="Reputation protection"
      description="Bounce and complaint rates, unsubscribe spikes, domain and provider reputation."
      qaMarker={GROWTH_DELIVERABILITY_DEGRADED_MODE_QA_MARKER}
      loading={loading}
      module={module}
      onRetry={reload}
      emptyContent="No provider health data available."
    >
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Bounce rate" value={data.bounce_rate_pct != null ? `${data.bounce_rate_pct.toFixed(1)}%` : "—"} />
            <StatTile label="Complaints" value={data.complaint_rate_pct != null ? `${data.complaint_rate_pct.toFixed(2)}%` : "—"} />
            <StatTile label="Unsub spikes" value={String(data.unsubscribe_spike_count)} />
            <StatTile label="Spam risk" value={String(data.spam_trap_risk_count)} />
          </div>
          {data.domain_reputation_issues.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs">
              {data.domain_reputation_issues.slice(0, 4).map((row) => (
                <li key={row.domain} className="flex justify-between gap-2">
                  <span>{row.domain}</span>
                  <span className="text-muted-foreground">score {row.score}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </DeliverabilityModuleShell>
  )
}

function DnsHealthWidget() {
  const { loading, module, reload } = useDeliverabilityModule<GrowthDeliverabilityDnsHealthModule>("dns_health")
  const data = module?.data

  return (
    <DeliverabilityModuleShell
      moduleId="dns_health"
      title="DNS / authentication"
      description="SPF, DKIM, DMARC, MX validation, and warmup readiness."
      qaMarker={GROWTH_DELIVERABILITY_DNS_HEALTH_QA_MARKER}
      loading={loading}
      module={module}
      onRetry={reload}
      emptyContent="Deliverability monitoring not configured. Add sender domains under DNS & Setup."
    >
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <StatTile label="Domains" value={String(data.domains_tracked)} />
            <StatTile label="SPF ok" value={String(data.spf_ok)} />
            <StatTile label="DKIM ok" value={String(data.dkim_ok)} />
            <StatTile label="DMARC ok" value={String(data.dmarc_ok)} />
            <StatTile label="MX ok" value={String(data.mx_ok)} />
          </div>
          {data.failing_domains.length > 0 ? (
            <ul className="mt-3 space-y-2 text-xs">
              {data.failing_domains.slice(0, 4).map((row) => (
                <li key={row.domain} className="rounded border border-border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{row.domain}</span>
                    <GrowthBadge label={row.health_tier} tone="attention" />
                  </div>
                  <p className="mt-1 text-muted-foreground">{row.issues.join(" · ")}</p>
                </li>
              ))}
            </ul>
          ) : null}
          <Link href="/admin/growth/infrastructure/deliverability" className="mt-3 inline-block text-xs text-primary underline-offset-2 hover:underline">
            Open DNS & Setup →
          </Link>
        </>
      ) : null}
    </DeliverabilityModuleShell>
  )
}

function SequenceSafetyWidget() {
  const { loading, module, reload } = useDeliverabilityModule<GrowthDeliverabilitySequenceSafetyModule>("sequence_safety")
  const data = module?.data

  return (
    <DeliverabilityModuleShell
      moduleId="sequence_safety"
      title="Sequence safety"
      description="Risky sequences, complaint-heavy senders, throttled campaigns, auto-paused outreach."
      qaMarker={GROWTH_DELIVERABILITY_WIDGET_FALLBACK_QA_MARKER}
      loading={loading}
      module={module}
      onRetry={reload}
      emptyContent="No active sequence participation tracked."
    >
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Throttled" value={String(data.throttled_campaigns)} />
            <StatTile label="Auto-paused" value={String(data.auto_paused_outreach)} />
          </div>
          {data.risky_sequences.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs">
              {data.risky_sequences.slice(0, 4).map((row) => (
                <li key={row.label} className="flex justify-between gap-2">
                  <span className="truncate">{row.label}</span>
                  <span className="text-muted-foreground">{row.sequence_count} seq · risk {row.risk_score}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </DeliverabilityModuleShell>
  )
}

export function GrowthDeliverabilityProtectionConsole() {
  const [loading, setLoading] = useState(true)
  const [consoleSnapshot, setConsoleSnapshot] = useState<GrowthDeliverabilityProtectionConsoleSnapshot | null>(null)
  const [headerError, setHeaderError] = useState<string | null>(null)

  const loadHeader = useCallback(async () => {
    setLoading(true)
    setHeaderError(null)
    try {
      const response = await fetch("/api/platform/growth/deliverability/protection/console", { cache: "no-store" })
      const payload = (await response.json()) as {
        ok?: boolean
        console?: GrowthDeliverabilityProtectionConsoleSnapshot
        message?: string
        impact?: string
        remediation?: string
      }
      if (payload.console) {
        setConsoleSnapshot(payload.console)
        return
      }
      setHeaderError(payload.message ?? "Alert summary unavailable.")
    } catch (error) {
      setHeaderError(error instanceof Error ? error.message : "Alert summary unavailable.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHeader()
  }, [loadHeader])

  const alerts = consoleSnapshot?.alerts ?? []
  const degraded =
    Boolean(headerError) || isDeliverabilityConsoleDegraded(consoleSnapshot?.modules)
  const setupInProgress = hasDeliverabilitySetupInProgress(consoleSnapshot?.modules)

  return (
    <div
      className="flex flex-col gap-4"
      data-qa-marker={GROWTH_DELIVERABILITY_OPS_V2_QA_MARKER}
      data-reputation-qa={GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_QA_MARKER}
      data-degraded-mode={degraded ? GROWTH_DELIVERABILITY_DEGRADED_MODE_QA_MARKER : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl space-y-1">
          <p className="text-sm text-muted-foreground">
            Operational deliverability console — modules load independently; empty telemetry is normal during setup.
          </p>
          {setupInProgress ? (
            <p
              className="text-xs text-muted-foreground"
              data-qa={GROWTH_DELIVERABILITY_SETUP_IN_PROGRESS_QA_MARKER}
            >
              {DELIVERABILITY_SETUP_ONBOARDING_MESSAGE}
            </p>
          ) : null}
          {degraded ? (
            <p className="text-xs text-amber-800" data-qa={GROWTH_DELIVERABILITY_DEGRADED_MODE_QA_MARKER}>
              Degraded mode: one or more modules failed to load. Working sections remain active below.
            </p>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadHeader()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh alerts
        </Button>
      </div>

      {headerError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950">
          <p className="font-medium">Alert summary unavailable</p>
          <p className="mt-1 text-xs">{headerError}</p>
          <p className="mt-1 text-xs">Operational modules below remain active — retry alert refresh only.</p>
        </div>
      ) : null}

      {alerts.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-tight">Priority alerts</h2>
          <div className="grid gap-2 lg:grid-cols-2">
            {alerts.slice(0, 6).map((alert) => (
              <div
                key={alert.id}
                id={alert.action_href?.replace("#", "") ?? alert.id}
                className="rounded-lg border border-border bg-card p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />
                    <div>
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{alert.summary}</p>
                    </div>
                  </div>
                  <GrowthBadge label={alert.severity} tone={alertTone(alert.severity)} />
                </div>
                <p className="mt-2 text-xs">{alert.impact}</p>
                {alert.entity_labels.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">{alert.entity_labels.join(" · ")}</p>
                ) : null}
                {alert.action_href ? (
                  <a href={alert.action_href} className="mt-2 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline">
                    {alert.action_label}
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          <AlertTriangle className="mr-2 inline size-4" />
          No critical deliverability alerts right now. Modules below show live operational detail.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div id="sender-health"><SenderHealthWidget /></div>
        <div id="queue-ops"><QueueOpsWidget /></div>
        <div id="reputation-protection"><ReputationWidget /></div>
        <div id="dns-health"><DnsHealthWidget /></div>
        <div id="sequence-safety"><SequenceSafetyWidget /></div>
      </div>

      <GrowthOperatorDiagnosticsDisclosure
        title="Advanced diagnostics"
        description="Console metadata and module refresh timestamps."
      >
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <p>Generated: {consoleSnapshot?.generated_at ?? "—"}</p>
          <p>Degraded mode: {degraded ? "yes" : "no"}</p>
          <p>Setup in progress: {setupInProgress ? "yes" : "no"}</p>
          <p>Alert count: {alerts.length}</p>
          <p>{consoleSnapshot?.privacy_note}</p>
        </div>
      </GrowthOperatorDiagnosticsDisclosure>
    </div>
  )
}
