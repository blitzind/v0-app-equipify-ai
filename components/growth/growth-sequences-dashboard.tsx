"use client"

import { useCallback, useEffect, useState } from "react"
import { GitBranch, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthSequenceOptimizationRecommendationsSection } from "@/components/growth/growth-sequence-optimization-recommendations"
import type { GrowthSequencePattern } from "@/lib/growth/sequence-types"

type DashboardPayload = {
  averageQuality: number
  topPerforming: GrowthSequencePattern[]
  underperforming: GrowthSequencePattern[]
  sequenceRiskWatch: GrowthSequencePattern[]
  bestByIndustry: Array<{ segment: string; patternKey: string; positiveRate: number; count: number }>
  bestByObjection: Array<{ segment: string; patternKey: string; positiveRate: number; count: number }>
  bestByBuyingIntent: Array<{ segment: string; patternKey: string; positiveRate: number; count: number }>
  recommendedNextSequences: Array<{
    id: string
    companyName: string
    contactName: string | null
    recommendedSequenceConfidence: number | null
    recommendedSequenceReason: string | null
    sequenceFatigueRisk: string | null
  }>
  sequenceLiftTrends: Array<{
    key: string
    label: string
    opportunityLift: number
    revenueProbabilityLift: number
    conversationHealthLift: number
    qualityScore: number
  }>
}

function PatternList({ title, patterns }: { title: string; patterns: GrowthSequencePattern[] }) {
  return (
    <GrowthEngineCard title={title}>
      {patterns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No patterns in this bucket.</p>
      ) : (
        <ul className="space-y-2">
          {patterns.map((pattern) => (
            <li key={pattern.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{pattern.label}</p>
                <span className="font-semibold tabular-nums">{pattern.sequenceQualityScore}</span>
              </div>
              <p className="text-muted-foreground">
                {Math.round(pattern.positiveReplyRate * 100)}% positive · abandonment{" "}
                {Math.round(pattern.sequenceAbandonmentRate * 100)}% · fatigue {pattern.sequenceFatigueRisk}
              </p>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}

export function GrowthSequencesDashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/sequences/intelligence/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; dashboard?: DashboardPayload; message?: string }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load sequences dashboard.")
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
        Loading sequence intelligence…
      </div>
    )
  }

  if (error && !dashboard) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 size-4" />
          Retry
        </Button>
      </div>
    )
  }

  if (!dashboard) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Avg sequence quality" value={dashboard.averageQuality} />
          <StatTile label="Top patterns" value={dashboard.topPerforming.length} />
          <StatTile label="Risk watch" value={dashboard.sequenceRiskWatch.length} />
          <StatTile label="Recommended leads" value={dashboard.recommendedNextSequences.length} />
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <GrowthEngineCard title="Sequence Risk Watch" icon={<GitBranch className="size-4" />}>
        {dashboard.sequenceRiskWatch.length === 0 ? (
          <p className="text-sm text-muted-foreground">No high-risk sequence patterns detected.</p>
        ) : (
          <ul className="space-y-2">
            {dashboard.sequenceRiskWatch.map((pattern) => (
              <li key={pattern.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{pattern.label}</p>
                  <p className="text-muted-foreground">
                    abandonment {Math.round(pattern.sequenceAbandonmentRate * 100)}% · quality{" "}
                    {pattern.sequenceQualityScore}
                  </p>
                </div>
                <GrowthBadge label={pattern.sequenceFatigueRisk} tone="warning" />
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <PatternList title="Top performing patterns" patterns={dashboard.topPerforming} />
        <PatternList title="Underperforming patterns" patterns={dashboard.underperforming} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GrowthEngineCard title="Best by industry">
          <SegmentList rows={dashboard.bestByIndustry} />
        </GrowthEngineCard>
        <GrowthEngineCard title="Best by objection">
          <SegmentList rows={dashboard.bestByObjection} />
        </GrowthEngineCard>
        <GrowthEngineCard title="Best by buying intent">
          <SegmentList rows={dashboard.bestByBuyingIntent} />
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="Recommended next sequences">
        {dashboard.recommendedNextSequences.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sequence recommendations yet.</p>
        ) : (
          <ul className="space-y-2">
            {dashboard.recommendedNextSequences.map((lead) => (
              <li key={lead.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{lead.companyName}</p>
                  <span className="tabular-nums font-semibold">{lead.recommendedSequenceConfidence ?? "—"}</span>
                </div>
                {lead.recommendedSequenceReason ? (
                  <p className="text-muted-foreground">{lead.recommendedSequenceReason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Sequence lift trends">
        <ul className="space-y-2">
          {dashboard.sequenceLiftTrends.map((row) => (
            <li key={row.key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <span>{row.label}</span>
              <span className="text-muted-foreground tabular-nums">
                opp {row.opportunityLift.toFixed(1)} · rev {row.revenueProbabilityLift.toFixed(1)} · conv{" "}
                {row.conversationHealthLift.toFixed(1)}
              </span>
            </li>
          ))}
        </ul>
      </GrowthEngineCard>

      <GrowthSequenceOptimizationRecommendationsSection />
    </div>
  )
}

function SegmentList({
  rows,
}: {
  rows: Array<{ segment: string; patternKey: string; positiveRate: number; count: number }>
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Insufficient outcome data.</p>
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.segment} className="flex items-center justify-between text-sm">
          <span className="capitalize">{row.segment.replace(/_/g, " ")}</span>
          <span className="text-muted-foreground">
            {row.patternKey.replace(/_/g, " ")} · {Math.round(row.positiveRate * 100)}%
          </span>
        </li>
      ))}
    </ul>
  )
}
