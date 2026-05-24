"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plug, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { RealtimeProviderConnection } from "@/lib/growth/realtime/providers/provider-types"

type DashboardPayload = {
  stats: {
    connectionCount: number
    connectedCount: number
    averageGuidanceLatencyMs: number
    p95GuidanceLatencyMs: number
    averageTranscriptQualityScore: number
    providerFailoverCount: number
    providerDisconnectCount: number
    providerRecoverySuccessRate: number
  }
  connections: RealtimeProviderConnection[]
  coachingResponsiveness: {
    averageGuidanceLatencyMs: number
    p95GuidanceLatencyMs: number
    sampleSize: number
    targetLatencyMs: number
  }
}

export function GrowthRealtimeProvidersDashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/calls/providers/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: DashboardPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load provider dashboard.")
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

  async function validateConnection(connectionId: string) {
    setActing(connectionId)
    try {
      await fetch(`/api/platform/growth/realtime/providers/connections/${connectionId}/validate`, {
        method: "POST",
      })
      await load()
    } finally {
      setActing(null)
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading provider connections…
      </div>
    )
  }

  if (error && !dashboard) return <p className="text-sm text-rose-600">{error}</p>
  if (!dashboard) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Connections" value={dashboard.stats.connectionCount} />
          <StatTile label="Connected" value={dashboard.stats.connectedCount} />
          <StatTile label="Avg transcript quality" value={dashboard.stats.averageTranscriptQualityScore} />
          <StatTile label="Recovery success" value={`${dashboard.stats.providerRecoverySuccessRate}%`} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <GrowthEngineCard title="Coaching Responsiveness">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            label="Avg guidance latency"
            value={`${dashboard.coachingResponsiveness.averageGuidanceLatencyMs}ms`}
            hint={`Target ${dashboard.coachingResponsiveness.targetLatencyMs}ms`}
          />
          <StatTile label="P95 guidance latency" value={`${dashboard.coachingResponsiveness.p95GuidanceLatencyMs}ms`} />
          <StatTile label="Samples" value={dashboard.coachingResponsiveness.sampleSize} />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Provider reliability">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Failovers" value={dashboard.stats.providerFailoverCount} />
          <StatTile label="Disconnects" value={dashboard.stats.providerDisconnectCount} />
          <StatTile label="Recovery rate" value={`${dashboard.stats.providerRecoverySuccessRate}%`} />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Provider connections">
        {dashboard.connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No realtime transcript providers configured yet.</p>
        ) : (
          <ul className="space-y-3">
            {dashboard.connections.map((connection) => (
              <li key={connection.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Plug className="size-4 text-muted-foreground" />
                      <p className="font-medium">{connection.label}</p>
                      <GrowthBadge label={connection.provider.replace(/_/g, " ")} tone="neutral" />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Status {connection.status} · Health {connection.healthStatus}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acting === connection.id}
                    onClick={() => void validateConnection(connection.id)}
                  >
                    Validate
                  </Button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4 text-sm">
                  <Metric label="Latency" value={`${connection.averageLatencyMs}ms`} />
                  <Metric label="Quality" value={String(connection.transcriptQualityScore)} />
                  <Metric label="Realtime" value={connection.capabilitySnapshot.realtime ? "Yes" : "No"} />
                  <Metric label="Keywords" value={connection.capabilitySnapshot.keywordEvents ? "Yes" : "No"} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}
