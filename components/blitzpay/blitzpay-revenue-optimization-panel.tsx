"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BarChart3, CheckCircle2, ClipboardList, Loader2, RefreshCw, ShieldAlert, Sparkles, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"

const DISCLAIMER =
  "Revenue optimization recommendations are advisory. Your team controls customer messaging, pricing, renewals, and payment actions."

type OppRow = {
  id: string
  opportunity_type: string
  opportunity_status: string
  priority: string
  title: string
  summary: string
  deterministic_score: number | null
  estimated_revenue_impact_cents: number | null
  confidence_score: number | null
  supporting_metrics: Record<string, unknown>
  recommended_action: string | null
  created_at: string
}

type ActRow = {
  id: string
  opportunity_id: string
  action_status: string
  action_type: string
  action_summary: string
  deterministic_basis: Record<string, unknown>
  created_at: string
}

type ScoreRow = {
  id: string
  customer_id: string
  score_date: string
  payment_reliability_score: number | null
  late_payment_risk_score: number | null
  autopay_fit_score: number | null
  ach_nudge_fit_score: number | null
  renewal_risk_score: number | null
  financing_fit_score: number | null
  supporting_metrics: Record<string, unknown>
}

type ExpRow = {
  id: string
  experiment_name: string
  experiment_type: string
  experiment_status: string
  estimated_lift_basis_points: number | null
  created_at: string
}

type Health = {
  ok: true
  organizationId: string
  activeOpportunityCount: number
  pendingActionCount: number
  activeOrDraftExperimentCount: number
}

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

function shortCustomerLabel(id: string): string {
  return `Customer ${id.slice(0, 8)}…`
}

