"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, PiggyBank } from "lucide-react"
import { useOrgPermissions } from "@/lib/org-permissions-context"

type CommissionRow = {
  id: string
  org_invoice_id: string
  revenue_basis_cents: number
  commission_cents: number
  commission_status: string
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type Props = {
  organizationId: string | null
  workOrderId: string | null
}

export function BlitzpayWorkOrderPayrollStrip({ organizationId, workOrderId }: Props) {
  const { permissions } = useOrgPermissions()
  const canView = permissions.canViewFinancialReports || permissions.canViewFinancials
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<CommissionRow[]>([])

  const load = useCallback(async () => {
    if (!organizationId || !workOrderId || !canView) {
      setRows([])
      return
    }
    setLoading(true)
    try {
      const q = new URLSearchParams({ workOrderId, limit: "24" })
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/commissions?${q.toString()}`,
        { credentials: "include" },
      )
      const j = (await res.json()) as { commissions?: CommissionRow[] }
      if (res.ok) setRows(j.commissions ?? [])
      else setRows([])
    } finally {
      setLoading(false)
    }
  }, [organizationId, workOrderId, canView])

  useEffect(() => {
    void load()
  }, [load])

  if (!canView || !organizationId || !workOrderId) return null

  if (rows.length === 0 && !loading) return null

  return (
    <div className="rounded-lg border border-border/80 bg-muted/10 px-3 py-2 space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <PiggyBank className="h-3 w-3" aria-hidden />
        Commission accruals (this job)
      </p>
      {loading ? (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading…
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.id} className="text-[10px] flex justify-between gap-2 text-muted-foreground">
              <span>
                Invoice {r.org_invoice_id.slice(0, 8)}… · {r.commission_status}
              </span>
              <span className="shrink-0 tabular-nums text-foreground">
                {fmtMoney(r.commission_cents)} on {fmtMoney(r.revenue_basis_cents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
