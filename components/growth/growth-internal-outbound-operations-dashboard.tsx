"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, AlertTriangle, CheckCircle2, Circle, Loader2, Mail, RefreshCw, Server, Shield, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthInfrastructureReadinessBadge } from "@/components/growth/growth-infrastructure-readiness-badge"
import type { GrowthInternalOutboundOperationsDashboard } from "@/lib/growth/operations/internal-outbound-operations-dashboard"
import { GrowthOperatorDiagnosticsDisclosure } from "@/components/growth/growth-operator-diagnostics-disclosure"
import {
  buildDomainOperatorGuidance,
  buildSendInfrastructureChecklist,
  buildSendInfrastructureOperatorSummary,
  buildSendInfrastructureProviderCards,
  formatDomainReadinessOperatorLabel,
  formatDomainVerificationLabel,
  GROWTH_SEND_INFRASTRUCTURE_OPERATIONAL_MODE_QA_MARKER,
  GROWTH_SEND_INFRASTRUCTURE_OPERATOR_READY_QA_MARKER,
  GROWTH_SEND_INFRASTRUCTURE_SETUP_MODE_QA_MARKER,
  GROWTH_SEND_INFRASTRUCTURE_CHECKLIST_STATUS_LABELS,
  hasMeaningfulOutboundOperationalMetrics,
  isSendInfrastructureSetupMode,
  snapshotFromInternalOutboundDashboard,
} from "@/lib/growth/infrastructure/send-infrastructure-operator-types"
import { sanitizeInfrastructureReadinessDetailForOperator } from "@/lib/growth/deliverability/dns-setup-operator-types"
import { GROWTH_OPERATOR_UX_H3_QA_MARKER } from "@/lib/growth/operator-ux/operator-ux-h3-types"
import { GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER } from "@/lib/growth/operations/internal-outbound-ops-types"
import { GROWTH_DELIVERABILITY_INTELLIGENCE_QA_MARKER } from "@/lib/growth/deliverability/deliverability-intelligence-types"
import { GROWTH_REPUTATION_SAFE_SCALING_QA_MARKER } from "@/lib/growth/outbound/reputation-safe-scaling-types"
import { GROWTH_OUTBOUND_LIFECYCLE_OPS_QA_MARKER } from "@/lib/growth/outbound/lifecycle-ops-types"

const CHECKLIST_TONE: Record<
  keyof typeof GROWTH_SEND_INFRASTRUCTURE_CHECKLIST_STATUS_LABELS,
  "healthy" | "attention" | "critical" | "neutral"
