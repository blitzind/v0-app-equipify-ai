"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, RefreshCw, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { formatBlitzpayUiLabel } from "@/lib/blitzpay/blitzpay-ui-labels"
import { reserveReplenishmentIndicator0to100, reserveUtilizationScore0to100 } from "@/lib/blitzpay/blitzpay-warranty-reserves"

type Phase5c = {
  warrantyReserveExposure: number
  claimsExposureCents: number
  claimsReserveCoverageScore: number
  protectionPlanRecurringRevenue: number
  stormEventTreasuryPressure: number
  contractorProtectionHealthScore: number
  claimsPayoutExposure: number
  protectionPlanCoverageRate: number
}

type HealthPayload = {
  disclaimer: string
  sinceIso: string | null
  phase5c: Phase5c
}

type ReserveRow = {
  id: string
  reserve_status: string
  reserve_type: string
  reserve_name: string
  reserve_balance_cents: number
  projected_exposure_cents: number | null
  reserve_utilization_rate: number | null
}

type ClaimRow = {
  id: string
  claim_status: string
  claim_type: string
  claim_reference: string
  estimated_claim_amount_cents: number | null
  submitted_at: string | null
}

type PayoutRow = {
  id: string
  claim_id: string
  payout_status: string
  payout_type: string
  payout_amount_cents: number
  payout_reference_recorded: boolean
  payout_reference_probe: string | null
}

type PlanRow = {
  id: string
  plan_status: string
  plan_type: string
  monthly_price_cents: number | null
  estimated_exposure_cents: number | null
}

