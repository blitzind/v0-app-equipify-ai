"use client"

import { useCallback, useEffect, useState } from "react"
import { ClipboardList, Loader2, RefreshCw } from "lucide-react"
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
  orgReady: boolean
}

export function BlitzpayCommissionQueue({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<CommissionRow[]>([])
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
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/commissions?limit=60&status=pending`,
        { cache: "no-store", credentials: "include" },
      )
      const j = (await res.json()) as { commissions?: CommissionRow[]; message?: string }
      if (!res.ok) {
        setRows([])
        setError(typeof j.message === "string" ? j.message : "Could not load commissions.")
        return
      }
      setRows(j.commissions ?? [])
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
          <ClipboardList className="h-4 w-4 text-[color:var(--primary)] shrink-0" aria-hidden />
          <p className="text-sm font-semibold text-foreground">Commission approval queue (pending)</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading && rows.length === 0 ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {rows.length === 0 && !loading ? (
        <p className="text-[11px] text-muted-foreground">No pending commission rows in the bounded window.</p>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {rows.map((r) => (
            <li key={r.id} className="rounded-md border border-border/70 px-2 py-1.5 text-[11px] flex flex-col gap-0.5">
              <span className="text-muted-foreground">
                Invoice <span className="font-mono text-foreground">{r.org_invoice_id.slice(0, 8)}…</span>
                {r.work_order_id ? (
                  <>
                    {" "}
                    · WO <span className="font-mono">{r.work_order_id.slice(0, 8)}…</span>
                  </>
                ) : null}
              </span>
              <span className="text-foreground tabular-nums">
                Basis {fmtMoney(r.revenue_basis_cents)} · Commission {fmtMoney(r.commission_cents)} ·{" "}
                <span className="text-muted-foreground">{r.commission_status}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
