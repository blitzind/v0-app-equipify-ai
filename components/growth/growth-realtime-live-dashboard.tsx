"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"

type DashboardPayload = {
  stats: { liveCount: number; preparingCount: number; completedToday: number }
  liveSessions: Array<{
    id: string
    leadId: string
    companyName: string
    status: string
    transcriptStatus: string
    riskFlags: string[]
    talkRatio: { repTalkPercent: number; prospectTalkPercent: number; inGoalRange: boolean }
    updatedAt: string
  }>
  topObjections: Array<{ key: string; count: number }>
  buyingSignalsDetected: Array<{ key: string; count: number }>
  riskMonitoringTrends: Array<{ flag: string; count: number }>
  talkRatioTrends: { averageRepTalkPercent: number; inGoalRangeCount: number; sampleSize: number }
  discoveryCoverage: Array<{ area: string; missingCount: number }>
}

export function GrowthRealtimeLiveDashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/calls/live/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: DashboardPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load live dashboard.")
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
        Loading live call intelligence…
      </div>
    )
  }

  if (error && !dashboard) return <p className="text-sm text-rose-600">{error}</p>
  if (!dashboard) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Live sessions" value={dashboard.stats.liveCount} />
          <StatTile label="Preparing" value={dashboard.stats.preparingCount} />
          <StatTile label="Completed today" value={dashboard.stats.completedToday} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <GrowthEngineCard title="Live sessions">
        {dashboard.liveSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active realtime sessions.</p>
        ) : (
          <ul className="space-y-2">
            {dashboard.liveSessions.map((session) => (
              <li key={session.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link
                      href={`/admin/growth/leads?open=${session.leadId}&focus=call-copilot`}
                      className="font-medium hover:underline"
                    >
                      {session.companyName}
                    </Link>
                    <p className="text-muted-foreground">
                      {session.status.replace(/_/g, " ")} · transcript {session.transcriptStatus}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <GrowthBadge label={`Rep ${session.talkRatio.repTalkPercent}%`} tone="neutral" />
                    {session.riskFlags.slice(0, 2).map((flag) => (
                      <GrowthBadge key={flag} label={flag.replace(/_/g, " ")} tone="attention" />
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <BucketList title="Top objections" rows={dashboard.topObjections.map((row) => ({ label: row.key, value: row.count }))} />
        <BucketList
          title="Buying signals detected"
          rows={dashboard.buyingSignalsDetected.map((row) => ({ label: row.key, value: row.count }))}
        />
      </div>

      <GrowthEngineCard title="Talk ratio trends">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Avg rep talk" value={`${dashboard.talkRatioTrends.averageRepTalkPercent}%`} />
          <StatTile label="In goal range" value={dashboard.talkRatioTrends.inGoalRangeCount} />
          <StatTile label="Sample size" value={dashboard.talkRatioTrends.sampleSize} />
        </div>
      </GrowthEngineCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <BucketList
          title="Discovery coverage gaps"
          rows={dashboard.discoveryCoverage.map((row) => ({ label: row.area, value: row.missingCount }))}
        />
        <BucketList
          title="Risk monitoring trends"
          rows={dashboard.riskMonitoringTrends.map((row) => ({ label: row.flag, value: row.count }))}
        />
      </div>
    </div>
  )
}

function BucketList({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  return (
    <GrowthEngineCard title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <span>{row.label.replace(/_/g, " ")}</span>
              <span className="font-semibold tabular-nums">{row.value}</span>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}
