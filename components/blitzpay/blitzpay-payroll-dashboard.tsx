"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Briefcase, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { cn } from "@/lib/utils"

type PayrollHealth = {
  pendingCommissionCents: number
  pendingCommissionRowsApprox: number
  draftPayrollRuns: number
  failedPayrollRuns: number
  contractorSettlementPendingCents: number
  revenueSharePendingCents: number
  commissionVelocity7dCents: number
}

type PayrollRun = {
  id: string
  period_start: string
  period_end: string
  payroll_status: string
  total_payout_cents: number
  total_commission_cents: number
  technician_count: number
  processed_at: string | null
}

type PayrollPayload = {
  health: PayrollHealth
  recentRuns: PayrollRun[]
  periodSummarySample?: { totalCommissionPendingCents: number; technicianIds: string[] }
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

function defaultPayrollPeriod(): { start: string; end: string } {
  const now = new Date()
  const firstPrev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const lastPrev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
  const ymd = (d: Date) => d.toISOString().slice(0, 10)
  return { start: ymd(firstPrev), end: ymd(lastPrev) }
}

export function BlitzpayPayrollDashboard({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PayrollPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const defaults = useMemo(() => defaultPayrollPeriod(), [])
  const [periodStart, setPeriodStart] = useState(defaults.start)
  const [periodEnd, setPeriodEnd] = useState(defaults.end)
  const [selectedRunId, setSelectedRunId] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [pRes, rRes] = await Promise.all([
        fetch(`/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/payroll`, {
          cache: "no-store",
          credentials: "include",
        }),
        fetch(`/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/payroll-runs`, {
          cache: "no-store",
          credentials: "include",
        }),
      ])
      let pj: { payroll?: PayrollPayload }
      let rj: { runs?: PayrollRun[] }
      try {
        pj = (await pRes.json()) as { payroll?: PayrollPayload }
        rj = (await rRes.json()) as { runs?: PayrollRun[] }
      } catch {
        setData(null)
        setError(blitzpayStaffWidgetLoadCopy.payroll)
        return
      }
      if (!pRes.ok) {
        setData(null)
        setError(blitzpayStaffWidgetLoadCopy.payroll)
        return
      }
      const runs = rRes.ok ? (rj.runs ?? []) : []
      const merged: PayrollPayload = {
        health: pj.payroll?.health ?? ({} as PayrollHealth),
        recentRuns: runs.length ? runs : (pj.payroll?.recentRuns ?? []),
        periodSummarySample: pj.payroll?.periodSummarySample,
      }
      setData(merged)
      setSelectedRunId((prev) => prev || (merged.recentRuns[0]?.id ?? ""))
    } catch {
      setData(null)
      setError(blitzpayStaffWidgetLoadCopy.payroll)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  async function postDraft() {
    if (!organizationId) return
    setBusy("draft")
    setError(null)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/payroll-runs`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodStart, periodEnd }),
      })
      let j: { run?: { id: string } }
      try {
        j = (await res.json()) as { run?: { id: string } }
      } catch {
        setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
        return
      }
      if (!res.ok) {
        setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
        return
      }
      if (j.run?.id) setSelectedRunId(j.run.id)
      await load()
    } catch {
      setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
    } finally {
      setBusy(null)
    }
  }

  async function postApprove() {
    if (!organizationId || !selectedRunId) return
    setBusy("approve")
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/payroll-runs/${encodeURIComponent(selectedRunId)}/approve`,
        { method: "POST", credentials: "include" },
      )
      await res.json().catch(() => null)
      if (!res.ok) setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
      await load()
    } catch {
      setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
    } finally {
      setBusy(null)
    }
  }

  async function postFinalize() {
    if (!organizationId || !selectedRunId) return
    setBusy("finalize")
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/payroll-runs/${encodeURIComponent(selectedRunId)}/finalize`,
        { method: "POST", credentials: "include" },
      )
      await res.json().catch(() => null)
      if (!res.ok) setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
      await load()
    } catch {
      setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
    } finally {
      setBusy(null)
    }
  }

  if (!organizationId || !orgReady) return null

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-white dark:bg-card px-4 py-5 sm:px-6 sm:py-6 space-y-4",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Briefcase className="h-5 w-5 text-[color:var(--primary)] shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Payroll & commission accruals</p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
              Orchestration and liability signals only — no ACH payroll execution, no bank details, no raw Stripe ids.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs shrink-0" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>
      {error ? <p className="text-xs text-muted-foreground leading-relaxed">{error}</p> : null}
      {loading && !data ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </p>
      ) : null}
      {data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { k: "Pending commissions", v: fmtMoney(data.health.pendingCommissionCents) },
              { k: "Payroll liability (sum)", v: fmtMoney(data.health.pendingCommissionCents + data.health.contractorSettlementPendingCents + data.health.revenueSharePendingCents) },
              { k: "Contractor settlements (pending)", v: fmtMoney(data.health.contractorSettlementPendingCents) },
              { k: "Revenue-share pending", v: fmtMoney(data.health.revenueSharePendingCents) },
              { k: "Commission velocity (7d)", v: fmtMoney(data.health.commissionVelocity7dCents) },
              { k: "Draft payroll runs", v: String(data.health.draftPayrollRuns) },
              { k: "Failed payroll runs (sample)", v: String(data.health.failedPayrollRuns) },
              { k: "Pending commission rows (cap)", v: String(data.health.pendingCommissionRowsApprox) },
            ].map((x) => (
              <div key={x.k} className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide leading-snug">{x.k}</p>
                <p className="text-sm font-semibold tabular-nums mt-1 text-foreground">{x.v}</p>
              </div>
            ))}
          </div>
          {data.recentRuns.length > 0 ? (
            <div className="rounded-lg border border-border/80 px-3 py-2 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recent payroll runs</p>
              <ul className="space-y-1 text-[11px] text-muted-foreground">
                {data.recentRuns.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span>
                      {r.period_start} → {r.period_end} · {r.payroll_status}
                    </span>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {fmtMoney(r.total_commission_cents)} comm · {r.technician_count} tech
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">No payroll runs yet — create a draft period using the actions below.</p>
          )}

          <div className="rounded-lg border border-dashed border-border px-3 py-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Payroll run actions (admin)</p>
            <div className="flex flex-wrap gap-2 items-end">
              <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                Period start
                <Input className="h-8 text-xs w-36" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </label>
              <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                Period end
                <Input className="h-8 text-xs w-36" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </label>
              <Button type="button" size="sm" className="h-8 text-xs" disabled={busy !== null} onClick={() => void postDraft()}>
                {busy === "draft" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Create / refresh draft
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                Run id
                <select
                  className="h-8 rounded border border-border bg-background px-2 text-[11px] font-mono min-w-[220px]"
                  value={selectedRunId}
                  onChange={(e) => setSelectedRunId(e.target.value)}
                >
                  <option value="">Select a run…</option>
                  {(data?.recentRuns ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.period_start} → {r.period_end} ({r.payroll_status})
                    </option>
                  ))}
                </select>
              </label>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={!selectedRunId || busy !== null} onClick={() => void postApprove()}>
                {busy === "approve" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Approve
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={!selectedRunId || busy !== null} onClick={() => void postFinalize()}>
                {busy === "finalize" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Finalize
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Finalize marks linked commissions paid for this run (accounting only). Requires workspace settings + financials access.
            </p>
          </div>
        </>
      ) : null}
    </div>
  )
}
