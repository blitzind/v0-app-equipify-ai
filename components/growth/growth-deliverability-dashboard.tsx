"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Circle, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GrowthInfrastructureReadinessBadge,
} from "@/components/growth/growth-infrastructure-readiness-badge"
import { GrowthDomainDeliverabilitySetupDrawer } from "@/components/growth/growth-domain-deliverability-setup-drawer"
import { GrowthOperatorDiagnosticsDisclosure } from "@/components/growth/growth-operator-diagnostics-disclosure"
import { dnsHealthTierLabel } from "@/lib/growth/deliverability/dns-health"
import {
  buildDnsSetupChecklist,
  buildDnsSetupOperatorSummary,
  GROWTH_DNS_SETUP_CHECKLIST_STATUS_LABELS,
  GROWTH_DNS_SETUP_OPERATOR_READY_QA_MARKER,
  hasMeaningfulDnsDashboardMetrics,
  sanitizeInfrastructureReadinessDetailForOperator,
} from "@/lib/growth/deliverability/dns-setup-operator-types"
import type {
  GrowthDeliverabilityDashboard,
  GrowthDeliverabilityDomainRow,
  GrowthDeliverabilityEvent,
} from "@/lib/growth/deliverability/deliverability-types"
import { GROWTH_DNS_DELIVERABILITY_QA_MARKER } from "@/lib/growth/deliverability/deliverability-types"
import type { GrowthInfrastructureReadinessCatalogEntry } from "@/lib/growth/infrastructure/infrastructure-readiness-types"
import { hasActionableDnsSetupStatus } from "@/lib/growth/operator-ux/operator-attention-utils"

const TIER_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral" | "blocked"> = {
  healthy: "healthy",
  warning: "attention",
  degraded: "attention",
  critical: "critical",
  low: "healthy",
  medium: "attention",
  high: "attention",
}

const SEVERITY_TONE: Record<string, "healthy" | "medium" | "attention" | "critical" | "neutral"> = {
  low: "neutral",
  medium: "medium",
  high: "attention",
  critical: "critical",
}

const CHECKLIST_TONE: Record<
  keyof typeof GROWTH_DNS_SETUP_CHECKLIST_STATUS_LABELS,
  "healthy" | "attention" | "critical" | "neutral"
> = {
  ready: "healthy",
  needs_setup: "attention",
  not_connected: "neutral",
  internal_only: "neutral",
}

