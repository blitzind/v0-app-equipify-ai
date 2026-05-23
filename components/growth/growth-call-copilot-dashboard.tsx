"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Phone, RefreshCw, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthCallCopilotDashboard } from "@/lib/growth/call-copilot-dashboard-repository"
import {
  GROWTH_CALL_COPILOT_BUYING_SIGNAL_LABELS,
  GROWTH_CALL_COPILOT_COMMITMENT_SIGNAL_LABELS,
} from "@/lib/growth/call-copilot-types"

export function GrowthCallCopilotDashboard() {
  const [dashboard, setDashboard] = useState<GrowthCallCopilotDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/calls/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthCallCopilotDashboard
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load calls dashboard.")
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
        Loading calls dashboard…
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-600">{error ?? "Dashboard unavailable."}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-1 size-3.5" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active sessions" value={dashboard.stats.activeCount} />
        <StatTile label="Completed (7d)" value={dashboard.stats.completed7d} />
        <StatTile label="High risk active" value={dashboard.stats.highRiskActive} />
        <StatTile label="Avg outcome confidence" value={dashboard.stats.avgOutcomeConfidence} />
      </div>

      <GrowthEngineCard title="Active Call Copilot Sessions">
        {dashboard.activeSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          <ul className="space-y-2">
            {dashboard.activeSessions.map((session) => (
              <li key={session.id} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{session.companyName}</p>
                  <p className="text-muted-foreground capitalize">{session.status.replace(/_/g, " ")}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {session.highRiskCall ? <GrowthBadge label="High risk" tone="attention" /> : null}
                  <GrowthBadge label={`confidence ${session.callOutcomeConfidence}`} tone="neutral" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Objection Trend Shift" icon={<TrendingUp className="size-4" />}>
        {dashboard.objectionTrendShift.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enough objection data for trend comparison.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {dashboard.objectionTrendShift.map((entry) => (
              <li key={entry.objection} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <span className="capitalize">{entry.objection}</span>
                <span className="tabular-nums text-muted-foreground">
                  {entry.priorCount} → {entry.recentCount}
                  <span className={entry.delta >= 0 ? " ml-2 text-amber-700" : " ml-2 text-emerald-700"}>
                    ({entry.delta >= 0 ? "+" : ""}
                    {entry.delta})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthEngineCard title="Top Objections (7d)">
          {dashboard.topObjections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No objections captured.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {dashboard.topObjections.map((entry) => (
                <li key={entry.objection} className="flex justify-between gap-2">
                  <span className="capitalize">{entry.objection}</span>
                  <span className="tabular-nums text-muted-foreground">{entry.count}</span>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Recent Summaries">
          {dashboard.recentSummaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed summaries yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dashboard.recentSummaries.slice(0, 8).map((session) => (
                <li key={session.id} className="rounded-lg border px-3 py-2">
                  <p className="font-medium">{session.companyName}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{session.postCallSummary}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {session.suggestedDisposition ? (
                      <GrowthBadge label={session.suggestedDisposition.replace(/_/g, " ")} tone="neutral" />
                    ) : null}
                    <GrowthBadge label={`confidence ${session.callOutcomeConfidence}`} tone="neutral" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthEngineCard title="Buying Signals (7d)">
          {dashboard.buyingSignalCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No buying signals.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {dashboard.buyingSignalCounts.map((entry) => (
                <li key={entry.key} className="flex justify-between gap-2">
                  <span>
                    {GROWTH_CALL_COPILOT_BUYING_SIGNAL_LABELS[
                      entry.key as keyof typeof GROWTH_CALL_COPILOT_BUYING_SIGNAL_LABELS
                    ] ?? entry.key}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{entry.count}</span>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Commitment Signals (7d)">
          {dashboard.commitmentSignalCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commitment signals.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {dashboard.commitmentSignalCounts.map((entry) => (
                <li key={entry.key} className="flex justify-between gap-2">
                  <span>
                    {GROWTH_CALL_COPILOT_COMMITMENT_SIGNAL_LABELS[
                      entry.key as keyof typeof GROWTH_CALL_COPILOT_COMMITMENT_SIGNAL_LABELS
                    ] ?? entry.key}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{entry.count}</span>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="Follow-Up Needed" icon={<Phone className="size-4" />}>
        {dashboard.followUpNeeded.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending follow-up dispositions.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {dashboard.followUpNeeded.map((session) => (
              <li key={session.id} className="rounded-lg border px-3 py-2">
                <p className="font-medium capitalize">{session.suggestedDisposition?.replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground">Session {session.id.slice(0, 8)} · confidence {session.callOutcomeConfidence}</p>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>
    </div>
  )
}
