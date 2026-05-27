"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Activity, AlertTriangle, Loader2, RefreshCw, Server } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GrowthInfrastructureReadinessBadge,
  GrowthInfrastructureReadinessBanner,
} from "@/components/growth/growth-infrastructure-readiness-badge"
import type { GrowthOutboundOperationsDashboard } from "@/lib/growth/operations/outbound-operations-dashboard"
import { GROWTH_CRON_TELEMETRY_QA_MARKER } from "@/lib/growth/runtime/cron-telemetry-types"

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

export function GrowthOutboundOperationsDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthOutboundOperationsDashboard | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/operations/outbound", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthOutboundOperationsDashboard
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load outbound operations dashboard.")
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

  const transportReadiness =
    dashboard.readiness_catalog.find((entry) => entry.surfaceId === "transport_send")?.readiness ?? {
      status: "internal" as const,
      label: "Internal",
      detail: "Transport readiness unavailable.",
    }

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
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        {error ?? "Dashboard unavailable."}
        <Button type="button" variant="outline" size="sm" className="ml-3" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5" data-qa-marker={GROWTH_CRON_TELEMETRY_QA_MARKER}>
      <GrowthInfrastructureReadinessBanner
        title="Transport send plane"
        readiness={transportReadiness}
      />

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Outreach pending approval" value={String(dashboard.approvals.outreach_pending_approval)} />
        <StatTile label="Sequence pending approval" value={String(dashboard.approvals.sequence_pending_approval)} />
        <StatTile label="Failed sends (24h)" value={String(dashboard.transport.failed_attempts_24h)} />
        <StatTile label="Suppression blocks (24h)" value={String(dashboard.suppression.pre_send_blocks_24h)} />
      </div>

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

      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 size-3.5" />
          Refresh
        </Button>
      </div>
    </div>
  )
}