function boolBadge(value: boolean): { label: string; tone: "healthy" | "critical" | "neutral" } {
  return value ? { label: "Valid", tone: "healthy" } : { label: "Missing", tone: "critical" }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

type DashboardPayload = {
  ok?: boolean
  dashboard?: GrowthDeliverabilityDashboard
  domains?: GrowthDeliverabilityDomainRow[]
  top_issues?: string[]
  events?: GrowthDeliverabilityEvent[]
  message?: string
  operator_context?: {
    live_dns_verification_enabled?: boolean
  }
}

export function GrowthDeliverabilityDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthDeliverabilityDashboard | null>(null)
  const [domains, setDomains] = useState<GrowthDeliverabilityDomainRow[]>([])
  const [topIssues, setTopIssues] = useState<string[]>([])
  const [events, setEvents] = useState<GrowthDeliverabilityEvent[]>([])
  const [liveDnsEnabled, setLiveDnsEnabled] = useState(false)
  const [readinessCatalog, setReadinessCatalog] = useState<GrowthInfrastructureReadinessCatalogEntry[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [setupDrawerDomain, setSetupDrawerDomain] = useState<GrowthDeliverabilityDomainRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dashboardResponse, readinessResponse] = await Promise.all([
        fetch("/api/platform/growth/deliverability/dns-dashboard"),
        fetch("/api/platform/growth/infrastructure/readiness", { cache: "no-store" }),
      ])
      const payload = (await dashboardResponse.json()) as DashboardPayload
      if (!dashboardResponse.ok) {
        throw new Error(payload.message ?? "Could not load DNS setup.")
      }
      const readinessPayload = (await readinessResponse.json()) as {
        catalog?: GrowthInfrastructureReadinessCatalogEntry[]
      }

      setDashboard(payload.dashboard ?? null)
      setDomains(payload.domains ?? [])
      setTopIssues(payload.top_issues ?? [])
      setEvents(payload.events ?? [])
      setLiveDnsEnabled(Boolean(payload.operator_context?.live_dns_verification_enabled))
      setReadinessCatalog(readinessPayload.catalog ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load DNS setup.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const checklist = useMemo(
    () =>
      buildDnsSetupChecklist({
        domains,
        liveDnsEnabled,
        readinessCatalog,
      }),
    [domains, liveDnsEnabled, readinessCatalog],
  )

  const summary = useMemo(
    () =>
      buildDnsSetupOperatorSummary({
        checklist,
        liveDnsEnabled,
        domainCount: domains.length,
      }),
    [checklist, domains.length, liveDnsEnabled],
  )

  const showMetricCards = useMemo(
    () =>
      hasMeaningfulDnsDashboardMetrics({
        domainCount: domains.length,
        liveDnsEnabled,
        dashboard,
        domains,
      }),
    [dashboard, domains, liveDnsEnabled],
  )

  const recommendedFixes = useMemo(() => dashboard?.top_recommendations ?? [], [dashboard])
  const showRecommendations = topIssues.length > 0 || recommendedFixes.length > 0
  const showHealthFeed = events.length > 0

  const dnsValidationEntry = readinessCatalog.find((entry) => entry.surfaceId === "dns_validation") ?? null
  const deliverabilityEntry = readinessCatalog.find((entry) => entry.surfaceId === "deliverability") ?? null

  async function validateDomain(domainId: string) {
    setActionLoading(domainId)
    setError(null)
    try {
      const response = await fetch(`/api/platform/growth/deliverability/domain/${domainId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) {
        throw new Error(payload.message ?? "Domain validation failed.")
      }
      await load()
    } catch (validateError) {
      setError(validateError instanceof Error ? validateError.message : "Domain validation failed.")
    } finally {
      setActionLoading(null)
    }
  }

  async function resolveEvent(eventId: string) {
    setActionLoading(`resolve-${eventId}`)
    setError(null)
    try {
      const response = await fetch(`/api/platform/growth/deliverability/events/${eventId}`, { method: "PATCH" })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) {
        throw new Error(payload.message ?? "Could not resolve event.")
      }
      await load()
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Could not resolve event.")
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading DNS setup…
      </div>
    )
  }

  return (
    <div className="space-y-4" data-qa={GROWTH_DNS_SETUP_OPERATOR_READY_QA_MARKER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted-foreground">{summary.headline}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/infrastructure/mailboxes">Mailbox connections</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/infrastructure/warmup">Warmup</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/infrastructure">Sender infrastructure</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={Boolean(actionLoading)}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      {hasActionableDnsSetupStatus(summary) ? (
      <GrowthEngineCard title="Setup status">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What is working</p>
            {summary.workingToday.length > 0 ? (
              <ul className="mt-2 space-y-2 text-sm">
                {summary.workingToday.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Complete the checklist below to activate DNS setup.</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Not connected yet</p>
            {summary.notConnectedYet.length > 0 ? (
              <ul className="mt-2 space-y-2 text-sm">
                {summary.notConnectedYet.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Do this next</p>
            {summary.nextSteps.length > 0 ? (
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
                {summary.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            ) : null}
          </div>
        </div>
      </GrowthEngineCard>
      ) : null}

      <GrowthEngineCard title="Setup checklist">
        <ul className="divide-y divide-border/70">
          {checklist.map((item) => (
            <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {item.href ? (
                    <Link href={item.href} className="text-sm font-medium text-foreground hover:underline">
                      {item.label}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                  )}
                  <GrowthBadge
                    label={GROWTH_DNS_SETUP_CHECKLIST_STATUS_LABELS[item.status]}
                    tone={CHECKLIST_TONE[item.status]}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </GrowthEngineCard>

      {!showMetricCards ? (
        <GrowthEngineCard title="DNS setup preview">
          <p className="text-sm text-muted-foreground">
            Live DNS verification and mailbox placement checks are not connected yet. Add sending domains and complete
            the checklist above before expecting live health scores here.
          </p>
        </GrowthEngineCard>
      ) : (
        <>
          <GrowthEngineCard title="DNS health">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile label="Healthy" value={String(dashboard?.healthy_count ?? 0)} />
              <StatTile label="Warning" value={String(dashboard?.warning_count ?? 0)} />
              <StatTile label="Critical" value={String(dashboard?.critical_count ?? 0)} />
              <StatTile label="Average score" value={`${dashboard?.average_score ?? 0}%`} />
            </div>
          </GrowthEngineCard>

          <GrowthEngineCard title="Authentication coverage">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile label="SPF" value={`${dashboard?.spf_coverage_percent ?? 0}%`} />
              <StatTile label="DKIM" value={`${dashboard?.dkim_coverage_percent ?? 0}%`} />
              <StatTile label="DMARC" value={`${dashboard?.dmarc_coverage_percent ?? 0}%`} />
              <StatTile label="MX" value={`${dashboard?.mx_coverage_percent ?? 0}%`} />
            </div>
          </GrowthEngineCard>
        </>
      )}

      <GrowthEngineCard title="Sending domains">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2">Domain</th>
                <th className="px-2 py-2">SPF</th>
                <th className="px-2 py-2">DKIM</th>
                <th className="px-2 py-2">DMARC</th>
                <th className="px-2 py-2">MX</th>
                <th className="px-2 py-2">Health</th>
                <th className="px-2 py-2">Deliverability</th>
                <th className="px-2 py-2">Risk</th>
                <th className="px-2 py-2">Last check</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {domains.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-2 py-4 text-muted-foreground">
                    No sending domains yet.{" "}
                    <Link href="/admin/growth/infrastructure" className="font-medium text-foreground underline-offset-2 hover:underline">
                      Register senders in Infrastructure
                    </Link>{" "}
                    to start DNS setup.
                  </td>
                </tr>
              ) : (
                domains.map((row) => {
                  const spf = boolBadge(row.spf_present && row.spf_valid)
                  const dkim = boolBadge(row.dkim_present && row.dkim_valid)
                  const dmarc = boolBadge(row.dmarc_present && row.dmarc_valid)
                  const mx = boolBadge(row.mx_present && row.mx_valid)
                  return (
                    <tr key={row.domain_id} className="border-b border-border/60">
                      <td className="px-2 py-3 font-medium">{row.domain}</td>
                      <td className="px-2 py-3">
                        <GrowthBadge label={spf.label} tone={spf.tone} />
                      </td>
                      <td className="px-2 py-3">
                        <GrowthBadge label={dkim.label} tone={dkim.tone} />
                      </td>
                      <td className="px-2 py-3">
                        <GrowthBadge label={dmarc.label} tone={dmarc.tone} />
                      </td>
                      <td className="px-2 py-3">
                        <GrowthBadge label={mx.label} tone={mx.tone} />
                      </td>
                      <td className="px-2 py-3">
                        <GrowthBadge
                          label={dnsHealthTierLabel(row.health_tier)}
                          tone={TIER_TONE[row.health_tier] ?? "neutral"}
                        />
                      </td>
                      <td className="px-2 py-3">{row.deliverability_score}%</td>
                      <td className="px-2 py-3">
                        <GrowthBadge label={row.risk_level} tone={TIER_TONE[row.risk_level] ?? "neutral"} />
                      </td>
                      <td className="px-2 py-3">{formatDate(row.last_checked_at)}</td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setSetupDrawerDomain(row)}
                          >
                            View Setup Instructions
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={Boolean(actionLoading)}
                            onClick={() => void validateDomain(row.domain_id)}
                          >
                            Validate domain
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      {showRecommendations || showHealthFeed ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {showRecommendations ? (
            <GrowthEngineCard title="Recommendations">
              <div className="space-y-4">
                {topIssues.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top issues</p>
                    <ul className="space-y-1.5 text-sm">
                      {topIssues.map((issue) => (
                        <li key={issue} className="rounded-md border border-border/70 px-2.5 py-1.5">
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {recommendedFixes.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Recommended fixes
                    </p>
                    <ul className="space-y-1.5 text-sm">
                      {recommendedFixes.map((item) => (
                        <li
                          key={item.recommendation}
                          className="flex items-center justify-between rounded-md border border-border/70 px-2.5 py-1.5"
                        >
                          <span>{item.recommendation}</span>
                          <GrowthBadge label={`${item.count}`} tone="neutral" />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </GrowthEngineCard>
          ) : null}

          {showHealthFeed ? (
            <GrowthEngineCard title="Health feed">
              <ul className="space-y-3">
                {events.map((event) => (
                  <li key={event.id} className="rounded-lg border border-border/80 bg-background px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{event.title}</p>
                      <GrowthBadge label={event.severity} tone={SEVERITY_TONE[event.severity] ?? "neutral"} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.domain ? `${event.domain} · ` : ""}
                      {formatDate(event.created_at)}
                    </p>
                    <p className="mt-1 text-sm text-foreground/90">{event.description}</p>
                    {!event.resolved ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        disabled={Boolean(actionLoading)}
                        onClick={() => void resolveEvent(event.id)}
                      >
                        Resolve
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </GrowthEngineCard>
          ) : null}
        </div>
      ) : null}

      <GrowthDomainDeliverabilitySetupDrawer
        domainId={setupDrawerDomain?.domain_id ?? null}
        domainLabel={setupDrawerDomain?.domain ?? null}
        open={Boolean(setupDrawerDomain)}
        onOpenChange={(open) => {
          if (!open) setSetupDrawerDomain(null)
        }}
        onDomainUpdated={() => void load()}
      />

      <GrowthOperatorDiagnosticsDisclosure
        title="Developer diagnostics"
        description="Technical readiness flags, QA markers, and infrastructure config details."
      >
        <div className="space-y-3 text-xs text-muted-foreground">
          <p>
            QA markers: {GROWTH_DNS_SETUP_OPERATOR_READY_QA_MARKER}, {GROWTH_DNS_DELIVERABILITY_QA_MARKER}
          </p>
          <p>
            Live DNS verification env:{" "}
            <code className="rounded bg-muted px-1 py-0.5">GROWTH_LIVE_DNS_VERIFICATION=true</code> (
            {liveDnsEnabled ? "enabled" : "disabled"})
          </p>
          {dnsValidationEntry ? (
            <div className="rounded-lg border border-border/70 bg-background p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{dnsValidationEntry.title}</span>
                <GrowthInfrastructureReadinessBadge readiness={dnsValidationEntry.readiness} />
              </div>
              {dnsValidationEntry.readiness.detail ? (
                <p className="mt-1">{dnsValidationEntry.readiness.detail}</p>
              ) : null}
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
              {deliverabilityEntry.readiness.detail ? (
                <p className="mt-1">{deliverabilityEntry.readiness.detail}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </GrowthOperatorDiagnosticsDisclosure>
    </div>
  )
}
