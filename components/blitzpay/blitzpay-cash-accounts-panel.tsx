"use client"

import { useCallback, useEffect, useState } from "react"
import { Banknote, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { cn } from "@/lib/utils"

type CashPlanning = {
  generatedAt: string
  summary: {
    accounts: Array<{
      id: string | null
      accountType: string
      displayName: string
      status: string
      targetBalanceCents: number
      currentEstimatedBalanceCents: number
    }>
    estimatedOperatingCashCents: number
    cashReserveTargetCents: number
    cashReserveGapCents: number
  }
  runway: {
    status: string
    expectedInflows7dCents: number
    expectedInflows30dCents: number
    expectedOutflows7dCents: number
    expectedOutflows30dCents: number
    reserveTargetCents: number
    cushion7dCents: number
    cushion30dCents: number
  }
  health: {
    runwayStatus: string
    warnings: string[]
    recommendations: string[]
    payrollReserveCoverageBasisPoints: number
    apReserveCoverageBasisPoints: number
  }
  reserveRules: Array<{
    id: string
    rule_name: string
    rule_type: string
    basis_points: number | null
    fixed_amount_cents: number | null
    active: boolean
  }>
  disclosures: string[]
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayCashAccountsPanel({ organizationId, orgReady }: Props) {
  const { permissions, status: permStatus } = useOrgPermissions()
  const canMutate =
    permStatus === "ready" && Boolean(permissions.canManageSettings && permissions.canViewFinancials)

  const [loading, setLoading] = useState(false)
  const [cash, setCash] = useState<CashPlanning | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ruleName, setRuleName] = useState("Operating reserve")
  const [ruleType, setRuleType] = useState("percent_of_collections")
  const [basisPoints, setBasisPoints] = useState("500")

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setCash(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/cash-accounts`,
        { cache: "no-store", credentials: "include" },
      )
      let j: { cash?: CashPlanning }
      try {
        j = (await res.json()) as { cash?: CashPlanning }
      } catch {
        setCash(null)
        setError(blitzpayStaffWidgetLoadCopy.cashPlanning)
        return
      }
      if (!res.ok) {
        setCash(null)
        setError(blitzpayStaffWidgetLoadCopy.cashPlanning)
        return
      }
      setCash(j.cash ?? null)
    } catch {
      setCash(null)
      setError(blitzpayStaffWidgetLoadCopy.cashPlanning)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  async function addRule() {
    if (!organizationId || !canMutate) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/cash-reserve-rules`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ruleName,
            ruleType,
            basisPoints: Number(basisPoints) || 0,
          }),
        },
      )
      await res.json().catch(() => null)
      if (!res.ok) {
        setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
        return
      }
      await load()
    } catch {
      setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
    } finally {
      setBusy(false)
    }
  }

  if (!organizationId || !orgReady) return null

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-5 sm:px-6 sm:py-6 space-y-4",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Banknote className="h-5 w-5 text-[color:var(--primary)] shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Operating cash &amp; internal buckets</p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
              Planning-only view of contractor cash timing. Not a bank account; Stripe Connect remains the source of truth
              for funds movement.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs shrink-0" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>

      {error ? <p className="text-xs text-muted-foreground leading-relaxed">{error}</p> : null}
      {loading && !cash ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </p>
      ) : null}

      {cash ? (
        <>
          <p className="text-xs text-muted-foreground tabular-nums">
            Generated {new Date(cash.generatedAt).toLocaleString()}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">Available operating cash</p>
              <p className="font-semibold tabular-nums mt-0.5">{fmtMoney(cash.summary.estimatedOperatingCashCents)}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">Money to reserve (target)</p>
              <p className="font-semibold tabular-nums mt-0.5">{fmtMoney(cash.summary.cashReserveTargetCents)}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">Reserve gap</p>
              <p className="font-semibold tabular-nums mt-0.5">{fmtMoney(cash.summary.cashReserveGapCents)}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">Cash runway</p>
              <p className="font-semibold mt-0.5 capitalize">{cash.runway.status}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">Expected incoming payments (7d / 30d)</p>
              <p className="font-semibold tabular-nums mt-0.5 text-xs leading-snug">
                {fmtMoney(cash.runway.expectedInflows7dCents)} · {fmtMoney(cash.runway.expectedInflows30dCents)}
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">Upcoming obligations (7d / 30d est.)</p>
              <p className="font-semibold tabular-nums mt-0.5 text-xs leading-snug">
                {fmtMoney(cash.runway.expectedOutflows7dCents)} · {fmtMoney(cash.runway.expectedOutflows30dCents)}
              </p>
            </div>
          </div>

          {cash.health.warnings.length > 0 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm space-y-1">
              <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">Liquidity notes</p>
              <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                {cash.health.warnings.map((w) => (
                  <li key={w.slice(0, 80)}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {cash.health.recommendations.length > 0 ? (
            <div className="rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-sm space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Guidance</p>
              <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                {cash.health.recommendations.map((r) => (
                  <li key={r.slice(0, 100)}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
            {cash.disclosures.map((d) => (
              <p key={d.slice(0, 40)}>{d}</p>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Internal bucket rows</p>
            {cash.summary.accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bucket rows yet — estimates still populate above.</p>
            ) : (
              <ul className="text-sm space-y-1 text-muted-foreground">
                {cash.summary.accounts.map((a) => (
                  <li key={`${a.accountType}-${a.displayName}`} className="flex flex-wrap justify-between gap-2">
                    <span className="text-foreground font-medium">{a.displayName}</span>
                    <span className="tabular-nums">
                      {fmtMoney(a.currentEstimatedBalanceCents)} / target {fmtMoney(a.targetBalanceCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reserve rules</p>
            {cash.reserveRules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No custom rules — defaults come from treasury target + heuristics.</p>
            ) : (
              <ul className="text-xs space-y-1">
                {cash.reserveRules.map((r) => (
                  <li key={r.id} className="text-muted-foreground">
                    <span className="font-medium text-foreground">{r.rule_name}</span> · {r.rule_type} · bps{" "}
                    {r.basis_points ?? "—"} · fixed {r.fixed_amount_cents != null ? fmtMoney(r.fixed_amount_cents) : "—"} ·{" "}
                    {r.active ? "active" : "off"}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canMutate ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-3 space-y-2 text-sm">
              <p className="text-xs font-semibold text-muted-foreground">Add reserve rule (deterministic)</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="Rule name" className="h-8 text-xs" />
                <select
                  className="h-8 text-xs rounded-md border border-input bg-background px-2"
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value)}
                >
                  <option value="percent_of_collections">Percent of collections</option>
                  <option value="fixed_monthly_reserve">Fixed monthly reserve</option>
                  <option value="payroll_liability">Payroll liability</option>
                  <option value="vendor_ap_pressure">Vendor / AP pressure</option>
                  <option value="dispute_risk">Dispute risk</option>
                  <option value="tax_estimate">Tax estimate</option>
                </select>
                <Input
                  value={basisPoints}
                  onChange={(e) => setBasisPoints(e.target.value)}
                  placeholder="Basis points (e.g. 500 = 5%)"
                  className="h-8 text-xs"
                />
              </div>
              <Button type="button" size="sm" className="h-8 text-xs" disabled={busy} onClick={() => void addRule()}>
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Save rule
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
