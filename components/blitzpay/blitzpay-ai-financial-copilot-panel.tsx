"use client"

import { useCallback, useEffect, useState } from "react"
import { ClipboardList, Loader2, RefreshCw, Scale, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { formatBlitzpayUiLabel } from "@/lib/blitzpay/blitzpay-ui-labels"

type InsightRow = {
  id: string
  insight_type: string
  insight_status: string
  severity: string
  title: string
  summary: string
  deterministic_score: number | null
  supporting_metrics: Record<string, unknown>
  recommendation_summary: string | null
  generated_by: string
  generated_at: string
}

type ForecastRow = {
  id: string
  snapshot_type: string
  forecast_window_days: number
  forecast_confidence_score: number | null
  projected_inflow_cents: number | null
  projected_outflow_cents: number | null
  projected_net_cents: number | null
  projected_risk_score: number | null
  created_at: string
}

type RecommendationRow = {
  id: string
  insight_id: string
  action_status: string
  action_type: string
  action_summary: string
  deterministic_basis: Record<string, unknown>
  ai_reasoning_summary: string | null
  created_at: string
}

type ExecPayload = {
  generatedAt: string
  windowDays: number
  scores: Record<string, number>
  executive: { title: string; summary: string; bullets: string[] }
}

const DISCLAIMER =
  "AI insights are operational recommendations based on historical and current system data. Final business and financial decisions should be reviewed by your team."

type Props = {
  organizationId: string | null
  orgReady: boolean
}

function fmtMoney(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "—"
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100,
  )
}

function severityClass(sev: string): string {
  if (sev === "critical") return "text-destructive font-semibold"
  if (sev === "high") return "text-amber-800 dark:text-amber-200 font-semibold"
  if (sev === "medium") return "text-amber-700 dark:text-amber-300"
  return "text-muted-foreground"
}

export function BlitzpayAiFinancialCopilotPanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exec, setExec] = useState<ExecPayload | null>(null)
  const [insights, setInsights] = useState<InsightRow[]>([])
  const [forecasts, setForecasts] = useState<ForecastRow[]>([])
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([])

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setExec(null)
      setInsights([])
      setForecasts([])
      setRecommendations([])
      return
    }
    setLoading(true)
    setError(null)
    const base = `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/ai`
    try {
      const [eRes, iRes, fRes, rRes] = await Promise.all([
        fetch(`${base}/executive-summary?windowDays=30`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/insights`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/forecasts`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/recommendations`, { cache: "no-store", credentials: "include" }),
      ])
      const [ej, ij, fj, rj] = await Promise.all([
        eRes.json() as Promise<{ executiveSummary?: ExecPayload }>,
        iRes.json() as Promise<{ insights?: InsightRow[] }>,
        fRes.json() as Promise<{ forecasts?: ForecastRow[] }>,
        rRes.json() as Promise<{ recommendations?: RecommendationRow[] }>,
      ])
      if (!eRes.ok || !iRes.ok || !fRes.ok || !rRes.ok) {
        setError(blitzpayStaffWidgetLoadCopy.aiFinancialCopilot)
        return
      }
      setExec(ej.executiveSummary ?? null)
      setInsights(ij.insights ?? [])
      setForecasts((fj.forecasts ?? []).slice(0, 10))
      setRecommendations((rj.recommendations ?? []).slice(0, 15))
    } catch {
      setError(blitzpayStaffWidgetLoadCopy.aiFinancialCopilot)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  const regenerate = useCallback(async () => {
    if (!organizationId || !orgReady) return
    setRegenLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/ai/insights?regenerate=1&windowDays=30`,
        { cache: "no-store", credentials: "include" },
      )
      if (!res.ok) {
        setError(blitzpayStaffWidgetLoadCopy.aiFinancialCopilot)
        return
      }
      await load()
    } catch {
      setError(blitzpayStaffWidgetLoadCopy.aiFinancialCopilot)
    } finally {
      setRegenLoading(false)
    }
  }, [organizationId, orgReady, load])

  async function dismissInsight(id: string) {
    if (!organizationId) return
    const res = await fetch(
      `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/ai/insights/${encodeURIComponent(id)}/dismiss`,
      { method: "POST", credentials: "include" },
    )
    if (res.ok) void load()
  }

  async function ackRec(id: string) {
    if (!organizationId) return
    const res = await fetch(
      `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/ai/recommendations/${encodeURIComponent(id)}/acknowledge`,
      { method: "POST", credentials: "include" },
    )
    if (res.ok) void load()
  }

  async function completeRec(id: string) {
    if (!organizationId) return
    const res = await fetch(
      `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/ai/recommendations/${encodeURIComponent(id)}/complete`,
      { method: "POST", credentials: "include" },
    )
    if (res.ok) void load()
  }

  if (!organizationId || !orgReady) return null

  return (
    <div
      id="blitzpay-ai-financial-copilot-anchor"
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-5 sm:px-6 sm:py-6 space-y-5",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Scale className="h-5 w-5 text-[color:var(--primary)] shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">AI financial copilot (advisory)</p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
              Deterministic metrics first, with optional plain-language reads. Recommendations only — no automatic payouts,
              bills, payroll, or customer messages.
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={loading || regenLoading}
            onClick={() => void load()}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            disabled={regenLoading || loading}
            onClick={() => void regenerate()}
          >
            {regenLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
            Regenerate artifacts
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-3">{DISCLAIMER}</p>

      {error ? <p className="text-xs text-muted-foreground">{error}</p> : null}

      {loading && !exec ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </p>
      ) : null}

      {exec ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Executive summary</p>
          <p className="text-sm font-medium text-foreground">{exec.executive.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{exec.executive.summary}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {Object.entries(exec.scores).map(([k, v]) => (
              <div key={k} className="rounded-md border border-border bg-card px-2 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate" title={k}>
                  {k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                </p>
                <p className="text-lg font-semibold tabular-nums">{v}</p>
              </div>
            ))}
          </div>
          <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground leading-relaxed">
            {exec.executive.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risk &amp; opportunity insights</p>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {insights.length === 0 && !loading ? (
              <p className="text-xs text-muted-foreground">No active insights. Use Regenerate to materialize advisory rows.</p>
            ) : null}
            {insights.map((ins) => (
              <div key={ins.id} className="rounded-lg border border-border bg-card/80 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={cn("text-xs font-semibold", severityClass(ins.severity))}>
                    {formatBlitzpayUiLabel(ins.severity)}
                  </span>
                  <span className="text-[10px] uppercase text-muted-foreground">{formatBlitzpayUiLabel(ins.insight_type)}</span>
                </div>
                <p className="text-sm font-medium leading-snug">{ins.title}</p>
                <div className="rounded-md bg-muted/50 px-2 py-1.5 text-[11px] font-mono text-muted-foreground">
                  Deterministic score: {ins.deterministic_score ?? "—"} / 100
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{ins.summary}</p>
                {ins.recommendation_summary ? (
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    <span className="font-semibold text-foreground">Suggested next step: </span>
                    {ins.recommendation_summary}
                  </p>
                ) : null}
                {ins.generated_by !== "deterministic_engine" ? (
                  <p className="text-[11px] text-muted-foreground border-t border-border pt-2 italic">
                    Assisted read (non-authoritative): check deterministic score and metrics first.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void dismissInsight(ins.id)}>
                    Dismiss insight
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Forecast snapshots</p>
            <div className="space-y-2 max-h-[200px] overflow-y-auto text-xs">
              {forecasts.map((f) => (
                <div key={f.id} className="flex flex-wrap justify-between gap-2 rounded-md border border-border px-2 py-2">
                  <span className="font-medium capitalize">{f.snapshot_type}</span>
                  <span className="text-muted-foreground">{f.forecast_window_days}d window</span>
                  <span className="w-full text-muted-foreground">
                    In {fmtMoney(f.projected_inflow_cents)} · Out {fmtMoney(f.projected_outflow_cents)} · Net{" "}
                    {fmtMoney(f.projected_net_cents)}
                  </span>
                </div>
              ))}
              {forecasts.length === 0 ? <p className="text-muted-foreground">No stored forecasts yet.</p> : null}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
              <ClipboardList className="w-3.5 h-3.5" aria-hidden />
              Recommendation queue
            </p>
            <div className="space-y-2 max-h-[220px] overflow-y-auto text-xs">
              {recommendations.map((r) => (
                <div key={r.id} className="rounded-md border border-border p-2 space-y-1">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{formatBlitzpayUiLabel(r.action_type)}</span>
                    <span className="text-muted-foreground">{formatBlitzpayUiLabel(r.action_status)}</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{r.action_summary}</p>
                  {r.ai_reasoning_summary ? (
                    <p className="text-[11px] italic text-muted-foreground border-l-2 border-primary/20 pl-2">
                      Assisted wording: {r.ai_reasoning_summary}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => void ackRec(r.id)}>
                      Acknowledge
                    </Button>
                    <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" onClick={() => void completeRec(r.id)}>
                      Mark done
                    </Button>
                  </div>
                </div>
              ))}
              {recommendations.length === 0 ? <p className="text-muted-foreground">No queued recommendations.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