> = {
  ready: "healthy",
  needs_setup: "attention",
  in_progress: "neutral",
  not_connected: "neutral",
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

function formatMailboxStatus(status: string): string {
  if (status === "connected") return "Connected"
  if (status === "paused") return "Paused"
  return status.replace(/_/g, " ")
}

export function GrowthInternalOutboundOperationsDashboardView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthInternalOutboundOperationsDashboard | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/operations/internal-outbound", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthInternalOutboundOperationsDashboard
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load send infrastructure.")
      }
      setDashboard(data.dashboard)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const snapshot = useMemo(
    () => (dashboard ? snapshotFromInternalOutboundDashboard(dashboard) : null),
    [dashboard],
  )

  const checklist = useMemo(
    () => (snapshot ? buildSendInfrastructureChecklist(snapshot) : []),
    [snapshot],
  )

  const summary = useMemo(
    () =>
      snapshot
        ? buildSendInfrastructureOperatorSummary({ checklist, snapshot })
        : { headline: "", connected: [], needsSetup: [], blockers: [], nextSteps: [] },
    [checklist, snapshot],
  )

  const providerCards = useMemo(
    () => (snapshot ? buildSendInfrastructureProviderCards(snapshot) : []),
    [snapshot],
  )

  const setupMode = snapshot ? isSendInfrastructureSetupMode(snapshot) : true
  const showOperationalMetrics = snapshot ? hasMeaningfulOutboundOperationalMetrics(snapshot) : false

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading outbound setup…
      </div>
    )
  }

  if (error || !dashboard || !snapshot) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        {error ?? "Dashboard unavailable."}
        <Button type="button" variant="outline" size="sm" className="ml-3" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    )
  }

  const dnsValidationEntry =
    dashboard.readiness_catalog.find((entry) => entry.surfaceId === "dns_validation") ?? null
  const deliverabilityEntry =
    dashboard.readiness_catalog.find((entry) => entry.surfaceId === "deliverability") ?? null

  return (
    <div
      className="flex flex-col gap-4"
      data-qa={GROWTH_SEND_INFRASTRUCTURE_OPERATOR_READY_QA_MARKER}
      data-qa-marker={GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER}
      data-h3-qa={GROWTH_OPERATOR_UX_H3_QA_MARKER}
    >
      <div
        data-qa={setupMode ? GROWTH_SEND_INFRASTRUCTURE_SETUP_MODE_QA_MARKER : GROWTH_SEND_INFRASTRUCTURE_OPERATIONAL_MODE_QA_MARKER}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-3xl text-sm text-muted-foreground">{summary.headline}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/admin/growth/operations/outbound">Outbound console</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/admin/growth/infrastructure/mailboxes">Mailboxes</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="mr-2 size-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        <GrowthEngineCard title="Outbound setup status" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Connected</p>
              {summary.connected.length > 0 ? (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {summary.connected.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Nothing fully connected yet.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Still needs setup</p>
              {summary.needsSetup.length > 0 ? (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {summary.needsSetup.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Core setup steps are complete.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blocking outbound</p>
              {summary.blockers.length > 0 ? (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {summary.blockers.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No hard blockers detected.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Do this next</p>
              {summary.nextSteps.length > 0 ? (
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                  {summary.nextSteps.slice(0, 5).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Review operational health below.</p>
              )}
            </div>
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Outbound readiness" className="mt-4">
          <ul className="divide-y divide-border/70">
            {checklist.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.href ? (
                      <Link href={item.href} className="text-sm font-medium hover:underline">
                        {item.label}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium">{item.label}</p>
                    )}
                    <GrowthBadge
                      label={GROWTH_SEND_INFRASTRUCTURE_CHECKLIST_STATUS_LABELS[item.status]}
                      tone={CHECKLIST_TONE[item.status]}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </GrowthEngineCard>

        <GrowthEngineCard title="Mailbox providers" icon={<Mail size={16} />} className="mt-4">
          <div className="grid gap-3 md:grid-cols-2">
            {providerCards.map((provider) => (
              <div key={provider.id} className="rounded-lg border border-border/80 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{provider.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{provider.detail}</p>
                  </div>
                  <GrowthBadge label={provider.healthLabel} tone={provider.healthTone} />
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Connection</dt>
                  <dd>{provider.connectionStatus === "connected" ? "Connected" : "Not connected"}</dd>
                  <dt className="text-muted-foreground">Mailboxes</dt>
                  <dd>{provider.mailboxesAttached}</dd>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>{provider.lastActivityLabel}</dd>
                </dl>
                <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
                  <Link href={provider.ctaHref}>{provider.ctaLabel}</Link>
                </Button>
              </div>
            ))}
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Sending domains" icon={<Shield size={16} />} className="mt-4">
          {dashboard.domains.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              No sender domains configured yet.{" "}
              <Link href="/admin/growth/infrastructure" className="font-medium text-foreground underline-offset-2 hover:underline">
                Add your first sending domain
              </Link>
              .
            </div>
          ) : (
            <div className="space-y-2">
              {dashboard.domains.map((domain) => {
                const guidance = buildDomainOperatorGuidance(domain)
                return (
                  <div key={domain.id} className="rounded-lg border border-border/80 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{domain.domain}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDomainVerificationLabel(domain.verificationLabel)}
                          {domain.lastVerifiedAt ? ` · Last checked ${formatDate(domain.lastVerifiedAt)}` : ""}
                        </p>
                      </div>
                      <GrowthBadge
                        label={formatDomainReadinessOperatorLabel(domain.readinessStatus)}
                        tone={
                          domain.readinessStatus === "live"
                            ? "healthy"
                            : domain.readinessStatus === "error"
                              ? "critical"
                              : "attention"
                        }
                      />
                    </div>
                    {guidance.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {guidance.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">DNS authentication looks ready for this domain.</p>
                    )}
                    <Button type="button" variant="outline" size="sm" className="mt-2" asChild>
                      <Link href="/admin/growth/infrastructure/deliverability">Review DNS setup</Link>
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </GrowthEngineCard>

        {setupMode ? (
          <GrowthEngineCard title="Get outbound running" className="mt-4">
            <div className="grid gap-3 md:grid-cols-3">
              {snapshot.connectedMailboxes === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-3 text-sm">
                  <p className="font-medium">No mailbox providers connected yet.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Add your first sending mailbox to start outbound setup.</p>
                  <Button type="button" variant="outline" size="sm" className="mt-2" asChild>
                    <Link href="/admin/growth/infrastructure/mailboxes">Connect mailbox</Link>
                  </Button>
                </div>
              ) : null}
              {snapshot.domainCount === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-3 text-sm">
                  <p className="font-medium">No sender domains configured.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Register a domain before verifying SPF, DKIM, and DMARC.</p>
                  <Button type="button" variant="outline" size="sm" className="mt-2" asChild>
                    <Link href="/admin/growth/infrastructure">Add sending domain</Link>
                  </Button>
                </div>
              ) : null}
              {snapshot.warmupActiveCount === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-3 text-sm">
                  <p className="font-medium">Warmup has not started.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Plan mailbox warmup before scaling send volume.</p>
                  <Button type="button" variant="outline" size="sm" className="mt-2" asChild>
                    <Link href="/admin/growth/infrastructure/warmup">Start warmup</Link>
                  </Button>
                </div>
              ) : null}
            </div>
          </GrowthEngineCard>
        ) : null}

        {showOperationalMetrics ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Connected mailboxes" value={String(snapshot.connectedMailboxes)} />
              <StatTile label="Pending approvals" value={String(snapshot.pendingApprovals)} />
              <StatTile label="Failed sends (24h)" value={String(snapshot.failedSends24h)} />
              <StatTile label="Unhealthy mailboxes" value={String(snapshot.unhealthyMailboxCount)} />
            </div>

            <GrowthEngineCard title="Connected mailboxes" icon={<Mail size={16} />} className="mt-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 pr-3">Address</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Health</th>
                      <th className="py-2 pr-3">Caps</th>
                      <th className="py-2 pr-3">Pool</th>
                      <th className="py-2">Last send</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.mailboxes.map((row) => (
                      <tr key={row.id} className="border-b border-border/60">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{row.emailAddress}</div>
                          <div className="text-muted-foreground">{row.providerFamily}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <GrowthBadge
                            label={formatMailboxStatus(row.status)}
                            tone={row.status === "connected" ? "healthy" : "attention"}
                          />
                        </td>
                        <td className="py-2 pr-3">{row.connectionHealth}</td>
                        <td className="py-2 pr-3">
                          {row.dailySendUsed}/{row.dailySendLimit}
                        </td>
                        <td className="py-2 pr-3">{row.senderPoolLabels.join(", ") || "—"}</td>
                        <td className="py-2">{formatDate(row.lastSuccessfulSendAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GrowthEngineCard>

            {dashboard.sender_pools.length > 0 ? (
              <GrowthEngineCard title="Sender pools" icon={<Users size={16} />} className="mt-4">
                <div className="space-y-2">
                  {dashboard.sender_pools.map((pool) => (
                    <div key={pool.id} className="rounded-lg border p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{pool.name}</span>
                        <GrowthBadge label={pool.status} tone={pool.status === "active" ? "healthy" : "neutral"} />
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        Active {pool.activeSenders} · Paused {pool.pausedSenders} · Unhealthy {pool.unhealthySenders} ·
                        Queue load {pool.queueLoad}
                      </p>
                    </div>
                  ))}
                </div>
              </GrowthEngineCard>
            ) : null}

            {snapshot.sent24h > 0 ? (
              <GrowthEngineCard title="Deliverability (24h)" icon={<Shield size={16} />} className="mt-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile label="Bounce rate" value={`${dashboard.deliverability.bounceRate24h}%`} />
                  <StatTile label="Complaint rate" value={`${dashboard.deliverability.complaintRate24h}%`} />
                  <StatTile label="Suppression hits" value={String(dashboard.deliverability.suppressionHits24h)} />
                  <StatTile label="Sent" value={String(dashboard.deliverability.sent24h)} />
                </div>
              </GrowthEngineCard>
            ) : null}
          </>
        ) : null}
      </div>

      <GrowthOperatorDiagnosticsDisclosure
        title="Developer diagnostics"
        description="Technical readiness flags, cron telemetry, execution command center, and engineering config."
      >
        <div className="space-y-3 text-xs text-muted-foreground">
          <p>
            Live DNS verification env:{" "}
            <code className="rounded bg-muted px-1 py-0.5">GROWTH_LIVE_DNS_VERIFICATION=true</code> (
            {snapshot.liveDnsEnabled ? "enabled" : "disabled"})
          </p>
          {dnsValidationEntry ? (
            <div className="rounded-lg border border-border/70 bg-background p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{dnsValidationEntry.title}</span>
                <GrowthInfrastructureReadinessBadge readiness={dnsValidationEntry.readiness} />
              </div>
              {dnsValidationEntry.readiness.detail ? <p className="mt-1">{dnsValidationEntry.readiness.detail}</p> : null}
              <p className="mt-1 opacity-80">
                Operator detail: {sanitizeInfrastructureReadinessDetailForOperator(dnsValidationEntry.readiness.detail) ?? "—"}
              </p>
            </div>
          ) : null}
          {deliverabilityEntry ? (
            <div className="rounded-lg border border-border/70 bg-background p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{deliverabilityEntry.title}</span>
                <GrowthInfrastructureReadinessBadge readiness={deliverabilityEntry.readiness} />
              </div>
              {deliverabilityEntry.readiness.detail ? <p className="mt-1">{deliverabilityEntry.readiness.detail}</p> : null}
            </div>
          ) : null}
        </div>
      <GrowthEngineCard title="Queue + cron health" icon={<Activity size={16} />}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Scheduled outreach" value={String(dashboard.queue_health.outreach_queue.scheduled)} />
          <StatTile label="Sequence jobs due" value={String(dashboard.queue_health.sequence_jobs.approved_due)} />
          <StatTile label="Suppression blocks (24h)" value={String(dashboard.deliverability.suppressionHits24h)} />
          <StatTile label="Sent (24h)" value={String(dashboard.deliverability.sent24h)} />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 pr-3">Cron route</th>
                <th className="py-2 pr-3">Last success</th>
                <th className="py-2 pr-3">Failures 24h</th>
                <th className="py-2">Duration</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.queue_health.cron_routes.map((route) => (
                <tr key={route.routeId} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-mono">{route.routeId}</td>
                  <td className="py-2 pr-3">{formatDate(route.lastSuccessAt)}</td>
                  <td className="py-2 pr-3">{route.failureCount24h}</td>
                  <td className="py-2">{route.lastDurationMs != null ? `${route.lastDurationMs}ms` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <div
        className="flex flex-col gap-5"
        data-qa-marker={GROWTH_REPUTATION_SAFE_SCALING_QA_MARKER}
      >
        <GrowthEngineCard title="Execution command center" icon={<Activity size={16} />}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Active campaign load"
              value={String(dashboard.execution_command_center.summary.activeCampaignLoad)}
            />
            <StatTile
              label="Deferred sends (24h)"
              value={String(dashboard.execution_command_center.summary.deferredSends24h)}
            />
            <StatTile
              label="Overloaded senders"
              value={String(dashboard.execution_command_center.summary.overloadedSenders)}
            />
            <StatTile
              label="Infrastructure risk"
              value={dashboard.execution_command_center.summary.infrastructureRiskLevel}
            />
            <StatTile
              label="Avg reply quality"
              value={String(dashboard.execution_command_center.summary.avgReplyQuality)}
            />
            <StatTile
              label="Degraded campaigns"
              value={String(dashboard.execution_command_center.summary.degradedCampaigns)}
            />
            <StatTile
              label="Throttled pools"
              value={String(dashboard.execution_command_center.summary.throttledPools)}
            />
            <StatTile
              label="Paused domains"
              value={String(dashboard.execution_command_center.summary.pausedDomains)}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {dashboard.execution_command_center.partial_telemetry_note}
          </p>
        </GrowthEngineCard>

        <div data-qa-marker={`${GROWTH_REPUTATION_SAFE_SCALING_QA_MARKER}-throughput`}>
          <GrowthEngineCard title="Throughput utilization" icon={<Server size={16} />}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 pr-3">Entity</th>
                    <th className="py-2 pr-3">Used / limit</th>
                    <th className="py-2 pr-3">Utilization</th>
                    <th className="py-2">Saturation</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.execution_command_center.throughput_utilization.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-3 text-muted-foreground">
                        No throughput data.
                      </td>
                    </tr>
                  ) : (
                    dashboard.execution_command_center.throughput_utilization.slice(0, 20).map((row) => (
                      <tr key={`${row.entityType}-${row.entityId ?? row.label}`} className="border-b border-border/60">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{row.label}</div>
                          <div className="text-muted-foreground">{row.entityType}</div>
                        </td>
                        <td className="py-2 pr-3">
                          {row.dailyUsed}/{row.dailyLimit}
                        </td>
                        <td className="py-2 pr-3">{row.utilizationPct}%</td>
                        <td className="py-2">
                          <GrowthBadge
                            label={row.saturationLevel}
                            tone={row.saturationLevel === "critical" ? "critical" : "neutral"}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GrowthEngineCard>
        </div>

        <div data-qa-marker={`${GROWTH_REPUTATION_SAFE_SCALING_QA_MARKER}-allocation`}>
          <GrowthEngineCard title="Infrastructure recommendations" icon={<Shield size={16} />}>
            <ul className="space-y-2 text-xs">
              {dashboard.execution_command_center.infrastructure_recommendations.length === 0 ? (
                <li className="text-muted-foreground">No recommendations — infrastructure within normal bounds.</li>
              ) : (
                dashboard.execution_command_center.infrastructure_recommendations.map((rec) => (
                  <li key={`${rec.type}-${rec.title}`} className="rounded-lg border p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{rec.title}</span>
                      <GrowthBadge label={rec.severity} tone={rec.severity === "critical" ? "critical" : "attention"} />
                    </div>
                    <p className="text-muted-foreground">{rec.detail}</p>
                    <p className="text-[10px] text-muted-foreground">Operator action required — no autonomous execution.</p>
                  </li>
                ))
              )}
            </ul>
          </GrowthEngineCard>
        </div>

        <GrowthEngineCard title="Sequence execution diagnostics" icon={<Server size={16} />}>
          <ul className="space-y-2 text-xs">
            {dashboard.execution_command_center.sequence_diagnostics.length === 0 ? (
              <li className="text-muted-foreground">No stuck or dead-letter jobs detected.</li>
            ) : (
              dashboard.execution_command_center.sequence_diagnostics.map((diag) => (
                <li key={diag.id} className="rounded-lg border p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{diag.title}</span>
                    <GrowthBadge label={diag.diagnosticType} tone={diag.severity === "critical" ? "critical" : "neutral"} />
                  </div>
                  <p className="text-muted-foreground">{diag.summary ?? diag.jobId}</p>
                </li>
              ))
            )}
          </ul>
        </GrowthEngineCard>
      </div>

      <div
        className="flex flex-col gap-5"
        data-qa-marker={GROWTH_DELIVERABILITY_INTELLIGENCE_QA_MARKER}
      >
        <GrowthEngineCard title="Deliverability intelligence" icon={<Shield size={16} />}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Unhealthy domains"
              value={String(dashboard.deliverability_intelligence.intelligence_summary.unhealthyDomainCount)}
            />
            <StatTile
              label="Degraded mailboxes"
              value={String(dashboard.deliverability_intelligence.intelligence_summary.degradedMailboxCount)}
            />
            <StatTile
              label="DNS failures"
              value={String(dashboard.deliverability_intelligence.intelligence_summary.dnsFailureCount)}
            />
            <StatTile
              label="Paused senders"
              value={String(dashboard.deliverability_intelligence.intelligence_summary.pausedSenderCount)}
            />
            <StatTile
              label="Bounce spike domains"
              value={String(dashboard.deliverability_intelligence.intelligence_summary.bounceSpikeDomains)}
            />
            <StatTile
              label="Complaint spike domains"
              value={String(dashboard.deliverability_intelligence.intelligence_summary.complaintSpikeDomains)}
            />
            <StatTile
              label="Webhook silence"
              value={String(dashboard.deliverability_intelligence.intelligence_summary.webhookOutageMailboxes)}
            />
            <StatTile
              label="Provider rejections"
              value={String(dashboard.deliverability_intelligence.intelligence_summary.providerRejectionSenders)}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Real telemetry only — no Postmaster, blacklist, or inbox placement integrations unless configured separately.
          </p>
        </GrowthEngineCard>

        <div data-qa-marker={`${GROWTH_DELIVERABILITY_INTELLIGENCE_QA_MARKER}-domain-readiness`}>
          <GrowthEngineCard title="Domain readiness cards" icon={<Shield size={16} />}>
            <div className="space-y-2">
              {dashboard.deliverability_intelligence.domain_readiness_cards.length === 0 ? (
                <p className="text-sm text-muted-foreground">No domains to assess.</p>
              ) : (
                dashboard.deliverability_intelligence.domain_readiness_cards.map((card) => (
                  <div key={card.domainId} className="rounded-lg border p-3 text-xs">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{card.domain}</p>
                        <p className="text-muted-foreground">
                          {card.verificationLabel} · Score {card.readinessScore} · Health {card.domainHealthScore} ·{" "}
                          {card.operationalStatus}
                        </p>
                      </div>
                      <GrowthBadge
                        label={card.domainRiskLevel}
                        tone={card.domainRiskLevel === "critical" ? "critical" : "neutral"}
                      />
                    </div>
                    {card.riskReasons.length > 0 ? (
                      <p className="mt-1 text-rose-800">{card.riskReasons.join(" ")}</p>
                    ) : null}
                    {card.recommendations.length > 0 ? (
                      <p className="mt-1 text-muted-foreground">{card.recommendations[0]}</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </GrowthEngineCard>
        </div>

        <div data-qa-marker={`${GROWTH_DELIVERABILITY_INTELLIGENCE_QA_MARKER}-timeline`}>
          <GrowthEngineCard title="Operational timeline" icon={<Activity size={16} />}>
            <ul className="space-y-2 text-xs">
              {dashboard.deliverability_intelligence.timeline_feed.length === 0 ? (
                <li className="text-muted-foreground">No normalized timeline events yet.</li>
              ) : (
                dashboard.deliverability_intelligence.timeline_feed.slice(0, 20).map((event) => (
                  <li key={event.id} className="rounded-lg border p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{event.title}</span>
                      <GrowthBadge label={event.normalizedType} tone="neutral" />
                    </div>
                    <p className="text-muted-foreground">{event.summary ?? event.normalizedType}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(event.occurredAt)}</p>
                  </li>
                ))
              )}
            </ul>
          </GrowthEngineCard>
        </div>

        <GrowthEngineCard title="Domain ↔ sender mapping" icon={<Users size={16} />}>
          <div className="space-y-2 text-xs">
            {dashboard.deliverability_intelligence.domain_sender_mappings.map((mapping) => (
              <div key={mapping.domainId} className="rounded-lg border p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{mapping.domain}</span>
                  <GrowthBadge
                    label={`${mapping.concentrationRisk} concentration`}
                    tone={mapping.concentrationRisk === "high" ? "attention" : "neutral"}
                  />
                </div>
                <p className="text-muted-foreground">
                  {mapping.senderCount} senders · {mapping.poolCount} pools · {mapping.pools.join(", ") || "no pools"}
                </p>
              </div>
            ))}
          </div>
        </GrowthEngineCard>
      </div>

      <div
        className="flex flex-col gap-5"
        data-qa-marker={GROWTH_OUTBOUND_LIFECYCLE_OPS_QA_MARKER}
      >
        <GrowthEngineCard title="Lifecycle management" icon={<Users size={16} />}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Active inboxes" value={String(dashboard.lifecycle_ops.inventory_summary.activeSenders)} />
            <StatTile label="Paused" value={String(dashboard.lifecycle_ops.inventory_summary.pausedSenders)} />
            <StatTile label="Retirement candidates" value={String(dashboard.lifecycle_ops.sustainability_metrics.retirementCandidateCount)} />
            <StatTile label="Inactive (21d+)" value={String(dashboard.lifecycle_ops.sustainability_metrics.inactiveInfrastructureCount)} />
          </div>
          <div className="mt-4 space-y-2 text-xs">
            {dashboard.lifecycle_ops.lifecycle_rows.slice(0, 12).map((row) => (
              <div key={row.senderAccountId} className="rounded-lg border p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{row.emailAddress}</span>
                  <GrowthBadge label={row.lifecycleStage} tone={row.lifecycleStage === "elevated_risk" ? "critical" : "neutral"} />
                </div>
                <p className="text-muted-foreground">
                  Trust {row.trustScore} · Fatigue {row.fatigueScore}
                  {row.inactivityDays != null ? ` · Inactive ${row.inactivityDays}d` : ""}
                  {row.lifecycleStageOverride ? " · MANUAL OVERRIDE" : ""}
                </p>
                {row.recommendations[0] ? <p className="text-[11px] text-amber-900">{row.recommendations[0]}</p> : null}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{dashboard.lifecycle_ops.partial_telemetry_note}</p>
        </GrowthEngineCard>

        <div data-qa-marker={`${GROWTH_OUTBOUND_LIFECYCLE_OPS_QA_MARKER}-maintenance`}>
          <GrowthEngineCard title="Maintenance queue" icon={<Server size={16} />}>
            <ul className="space-y-2 text-xs">
              {dashboard.lifecycle_ops.maintenance_tasks.length === 0 ? (
                <li className="text-muted-foreground">No open maintenance tasks.</li>
              ) : (
                dashboard.lifecycle_ops.maintenance_tasks.slice(0, 15).map((task) => (
                  <li key={task.id} className="rounded-lg border p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{task.title}</span>
                      <GrowthBadge label={task.severity} tone={task.severity === "critical" ? "critical" : "attention"} />
                    </div>
                    <p className="text-muted-foreground">{task.summary ?? task.taskType}</p>
                    <p className="text-[10px] text-muted-foreground">Recommendation only — operator action required.</p>
                  </li>
                ))
              )}
            </ul>
            {dashboard.lifecycle_ops.operational_alerts.length > 0 ? (
              <div className="mt-4 border-t pt-3">
                <p className="mb-2 text-xs font-medium">Operational alerts</p>
                <ul className="space-y-2 text-xs">
                  {dashboard.lifecycle_ops.operational_alerts.slice(0, 8).map((alert) => (
                    <li key={alert.id} className="rounded border p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>{alert.title}</span>
                        <GrowthBadge label={alert.category} tone="neutral" />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </GrowthEngineCard>
        </div>

        <div data-qa-marker={`${GROWTH_OUTBOUND_LIFECYCLE_OPS_QA_MARKER}-sustainability`}>
          <GrowthEngineCard title="Infrastructure sustainability" icon={<Shield size={16} />}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Avg inbox age (days)" value={String(dashboard.lifecycle_ops.sustainability_metrics.avgInboxAgeDays)} />
              <StatTile label="Aging senders (90d+)" value={String(dashboard.lifecycle_ops.sustainability_metrics.agingSenderCount)} />
              <StatTile label="Risk accumulation" value={String(dashboard.lifecycle_ops.sustainability_metrics.riskAccumulationScore)} />
              <StatTile
                label="Interventions (30d)"
                value={String(dashboard.lifecycle_ops.sustainability_metrics.operationalInterventions30d)}
              />
              <StatTile
                label="Available capacity"
                value={String(dashboard.lifecycle_ops.inventory_summary.availableDailyCapacity)}
              />
              <StatTile label="Used capacity" value={String(dashboard.lifecycle_ops.inventory_summary.usedDailyCapacity)} />
              <StatTile label="Domains" value={String(dashboard.lifecycle_ops.inventory_summary.totalDomains)} />
              <StatTile label="Mailboxes" value={String(dashboard.lifecycle_ops.inventory_summary.totalMailboxes)} />
            </div>
            {dashboard.lifecycle_ops.domain_rotation_recommendations.length > 0 ? (
              <ul className="mt-4 space-y-2 text-xs">
                {dashboard.lifecycle_ops.domain_rotation_recommendations.slice(0, 5).map((rec) => (
                  <li key={rec.domainId} className="rounded border p-2">
                    <span className="font-medium">{rec.title}</span>
                    <p className="text-muted-foreground">{rec.detail}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </GrowthEngineCard>
        </div>
      </div>

      <GrowthEngineCard title="Operational audit" icon={<Server size={16} />}>
        <ul className="space-y-2 text-xs">
          {dashboard.audit_events.length === 0 ? (
            <li className="text-muted-foreground">No audit events recorded yet.</li>
          ) : (
            dashboard.audit_events.map((event) => (
              <li key={event.id} className="rounded-lg border p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{event.title}</span>
                  <GrowthBadge label={event.severity} tone={event.severity === "critical" ? "critical" : "neutral"} />
                </div>
                <p className="text-muted-foreground">{event.summary ?? event.eventType}</p>
                <p className="text-[10px] text-muted-foreground">{formatDate(event.createdAt)}</p>
              </li>
            ))
          )}
        </ul>
      </GrowthEngineCard>
      </GrowthOperatorDiagnosticsDisclosure>
    </div>
  )
}
