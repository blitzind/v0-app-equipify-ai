"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthComplianceDashboard } from "@/lib/growth/compliance/compliance-types"
import {
  GROWTH_COMPLIANCE_SUPPRESSION_QA_MARKER,
  maskComplianceEmailHash,
} from "@/lib/growth/compliance/compliance-types"
import { senderReputationTierLabel } from "@/lib/growth/compliance/sender-reputation"

function formatRate(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

const REPUTATION_TONE: Record<string, "healthy" | "attention" | "warning" | "critical" | "neutral"> = {
  healthy: "healthy",
  monitor: "neutral",
  warning: "warning",
  critical: "critical",
}

export function GrowthComplianceDashboardPanel() {
  const [dashboard, setDashboard] = useState<GrowthComplianceDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/compliance/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthComplianceDashboard
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load compliance dashboard.")
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

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading compliance dashboard…
      </div>
    )
  }

  if (error && !dashboard) {
    return <p className="text-sm text-rose-600">{error}</p>
  }

  if (!dashboard) return null

  const reputationTier = dashboard.senderReputation.tier

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        {GROWTH_COMPLIANCE_SUPPRESSION_QA_MARKER} · Hashed recipient identity only. Human authority required.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Hard bounce rate" value={formatRate(dashboard.hardBounceRate)} />
          <StatTile label="Complaint rate" value={formatRate(dashboard.complaintRate)} />
          <StatTile label="Suppression count" value={dashboard.suppressionCount} />
          <StatTile label="Sender reputation" value={dashboard.senderReputation.score} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <GrowthEngineCard title="Sender health" icon={<ShieldAlert className="size-4" />}>
        <div className="flex flex-wrap items-center gap-3">
          <GrowthBadge
            label={senderReputationTierLabel(reputationTier)}
            tone={REPUTATION_TONE[reputationTier] ?? "neutral"}
          />
          <span className="text-sm text-muted-foreground">
            Score {dashboard.senderReputation.score} · Hard {dashboard.senderReputation.hardBounces} · Complaints{" "}
            {dashboard.senderReputation.complaints}
          </span>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Suppression table">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Email</th>
                <th className="px-2 py-2 font-medium">Reason</th>
                <th className="px-2 py-2 font-medium">Scope</th>
                <th className="px-2 py-2 font-medium">Created</th>
                <th className="px-2 py-2 font-medium">Expires</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.suppressions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                    No active suppressions.
                  </td>
                </tr>
              ) : (
                dashboard.suppressions.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="px-2 py-2 font-mono text-xs">{maskComplianceEmailHash(row.emailHash)}</td>
                    <td className="px-2 py-2">{row.reason}</td>
                    <td className="px-2 py-2">{row.leadId ? "lead" : "global"}</td>
                    <td className="px-2 py-2">{formatDate(row.createdAt)}</td>
                    <td className="px-2 py-2">{formatDate(row.expiresAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Deliverability compliance risks">
        <p className="text-sm text-muted-foreground">
          Bounce rate {formatRate(dashboard.hardBounceRate)} · Complaint rate {formatRate(dashboard.complaintRate)}.
          Review bounce, complaint, and unsubscribe spikes in Deliverability Ops.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/admin/growth/providers/deliverability-ops">Open Deliverability Ops</Link>
        </Button>
      </GrowthEngineCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <GrowthEngineCard title="Bounce feed">
          {dashboard.recentBounces.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bounces recorded.</p>
          ) : (
            <ul className="space-y-2">
              {dashboard.recentBounces.map((bounce) => (
                <li key={bounce.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <GrowthBadge label={bounce.bounceType} tone={bounce.retryAllowed ? "attention" : "critical"} />
                    <span className="text-xs text-muted-foreground">{formatDate(bounce.occurredAt)}</span>
                  </div>
                  <p className="text-muted-foreground">
                    {bounce.providerLabel} · {bounce.senderLabel}
                  </p>
                  {bounce.providerReason ? <p className="text-xs">{bounce.providerReason}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Complaint feed">
          {dashboard.recentComplaints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No complaints recorded.</p>
          ) : (
            <ul className="space-y-2">
              {dashboard.recentComplaints.map((complaint) => (
                <li key={complaint.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <GrowthBadge label={complaint.complaintType} tone="critical" />
                    <span className="text-xs text-muted-foreground">{formatDate(complaint.occurredAt)}</span>
                  </div>
                  <p className="text-muted-foreground">
                    {complaint.providerLabel} · {complaint.senderLabel}
                  </p>
                  {complaint.providerReason ? <p className="text-xs">{complaint.providerReason}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>
      </div>
    </div>
  )
}
