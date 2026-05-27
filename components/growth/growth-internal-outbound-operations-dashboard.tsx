"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Activity, Loader2, Mail, RefreshCw, Server, Shield, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GrowthInfrastructureReadinessBadge,
  GrowthInfrastructureReadinessBanner,
} from "@/components/growth/growth-infrastructure-readiness-badge"
import type { GrowthInternalOutboundOperationsDashboard } from "@/lib/growth/operations/internal-outbound-operations-dashboard"
import { GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER } from "@/lib/growth/operations/internal-outbound-ops-types"

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
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
        throw new Error(data.message ?? "Could not load internal outbound operations.")
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading internal outbound operations…
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        {error ?? "Dashboard unavailable."}
        <Button type="button" variant="outline" size="sm" className="ml-3" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    )
  }

  const transportReadiness =
    dashboard.readiness_catalog.find((e) => e.surfaceId === "transport_send")?.readiness ?? {
      status: "internal" as const,
      label: "Internal",
    }

  return (
    <div className="flex flex-col gap-5" data-qa-marker={GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER}>
      <GrowthInfrastructureReadinessBanner title="Internal transport send plane" readiness={transportReadiness} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Connected mailboxes" value={String(dashboard.mailboxes.filter((m) => m.status === "connected").length)} />
        <StatTile label="Pending approvals" value={String(dashboard.queue_health.approvals.outreach_pending_approval)} />
        <StatTile label="Failed sends (24h)" value={String(dashboard.deliverability.failedSends24h)} />
        <StatTile label="Unhealthy mailboxes" value={String(dashboard.deliverability.unhealthyMailboxCount)} />
      </div>

      <GrowthEngineCard title="Google Workspace (live path)" icon={<Mail size={16} />}>
        <div className="flex flex-wrap items-center gap-2">
          <GrowthInfrastructureReadinessBadge
            readiness={{
              status: dashboard.google_provider.oauthConfigured ? "live" : "stub",
              label: dashboard.google_provider.oauthConfigured ? "Live" : "Stub",
              detail: dashboard.google_provider.oauthConfigured
                ? "OAuth configured for internal Google Workspace sending."
                : "Complete Google OAuth env + provider setup to enable live path.",
            }}
          />
          <span className="text-xs text-muted-foreground">
            Connected accounts: {dashboard.google_provider.connectedAccounts} · Last test send:{" "}
            {formatDate(dashboard.google_provider.lastTestSendAt)}
          </span>
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
          <Link href="/admin/growth/providers/setup">Provider setup</Link>
        </Button>
      </GrowthEngineCard>

      <GrowthEngineCard title="Mailboxes" icon={<Mail size={16} />}>
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
              {dashboard.mailboxes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-3 text-muted-foreground">
                    No mailbox connections registered.
                  </td>
                </tr>
              ) : (
                dashboard.mailboxes.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{row.emailAddress}</div>
                      <div className="text-muted-foreground">{row.providerFamily}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <GrowthBadge label={row.status} tone={row.status === "connected" ? "healthy" : "attention"} />
                    </td>
                    <td className="py-2 pr-3">{row.connectionHealth}</td>
                    <td className="py-2 pr-3">
                      {row.dailySendUsed}/{row.dailySendLimit}
                    </td>
                    <td className="py-2 pr-3">{row.senderPoolLabels.join(", ") || "—"}</td>
                    <td className="py-2">{formatDate(row.lastSuccessfulSendAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Domains (manual DNS verification)" icon={<Shield size={16} />}>
        <p className="mb-3 text-xs text-amber-900">
          MANUAL VERIFICATION REQUIRED — DNS state reflects stored flags only; no live DNS probes in Phase 1.
        </p>
        <div className="space-y-2">
          {dashboard.domains.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sender domains registered.</p>
          ) : (
            dashboard.domains.map((domain) => (
              <div key={domain.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3">
                <div>
                  <p className="font-medium">{domain.domain}</p>
                  <p className="text-xs text-muted-foreground">
                    SPF {domain.spfStatus} · DKIM {domain.dkimStatus} · DMARC {domain.dmarcStatus} · MX {domain.mxStatus}
                  </p>
                  {domain.reputationWarnings.length > 0 ? (
                    <p className="mt-1 text-xs text-rose-800">{domain.reputationWarnings.join(" ")}</p>
                  ) : null}
                </div>
                <GrowthInfrastructureReadinessBadge
                  readiness={{
                    status: domain.readinessStatus as "live" | "stub" | "degraded" | "error",
                    label: domain.readinessStatus,
                    detail: domain.manualVerificationRequired ? "Operator must verify DNS records externally." : undefined,
                  }}
                />
              </div>
            ))
          )}
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Sender pools" icon={<Users size={16} />}>
        <div className="space-y-2">
          {dashboard.sender_pools.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sender pools configured.</p>
          ) : (
            dashboard.sender_pools.map((pool) => (
              <div key={pool.id} className="rounded-lg border p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{pool.name}</span>
                  <GrowthBadge label={pool.status} tone={pool.status === "active" ? "healthy" : "neutral"} />
                </div>
                <p className="mt-1 text-muted-foreground">
                  Active {pool.activeSenders} · Paused {pool.pausedSenders} · Unhealthy {pool.unhealthySenders} · Queue
                  load {pool.queueLoad} · Rotation health {pool.rotationHealth}
                </p>
              </div>
            ))
          )}
        </div>
      </GrowthEngineCard>

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

      <GrowthEngineCard title="Deliverability (deterministic)" icon={<Shield size={16} />}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Bounce rate (24h)" value={`${dashboard.deliverability.bounceRate24h}%`} />
          <StatTile label="Complaint rate (24h)" value={`${dashboard.deliverability.complaintRate24h}%`} />
          <StatTile label="Suppression hits (24h)" value={String(dashboard.deliverability.suppressionHits24h)} />
          <StatTile label="Failed sends (24h)" value={String(dashboard.deliverability.failedSends24h)} />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Open/click rates require webhook engagement events — not estimated here.
        </p>
      </GrowthEngineCard>

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

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/admin/growth/infrastructure/mailboxes">Mailboxes</Link>
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 size-3.5" />
          Refresh
        </Button>
      </div>
    </div>
  )
}
