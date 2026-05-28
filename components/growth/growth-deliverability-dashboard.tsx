"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { dnsHealthTierLabel } from "@/lib/growth/deliverability/dns-health"
import type {
  GrowthDeliverabilityDashboard,
  GrowthDeliverabilityDomainRow,
  GrowthDeliverabilityEvent,
} from "@/lib/growth/deliverability/deliverability-types"
import { GROWTH_DNS_DELIVERABILITY_QA_MARKER } from "@/lib/growth/deliverability/deliverability-types"

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
}

export function GrowthDeliverabilityDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthDeliverabilityDashboard | null>(null)
  const [domains, setDomains] = useState<GrowthDeliverabilityDomainRow[]>([])
  const [topIssues, setTopIssues] = useState<string[]>([])
  const [events, setEvents] = useState<GrowthDeliverabilityEvent[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/deliverability/dns-dashboard")
      const payload = (await response.json()) as DashboardPayload
      if (!response.ok) {
        throw new Error(payload.message ?? "Could not load deliverability dashboard.")
      }
      setDashboard(payload.dashboard ?? null)
      setDomains(payload.domains ?? [])
      setTopIssues(payload.top_issues ?? [])
      setEvents(payload.events ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load deliverability dashboard.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const recommendedFixes = useMemo(() => dashboard?.top_recommendations ?? [], [dashboard])

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
        Loading deliverability intelligence…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {GROWTH_DNS_DELIVERABILITY_QA_MARKER} · Stub-safe DNS intelligence — no live DNS, sending, or inbox placement.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/infrastructure/mailboxes">Mailbox Connections</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/infrastructure/warmup">Warmup</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/infrastructure">Sender Infrastructure</Link>
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

      <GrowthEngineCard title="DNS Health">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Healthy" value={String(dashboard?.healthy_count ?? 0)} />
          <StatTile label="Warning" value={String(dashboard?.warning_count ?? 0)} />
          <StatTile label="Critical" value={String(dashboard?.critical_count ?? 0)} />
          <StatTile label="Average Score" value={`${dashboard?.average_score ?? 0}%`} />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Authentication Coverage">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="SPF" value={`${dashboard?.spf_coverage_percent ?? 0}%`} />
          <StatTile label="DKIM" value={`${dashboard?.dkim_coverage_percent ?? 0}%`} />
          <StatTile label="DMARC" value={`${dashboard?.dmarc_coverage_percent ?? 0}%`} />
          <StatTile label="MX" value={`${dashboard?.mx_coverage_percent ?? 0}%`} />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Domain Table">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled>
            Live DNS Validation
            <GrowthBadge label="Coming Soon" tone="neutral" className="ml-2" />
          </Button>
        </div>
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
                <th className="px-2 py-2">Last Check</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {domains.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-2 py-6 text-muted-foreground">
                    No sender domains yet. Register senders in Infrastructure to seed domains for deliverability checks.
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
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={Boolean(actionLoading)}
                          onClick={() => void validateDomain(row.domain_id)}
                        >
                          Validate Domain
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <GrowthEngineCard title="Recommendations Panel">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top Issues</p>
              {topIssues.length === 0 ? (
                <p className="text-sm text-muted-foreground">No outstanding DNS issues detected.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {topIssues.map((issue) => (
                    <li key={issue} className="rounded-md border border-border/70 px-2.5 py-1.5">
                      {issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended Fixes</p>
              {recommendedFixes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recommendations yet.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {recommendedFixes.map((item) => (
                    <li key={item.recommendation} className="flex items-center justify-between rounded-md border border-border/70 px-2.5 py-1.5">
                      <span>{item.recommendation}</span>
                      <GrowthBadge label={`${item.count}`} tone="neutral" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Health Feed">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliverability events yet.</p>
          ) : (
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
          )}
        </GrowthEngineCard>
      </div>
    </div>
  )
}
