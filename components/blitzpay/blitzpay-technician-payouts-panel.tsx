"use client"

import { useCallback, useEffect, useState } from "react"
import { Banknote, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CommissionRow = {
  id: string
  work_order_id: string | null
  org_invoice_id: string
  technician_user_id: string
  revenue_basis_cents: number
  commission_cents: number
  commission_status: string
  calculated_at: string
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type Props = {
  organizationId: string | null
  technicianUserId: string | null
  orgReady: boolean
}

export function BlitzpayTechnicianPayoutsPanel({ organizationId, technicianUserId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<CommissionRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId || !technicianUserId || !orgReady) {
      setRows([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({ technicianUserId, limit: "40" })
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/commissions?${q.toString()}`,
        { cache: "no-store", credentials: "include" },
      )
      const j = (await res.json()) as { commissions?: CommissionRow[]; message?: string }
      if (!res.ok) {
        setRows([])
        setError(typeof j.message === "string" ? j.message : "Could not load technician commissions.")
        return
      }
      setRows(j.commissions ?? [])
    } finally {
      setLoading(false)
    }
  }, [organizationId, technicianUserId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  if (!organizationId || !technicianUserId || !orgReady) return null

  let pending = 0
  let approved = 0
  let paid = 0
  for (const r of rows) {
    if (r.commission_status === "pending") pending += r.commission_cents
    if (r.commission_status === "approved") approved += r.commission_cents
    if (r.commission_status === "paid") paid += r.commission_cents
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/10 px-3 py-3 space-y-2",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Banknote className="h-3.5 w-3.5" aria-hidden />
          BlitzPay commission accruals (this technician)
        </p>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px]" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        </Button>
      </div>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <p className="text-muted-foreground">Pending</p>
          <p className="font-semibold tabular-nums text-foreground">{fmtMoney(pending)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Approved</p>
          <p className="font-semibold tabular-nums text-foreground">{fmtMoney(approved)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Paid</p>
          <p className="font-semibold tabular-nums text-foreground">{fmtMoney(paid)}</p>
        </div>
      </div>
      {rows.length === 0 && !loading ? (
        <p className="text-[10px] text-muted-foreground">No commission rows for this user in the bounded list.</p>
      ) : (
        <ul className="text-[10px] text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
          {rows.slice(0, 12).map((r) => (
            <li key={r.id} className="flex justify-between gap-2 border-t border-border/40 pt-1 first:border-0 first:pt-0">
              <span className="truncate">
                {r.commission_status} · inv {r.org_invoice_id.slice(0, 8)}…
              </span>
              <span className="shrink-0 tabular-nums">{fmtMoney(r.commission_cents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