type StormRow = {
  id: string
  event_status: string
  event_name: string
  event_region: string | null
  estimated_claim_exposure_cents: number | null
  estimated_treasury_pressure: number | null
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayClaimsProtectionPanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [reserves, setReserves] = useState<ReserveRow[]>([])
  const [claims, setClaims] = useState<ClaimRow[]>([])
  const [payouts, setPayouts] = useState<PayoutRow[]>([])
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [storms, setStorms] = useState<StormRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setHealth(null)
      setReserves([])
      setClaims([])
      setPayouts([])
      setPlans([])
      setStorms([])
      return
    }
    setLoading(true)
    setError(null)
    const base = `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay`
    try {
      const [hRes, rRes, cRes, pRes, plRes, sRes] = await Promise.all([
        fetch(`${base}/claims/health`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/claims/reserves`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/claims`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/claims/payouts`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/protection-plans`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/storm-events`, { cache: "no-store", credentials: "include" }),
      ])
      if (!hRes.ok || !rRes.ok || !cRes.ok || !pRes.ok || !plRes.ok || !sRes.ok) {
        setHealth(null)
        setError(blitzpayStaffWidgetLoadCopy.claimsProtection)
        return
      }
      const h = (await hRes.json()) as HealthPayload
      setHealth(h)
      const rj = (await rRes.json()) as { reserves: ReserveRow[] }
      setReserves(rj.reserves ?? [])
      const cj = (await cRes.json()) as { claims: ClaimRow[] }
      setClaims(cj.claims ?? [])
      const pj = (await pRes.json()) as { payouts: PayoutRow[] }
      setPayouts(pj.payouts ?? [])
      const plj = (await plRes.json()) as { plans: PlanRow[] }
      setPlans(plj.plans ?? [])
      const sj = (await sRes.json()) as { stormEvents: StormRow[] }
      setStorms(sj.stormEvents ?? [])
    } catch {
      setHealth(null)
      setError(blitzpayStaffWidgetLoadCopy.claimsProtection)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  if (!organizationId || !orgReady) return null

  const p5 = health?.phase5c

  return (
    <div
      id="blitzpay-claims-protection"
      className={cn(
        "rounded-xl border border-border bg-white dark:bg-card px-4 py-5 sm:px-6 sm:py-6 space-y-5",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
        "min-w-0 max-w-full overflow-x-hidden",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Shield className="h-5 w-5 text-[color:var(--primary)] shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Claims &amp; protection</p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
              Operational tracking for warranty-style reserves, open work items, optional protection plans, and storm-season
              planning signals. Nothing here approves payouts or replaces your review steps.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs shrink-0" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>

      {error ? <p className="text-xs text-muted-foreground leading-relaxed">{error}</p> : null}

      {health?.disclaimer ?
        <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-border pl-3">{health.disclaimer}</p>
      : null}

      {loading && !health ?
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading claims &amp; protection signals…
        </p>
      : null}

      {health && p5 ?
        <>
          <p className="text-xs text-muted-foreground tabular-nums">
            Reporting window since {health?.sinceIso ? new Date(health.sinceIso).toLocaleDateString() : "—"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 min-w-0">
            {[
              { k: "Reserve & exposure (upper-bound est.)", v: fmtMoney(p5.warrantyReserveExposure) },
              { k: "Open items — estimated exposure (tracked)", v: fmtMoney(p5.claimsExposureCents) },
              { k: "Reserve vs open items (comfort score)", v: `${p5.claimsReserveCoverageScore}/100` },
              { k: "Protection plans — recurring proxy (annual est.)", v: fmtMoney(p5.protectionPlanRecurringRevenue) },
              { k: "Storm season — treasury pressure (max active)", v: `${p5.stormEventTreasuryPressure}/100` },
              { k: "Contractor protection health (advisory)", v: `${p5.contractorProtectionHealthScore}/100` },
              { k: "Payout tracking — in-flight exposure (est.)", v: fmtMoney(p5.claimsPayoutExposure) },
              { k: "Active plan coverage signal", v: `${p5.protectionPlanCoverageRate}/100` },
            ].map((x) => (
              <div key={x.k} className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide leading-snug break-words">{x.k}</p>
                <p className="text-sm font-semibold tabular-nums mt-1 text-foreground">{x.v}</p>
              </div>
            ))}
          </div>
        </>
      : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
        <div className="rounded-lg border border-border/70 px-3 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Warranty-style reserves</p>
          {reserves.length === 0 ?
            <p className="text-sm text-muted-foreground">No reserve rows yet.</p>
          : <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
              {reserves.slice(0, 8).map((r) => {
                const util =
                  r.reserve_utilization_rate != null ?
                    Math.round(Number(r.reserve_utilization_rate))
                  : reserveUtilizationScore0to100(r.reserve_balance_cents, r.projected_exposure_cents)
                const repl = reserveReplenishmentIndicator0to100(r.reserve_balance_cents, r.projected_exposure_cents)
                return (
                  <li key={r.id} className="tabular-nums min-w-0 break-words">
                    <span className="font-medium text-foreground">{r.reserve_name}</span> ·{" "}
                    {formatBlitzpayUiLabel(String(r.reserve_type))} · {formatBlitzpayUiLabel(r.reserve_status)} · balance{" "}
                    {fmtMoney(r.reserve_balance_cents)}
                    {r.projected_exposure_cents != null ? ` · projected ${fmtMoney(r.projected_exposure_cents)}` : ""}
                    {` · utilization ${util}/100`}
                    {repl > 0 ? ` · top-up signal ${repl}/100` : ""}
                  </li>
                )
              })}
            </ul>
          }
        </div>
        <div className="rounded-lg border border-border/70 px-3 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Work items (queue order)</p>
          {claims.length === 0 ?
            <p className="text-sm text-muted-foreground">No tracked items yet.</p>
          : <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
              {claims.slice(0, 10).map((c) => (
                <li key={c.id} className="tabular-nums min-w-0 break-words">
                  <span className="font-medium text-foreground">{c.claim_reference}</span> ·{" "}
                  {formatBlitzpayUiLabel(String(c.claim_type))} · {formatBlitzpayUiLabel(c.claim_status)}
                  {c.estimated_claim_amount_cents != null ?
                    ` · est. ${fmtMoney(Math.max(0, Math.round(Number(c.estimated_claim_amount_cents))))}`
                  : ""}
                </li>
              ))}
            </ul>
          }
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
        <div className="rounded-lg border border-border/70 px-3 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Protection plans (bounded)</p>
          {plans.length === 0 ?
            <p className="text-sm text-muted-foreground">No protection plan rows visible.</p>
          : <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
              {plans.slice(0, 8).map((p) => (
                <li key={p.id} className="tabular-nums">
                  <span className="font-medium text-foreground">{formatBlitzpayUiLabel(String(p.plan_type))}</span> ·{" "}
                  {formatBlitzpayUiLabel(p.plan_status)}
                  {p.monthly_price_cents != null ? ` · ${fmtMoney(Math.max(0, Math.round(Number(p.monthly_price_cents))))}/mo` : ""}
                  {p.estimated_exposure_cents != null ?
                    ` · exposure est. ${fmtMoney(Math.max(0, Math.round(Number(p.estimated_exposure_cents))))}`
                  : ""}
                </li>
              ))}
            </ul>
          }
        </div>
        <div className="rounded-lg border border-border/70 px-3 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Storm-season financial notes</p>
          {storms.length === 0 ?
            <p className="text-sm text-muted-foreground">No storm-event rows yet.</p>
          : <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
              {storms.slice(0, 8).map((s) => (
                <li key={s.id} className="tabular-nums">
                  <span className="font-medium text-foreground">{s.event_name}</span> · {formatBlitzpayUiLabel(s.event_status)}
                  {s.event_region ? ` · ${s.event_region}` : ""}
                  {s.estimated_claim_exposure_cents != null ?
                    ` · claim exposure est. ${fmtMoney(Math.max(0, Math.round(Number(s.estimated_claim_exposure_cents))))}`
                  : ""}
                  {s.estimated_treasury_pressure != null ? ` · pressure ${Math.round(Number(s.estimated_treasury_pressure))}/100` : ""}
                </li>
              ))}
            </ul>
          }
        </div>
      </div>

      <div className="rounded-lg border border-border/70 px-3 py-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payout tracking (internal reference labels)</p>
        {payouts.length === 0 ?
          <p className="text-sm text-muted-foreground">No payout tracking rows yet.</p>
        : <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
            {payouts.slice(0, 10).map((p) => (
              <li key={p.id} className="tabular-nums min-w-0 break-words">
                {formatBlitzpayUiLabel(String(p.payout_type))} · {formatBlitzpayUiLabel(p.payout_status)} ·{" "}
                {fmtMoney(Math.max(0, Math.round(Number(p.payout_amount_cents))))}
                {p.payout_reference_probe ? ` · ref ${p.payout_reference_probe}` : p.payout_reference_recorded ? " · ref on file" : ""}
              </li>
            ))}
          </ul>
        }
        <p className="text-xs text-muted-foreground leading-relaxed">
          Reference labels are shortened internal fingerprints only — not bank transfers, card payouts, or external payment identifiers.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Staff APIs live under{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">/api/organizations/…/blitzpay/claims/*</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">…/protection-plans</code>, and{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">…/storm-events</code>.{" "}
        <Link href="/insights/financial-command-center/claims-protection" className="text-primary underline-offset-2 hover:underline">
          Financial command center
        </Link>{" "}
        includes the same summary tiles when you have financial access.
      </p>
    </div>
  )
}
