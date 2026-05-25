"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Brain, Loader2, RefreshCw, Sparkles, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, StatTile } from "@/components/growth/growth-ui-utils"
import {
  DEAL_CLOSE_WINDOW_LABELS,
  DEAL_OPERATOR_ACTION_LABELS,
  DEAL_RISK_LEVEL_LABELS,
  GROWTH_PREDICTIVE_DEAL_INTELLIGENCE_QA_MARKER,
  type DealIntelligenceScorePublicView,
} from "@/lib/growth/deal-intelligence/deal-intelligence-types"
import { cn } from "@/lib/utils"

type GrowthPredictiveDealIntelligenceCardProps = {
  opportunityId?: string | null
  leadId: string
  companyName: string
  compact?: boolean
}

function riskTone(level: DealIntelligenceScorePublicView["riskLevel"]): "critical" | "high" | "medium" | "low" | "neutral" {
  if (level === "critical") return "critical"
  if (level === "high") return "high"
  if (level === "medium") return "medium"
  if (level === "low") return "low"
  return "neutral"
}

export function GrowthPredictiveDealIntelligenceCard({
  opportunityId,
  leadId,
  companyName,
  compact = false,
}: GrowthPredictiveDealIntelligenceCardProps) {
  const [score, setScore] = useState<DealIntelligenceScorePublicView | null>(null)
  const [resolvedOpportunityId, setResolvedOpportunityId] = useState<string | null>(opportunityId ?? null)
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (opportunityId) {
        const res = await fetch(`/api/platform/growth/opportunities/${opportunityId}/deal-intelligence`, {
          cache: "no-store",
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          score?: DealIntelligenceScorePublicView | null
          message?: string
        }
        if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load deal intelligence.")
        setScore(data.score ?? null)
        setResolvedOpportunityId(opportunityId)
        return
      }

      const res = await fetch(`/api/platform/growth/deal-intelligence/dashboard?leadId=${leadId}`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        leadScore?: DealIntelligenceScorePublicView | null
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load deal intelligence.")
      setScore(data.leadScore ?? null)
      setResolvedOpportunityId(data.leadScore?.opportunityId ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load deal intelligence.")
    } finally {
      setLoading(false)
    }
  }, [leadId, opportunityId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleRecompute() {
    if (!resolvedOpportunityId) {
      setError("Create or link an opportunity before recomputing deal intelligence.")
      return
    }
    setRecomputing(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/opportunities/${resolvedOpportunityId}/deal-intelligence/recompute`,
        { method: "POST" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        score?: DealIntelligenceScorePublicView
        message?: string
      }
      if (!res.ok || !data.ok || !data.score) {
        throw new Error(data.message ?? "Could not recompute deal intelligence.")
      }
      setScore(data.score)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not recompute deal intelligence.")
    } finally {
      setRecomputing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border/70 bg-muted/10 py-8 text-sm text-muted-foreground dark:border-slate-800">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading predictive deal intelligence…
      </div>
    )
  }

  return (
    <div
      className="space-y-4 rounded-xl border border-border/70 bg-gradient-to-br from-indigo-500/5 via-background to-emerald-500/5 p-4 dark:border-slate-800 dark:from-indigo-500/10 dark:to-emerald-500/10"
      data-qa-marker={GROWTH_PREDICTIVE_DEAL_INTELLIGENCE_QA_MARKER}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-semibold tracking-tight">Predictive Deal Intelligence</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Deterministic scoring for {companyName}. Recommendations only — no autonomous CRM movement.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void handleRecompute()} disabled={recomputing || !resolvedOpportunityId}>
          {recomputing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Recompute
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!score ? (
        <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground dark:border-slate-800">
          No deal intelligence score yet.
          {resolvedOpportunityId ? " Recompute to generate deterministic scores and operator recommendations." : " Link an opportunity to enable scoring."}
        </div>
      ) : (
        <>
          <div className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}>
            <StatTile label="Close probability" value={`${score.closeProbability}%`} />
            <StatTile label="Forecast confidence" value={`${score.forecastConfidence}%`} />
            <StatTile label="Risk level" value={DEAL_RISK_LEVEL_LABELS[score.riskLevel]} />
            <StatTile label="Close window" value={DEAL_CLOSE_WINDOW_LABELS[score.predictedCloseWindow]} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatTile label="Momentum" value={`${score.momentumScore}/100`} />
            <StatTile
              label="Recommended action"
              value={DEAL_OPERATOR_ACTION_LABELS[score.recommendedOperatorAction]}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-background/70 p-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <TrendingUp className="size-3.5" />
                Top positive signals
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {score.positiveSignals.slice(0, 3).map((signal) => (
                  <li key={signal.key} className="text-emerald-800 dark:text-emerald-300">
                    {signal.label}
                  </li>
                ))}
                {score.positiveSignals.length === 0 ? (
                  <li className="text-muted-foreground">No strong positive signals yet.</li>
                ) : null}
              </ul>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/70 p-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <AlertTriangle className="size-3.5" />
                Top risk factors
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {score.riskFactors.slice(0, 3).map((factor) => (
                  <li key={factor.key} className="text-amber-800 dark:text-amber-200">
                    {factor.label}
                  </li>
                ))}
                {score.riskFactors.length === 0 ? (
                  <li className="text-muted-foreground">No major risk factors detected.</li>
                ) : null}
              </ul>
            </div>
          </div>

          {score.explanation ? (
            <div className="rounded-lg border border-border/60 bg-background/80 p-3 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{score.explanation}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <GrowthBadge label={score.riskLevel.replace(/_/g, " ")} tone={riskTone(score.riskLevel)} />
            <GrowthBadge label={`Momentum ${score.momentumScore}`} tone="neutral" />
            <GrowthBadge label="Human approval required" tone="attention" />
          </div>
        </>
      )}

      {!resolvedOpportunityId ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="size-3.5" />
          Opportunity link required for full pipeline scoring.
        </p>
      ) : null}
    </div>
  )
}
