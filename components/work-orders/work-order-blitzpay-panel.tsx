"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CreditCard, Copy, ExternalLink, Link2, Mail, QrCode, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { paymentAllocationUiLabel } from "@/lib/billing/invoice-payment-allocation"
import type { WorkOrderBlitzpaySummary } from "@/lib/blitzpay/work-order-blitzpay-summary"
import { BlitzpayWorkOrderPayrollStrip } from "@/components/blitzpay/blitzpay-work-order-payroll-strip"

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type Props = {
  organizationId: string | null
  workOrderId: string | null
}

export function WorkOrderBlitzpayPanel({ organizationId, workOrderId }: Props) {
  const { permissions } = useOrgPermissions()
  const canAssist = permissions.canAssistBlitzpayCollection
  const canLoadBlitzpay = permissions.canViewFinancials || canAssist
  const canApplyWallet = permissions.canViewFinancials && permissions.canEditInvoices
  const canAttachPaymentPlan = permissions.canViewFinancials && permissions.canEditInvoices
  const canOpenInvoiceDeepLink = permissions.canViewFinancials
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<WorkOrderBlitzpaySummary | null>(null)
  const [fieldView, setFieldView] = useState(false)
  const [busyInv, setBusyInv] = useState<string | null>(null)
  const [walletInvoiceId, setWalletInvoiceId] = useState("")
  const [walletAmount, setWalletAmount] = useState("")
  const [walletBusy, setWalletBusy] = useState(false)
  const [planIdInput, setPlanIdInput] = useState("")
  const [planBusy, setPlanBusy] = useState(false)

  const load = useCallback(async () => {
    if (!organizationId || !workOrderId || !canLoadBlitzpay) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/work-orders/${encodeURIComponent(workOrderId)}/blitzpay/summary`,
        { credentials: "include" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        summary?: WorkOrderBlitzpaySummary
        fieldView?: boolean
        message?: string
      }
      if (!res.ok) {
        setSummary(null)
        setError(typeof data.message === "string" ? data.message : "Could not load BlitzPay summary.")
        return
      }
      setSummary(data.summary ?? null)
      setFieldView(Boolean(data.fieldView))
    } finally {
      setLoading(false)
    }
  }, [organizationId, workOrderId, canLoadBlitzpay])

  useEffect(() => {
    if (summary?.invoices?.length && !walletInvoiceId) {
      setWalletInvoiceId(summary.invoices[0]!.id)
    }
  }, [summary, walletInvoiceId])

  useEffect(() => {
    void load()
  }, [load])

  const primaryInvoice = summary?.invoices?.[0] ?? null

  const mailtoPayLink = useMemo(() => {
    return (url: string, invLabel: string) => {
      const subject = encodeURIComponent(`Payment link — ${invLabel}`)
      const body = encodeURIComponent(`You can pay securely here:\n\n${url}\n\nThank you.`)
      return `mailto:?subject=${subject}&body=${body}`
    }
  }, [])

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* ignore */
    }
  }

  async function createPayLink(invoiceId: string) {
    if (!organizationId || !workOrderId) return
    setBusyInv(invoiceId)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/work-orders/${encodeURIComponent(workOrderId)}/blitzpay/invoices/${encodeURIComponent(invoiceId)}/collect/payment-link`,
        { method: "POST", credentials: "include" },
      )
      const data = (await res.json().catch(() => ({}))) as { link?: { url: string }; message?: string }
      if (!res.ok || !data.link?.url) {
        setError(typeof data.message === "string" ? data.message : "Could not create payment link.")
        return
      }
      await copyText(data.link.url)
      void load()
    } finally {
      setBusyInv(null)
    }
  }

  async function emailPayLink(invoiceId: string, invLabel: string) {
    if (!organizationId || !workOrderId) return
    setBusyInv(invoiceId)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/work-orders/${encodeURIComponent(workOrderId)}/blitzpay/invoices/${encodeURIComponent(invoiceId)}/collect/payment-link`,
        { method: "POST", credentials: "include" },
      )
      const data = (await res.json().catch(() => ({}))) as { link?: { url: string }; message?: string }
      if (!res.ok || !data.link?.url) {
        setError(typeof data.message === "string" ? data.message : "Could not create payment link.")
        return
      }
      window.location.href = mailtoPayLink(data.link.url, invLabel)
      void load()
    } finally {
      setBusyInv(null)
    }
  }

  async function openCheckout(invoiceId: string) {
    if (!organizationId || !workOrderId) return
    setBusyInv(invoiceId)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/work-orders/${encodeURIComponent(workOrderId)}/blitzpay/invoices/${encodeURIComponent(invoiceId)}/collect/open-checkout`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentMethodType: "card" }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string }
      if (!res.ok || !data.url) {
        setError(typeof data.message === "string" ? data.message : "Could not start checkout.")
        return
      }
      window.open(data.url, "_blank", "noopener,noreferrer")
    } finally {
      setBusyInv(null)
    }
  }

  async function markInvoiceLater() {
    if (!organizationId || !workOrderId) return
    setBusyInv("_later")
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/work-orders/${encodeURIComponent(workOrderId)}/blitzpay/field-invoice-later`,
        { method: "POST", credentials: "include" },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string }
        setError(typeof data.message === "string" ? data.message : "Could not save preference.")
        return
      }
      void load()
    } finally {
      setBusyInv(null)
    }
  }

  async function applyWallet() {
    if (!organizationId || !summary?.customerId || !walletInvoiceId) return
    const dollars = Number(walletAmount)
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter a positive dollar amount to apply from wallet credit.")
      return
    }
    const amountCents = Math.round(dollars * 100)
    setWalletBusy(true)
    setError(null)
    try {
      const idem =
        typeof crypto !== "undefined" && crypto.randomUUID ?
          `wo-wallet:${workOrderId}:${walletInvoiceId}:${crypto.randomUUID()}`
        : `wo-wallet:${Date.now()}`
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/customers/${encodeURIComponent(summary.customerId)}/blitzpay/wallet/apply-invoice`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: walletInvoiceId, amountCents, idempotencyKey: idem }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        setError(typeof data.message === "string" ? data.message : "Could not apply wallet credit.")
        return
      }
      setWalletAmount("")
      void load()
    } finally {
      setWalletBusy(false)
    }
  }

  async function attachPlan() {
    if (!organizationId || !workOrderId || !planIdInput.trim()) return
    setPlanBusy(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/payment-plans/${encodeURIComponent(planIdInput.trim())}/link-work-order`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workOrderId }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        setError(typeof data.message === "string" ? data.message : "Could not link plan.")
        return
      }
      setPlanIdInput("")
      void load()
    } finally {
      setPlanBusy(false)
    }
  }

  if (!canLoadBlitzpay) {
    return (
      <p className="text-[11px] text-muted-foreground">
        BlitzPay on this work order is not available for your role.
      </p>
    )
  }

  if (!organizationId || !workOrderId) return null

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-[color:var(--primary)] shrink-0" aria-hidden />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">BlitzPay</p>
        {fieldView ? (
          <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">Field view</span>
        ) : null}
      </div>

      {loading ? <p className="text-muted-foreground">Loading payment summary…</p> : null}
      {error ? <p className="text-destructive text-[11px]">{error}</p> : null}

      <BlitzpayWorkOrderPayrollStrip organizationId={organizationId} workOrderId={workOrderId} />

      {summary?.fieldInvoiceLaterAt ? (
        <p className="rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
          Customer asked to receive the invoice by email later (
          {new Date(summary.fieldInvoiceLaterAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}).
        </p>
      ) : null}

      {summary?.wallet && (summary.wallet.spendableCreditCents > 0 || summary.wallet.refundableCreditCents > 0) ? (
        <div className="rounded-lg border border-border bg-muted/15 px-3 py-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Customer wallet</p>
          <p className="text-[11px] text-foreground">
            Spendable credit {fmtMoney(summary.wallet.spendableCreditCents)}
            {summary.wallet.refundableCreditCents > 0 ?
              ` · Refundable bucket ${fmtMoney(summary.wallet.refundableCreditCents)}`
            : null}
          </p>
          {canApplyWallet && summary.invoices.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2 pt-1">
              <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                Invoice
                <select
                  value={walletInvoiceId}
                  onChange={(e) => setWalletInvoiceId(e.target.value)}
                  className="h-8 rounded border border-border bg-background px-2 text-[11px]"
                >
                  {summary.invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} ({paymentAllocationUiLabel(inv.allocationState as "unpaid" | "partial" | "paid" | "overpaid")})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                Amount (USD)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                  className="h-8 w-24 rounded border border-border bg-background px-2 text-[11px]"
                />
              </label>
              <Button type="button" size="sm" className="h-8 text-xs" disabled={walletBusy} onClick={() => void applyWallet()}>
                Apply credit
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {summary?.vendorPayablesField &&
      (summary.vendorPayablesField.openCount > 0 ||
        (!fieldView && (summary.vendorPayablesStaff?.length ?? 0) > 0)) ? (
        <div className="rounded-lg border border-border px-3 py-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Vendor payables</p>
          <p className="text-[11px] text-muted-foreground">
            Open obligations {fmtMoney(summary.vendorPayablesField.openObligationCents)} · {summary.vendorPayablesField.openCount}{" "}
            line(s)
            {summary.vendorPayablesField.overdueCount > 0 ?
              ` · ${summary.vendorPayablesField.overdueCount} overdue`
            : ""}
            {summary.vendorPayablesField.hasReimbursementOpen ? " · includes reimbursement" : ""}
            {summary.vendorPayablesField.hasMaterialOpen ? " · includes material" : ""}
          </p>
          {!fieldView && summary.vendorPayablesStaff && summary.vendorPayablesStaff.length > 0 ? (
            <ul className="space-y-1 mt-1">
              {summary.vendorPayablesStaff.map((v) => (
                <li key={v.id} className="text-[11px] flex justify-between gap-2 border-t border-border/50 pt-1 first:border-0 first:pt-0">
                  <span className="truncate">
                    {v.counterpartyLabel}
                    <span className="text-muted-foreground block text-[9px]">
                      {v.vendorKind.replace(/_/g, " ")} · {v.status}
                      {v.reimbursementFlag ? " · reimb" : ""}
                      {v.materialCostFlag ? " · material" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {fmtMoney(v.amountCents)} · due {v.dueDate}
                  </span>
                </li>
              ))}
            </ul>
          ) : fieldView ? (
            <p className="text-[10px] text-muted-foreground">Office view shows payable detail; field view shows totals only.</p>
          ) : null}
        </div>
      ) : null}

      {summary?.quotes && summary.quotes.length > 0 ? (
        <div className="rounded-lg border border-border px-3 py-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Linked estimates</p>
          <ul className="space-y-1">
            {summary.quotes.map((q) => (
              <li key={q.id} className="text-[11px] flex justify-between gap-2">
                <span className="font-mono text-muted-foreground">{q.quoteNumber}</span>
                <span>
                  {fmtMoney(q.amountCents)}
                  {q.depositCollectedCents > 0 ? ` · deposit ${fmtMoney(q.depositCollectedCents)}` : ""}
                  {q.financingReady ? " · financing-ready" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary?.invoices && summary.invoices.length > 0 ? (
        <div className="rounded-lg border border-border px-3 py-2 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Invoices & collection</p>
          <ul className="space-y-2">
            {summary.invoices.map((inv) => (
              <li key={inv.id} className="border-b border-border/60 pb-2 last:border-0 last:pb-0">
                <div className="flex justify-between gap-2">
                  <span className="font-mono font-medium">{inv.invoiceNumber}</span>
                  <span className={cn(inv.balanceDueCents > 0 ? "text-[color:var(--status-warning)]" : "text-muted-foreground")}>
                    {fmtMoney(inv.balanceDueCents)} due
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {inv.statusLabel} · {paymentAllocationUiLabel(inv.allocationState as "unpaid" | "partial" | "paid" | "overpaid")}
                </p>
                {inv.balanceDueCents > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] gap-1"
                      disabled={busyInv === inv.id}
                      onClick={() => void createPayLink(inv.id)}
                    >
                      <Copy className="h-3 w-3" />
                      Copy pay link
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] gap-1"
                      disabled={busyInv === inv.id}
                      onClick={() => void openCheckout(inv.id)}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Pay now
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px] gap-1"
                      disabled={busyInv === inv.id}
                      onClick={() => void emailPayLink(inv.id, inv.invoiceNumber)}
                    >
                      <Mail className="h-3 w-3" />
                      Email link…
                    </Button>
                    {primaryInvoice?.id === inv.id ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] gap-1"
                        disabled={busyInv === "_later"}
                        onClick={() => void markInvoiceLater()}
                      >
                        Invoice email later
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1">
            <QrCode className="h-3 w-3 shrink-0" aria-hidden />
            Use “Copy pay link” and display as QR from any QR generator — link is customer-safe (no Stripe IDs shown here).
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">No invoices linked to this work order yet.</p>
      )}

      {summary?.paymentPlans && summary.paymentPlans.length > 0 ? (
        <div className="rounded-lg border border-border px-3 py-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Installment / staged plans</p>
          <ul className="space-y-1">
            {summary.paymentPlans.map((p) => (
              <li key={p.id} className="text-[11px] flex flex-col gap-0.5">
                <span>
                  {p.planKind.replace(/_/g, " ")} · {p.status}
                  {p.workOrderId ? " · linked to this job" : ""}
                </span>
                <span className="text-muted-foreground">
                  Progress {fmtMoney(p.paidInstallmentsCents)} / {fmtMoney(p.totalTargetCents)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary && summary.financingSessionCount > 0 ? (
        <p className="text-[10px] text-muted-foreground">
          Financing activity: {summary.financingSessionCount} session(s) tied to linked quotes/invoices (details in office tools).
        </p>
      ) : null}

      {summary?.recentPayments && summary.recentPayments.length > 0 ? (
        <div className="rounded-lg border border-border px-3 py-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recent payments</p>
          <ul className="space-y-1">
            {summary.recentPayments.map((p) => (
              <li key={p.id} className="text-[11px] flex justify-between gap-2">
                <span>
                  {p.invoiceNumber} · {p.methodLabel}
                </span>
                <span>{fmtMoney(p.amountCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary?.paymentLinks && summary.paymentLinks.length > 0 ? (
        <div className="rounded-lg border border-border px-3 py-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Payment links (activity)</p>
          <ul className="space-y-1">
            {summary.paymentLinks.map((l) => (
              <li key={l.id} className="text-[11px] flex justify-between gap-2 text-muted-foreground">
                <span>
                  {l.invoiceNumber} · {l.status} · used {l.useCount}×
                </span>
                <span className="shrink-0">{new Date(l.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canAttachPaymentPlan ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-2 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            Link existing plan to this job
          </p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Paste an active installment plan ID (from the invoice Payments tab). The plan’s invoice must already be linked to this work order.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={planIdInput}
              onChange={(e) => setPlanIdInput(e.target.value)}
              placeholder="Payment plan UUID"
              className="h-8 flex-1 min-w-[160px] rounded border border-border bg-background px-2 font-mono text-[10px]"
            />
            <Button type="button" size="sm" className="h-8 text-xs" disabled={planBusy} onClick={() => void attachPlan()}>
              Attach
            </Button>
          </div>
        </div>
      ) : null}

      {canOpenInvoiceDeepLink && primaryInvoice ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] gap-1" asChild>
            <a
              href={`/invoices?open=${encodeURIComponent(primaryInvoice.invoiceNumber)}`}
              target="_blank"
              rel="noreferrer"
            >
              <CreditCard className="h-3 w-3" />
              Open invoice (receipt / reminders)
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  )
}
