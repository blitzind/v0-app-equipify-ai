"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { sessionTimelineProviderLabel } from "@/lib/growth/realtime/live-coaching/session-timeline-labels"
import { sessionInsightsRiskLevelTone } from "@/lib/growth/realtime/live-coaching/session-insights-risk-level"
import type { LiveCoachingSessionInsightsPayload } from "@/lib/growth/realtime/live-coaching/session-insights-types"

type GrowthLiveCoachingSessionInsightsProps = {
  leadId: string
  sessionId: string | null
  refreshToken?: number
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "—"
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

export function GrowthLiveCoachingSessionInsights({
  leadId,
  sessionId,
  refreshToken = 0,
}: GrowthLiveCoachingSessionInsightsProps) {
  const [payload, setPayload] = useState<LiveCoachingSessionInsightsPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [recomputing, setRecomputing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!sessionId) {
      setPayload(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/leads/${leadId}/realtime-call/sessions/${sessionId}/insights`,
        { cache: "no-store" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        insights?: LiveCoachingSessionInsightsPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.insights) {
        throw new Error(data.message ?? "Could not load session insights.")
      }
      setPayload(data.insights)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Insights load failed.")
    } finally {
      setLoading(false)
    }
  }, [leadId, sessionId])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  const recompute = useCallback(async () => {
    if (!sessionId) return
    setRecomputing(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/leads/${leadId}/realtime-call/sessions/${sessionId}/insights/recompute`,
        { method: "POST" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        insights?: LiveCoachingSessionInsightsPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.insights) {
        throw new Error(data.message ?? "Could not recompute session insights.")
      }
      setPayload(data.insights)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recompute failed.")
    } finally {
      setRecomputing(false)
    }
  }, [leadId, sessionId])

  if (!sessionId) {
    return (
      <GrowthEngineCard title="Session Insights">
        <p className="text-sm text-muted-foreground">
          Start or select a live coaching session to view deterministic insights rollup.
        </p>
      </GrowthEngineCard>
    )
  }

  const rollup = payload?.rollup

  return (
    <GrowthEngineCard title="Session Insights">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Deterministic rollup from timeline metrics only. No transcript or audio data.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {payload?.qaProof ? (
            <GrowthBadge
              label={payload.qaProof.marker}
              tone={payload.qaProof.verified ? "healthy" : "attention"}
            />
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading || recomputing}
            onClick={() => void recompute()}
          >
            {recomputing ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 size-3.5" />
            )}
            Recompute insights
          </Button>
        </div>
      </div>

      {loading && !payload ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading session insights…
        </div>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!loading && payload && !rollup ? (
        <p className="text-sm text-muted-foreground">
          No timeline metrics yet. Run a session and use Recompute insights after events are recorded.
        </p>
      ) : null}

      {rollup ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <GrowthBadge label={`Health ${rollup.sessionHealthScore}`} tone="healthy" />
            <GrowthBadge
              label={`Risk ${rollup.riskLevel}`}
              tone={sessionInsightsRiskLevelTone(rollup.riskLevel)}
            />
            <GrowthBadge
              label={sessionTimelineProviderLabel(rollup.providerId)}
              tone="neutral"
            />
            <GrowthBadge label={`Duration ${formatDuration(rollup.sessionDurationMs)}`} tone="neutral" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile label="Transcript finals" value={rollup.transcriptFinalizedCount} />
            <StatTile label="Guidance generated" value={rollup.guidanceGeneratedCount} />
            <StatTile label="Objections" value={rollup.objectionCount} />
            <StatTile label="Buying signals" value={rollup.buyingSignalCount} />
            <StatTile label="Discovery gaps" value={rollup.discoveryGapCount} />
            <StatTile label="Competitor pressure" value={rollup.competitorPressureCount} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile label="Provider interruptions" value={rollup.providerInterruptions} />
            <StatTile label="Reconnect attempts" value={rollup.reconnectAttempts} />
            <StatTile label="Retry attempts" value={rollup.retryAttempts} />
            <StatTile label="Fallback count" value={rollup.fallbackCount} />
            <StatTile label="Avg transcript latency" value={`${rollup.averageTranscriptLatencyMs}ms`} />
            <StatTile label="Max transcript latency" value={`${rollup.maxTranscriptLatencyMs}ms`} />
          </div>
        </div>
      ) : null}
    </GrowthEngineCard>
  )
}

export function GrowthLiveCoachingSessionInsightsPreview({
  insightsPreview,
}: {
  insightsPreview: {
    sessionHealthScore: number
    riskLevel: string
    providerId: string | null
    transcriptFinalizedCount: number
    providerInterruptions: number
    retryAttempts: number
    sessionDurationMs: number
  } | null
}) {
  if (!insightsPreview) {
    return <span className="text-xs text-muted-foreground">Insights pending</span>
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
      <GrowthBadge label={`Health ${insightsPreview.sessionHealthScore}`} tone="neutral" />
      <GrowthBadge
        label={insightsPreview.riskLevel}
        tone={sessionInsightsRiskLevelTone(
          insightsPreview.riskLevel as "low" | "medium" | "high" | "critical",
        )}
      />
      <GrowthBadge
        label={sessionTimelineProviderLabel(insightsPreview.providerId)}
        tone="status"
      />
      <span className="text-muted-foreground">
        {insightsPreview.transcriptFinalizedCount} finals · {insightsPreview.providerInterruptions} interruptions
      </span>
    </div>
  )
}