function supportingWhy(metrics: Record<string, unknown>): string {
  const entries = Object.entries(metrics).slice(0, 6)
  if (entries.length === 0) return "Based on bounded billing and collections signals in your workspace."
  return entries
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "number" ? Math.round(v) : String(v)}`)
    .join(" · ")
}

export function BlitzpayRevenueOptimizationPanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [opportunities, setOpportunities] = useState<OppRow[]>([])
  const [actions, setActions] = useState<ActRow[]>([])
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [experiments, setExperiments] = useState<ExpRow[]>([])

  const base = useMemo(
    () => (organizationId ? `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/revenue-optimization` : ""),
    [organizationId],
  )

  const load = useCallback(async () => {
    if (!organizationId || !orgReady || !base) {
      setHealth(null)
      setOpportunities([])
      setActions([])
      setScores([])
      setExperiments([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [hRes, oRes, aRes, sRes, eRes] = await Promise.all([
        fetch(`${base}/health`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/opportunities`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/actions`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/payment-behavior`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/experiments`, { cache: "no-store", credentials: "include" }),
      ])
      const [hj, oj, aj, sj, ej] = await Promise.all([
        hRes.json() as Promise<{ health?: Health }>,
        oRes.json() as Promise<{ opportunities?: OppRow[] }>,
        aRes.json() as Promise<{ actions?: ActRow[] }>,
        sRes.json() as Promise<{ scores?: ScoreRow[] }>,
        eRes.json() as Promise<{ experiments?: ExpRow[] }>,
      ])
      if (!hRes.ok || !oRes.ok || !aRes.ok || !sRes.ok || !eRes.ok) {
        setError(blitzpayStaffWidgetLoadCopy.revenueOptimization)
        return
      }
      setHealth(hj.health ?? null)
      setOpportunities((oj.opportunities ?? []).slice(0, 25))
      setActions((aj.actions ?? []).slice(0, 20))
      setScores((sj.scores ?? []).slice(0, 20))
      setExperiments((ej.experiments ?? []).slice(0, 12))
    } catch {
      setError(blitzpayStaffWidgetLoadCopy.revenueOptimization)
    } finally {
      setLoading(false)
    }
  }, [base, organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  const regen = useCallback(async () => {
    if (!base) return
    setGenLoading(true)
    setError(null)
    try {
      const res = await fetch(`${base}/generate`, { method: "POST", credentials: "include" })
      if (!res.ok) {
        setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
        return
      }
      await load()
    } catch {
      setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
    } finally {
      setGenLoading(false)
    }
  }, [base, load])

  const dismissOpp = useCallback(
    async (id: string) => {
      if (!base) return
      try {
        const res = await fetch(`${base}/opportunities/${encodeURIComponent(id)}/dismiss`, {
          method: "POST",
          credentials: "include",
        })
        if (!res.ok) {
          setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
          return
        }
        await load()
      } catch {
        setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
      }
    },
    [base, load],
  )

  const ackAct = useCallback(
    async (id: string) => {
      if (!base) return
      try {
        const res = await fetch(`${base}/actions/${encodeURIComponent(id)}/acknowledge`, {
          method: "POST",
          credentials: "include",
        })
        if (!res.ok) {
          setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
          return
        }
        await load()
      } catch {
        setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
      }
    },
    [base, load],
  )

  const completeAct = useCallback(
    async (id: string) => {
      if (!base) return
      try {
        const res = await fetch(`${base}/actions/${encodeURIComponent(id)}/complete`, {
          method: "POST",
          credentials: "include",
        })
        if (!res.ok) {
          setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
          return
        }
        await load()
      } catch {
        setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
      }
    },
    [base, load],
  )

  if (!organizationId || !orgReady) return null

  const achRows = opportunities.filter((o) => o.opportunity_type === "ach_nudge")
  const churnRows = opportunities.filter((o) => o.opportunity_type === "churn_prevention" || o.opportunity_type === "renewal_timing")
  const membershipRows = opportunities.filter((o) => o.opportunity_type === "membership_pricing")
  const recoveryRows = opportunities.filter((o) => o.opportunity_type === "recovery_sequence")
  const coachRows = opportunities.filter((o) => o.opportunity_type === "technician_coaching")

  return (
    <div
      id="blitzpay-revenue-optimization-anchor"
      className={cn(
        "rounded-xl border border-border bg-card px-3 py-4 sm:px-5 sm:py-5 space-y-5",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <BarChart3 className="h-4 w-4 text-[color:var(--primary)] shrink-0 mt-0.5" aria-hidden />
          <div className="space-y-1">
            <p className="text-xs font-semibold">Revenue optimization (deterministic)</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed max-w-prose">
              Queue, scoring, and experiments are built from bounded ledger and billing signals. Nothing here messages customers,
              changes prices, or retries cards on its own.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Refresh</span>
          </Button>
          <Button type="button" size="sm" className="h-8 text-xs" onClick={() => void regen()} disabled={genLoading || loading}>
            {genLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Rebuild queue</span>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50 px-3 py-2 text-[11px] leading-relaxed text-foreground/90">
        <ShieldAlert className="inline h-3.5 w-3.5 mr-1 text-amber-700 dark:text-amber-400 align-text-bottom" aria-hidden />
        {DISCLAIMER}
      </div>

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}

      {health ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Active opportunities</p>
            <p className="text-lg font-semibold tabular-nums">{health.activeOpportunityCount}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pending actions</p>
            <p className="text-lg font-semibold tabular-nums">{health.pendingActionCount}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Draft / active experiments</p>
            <p className="text-lg font-semibold tabular-nums">{health.activeOrDraftExperimentCount}</p>
          </div>
        </div>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <h3 className="text-xs font-semibold">Revenue opportunity queue</h3>
        </div>
        {opportunities.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active opportunities. Use Rebuild queue after you have billing activity.</p>
        ) : (
          <ul className="space-y-2">
            {opportunities.map((o) => (
              <li key={o.id} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium">{o.title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{o.summary}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] uppercase text-muted-foreground">{o.priority} · {o.opportunity_type.replace(/_/g, " ")}</span>
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => void dismissOpp(o.id)}>
                        <XCircle className="h-3 w-3 mr-1" />
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded bg-muted/40 px-2 py-1.5 font-mono text-[10px]">
                    <span className="text-muted-foreground">Deterministic score: </span>
                    {o.deterministic_score ?? "—"}
                    <span className="text-muted-foreground"> · Est. impact: </span>
                    {fmtMoney(o.estimated_revenue_impact_cents)}
                  </div>
                  <div className="rounded bg-muted/20 px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
                    <span className="font-medium text-foreground/80">Why: </span>
                    {supportingWhy(o.supporting_metrics as Record<string, unknown>)}
                  </div>
                </div>
                {o.recommended_action ? (
                  <p className="text-[11px] border-l-2 border-primary/40 pl-2 text-foreground/90">
                    <span className="font-medium">Suggested next step: </span>
                    {o.recommended_action}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold">Payment behavior summary</h3>
        {scores.length === 0 ? (
          <p className="text-xs text-muted-foreground">No scored customers yet. Rebuild queue runs a bounded per-customer scan.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-[10px]">
              <thead className="bg-muted/50 text-muted-foreground text-left">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Customer</th>
                  <th className="px-2 py-1.5 font-medium">Date</th>
                  <th className="px-2 py-1.5 font-medium">Reliability</th>
                  <th className="px-2 py-1.5 font-medium">Late risk</th>
                  <th className="px-2 py-1.5 font-medium">Autopay fit</th>
                  <th className="px-2 py-1.5 font-medium">ACH nudge fit</th>
                  <th className="px-2 py-1.5 font-medium">Renewal risk</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s) => (
                  <tr key={s.id} className="border-t border-border/80">
                    <td className="px-2 py-1.5 font-mono">{shortCustomerLabel(s.customer_id)}</td>
                    <td className="px-2 py-1.5">{s.score_date}</td>
                    <td className="px-2 py-1.5 tabular-nums">{s.payment_reliability_score ?? "—"}</td>
                    <td className="px-2 py-1.5 tabular-nums">{s.late_payment_risk_score ?? "—"}</td>
                    <td className="px-2 py-1.5 tabular-nums">{s.autopay_fit_score ?? "—"}</td>
                    <td className="px-2 py-1.5 tabular-nums">{s.ach_nudge_fit_score ?? "—"}</td>
                    <td className="px-2 py-1.5 tabular-nums">{s.renewal_risk_score ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="space-y-2 rounded-md border border-dashed border-border/80 p-3">
          <h3 className="text-xs font-semibold">ACH nudge recommendations</h3>
          {achRows.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No ACH-focused opportunities in the current queue.</p>
          ) : (
            <ul className="space-y-1.5 text-[11px]">
              {achRows.map((o) => (
                <li key={o.id} className="leading-snug">
                  <span className="font-medium">{o.title}</span>
                  <span className="text-muted-foreground"> — {supportingWhy(o.supporting_metrics as Record<string, unknown>)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-2 rounded-md border border-dashed border-border/80 p-3">
          <h3 className="text-xs font-semibold">Churn / renewal risk indicators</h3>
          {churnRows.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No churn or renewal-timing opportunities right now.</p>
          ) : (
            <ul className="space-y-1.5 text-[11px]">
              {churnRows.map((o) => (
                <li key={o.id} className="leading-snug">
                  <span className="font-medium">{o.title}</span>
                  <span className="text-muted-foreground"> — {supportingWhy(o.supporting_metrics as Record<string, unknown>)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="space-y-2 rounded-md border border-dashed border-border/80 p-3">
          <h3 className="text-xs font-semibold">Membership pricing review</h3>
          {membershipRows.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No membership pricing review flags.</p>
          ) : (
            <ul className="space-y-1.5 text-[11px]">
              {membershipRows.map((o) => (
                <li key={o.id}>{o.summary}</li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-2 rounded-md border border-dashed border-border/80 p-3">
          <h3 className="text-xs font-semibold">Recovery sequence recommendations</h3>
          {recoveryRows.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No recovery-sequence suggestions. Phase 2AB retry caps still apply.</p>
          ) : (
            <ul className="space-y-1.5 text-[11px]">
              {recoveryRows.map((o) => (
                <li key={o.id}>{o.summary}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-2 rounded-md border border-dashed border-border/80 p-3">
        <h3 className="text-xs font-semibold">Technician collection coaching</h3>
        {coachRows.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No internal coaching prompts. Field recovery metrics look steady.</p>
        ) : (
          <ul className="space-y-1.5 text-[11px]">
            {coachRows.map((o) => (
              <li key={o.id}>{o.summary}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold">Human action queue</h3>
        {actions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No pending actions.</p>
        ) : (
          <ul className="space-y-2">
            {actions.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-[11px]">
                <div className="space-y-0.5 max-w-xl">
                  <p className="font-medium">{a.action_summary}</p>
                  <p className="text-muted-foreground">{a.action_type.replace(/_/g, " ")} · {a.action_status}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px]"
                    disabled={a.action_status !== "pending"}
                    onClick={() => void ackAct(a.id)}
                  >
                    Acknowledge
                  </Button>
                  <Button type="button" size="sm" className="h-7 text-[10px]" onClick={() => void completeAct(a.id)}>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Complete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold">Experiment tracking</h3>
        {experiments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No experiments logged. POST from API or future form can add operational trials.</p>
        ) : (
          <ul className="space-y-1.5 text-[11px]">
            {experiments.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 border-b border-border/60 pb-1.5 last:border-0">
                <span className="font-medium">{e.experiment_name}</span>
                <span className="text-muted-foreground">
                  {e.experiment_type.replace(/_/g, " ")} · {e.experiment_status}
                  {e.estimated_lift_basis_points != null ? ` · lift ${e.estimated_lift_basis_points} bps` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
