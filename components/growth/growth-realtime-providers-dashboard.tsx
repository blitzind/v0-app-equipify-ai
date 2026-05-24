"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Loader2, Plug, RefreshCw, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthLiveCoachingProviderComparisonTable } from "@/components/growth/growth-live-coaching-provider-selection"
import type { LiveCoachingProviderComparisonRow } from "@/lib/growth/realtime/live-coaching/live-coaching-provider-selection"
import type { RealtimeProviderConnection } from "@/lib/growth/realtime/providers/provider-types"
import type { RealtimeProviderDiagnostics } from "@/lib/growth/realtime/providers/realtime-provider-readiness-types"

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
    averageReliabilityScore: number
    totalStreamFailures: number
    totalReconnects: number
    totalRateLimitEvents: number
  }
  connections: RealtimeProviderConnection[]
  diagnostics: RealtimeProviderDiagnostics[]
  providerComparison: LiveCoachingProviderComparisonRow[]
  providerRecommendation: {
    connectionId: string | null
    label: string | null
    reason: string | null
  }
  qaProof: {
    marker: string
    label: string
    verified: boolean
  }
  coachingResponsiveness: {
    averageGuidanceLatencyMs: number
    p95GuidanceLatencyMs: number
    sampleSize: number
    targetLatencyMs: number
  }
}

type ValidationFeedback = {
  connectionId: string
  ok: boolean
  message: string
}

export function GrowthRealtimeProvidersDashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [validationFeedback, setValidationFeedback] = useState<ValidationFeedback | null>(null)
  const [cleanupFeedback, setCleanupFeedback] = useState<{
    ok: boolean
    message: string
    result?: { staleStreamsClosed: number; orphanSessionsDetached: number; stuckStreamsDetected: number }
  } | null>(null)

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

  async function testConnection(connectionId: string) {
    setActing(connectionId)
    setValidationFeedback(null)
    try {
      const res = await fetch(`/api/platform/growth/realtime/providers/connections/${connectionId}/validate`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        validation?: { message?: string; ok?: boolean }
        message?: string
        error?: string
      }
      setValidationFeedback({
        connectionId,
        ok: res.ok && Boolean(data.ok),
        message: data.validation?.message ?? data.message ?? data.error ?? "Test connection completed.",
      })
      await load()
    } finally {
      setActing(null)
    }
  }

  async function runCleanup() {
    setActing("cleanup")
    setCleanupFeedback(null)
    try {
      const res = await fetch("/api/platform/growth/realtime/providers/operations/cleanup", { method: "POST" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        result?: { staleStreamsClosed: number; orphanSessionsDetached: number; stuckStreamsDetected: number }
        qaProof?: { label: string }
        message?: string
      }
      setCleanupFeedback({
        ok: res.ok && Boolean(data.ok),
        message: data.qaProof?.label ?? data.message ?? "Cleanup completed.",
        result: data.result,
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

  const diagnosticsById = new Map(dashboard.diagnostics.map((entry) => [entry.connectionId, entry]))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Connections" value={dashboard.stats.connectionCount} />
          <StatTile label="Connected" value={dashboard.stats.connectedCount} />
          <StatTile label="Avg reliability" value={dashboard.stats.averageReliabilityScore} />
          <StatTile label="Avg transcript quality" value={dashboard.stats.averageTranscriptQualityScore} />
        </div>
        <div className="flex flex-col items-end gap-2">
          <GrowthBadge
            label={dashboard.qaProof.label}
            tone={dashboard.qaProof.verified ? "healthy" : "neutral"}
          />
          <span className="text-xs text-muted-foreground">Diagnostic: {dashboard.qaProof.marker}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void runCleanup()} disabled={acting === "cleanup"}>
            {acting === "cleanup" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            Run cleanup
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {cleanupFeedback ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            cleanupFeedback.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          <p>{cleanupFeedback.message}</p>
          {cleanupFeedback.result ? (
            <p className="mt-1 text-xs">
              Stale streams closed: {cleanupFeedback.result.staleStreamsClosed} · Orphan sessions detached:{" "}
              {cleanupFeedback.result.orphanSessionsDetached} · Stuck streams detected:{" "}
              {cleanupFeedback.result.stuckStreamsDetected}
            </p>
          ) : null}
        </div>
      ) : null}

      {validationFeedback ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            validationFeedback.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          {validationFeedback.message}
        </div>
      ) : null}

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

      <GrowthEngineCard title="Provider comparison">
        {dashboard.providerRecommendation.reason ? (
          <p className="mb-3 text-sm text-muted-foreground">{dashboard.providerRecommendation.reason}</p>
        ) : null}
        <GrowthLiveCoachingProviderComparisonTable rows={dashboard.providerComparison} />
      </GrowthEngineCard>

      <GrowthEngineCard title="Provider reliability">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Failovers" value={dashboard.stats.providerFailoverCount} />
          <StatTile label="Disconnects" value={dashboard.stats.providerDisconnectCount} />
          <StatTile label="Stream failures" value={dashboard.stats.totalStreamFailures} />
          <StatTile label="Rate-limit events" value={dashboard.stats.totalRateLimitEvents} />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Provider connections">
        {dashboard.connections.length === 0 ? (
          <div className="space-y-3 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            <p>No call transcript providers configured yet — live coaching is waiting on setup, not broken.</p>
            <p>
              Configure Deepgram, AssemblyAI, or OpenAI Realtime in Call Providers to enable browser mic coaching.
              Add a connection here, run Test Connection, then choose the provider in{" "}
              <Link href="/admin/growth/settings" className="font-medium text-indigo-600 hover:underline">
                Growth Settings → Live Coaching
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {dashboard.connections.map((connection) => {
              const diagnostics = diagnosticsById.get(connection.id)
              return (
                <li key={connection.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Plug className="size-4 text-muted-foreground" />
                        <p className="font-medium">{connection.label}</p>
                        <GrowthBadge label={connection.provider.replace(/_/g, " ")} tone="neutral" />
                        <GrowthBadge label={connection.readinessStatus.replace(/_/g, " ")} tone="status" />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Status {connection.status} · Health {connection.healthStatus}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={acting === connection.id}
                      onClick={() => void testConnection(connection.id)}
                    >
                      {acting === connection.id ? <Loader2 className="size-4 animate-spin" /> : null}
                      Test Connection
                    </Button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                    <Metric label="Auth configured" value={diagnostics?.authConfigured ? "Yes" : "No"} />
                    <Metric
                      label="Browser streaming"
                      value={diagnostics?.browserStreamingSupported ? "Supported" : "No"}
                    />
                    <Metric label="Reliability score" value={String(diagnostics?.reliabilityScore ?? 0)} />
                    <Metric
                      label="Avg transcript latency"
                      value={`${diagnostics?.averageTranscriptLatencyMs ?? 0}ms`}
                    />
                    <Metric label="Stream failures" value={String(diagnostics?.streamFailures ?? 0)} />
                    <Metric label="Reconnect count" value={String(diagnostics?.reconnectCount ?? 0)} />
                    <Metric label="Rate-limit events" value={String(diagnostics?.rateLimitEvents ?? 0)} />
                    <Metric
                      label="Fallback eligible"
                      value={diagnostics?.fallbackEligible ? "Yes" : "No"}
                    />
                  </div>

                  {diagnostics ? (
                    <div className="mt-3 rounded-lg bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      Capability matrix: realtime {diagnostics.capabilityMatrix.realtime ? "yes" : "no"} · speaker{" "}
                      {diagnostics.capabilityMatrix.speakerDetection ? "yes" : "no"} · keywords{" "}
                      {diagnostics.capabilityMatrix.keywordEvents ? "yes" : "no"} · browser mic{" "}
                      {diagnostics.capabilityMatrix.browserAudioStreaming ? "yes" : "no"} · live transcript{" "}
                      {diagnostics.capabilityMatrix.liveTranscriptStreaming ? "yes" : "no"} · live guidance{" "}
                      {diagnostics.capabilityMatrix.liveGuidanceCompatible ? "yes" : "no"}
                    </div>
                  ) : null}

                  {diagnostics?.lastDisconnectReason ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Last disconnect: {diagnostics.lastDisconnectReason}
                    </p>
                  ) : null}

                  {diagnostics?.configurationWarnings.length ? (
                    <div className="mt-3 space-y-2">
                      {diagnostics.configurationWarnings.map((warning) => (
                        <div
                          key={`${connection.id}-${warning.code}`}
                          className="flex items-start gap-2 rounded-md border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs text-amber-950"
                        >
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                          <span>{warning.message}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </li>
              )
            })}
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
