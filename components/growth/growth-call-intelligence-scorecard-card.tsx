"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Loader2, Mic, RefreshCw, Sparkles, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, StatTile } from "@/components/growth/growth-ui-utils"
import {
  CALL_OUTCOME_LABELS,
  CALL_RISK_LEVEL_LABELS,
  GROWTH_TRUE_CALL_INTELLIGENCE_QA_MARKER,
  type CallIntelligenceScorecardPublicView,
} from "@/lib/growth/call-intelligence/call-intelligence-types"
import { cn } from "@/lib/utils"

type GrowthCallIntelligenceScorecardCardProps = {
  leadId: string
  companyName: string
  meetingId?: string | null
  realtimeSessionId?: string | null
  compact?: boolean
}

function riskTone(level: CallIntelligenceScorecardPublicView["riskLevel"]): "critical" | "high" | "medium" | "low" | "neutral" {
  if (level === "critical") return "critical"
  if (level === "high") return "high"
  if (level === "medium") return "medium"
  if (level === "low") return "low"
  return "neutral"
}

export function GrowthCallIntelligenceScorecardCard({
  leadId,
  companyName,
  meetingId,
  realtimeSessionId,
  compact = false,
}: GrowthCallIntelligenceScorecardCardProps) {
  const [scorecard, setScorecard] = useState<CallIntelligenceScorecardPublicView | null>(null)
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${leadId}/call-intelligence`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        scorecard?: CallIntelligenceScorecardPublicView | null
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load call intelligence.")
      setScorecard(data.scorecard ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load call intelligence.")
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleRecompute() {
    setRecomputing(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${leadId}/call-intelligence/recompute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: meetingId ?? scorecard?.meetingId ?? null,
          realtimeSessionId: realtimeSessionId ?? scorecard?.realtimeSessionId ?? null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        scorecard?: CallIntelligenceScorecardPublicView
        message?: string
      }
      if (!res.ok || !data.ok || !data.scorecard) {
        throw new Error(data.message ?? "Could not recompute call intelligence.")
      }
      setScorecard(data.scorecard)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not recompute call intelligence.")
    } finally {
      setRecomputing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border/70 bg-muted/10 py-8 text-sm text-muted-foreground dark:border-slate-800">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading call intelligence…
      </div>
    )
  }

  const incomplete = scorecard?.metrics.incomplete === true

  return (
    <div
      className="space-y-4 rounded-xl border border-border/70 bg-gradient-to-br from-violet-500/5 via-background to-sky-500/5 p-4 dark:border-slate-800 dark:from-violet-500/10 dark:to-sky-500/10"
      data-qa-marker={GROWTH_TRUE_CALL_INTELLIGENCE_QA_MARKER}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Mic className="size-4 text-violet-600 dark:text-violet-400" />
            <h3 className="text-sm font-semibold tracking-tight">Call Intelligence Scorecard</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Deterministic scoring for {companyName}. Operator-facing only — no audio replay or transcript storage.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void handleRecompute()} disabled={recomputing}>
          {recomputing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Recompute
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!scorecard || incomplete ? (
        <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground dark:border-slate-800">
          {incomplete
            ? "Insufficient session data for a full scorecard. Complete a live coaching session and recompute."
            : "No call intelligence scorecard yet. Complete a live coaching session or record a meeting outcome, then recompute."}
        </div>
      ) : (
        <>
          <div className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}>
            <StatTile label="Overall score" value={`${scorecard.overallScore}/100`} />
            <StatTile label="Risk level" value={CALL_RISK_LEVEL_LABELS[scorecard.riskLevel]} />
            <StatTile label="Outcome" value={CALL_OUTCOME_LABELS[scorecard.outcome]} />
            <StatTile label="Confidence" value={`${scorecard.confidenceScore}/100`} />
          </div>

          <div className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}>
            <StatTile label="Conversation quality" value={`${scorecard.conversationQualityScore}/100`} />
            <StatTile label="Discovery" value={`${scorecard.discoveryScore}/100`} />
            <StatTile label="Objection handling" value={`${scorecard.objectionHandlingScore}/100`} />
            <StatTile label="Buying signals" value={`${scorecard.buyingSignalScore}/100`} />
            <StatTile label="Next step" value={`${scorecard.nextStepScore}/100`} />
            <StatTile label="Talk / listen" value={`${scorecard.talkListenBalanceScore}/100`} />
            <StatTile label="Competitor risk" value={`${scorecard.competitorRiskScore}/100`} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-background/70 p-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <TrendingUp className="size-3.5" />
                Top positive signals
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {[...scorecard.buyingSignals, ...scorecard.nextStepCommitments].slice(0, 3).map((signal) => (
                  <li key={signal.key} className="text-emerald-800 dark:text-emerald-300">
                    {signal.label}
                  </li>
                ))}
                {scorecard.buyingSignals.length === 0 && scorecard.nextStepCommitments.length === 0 ? (
                  <li className="text-muted-foreground">No strong positive signals detected.</li>
                ) : null}
              </ul>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/70 p-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <AlertTriangle className="size-3.5" />
                Top coaching opportunities
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {scorecard.coachingOpportunities.slice(0, 3).map((entry) => (
                  <li key={entry.key} className="text-amber-800 dark:text-amber-200">
                    {entry.label}
                  </li>
                ))}
                {scorecard.coachingOpportunities.length === 0 ? (
                  <li className="text-muted-foreground">No coaching opportunities flagged.</li>
                ) : null}
              </ul>
            </div>
          </div>

          {scorecard.safeSummary ? (
            <div className="rounded-lg border border-border/60 bg-background/80 p-3 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{scorecard.safeSummary}</p>
            </div>
          ) : null}

          {scorecard.recommendedNextAction ? (
            <div className="rounded-lg border border-indigo-200/60 bg-indigo-50/40 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Recommended next action
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">{scorecard.recommendedNextAction}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <GrowthBadge label={scorecard.riskLevel.replace(/_/g, " ")} tone={riskTone(scorecard.riskLevel)} />
            <GrowthBadge label={`Overall ${scorecard.overallScore}`} tone="neutral" />
            <GrowthBadge label="Human approval required" tone="attention" />
          </div>
        </>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="size-3.5" />
        Metrics only — no audio persistence or transcript replay.
      </p>
    </div>
  )
}
