"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { formatBlitzpayUiLabel } from "@/lib/blitzpay/blitzpay-ui-labels"
import { cn } from "@/lib/utils"

type SettlementRow = {
  id: string
  org_vendor_id: string | null
  work_order_id: string | null
  org_invoice_id: string | null
  settlement_type: string
  amount_cents: number
  settlement_status: string
  scheduled_for: string | null
  paid_at: string | null
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayVendorPayoutsPanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<SettlementRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setRows([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/vendor-payouts?limit=60`,
        { cache: "no-store", credentials: "include" },
      )
      let j: { vendorSettlements?: SettlementRow[] }
      try {
        j = (await res.json()) as { vendorSettlements?: SettlementRow[] }
      } catch {
        setRows([])
        setError(blitzpayStaffWidgetLoadCopy.contractorSettlements)
        return
      }
      if (!res.ok) {
        setRows([])
        setError(blitzpayStaffWidgetLoadCopy.contractorSettlements)
        return
      }
      setRows(j.vendorSettlements ?? [])
    } catch {
      setRows([])
      setError(blitzpayStaffWidgetLoadCopy.contractorSettlements)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  if (!organizationId || !orgReady) return null

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-5 sm:px-6 sm:py-6 space-y-3",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Truck className="h-4 w-4 text-[color:var(--primary)] shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Contractor / partner settlements</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Phase 2Y WO-linked settlements (not Phase 2S vendor AP payout markers).
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>
      {error ? <p className="text-xs text-muted-foreground leading-relaxed">{error}</p> : null}
      {rows.length === 0 && !loading ? (
        <p className="text-[11px] text-muted-foreground">No settlement rows yet.</p>
      ) : (
        <ul className="space-y-2 max-h-56 overflow-y-auto pr-1 text-[11px]">
          {rows.map((r) => (
            <li key={r.id} className="rounded-md border border-border/70 px-2 py-1.5 flex justify-between gap-2">
              <span className="text-muted-foreground">
                {formatBlitzpayUiLabel(r.settlement_type)} · {formatBlitzpayUiLabel(r.settlement_status)}
                {r.work_order_id ? (
                  <>
                    {" "}
                    · WO <span className="font-mono">{r.work_order_id.slice(0, 8)}…</span>
                  </>
                ) : null}
              </span>
              <span className="shrink-0 tabular-nums text-foreground">{fmtMoney(r.amount_cents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
