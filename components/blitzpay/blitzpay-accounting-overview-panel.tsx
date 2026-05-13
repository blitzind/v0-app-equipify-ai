"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, BookMarked, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { formatBlitzpayUiLabel } from "@/lib/blitzpay/blitzpay-ui-labels"

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

type TrialRow = { account_code: string; account_name: string; debit_cents: number; credit_cents: number }
type TrialPayload = { accounts: TrialRow[]; totalDebitCents: number; totalCreditCents: number; healthy: boolean; asOfDate: string }
type BatchRow = { batch_reference: string; batch_type: string; status: string; created_at: string }
type PeriodRow = { period_name: string; start_date: string; end_date: string; status: string }
type CoaRow = {
  account_code: string
  account_name: string
  account_type: string
  is_system_account?: boolean
}

export function BlitzpayAccountingOverviewPanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [trial, setTrial] = useState<TrialPayload | null>(null)
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [coa, setCoa] = useState<CoaRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setTrial(null)
      setBatches([])
      setPeriods([])
      setCoa([])
      return
    }
    setLoading(true)
    setError(null)
    const base = `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay`
    try {
      const [tRes, bRes, pRes, cRes] = await Promise.all([
        fetch(`${base}/accounting/trial-balance`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/accounting/journal-batches`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/accounting/financial-periods`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/accounting/chart-of-accounts`, { cache: "no-store", credentials: "include" }),
      ])
      if (!tRes.ok || !bRes.ok || !pRes.ok) {
        setError(blitzpayStaffWidgetLoadCopy.financialCommandCenter)
        setTrial(null)
        setCoa([])
        return
      }
      const tj = (await tRes.json()) as { trialBalance?: TrialPayload }
      const bj = (await bRes.json()) as { batches?: BatchRow[] }
      const pj = (await pRes.json()) as { periods?: PeriodRow[] }
      setTrial(tj.trialBalance ?? null)
      setBatches((bj.batches ?? []).slice(0, 12))
      setPeriods((pj.periods ?? []).slice(0, 6))
      if (cRes.ok) {
        const cj = (await cRes.json()) as { accounts?: CoaRow[] }
        setCoa((cj.accounts ?? []).slice(0, 24))
      } else {
        setCoa([])
      }
    } catch {
      setError(blitzpayStaffWidgetLoadCopy.financialCommandCenter)
      setTrial(null)
      setCoa([])
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  if (!organizationId || !orgReady) return null

  const postedAccounts = (trial?.accounts ?? []).filter((a) => a.debit_cents > 0 || a.credit_cents > 0).slice(0, 8)
  const displayAccounts = postedAccounts.length ? postedAccounts : (trial?.accounts ?? []).slice(0, 8)
  const deferredRow = (trial?.accounts ?? []).find((a) => a.account_code === "2100")
  const deferredNetCents = deferredRow ? Math.max(0, deferredRow.credit_cents - deferredRow.debit_cents) : 0
  const draftBatches = batches.filter((b) => b.status === "draft").length
  const closedPeriods = periods.filter((p) => p.status === "closed" || p.status === "soft_closed").length
  const warnings: string[] = []
  if (trial && !trial.healthy) warnings.push("Posted debits and credits on the trial balance do not match — review before closing.")
  if (draftBatches > 0) warnings.push(`You have ${draftBatches} draft journal batch(es) in the recent list — post or clean up when ready.`)
  if (closedPeriods > 0 && trial)
    warnings.push(`${closedPeriods} financial period(s) are closed or soft-closed — new posts may be blocked for those dates.`)

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-white dark:bg-card px-4 py-5 sm:px-6 sm:py-6 space-y-4",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BookMarked className="h-5 w-5 text-[color:var(--primary)] shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Internal books (BlitzPay)</p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
              Double-entry ledger for your team — separate from Stripe settlement. Posted entries stay fixed; corrections use reversals.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs shrink-0" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>

      {error ? <p className="text-xs text-muted-foreground leading-relaxed">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5">
          <p className="text-[11px] font-medium text-muted-foreground">Books in balance</p>
          <p className="text-sm font-semibold tabular-nums">{trial?.healthy ? "Yes" : trial ? "Review" : "—"}</p>
        </div>
        <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5">
          <p className="text-[11px] font-medium text-muted-foreground">Trial debits / credits</p>
          <p className="text-sm font-semibold tabular-nums">
            {trial ? `${fmtMoney(trial.totalDebitCents)} / ${fmtMoney(trial.totalCreditCents)}` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5">
          <p className="text-[11px] font-medium text-muted-foreground">Deferred revenue (liability)</p>
          <p className="text-sm font-semibold tabular-nums">{deferredRow ? fmtMoney(deferredNetCents) : "—"}</p>
        </div>
      </div>

      {warnings.length > 0 ? (
        <div className="rounded-lg border border-[color:var(--status-warning)]/35 bg-[color:var(--status-warning)]/10 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-[color:var(--status-warning)] shrink-0" aria-hidden />
            Heads-up
          </div>
          <ul className="text-[11px] text-muted-foreground space-y-1 leading-relaxed list-disc pl-4">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {coa.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Account list (active)</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">First accounts in your chart — codes are internal to BlitzPay.</p>
          <div className="overflow-x-auto rounded-md border border-border max-h-56 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Code</th>
                  <th className="px-2 py-1.5 font-medium">Name</th>
                  <th className="px-2 py-1.5 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {coa.map((a) => (
                  <tr key={a.account_code} className="border-t border-border/60">
                    <td className="px-2 py-1 tabular-nums">{a.account_code}</td>
                    <td className="px-2 py-1">
                      {a.account_name}
                      {a.is_system_account ? <span className="text-muted-foreground"> · default</span> : null}
                    </td>
                    <td className="px-2 py-1">{formatBlitzpayUiLabel(a.account_type)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {trial ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Trial balance (posted, windowed)</p>
          <p className="text-[11px] text-muted-foreground tabular-nums">As of {trial.asOfDate}</p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Code</th>
                  <th className="px-2 py-1.5 font-medium">Account</th>
                  <th className="px-2 py-1.5 font-medium text-right">Debit</th>
                  <th className="px-2 py-1.5 font-medium text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {displayAccounts.map((a) => (
                  <tr key={a.account_code} className="border-t border-border/60">
                    <td className="px-2 py-1 tabular-nums">{a.account_code}</td>
                    <td className="px-2 py-1">{a.account_name}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtMoney(a.debit_cents)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtMoney(a.credit_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : loading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading books…
        </p>
      ) : null}

      {batches.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Recent journal activity</p>
          <ul className="text-xs space-y-1 text-muted-foreground">
            {batches.map((b) => (
              <li key={`${b.batch_reference}-${b.created_at}`} className="flex justify-between gap-2">
                <span className="truncate">{b.batch_reference}</span>
                <span className="shrink-0 tabular-nums">
                  {formatBlitzpayUiLabel(b.batch_type)} · {formatBlitzpayUiLabel(b.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {periods.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Financial periods</p>
          <ul className="text-xs space-y-1 text-muted-foreground">
            {periods.map((p) => (
              <li key={p.period_name} className="flex justify-between gap-2">
                <span className="truncate">{p.period_name}</span>
                <span className="shrink-0 tabular-nums">
                  {p.start_date} → {p.end_date} · {formatBlitzpayUiLabel(p.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Money movement timing still follows Stripe on the Payments side; this view is your accrual-style map for reviews and period close.
      </p>
    </div>
  )
}
