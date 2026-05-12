"use client"

import { useCallback, useEffect, useState } from "react"
import { Briefcase, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { formatBlitzpayUiLabel } from "@/lib/blitzpay/blitzpay-ui-labels"

type ApDashboard = {
  todayYmd: string
  buckets: {
    outstandingOpenCents: number
    overdueOpenCents: number
    dueWithin7DaysOpenCents: number
    dueWithin30DaysOpenCents: number
    dueWithin60DaysOpenCents: number
    pendingReimbursementOpenCents: number
    materialOpenCents: number
    workOrderLinkedOpenCents: number
  }
  apProjectedOutgoingCents7d: number
  vendorPayoutVelocityInternalCents7d: number
  vendorPayoutVelocityInternalCents30d: number
  pendingPayablePressureCents: number
  insights: Array<{ severity: "warning" | "info"; code: string; message: string }>
  payables: Array<{
    id: string
    vendorKind: string
    counterpartyLabel: string
    amountCents: number
    dueDate: string
    status: string
    scheduledPayoutDate: string | null
    reimbursementFlag: boolean
    materialCostFlag: boolean
  }>
  vendorExposure: Array<{
    label: string
    openCents: number
    overdueOpenCents: number
    openCount: number
  }>
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayApPanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [dashboard, setDashboard] = useState<ApDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    counterpartyLabel: "",
    amount: "",
    dueDate: "",
    vendorKind: "vendor",
    reimbursement: false,
    material: false,
  })

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setDashboard(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/ap-dashboard`,
        { cache: "no-store", credentials: "include" },
      )
      let j: { dashboard?: ApDashboard }
      try {
        j = (await res.json()) as { dashboard?: ApDashboard }
      } catch {
        setDashboard(null)
        setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
        return
      }
      if (!res.ok) {
        setDashboard(null)
        setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
        return
      }
      setDashboard(j.dashboard ?? null)
    } catch {
      setDashboard(null)
      setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  async function submitPayable() {
    if (!organizationId) return
    const cents = Math.round(Number(form.amount) * 100)
    if (!form.counterpartyLabel.trim() || !Number.isFinite(cents) || cents < 0 || !form.dueDate.trim()) {
      setError("Enter counterparty, positive amount, and due date.")
      return
    }
    setCreating(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/vendor-payables`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendorKind: form.vendorKind,
            counterpartyLabel: form.counterpartyLabel.trim(),
            amountCents: cents,
            dueDate: form.dueDate.trim(),
            reimbursementFlag: form.reimbursement,
            materialCostFlag: form.material,
          }),
        },
      )
      await res.json().catch(() => null)
      if (!res.ok) {
        setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
        return
      }
      setForm((f) => ({ ...f, counterpartyLabel: "", amount: "", dueDate: "" }))
      await load()
    } catch {
      setError(blitzpayStaffWidgetLoadCopy.actionUnavailable)
    } finally {
      setCreating(false)
    }
  }

  if (!organizationId || !orgReady) return null

  return (
    <div id="blitzpay-ap-anchor" className="rounded-lg border border-border bg-muted/10 px-3 py-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-[color:var(--primary)] shrink-0" aria-hidden />
          <p className="text-xs font-semibold">BlitzPay vendor payables (internal AP)</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          Refresh
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Scheduling and approvals only — no outbound ACH from Equipify. Combined with Stripe treasury signals for cash
        planning. Customer portal never calls these APIs.
      </p>
      {error ? (
        <p
          className={
            error === "Enter counterparty, positive amount, and due date."
              ? "text-[11px] text-destructive"
              : "text-xs text-muted-foreground leading-relaxed"
          }
        >
          {error}
        </p>
      ) : null}
      {loading && !dashboard ? (
        <p className="text-[11px] text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </p>
      ) : null}
      {dashboard ? (
        <>
          <p className="text-[10px] text-muted-foreground">As-of {dashboard.todayYmd} (UTC)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded border border-border/80 bg-background/40 px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground uppercase">Open obligations</p>
              <p className="text-sm font-semibold tabular-nums">{fmtMoney(dashboard.buckets.outstandingOpenCents)}</p>
            </div>
            <div className="rounded border border-border/80 bg-background/40 px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground uppercase">Overdue (open)</p>
              <p className="text-sm font-semibold tabular-nums">{fmtMoney(dashboard.buckets.overdueOpenCents)}</p>
            </div>
            <div className="rounded border border-border/80 bg-background/40 px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground uppercase">Due ≤7d</p>
              <p className="text-sm font-semibold tabular-nums">{fmtMoney(dashboard.buckets.dueWithin7DaysOpenCents)}</p>
            </div>
            <div className="rounded border border-border/80 bg-background/40 px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground uppercase">Due ≤30d</p>
              <p className="text-sm font-semibold tabular-nums">{fmtMoney(dashboard.buckets.dueWithin30DaysOpenCents)}</p>
            </div>
            <div className="rounded border border-border/80 bg-background/40 px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground uppercase">Due ≤60d</p>
              <p className="text-sm font-semibold tabular-nums">{fmtMoney(dashboard.buckets.dueWithin60DaysOpenCents)}</p>
            </div>
            <div className="rounded border border-border/80 bg-background/40 px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground uppercase">Projected out (7d)</p>
              <p className="text-sm font-semibold tabular-nums">{fmtMoney(dashboard.apProjectedOutgoingCents7d)}</p>
            </div>
            <div className="rounded border border-border/80 bg-background/40 px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground uppercase">Vendor paid (int. 7d)</p>
              <p className="text-sm font-semibold tabular-nums">{fmtMoney(dashboard.vendorPayoutVelocityInternalCents7d)}</p>
            </div>
            <div className="rounded border border-border/80 bg-background/40 px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground uppercase">WO-linked open</p>
              <p className="text-sm font-semibold tabular-nums">{fmtMoney(dashboard.buckets.workOrderLinkedOpenCents)}</p>
            </div>
          </div>
          {dashboard.insights.length > 0 ? (
            <ul className="space-y-1 text-[11px]">
              {dashboard.insights.map((i) => (
                <li
                  key={i.code}
                  className={
                    i.severity === "warning" ? "text-[color:var(--status-warning)]" : "text-muted-foreground"
                  }
                >
                  {i.message}
                </li>
              ))}
            </ul>
          ) : null}
          {dashboard.vendorExposure.length > 0 ? (
            <details className="text-[11px]">
              <summary className="cursor-pointer text-muted-foreground">Top vendor exposure</summary>
              <ul className="mt-1 space-y-0.5 pl-3">
                {dashboard.vendorExposure.slice(0, 8).map((v) => (
                  <li key={v.label} className="flex justify-between gap-2">
                    <span className="truncate">{v.label}</span>
                    <span className="shrink-0 tabular-nums">
                      {fmtMoney(v.openCents)}
                      {v.overdueOpenCents > 0 ? ` · overdue ${fmtMoney(v.overdueOpenCents)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <div className="rounded border border-dashed border-border px-2 py-2 space-y-2">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Quick add (draft)</p>
            <div className="flex flex-wrap gap-2 items-end">
              <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground min-w-[120px]">
                Counterparty
                <input
                  className="h-8 rounded border border-border bg-background px-2 text-[11px]"
                  value={form.counterpartyLabel}
                  onChange={(e) => setForm((f) => ({ ...f, counterpartyLabel: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground w-24">
                Amount USD
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="h-8 rounded border border-border bg-background px-2 text-[11px]"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground w-36">
                Due date
                <input
                  type="date"
                  className="h-8 rounded border border-border bg-background px-2 text-[11px]"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                Kind
                <select
                  className="h-8 rounded border border-border bg-background px-2 text-[11px] min-w-[140px]"
                  value={form.vendorKind}
                  onChange={(e) => setForm((f) => ({ ...f, vendorKind: e.target.value }))}
                >
                  <option value="vendor">Vendor</option>
                  <option value="subcontractor">Subcontractor</option>
                  <option value="field_reimbursement">Field reimbursement</option>
                  <option value="equipment_supplier">Equipment supplier</option>
                  <option value="material_supplier">Material supplier</option>
                </select>
              </label>
              <label className="flex items-center gap-1 text-[10px] text-muted-foreground pt-4">
                <input
                  type="checkbox"
                  checked={form.reimbursement}
                  onChange={(e) => setForm((f) => ({ ...f, reimbursement: e.target.checked }))}
                />
                Reimbursement
              </label>
              <label className="flex items-center gap-1 text-[10px] text-muted-foreground pt-4">
                <input
                  type="checkbox"
                  checked={form.material}
                  onChange={(e) => setForm((f) => ({ ...f, material: e.target.checked }))}
                />
                Material
              </label>
              <Button type="button" size="sm" className="h-8 text-xs" disabled={creating} onClick={() => void submitPayable()}>
                {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save draft"}
              </Button>
            </div>
          </div>
          <div className="max-h-56 overflow-auto rounded border border-border/80">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border/60">
                  <th className="p-1.5">Vendor</th>
                  <th className="p-1.5">Due</th>
                  <th className="p-1.5">Status</th>
                  <th className="p-1.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.payables.slice(0, 40).map((p) => (
                  <tr key={p.id} className="border-b border-border/40">
                    <td className="p-1.5">
                      <span className="font-medium">{p.counterpartyLabel}</span>
                      <span className="text-muted-foreground block text-[9px]">
                        {formatBlitzpayUiLabel(p.vendorKind)}
                        {p.reimbursementFlag ? " · reimb" : ""}
                        {p.materialCostFlag ? " · material" : ""}
                      </span>
                    </td>
                    <td className="p-1.5 tabular-nums">{p.dueDate}</td>
                    <td className="p-1.5">{formatBlitzpayUiLabel(p.status)}</td>
                    <td className="p-1.5 text-right tabular-nums">{fmtMoney(p.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
