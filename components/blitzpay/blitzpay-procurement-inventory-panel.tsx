"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Package, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { formatBlitzpayUiLabel } from "@/lib/blitzpay/blitzpay-ui-labels"

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type Health = {
  generatedAt: string
  disclaimer: string
  reporting: {
    totalInventoryValueCents: number
    inventoryWriteoffExposure: number
    inventoryTurnoverScore: number
    reorderExposureCents: number
    rebateOpportunityCents: number
    serializedAssetExposure: number
    procurementTreasuryImpactScore: number
    inventoryMarginHealthScore: number
  }
  recentAudit: Array<{ id: string; audit_type: string; audit_summary: string; created_at: string }>
}

type MovementRow = {
  id: string
  movement_type: string
  movement_date: string
  total_cost_cents: number
  inventory_financial_item_id: string
}

type ForecastRow = {
  id: string
  inventory_financial_item_id: string
  projected_reorder_date: string | null
  projected_reorder_cost_cents: number | null
  forecast_confidence_score: number | null
  treasury_impact_score: number | null
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayProcurementInventoryPanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [forecasts, setForecasts] = useState<ForecastRow[]>([])

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setHealth(null)
      setMovements([])
      setForecasts([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const base = `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/procurement`
      const [hRes, mRes, fRes] = await Promise.all([
        fetch(`${base}/health`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/inventory-movements`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/reorder-forecasts`, { cache: "no-store", credentials: "include" }),
      ])
      const [hJson, mJson, fJson] = await Promise.all([
        hRes.json().catch(() => null) as Promise<{ procurementHealth?: Health } | null>,
        mRes.json().catch(() => null) as Promise<{ movements?: MovementRow[] } | null>,
        fRes.json().catch(() => null) as Promise<{ reorderForecasts?: ForecastRow[] } | null>,
      ])
      if (!hRes.ok || !mRes.ok || !fRes.ok) {
        setHealth(null)
        setMovements([])
        setForecasts([])
        setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
        return
      }
      setHealth(hJson?.procurementHealth ?? null)
      setMovements((mJson?.movements ?? []).slice(0, 24))
      setForecasts((fJson?.reorderForecasts ?? []).slice(0, 16))
    } catch {
      setHealth(null)
      setMovements([])
      setForecasts([])
      setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  if (!organizationId || !orgReady) return null

  const r = health?.reporting

  return (
    <div
      id="blitzpay-procurement-inventory-anchor"
      className="rounded-xl border border-border bg-card px-4 py-5 sm:px-6 sm:py-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Package className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">Procurement &amp; inventory finance</h3>
            <p className="text-sm text-muted-foreground leading-snug">
              Valuation, parts margin signals, and reorder planning — estimates only. Nothing here places supplier orders
              or moves money.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-amber-500/50 pl-3">
        {health?.disclaimer ??
          "Forecasting and valuation tools are operational estimates and may differ from finalized accounting or inventory counts."}
      </p>

      {error ? <p className="text-xs text-muted-foreground">{error}</p> : null}

      {r ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Inventory value (internal)</p>
            <p className="text-sm font-semibold tabular-nums mt-1">{fmtMoney(r.totalInventoryValueCents)}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Write-off exposure (signals)</p>
            <p className="text-sm font-semibold tabular-nums mt-1">{fmtMoney(r.inventoryWriteoffExposure)}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Turnover comfort</p>
            <p className="text-sm font-semibold tabular-nums mt-1">{r.inventoryTurnoverScore}/100</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Reorder cash call (30d est.)</p>
            <p className="text-sm font-semibold tabular-nums mt-1">{fmtMoney(r.reorderExposureCents)}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Rebate opportunity (annual est.)</p>
            <p className="text-sm font-semibold tabular-nums mt-1">{fmtMoney(r.rebateOpportunityCents)}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Serialized assets (on books est.)</p>
            <p className="text-sm font-semibold tabular-nums mt-1">{fmtMoney(r.serializedAssetExposure)}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Treasury vs reorder pressure</p>
            <p className="text-sm font-semibold tabular-nums mt-1">{r.procurementTreasuryImpactScore}/100</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Parts margin health (metadata)</p>
            <p className="text-sm font-semibold tabular-nums mt-1">{r.inventoryMarginHealthScore}/100</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border/70 px-3 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent inventory movements</p>
          {movements.length === 0 ? (
            <p className="text-xs text-muted-foreground">No movements recorded yet.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {movements.map((m) => (
                <li key={m.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {m.movement_date} · {formatBlitzpayUiLabel(m.movement_type)}
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-foreground">{fmtMoney(m.total_cost_cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border/70 px-3 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reorder summaries</p>
          {forecasts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Forecasts appear after items and usage history exist.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {forecasts.map((f) => (
                <li key={f.id} className="flex justify-between gap-2">
                  <span className="truncate">Item {f.inventory_financial_item_id.slice(0, 8)}…</span>
                  <span className="shrink-0 tabular-nums text-foreground">
                    {f.projected_reorder_date ?? "—"} · {fmtMoney(f.projected_reorder_cost_cents ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {health?.recentAudit?.length ? (
        <div className="rounded-lg border border-border/70 px-3 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Procurement audit (recent)</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {health.recentAudit.slice(0, 8).map((a) => (
              <li key={a.id} className="leading-relaxed">
                <span className="font-medium text-foreground">{formatBlitzpayUiLabel(a.audit_type)}</span> — {a.audit_summary}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
