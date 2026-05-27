"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { sessionTimelineProviderLabel } from "@/lib/growth/realtime/live-coaching/session-timeline-labels"
import { sessionInsightsRiskLevelTone } from "@/lib/growth/realtime/live-coaching/session-insights-risk-level"
import { COACHING_TRENDS_DATE_RANGE_DAYS } from "@/lib/growth/realtime/live-coaching/coaching-trends-types"
import type { CoachingTrendsPayload } from "@/lib/growth/realtime/live-coaching/coaching-trends-types"
import { LIVE_COACHING_SESSION_INSIGHTS_RISK_LEVELS } from "@/lib/growth/realtime/live-coaching/session-insights-types"

export function GrowthLiveCoachingTrends() {
  const [trends, setTrends] = useState<CoachingTrendsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRangeDays, setDateRangeDays] = useState<(typeof COACHING_TRENDS_DATE_RANGE_DAYS)[number]>(30)
  const [providerFilter, setProviderFilter] = useState("all")
  const [riskFilter, setRiskFilter] = useState("all")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        range: String(dateRangeDays),
        provider: providerFilter,
        risk: riskFilter,
      })
      const res = await fetch(`/api/platform/growth/calls/live-coaching/trends?${params.toString()}`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        trends?: CoachingTrendsPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.trends) {
        throw new Error(data.message ?? "Could not load coaching trends.")
      }
      setTrends(data.trends)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trends load failed.")
    } finally {
      setLoading(false)
    }
  }, [dateRangeDays, providerFilter, riskFilter])

  useEffect(() => {
    void load()
  }, [load])

  const providerOptions = useMemo(() => {
    const providers = new Set<string>(["all"])
    for (const entry of trends?.sessionsByProvider ?? []) {
      providers.add(entry.providerId)
    }
    return [...providers]
  }, [trends?.sessionsByProvider])

  return (
    <div data-qa-marker={trends?.qaProof?.marker}>
      <GrowthEngineCard title="Coaching Trends">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Session trends from coaching insights — no transcript or audio storage.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {trends?.meta.truncated ? (
            <GrowthBadge
              label={`Showing ${trends.meta.limit} of ${trends.meta.total}`}
              tone="attention"
            />
          ) : null}
          <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterSelect
          label="Range"
          value={String(dateRangeDays)}
          onChange={(value) => setDateRangeDays(Number(value) as (typeof COACHING_TRENDS_DATE_RANGE_DAYS)[number])}
          options={COACHING_TRENDS_DATE_RANGE_DAYS.map((days) => ({
            value: String(days),
            label: `${days} days`,
          }))}
        />
        <FilterSelect
          label="Provider"
          value={providerFilter}
          onChange={setProviderFilter}
          options={providerOptions.map((value) => ({
            value,
            label: value === "all" ? "All providers" : sessionTimelineProviderLabel(value),
          }))}
        />
        <FilterSelect
          label="Risk"
          value={riskFilter}
          onChange={setRiskFilter}
          options={[
            { value: "all", label: "All risk levels" },
            ...LIVE_COACHING_SESSION_INSIGHTS_RISK_LEVELS.map((level) => ({
              value: level,
              label: level,
            })),
          ]}
        />
      </div>

      {loading && !trends ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading coaching trends…
        </div>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!loading && trends && trends.summary.sessionCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          No session insights in this range yet. Complete live coaching sessions and recompute insights to populate trends.
        </p>
      ) : null}

      {trends && trends.summary.sessionCount > 0 ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Sessions" value={trends.summary.sessionCount} />
            <StatTile label="Avg health score" value={trends.summary.averageHealthScore} />
            <StatTile label="Avg transcript latency" value={`${trends.summary.averageTranscriptLatencyMs}ms`} />
            <StatTile label="Max transcript latency" value={`${trends.summary.maxTranscriptLatencyMs}ms`} />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risk distribution</p>
            <div className="flex flex-wrap gap-2">
              {LIVE_COACHING_SESSION_INSIGHTS_RISK_LEVELS.map((level) => (
                <GrowthBadge
                  key={level}
                  label={`${level} ${trends.riskDistribution[level]}`}
                  tone={sessionInsightsRiskLevelTone(level)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sessions by provider</p>
            <ul className="space-y-2">
              {trends.sessionsByProvider.map((entry) => (
                <li key={entry.providerId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span>{sessionTimelineProviderLabel(entry.providerId)}</span>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{entry.sessionCount} sessions</span>
                    <span>health {entry.averageHealthScore}</span>
                    <span>{entry.providerInterruptions} interruptions</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile label="Provider interruptions" value={trends.summary.totalProviderInterruptions} />
            <StatTile label="Reconnect attempts" value={trends.summary.totalReconnectAttempts} />
            <StatTile label="Retry attempts" value={trends.summary.totalRetryAttempts} />
            <StatTile label="Fallback count" value={trends.summary.totalFallbackCount} />
            <StatTile label="Guidance generated" value={trends.summary.totalGuidanceGenerated} />
            <StatTile label="Objections detected" value={trends.summary.totalObjections} />
            <StatTile label="Buying signals" value={trends.summary.totalBuyingSignals} />
            <StatTile label="Discovery gaps" value={trends.summary.totalDiscoveryGaps} />
            <StatTile label="Competitor pressure" value={trends.summary.totalCompetitorPressure} />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Daily trend</p>
            {trends.dailyTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No daily buckets in this range.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {trends.dailyTrend.map((point) => (
                  <li key={point.date} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{point.date}</span>
                      <span className="text-xs text-muted-foreground">{point.sessionCount} sessions</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      health {point.averageHealthScore} · latency avg {point.averageTranscriptLatencyMs}ms · max{" "}
                      {point.maxTranscriptLatencyMs}ms · guidance {point.guidanceGeneratedCount} · objections{" "}
                      {point.objectionCount}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </GrowthEngineCard>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{label}</span>
      <select
        className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
