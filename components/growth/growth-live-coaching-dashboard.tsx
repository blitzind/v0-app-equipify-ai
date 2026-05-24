"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthLiveCoachingSessionTimeline } from "@/components/growth/growth-live-coaching-session-timeline"
import { GrowthLiveCoachingSessionInsightsPreview } from "@/components/growth/growth-live-coaching-session-insights"
import { GrowthLiveCoachingTrends } from "@/components/growth/growth-live-coaching-trends"

type DashboardPayload = {
  stats: {
    completedSessions: number
    averageExecutionScore: number
    buyingSignalCapturePercent: number
    discoveryCompletionPercent: number
    activeGuidanceEvents: number
    averageGuidanceLatencyMs: number
    p95GuidanceLatencyMs: number
  }
  topObjections: Array<{ key: string; count: number }>
  talkRatioDistribution: {
    underGoal: number
    inGoal: number
    overGoal: number
    sampleSize: number
  }
  mostEffectiveGuidance: Array<{
    eventType: string
    title: string
    surfaced: number
    accepted: number
    acceptanceRate: number
  }>
  operatorLeaderboard: Array<{
    operatorId: string
    sessions: number
    acceptedGuidance: number
    averageExecutionScore: number
  }>
  highRiskCalls: Array<{
    sessionId: string
    leadId: string
    companyName: string
    riskLevel: string
    riskFlags: string[]
    executionScore: number
    updatedAt: string
    insightsPreview: {
      sessionHealthScore: number
      riskLevel: string
      providerId: string | null
      transcriptFinalizedCount: number
      providerInterruptions: number
      retryAttempts: number
      sessionDurationMs: number
    } | null
  }>
}

export function GrowthLiveCoachingDashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timelineSession, setTimelineSession] = useState<{ leadId: string; sessionId: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/calls/live-coaching/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: DashboardPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load live coaching dashboard.")
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
        Loading live coaching analytics…
      </div>
    )
  }

  if (error && !dashboard) return <p className="text-sm text-rose-600">{error}</p>
  if (!dashboard) return null

  const talk = dashboard.talkRatioDistribution

  return (
    <div className="space-y-6">
      <GrowthLiveCoachingTrends />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Avg execution score" value={dashboard.stats.averageExecutionScore} />
          <StatTile label="Buying signal capture" value={`${dashboard.stats.buyingSignalCapturePercent}%`} />
          <StatTile label="Discovery completion" value={`${dashboard.stats.discoveryCompletionPercent}%`} />
          <StatTile label="Active guidance cards" value={dashboard.stats.activeGuidanceEvents} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <GrowthEngineCard title="Coaching Responsiveness">
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile label="Avg guidance latency" value={`${dashboard.stats.averageGuidanceLatencyMs}ms`} />
          <StatTile label="P95 guidance latency" value={`${dashboard.stats.p95GuidanceLatencyMs}ms`} />
        </div>
      </GrowthEngineCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthEngineCard title="Top objections">
          {dashboard.topObjections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No objections recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {dashboard.topObjections.map((entry) => (
                <li key={entry.key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span>{entry.key.replace(/_/g, " ")}</span>
                  <span className="font-semibold tabular-nums">{entry.count}</span>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Talk ratio distribution">
          <div className="grid gap-2 sm:grid-cols-3">
            <StatTile label="In goal (45–60%)" value={talk.inGoal} hint={`of ${talk.sampleSize}`} />
            <StatTile label="Over 65% rep" value={talk.overGoal} />
            <StatTile label="Under goal" value={talk.underGoal} />
          </div>
        </GrowthEngineCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthEngineCard title="Most effective guidance cards">
          {dashboard.mostEffectiveGuidance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No guidance usage yet.</p>
          ) : (
            <ul className="space-y-2">
              {dashboard.mostEffectiveGuidance.map((entry) => (
                <li key={entry.eventType} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{entry.title}</p>
                    <GrowthBadge label={`${entry.acceptanceRate}% accepted`} tone="healthy" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {entry.accepted}/{entry.surfaced} accepted
                  </p>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Operator leaderboard">
          {dashboard.operatorLeaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed sessions yet.</p>
          ) : (
            <ul className="space-y-2">
              {dashboard.operatorLeaderboard.map((entry, index) => (
                <li key={entry.operatorId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">#{index + 1} · {entry.operatorId === "unknown" ? "Unassigned" : entry.operatorId.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{entry.sessions} sessions · {entry.acceptedGuidance} guidance accepted</p>
                  </div>
                  <span className="text-lg font-semibold tabular-nums">{entry.averageExecutionScore}</span>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="High-risk calls">
        {dashboard.highRiskCalls.length === 0 ? (
          <p className="text-sm text-muted-foreground">No high-risk completed sessions.</p>
        ) : (
          <ul className="space-y-2">
            {dashboard.highRiskCalls.map((call) => (
              <li key={call.sessionId} className="rounded-lg border border-rose-200 bg-rose-50/40 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/admin/growth/leads?open=${call.leadId}&focus=call-copilot`} className="font-medium hover:underline">
                    {call.companyName}
                  </Link>
                  <div className="flex items-center gap-2">
                    <GrowthBadge label={call.riskLevel} tone="attention" />
                    <span className="font-semibold tabular-nums">Score {call.executionScore}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setTimelineSession({ leadId: call.leadId, sessionId: call.sessionId })
                      }
                    >
                      View timeline
                    </Button>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {call.riskFlags.map((flag) => (
                    <GrowthBadge key={flag} label={flag.replace(/_/g, " ")} tone="neutral" />
                  ))}
                </div>
                <GrowthLiveCoachingSessionInsightsPreview insightsPreview={call.insightsPreview} />
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      {timelineSession ? (
        <GrowthLiveCoachingSessionTimeline
          leadId={timelineSession.leadId}
          sessionId={timelineSession.sessionId}
        />
      ) : null}
    </div>
  )
}
