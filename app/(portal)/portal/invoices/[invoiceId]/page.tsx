"use client"

import Link from "next/link"
import { Suspense, use, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, Clock, Download, ExternalLink, Loader2, Lock, Receipt, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ServiceLifecycleTimeline } from "@/components/lifecycle/service-lifecycle-timeline"
import type { ServiceTimelineEvent } from "@/lib/lifecycle/service-timeline"
import { invoiceTermsCodeLabel } from "@/lib/billing/invoice-terms"
import { BLITZPAY_FUTURE_PAYMENT_AUTHORIZATION_COPY } from "@/lib/blitzpay/blitzpay-consent-copy"

function fmtDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function parseUsdToCents(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t.replace(/[^0-9.]/g, ""))
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

type CertItem = {
  id: string
  templateName: string
  unlocked: boolean
  reasonLabel: string
  reasonCode?: string
  downloadPath: string | null
}

type WoRow = {
  id: string
  display: string
  title: string
  statusLabel: string
  typeLabel: string
  scheduledOn: string | null
  completedAt: string | null
  equipmentName: string
  technicianName: string | null
}

type PortalInvoiceLine = {
  description: string
  qty: number
  unitCents: number
  lineTotalCents: number
  sku: string | null
  itemType: string | null
}

type PortalBlitzpayHostedCheckoutPayload = {
  hostedCheckoutAvailable: boolean
  unavailableReason: "feature_disabled" | "org_disabled" | "connect_not_ready" | null
}

type BlitzpayPricingPreview = {
  invoiceBalanceCents: number
  paymentTowardInvoiceCents?: number
  remainingBalanceAfterPaymentCents?: number
  convenienceFeeCents: number
  totalChargeCents: number
  appliesToCustomer: boolean
  disclosureCopy: string
  savePaymentMethodEligible?: boolean
  availablePaymentMethods?: Array<{
    type: "card" | "us_bank_account"
    label: string
    convenienceFeeCents: number
    totalChargeCents: number
    disclosureCopy: string
    timelineCopy: string | null
  }>
  phase2k?: {
    partialPayments: { effective: boolean; minCents: number }
    scheduledPaymentsEnabled: boolean
    savedPaymentProfile: boolean
    autopayAuthorization: { status: string; methodType: string | null; consentAt: string | null; revokedAt: string | null }
    scheduled: Array<{ id: string; scheduledFor: string; invoicePortionCents: number; status: string; createdByKind: string }>
    blitzpayPartialPaymentHistory: Array<{ paidOn: string; amountCents: number; referenceDisplay: string | null }>
  } | null
}

type PortalPaymentHistoryItem = {
  paidOn: string
  amountCents: number
  methodLabel: string
  referenceDisplay: string | null
  statusLabel: string
}

type DetailPayload = {
  workspaceDisplayName?: string
  customerDisplayName?: string
  paymentHistory?: PortalPaymentHistoryItem[]
  blitzpayHostedCheckout?: PortalBlitzpayHostedCheckoutPayload
  invoice: {
    id: string
    invoiceNumber: string
    title: string
    amountCents: number
    subtotalCents?: number
    taxCents?: number | null
    taxLabel?: string | null
    grandTotalCents?: number
    totalDueCents?: number
    totalPaidCents?: number
    balanceDueCents?: number
    paymentStatusLabel?: string
    statusLabel: string
    status: string
    issuedAt: string
    paidAt: string | null
    dueDate: string | null
    equipmentId: string | null
    equipmentName: string | null
    portalCertificateReleaseOverride: string | null
    termsCode: string | null
    termsCustomDays: number | null
    lineItems?: PortalInvoiceLine[]
    billingName?: string | null
    billingEmail?: string | null
    billingPhone?: string | null
    billingAddressFormatted?: string | null
  }
  workOrders: WoRow[]
  certificates: CertItem[]
  timeline: ServiceTimelineEvent[]
}

function blitzpayUnavailableCopy(reason: PortalBlitzpayHostedCheckoutPayload["unavailableReason"]): string {
  if (reason === "feature_disabled") {
    return "Online card payment is not enabled for this deployment."
  }
  if (reason === "org_disabled") {
    return "Your service provider has not turned on BlitzPay online payments for invoices."
  }
  if (reason === "connect_not_ready") {
    return "Your service provider’s BlitzPay account is not ready to accept charges yet. Try again later or use another payment method."
  }
  return "Online payment is not available right now."
}

function PortalInvoiceDetailPageInner({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<DetailPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checkoutReturn, setCheckoutReturn] = useState<"success" | "cancel" | null>(null)
  const [confirmPollExhausted, setConfirmPollExhausted] = useState(false)
  const [prepareError, setPrepareError] = useState<string | null>(null)
  const [blitzpayBusy, setBlitzpayBusy] = useState(false)
  const [pricing, setPricing] = useState<BlitzpayPricingPreview | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"card" | "us_bank_account">("card")
  const [portalPayPortionDollars, setPortalPayPortionDollars] = useState("")
  const [blitzpayAuthAck, setBlitzpayAuthAck] = useState(false)
  const [scheduleForLocal, setScheduleForLocal] = useState("")
  const [schedulePortionDollars, setSchedulePortionDollars] = useState("")
  const [scheduleConsentAck, setScheduleConsentAck] = useState(false)
  const [scheduleBusy, setScheduleBusy] = useState(false)
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null)

  const partialEffective = Boolean(pricing?.phase2k?.partialPayments.effective)
  const portalPortionCentsQuery = useMemo(() => {
    if (!partialEffective) return ""
    const c = parseUsdToCents(portalPayPortionDollars)
    if (c == null || c < 50) return ""
    return `?invoicePortionCents=${encodeURIComponent(String(c))}`
  }, [partialEffective, portalPayPortionDollars])

  useEffect(() => {
    const b = searchParams.get("blitzpay")
    const st = searchParams.get("status")
    if (b !== "1" || (st !== "success" && st !== "cancel")) return
    if (st === "success") {
      setCheckoutReturn("success")
      setConfirmPollExhausted(false)
    } else {
      setCheckoutReturn("cancel")
    }
    router.replace(`/portal/invoices/${invoiceId}`, { scroll: false })
  }, [searchParams, router, invoiceId])

  useEffect(() => {
    if (checkoutReturn !== "success" || !invoiceId) return
    let cancelled = false
    let ticks = 0
    const id = window.setInterval(() => {
      void (async () => {
        if (cancelled) return
        ticks += 1
        try {
          const r = await fetch(`/api/portal/invoices/${encodeURIComponent(invoiceId)}`, { credentials: "include" })
          if (!r.ok || cancelled) return
          const j = (await r.json()) as DetailPayload
          setData(j)
          const bal = j.invoice.balanceDueCents ?? 0
          const paidSt = String(j.invoice.status || "").toLowerCase() === "paid"
          if (paidSt || bal <= 0) {
            window.clearInterval(id)
            setConfirmPollExhausted(false)
            return
          }
          if (ticks >= 18) {
            window.clearInterval(id)
            if (!cancelled) setConfirmPollExhausted(true)
          }
        } catch {
          /* ignore transient errors while polling */
        }
      })()
    }, 2500)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [checkoutReturn, invoiceId])

  useEffect(() => {
    fetch(`/api/portal/invoices/${invoiceId}`)
      .then(async (r) => {
        if (r.status === 404) throw new Error("not_found")
        if (!r.ok) throw new Error("load_failed")
        return r.json() as Promise<DetailPayload>
      })
      .then(setData)
      .catch((e) =>
        setError(e instanceof Error && e.message === "not_found" ? "Invoice not found." : "This invoice could not be loaded."),
      )
  }, [invoiceId])

  useEffect(() => {
    let cancelled = false
    const url = `/api/portal/invoices/${encodeURIComponent(invoiceId)}/blitzpay/prepare-pay${portalPortionCentsQuery}`
    void fetch(url, { method: "GET", credentials: "include", cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json()) as { pricing?: BlitzpayPricingPreview }
        if (!r.ok || !j.pricing) return null
        return j.pricing
      })
      .then((p) => {
        if (cancelled || !p) return
        setPricing(p)
        const first = p.availablePaymentMethods?.[0]?.type
        if (first === "card" || first === "us_bank_account") setSelectedPaymentMethod(first)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [invoiceId, portalPortionCentsQuery])

  if (error) {
    return (
      <div className="portal-card py-20 text-center">
        <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>
          {error}
        </p>
        <Link href="/portal/invoices" className="text-sm mt-2 inline-flex items-center gap-1" style={{ color: "var(--portal-accent)" }}>
          <ChevronLeft size={14} /> Back to invoices
        </Link>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="portal-card py-20 text-center text-sm" style={{ color: "var(--portal-nav-text)" }}>
        Loading invoice…
      </div>
    )
  }

  const inv = data.invoice
  const overdue = inv.status === "overdue"
  const totalDue = inv.totalDueCents ?? inv.grandTotalCents ?? inv.amountCents
  const totalPaid = inv.totalPaidCents ?? 0
  const balanceDue = inv.balanceDueCents ?? (inv.status === "paid" ? 0 : totalDue)
  const paymentLabel = inv.paymentStatusLabel ?? inv.statusLabel
  const lineItems = inv.lineItems ?? []
  const subtotalCents = inv.subtotalCents ?? inv.amountCents
  const taxCents = inv.taxCents
  const showTax = taxCents != null && taxCents > 0

  const blitzpay = data.blitzpayHostedCheckout
  const stRaw = String(inv.status || "").toLowerCase()
  const fullyPaid = balanceDue <= 0 || stRaw === "paid"
  const blockedStatus = stRaw === "draft" || stRaw === "void"
  const meetsCardMinimum = balanceDue >= 50
  const workspaceReady = blitzpay?.hostedCheckoutAvailable === true
  const activeMethodPricing = pricing?.availablePaymentMethods?.find((m) => m.type === selectedPaymentMethod)
  const payTowardCents = pricing?.paymentTowardInvoiceCents ?? pricing?.invoiceBalanceCents
  const remainingAfterPay = pricing?.remainingBalanceAfterPaymentCents
  const saveEligible = pricing?.savePaymentMethodEligible !== false
  const consentRequiredForPay = saveEligible && !blitzpayAuthAck
  const canSchedule =
    Boolean(pricing?.phase2k?.scheduledPaymentsEnabled) &&
    Boolean(pricing?.phase2k?.savedPaymentProfile) &&
    pricing?.phase2k?.autopayAuthorization?.status === "active"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/portal/invoices" className="flex items-center gap-1 font-medium" style={{ color: "var(--portal-accent)" }}>
          <ChevronLeft size={14} /> Invoices
        </Link>
        <span style={{ color: "var(--portal-nav-icon)" }}>/</span>
        <span style={{ color: "var(--portal-nav-text)" }} className="font-mono text-xs">
          {inv.invoiceNumber}
        </span>
      </div>

      <div className="portal-card overflow-hidden">
        <div className="p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0" style={{ background: "var(--portal-accent-muted)" }}>
              <Receipt size={20} style={{ color: "var(--portal-accent)" }} />
            </span>
            <div>
              <p className="text-xs font-mono font-medium" style={{ color: "var(--portal-nav-text)" }}>
                {inv.invoiceNumber}
              </p>
              <h1 className="text-xl font-semibold mt-0.5" style={{ color: "var(--portal-foreground)" }}>
                {inv.title}
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--portal-nav-text)" }}>
                Issued {fmtDate(inv.issuedAt)}
                {inv.dueDate ? ` · Due ${fmtDate(inv.dueDate)}` : ""}
                {inv.paidAt ? ` · Paid ${fmtDate(inv.paidAt)}` : ""}
                {inv.termsCode ? ` · ${invoiceTermsCodeLabel(inv.termsCode)}` : ""}
              </p>
              {inv.equipmentName ? (
                <p className="text-xs mt-1" style={{ color: "var(--portal-secondary)" }}>
                  Equipment: {inv.equipmentName}
                </p>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>
              {fmtCurrency(totalDue)}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
              Invoice total
            </p>
            <div className="flex flex-col items-end gap-1 mt-2">
              <span
                className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  background:
                    inv.statusLabel === "Paid" ? "var(--portal-success-muted)"
                    : overdue ? "var(--portal-danger-muted)"
                    : "var(--portal-warning-muted)",
                  color:
                    inv.statusLabel === "Paid" ? "var(--portal-success)"
                    : overdue ? "var(--portal-danger)"
                    : "var(--portal-warning)",
                }}
              >
                {inv.statusLabel}
              </span>
              <span
                className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium"
                style={{
                  background: "var(--portal-accent-muted)",
                  color: "var(--portal-accent)",
                }}
              >
                Payment: {paymentLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="portal-card p-5 space-y-5">
        <div>
          <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--portal-foreground)" }}>
            Bill to
          </h2>
          {inv.billingName?.trim() || inv.billingAddressFormatted?.trim() || inv.billingEmail?.trim() || inv.billingPhone?.trim() ? (
            <div className="text-sm space-y-1" style={{ color: "var(--portal-nav-text)" }}>
              {inv.billingName?.trim() ? <p style={{ color: "var(--portal-foreground)" }}>{inv.billingName.trim()}</p> : null}
              {inv.billingAddressFormatted?.trim() ? <p className="whitespace-pre-line">{inv.billingAddressFormatted.trim()}</p> : null}
              {inv.billingEmail?.trim() ? <p>{inv.billingEmail.trim()}</p> : null}
              {inv.billingPhone?.trim() ? <p>{inv.billingPhone.trim()}</p> : null}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--portal-nav-text)" }}>
              Billing details are taken from your account profile on file with your service provider.
            </p>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--portal-foreground)" }}>
            Line items
          </h2>
          {lineItems.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--portal-nav-text)" }}>
              This invoice does not list individual lines — totals below reflect the invoice on file.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--portal-border-light)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: "var(--portal-nav-text)", background: "var(--portal-accent-muted)" }}>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium text-right w-16">Qty</th>
                    <th className="px-3 py-2 font-medium text-right w-28">Rate</th>
                    <th className="px-3 py-2 font-medium text-right w-28">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((row, idx) => (
                    <tr key={`${row.description}-${idx}`} className="border-t" style={{ borderColor: "var(--portal-border-light)" }}>
                      <td className="px-3 py-2 align-top" style={{ color: "var(--portal-foreground)" }}>
                        <span className="font-medium">{row.description}</span>
                        {row.itemType ? (
                          <span className="block text-[11px] mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                            {row.itemType}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--portal-nav-text)" }}>
                        {row.qty}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--portal-nav-text)" }}>
                        {fmtCurrency(row.unitCents)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: "var(--portal-foreground)" }}>
                        {fmtCurrency(row.lineTotalCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="pt-1 border-t space-y-2" style={{ borderColor: "var(--portal-border-light)" }}>
          <div className="flex justify-between text-sm" style={{ color: "var(--portal-nav-text)" }}>
            <span>Subtotal</span>
            <span className="tabular-nums font-medium" style={{ color: "var(--portal-foreground)" }}>
              {fmtCurrency(subtotalCents)}
            </span>
          </div>
          {showTax ? (
            <div className="flex justify-between text-sm" style={{ color: "var(--portal-nav-text)" }}>
              <span>{inv.taxLabel?.trim() || "Tax"}</span>
              <span className="tabular-nums font-medium" style={{ color: "var(--portal-foreground)" }}>
                {fmtCurrency(taxCents ?? 0)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-semibold pt-1 border-t" style={{ color: "var(--portal-foreground)", borderColor: "var(--portal-border-light)" }}>
            <span>Invoice total</span>
            <span className="tabular-nums">{fmtCurrency(totalDue)}</span>
          </div>
        </div>
      </div>

      <div className="portal-card p-5">
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--portal-foreground)" }}>
          Payment status
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wide font-medium" style={{ color: "var(--portal-nav-text)" }}>
              Invoice total
            </p>
            <p className="text-lg font-semibold tabular-nums mt-0.5" style={{ color: "var(--portal-foreground)" }}>
              {fmtCurrency(totalDue)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide font-medium" style={{ color: "var(--portal-nav-text)" }}>
              Paid toward invoice
            </p>
            <p className="text-lg font-semibold tabular-nums mt-0.5" style={{ color: "var(--portal-success)" }}>
              {fmtCurrency(totalPaid)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide font-medium" style={{ color: "var(--portal-nav-text)" }}>
              Balance due
            </p>
            <p className="text-lg font-semibold tabular-nums mt-0.5" style={{ color: "var(--portal-foreground)" }}>
              {fmtCurrency(balanceDue)}
            </p>
          </div>
        </div>
        {paymentLabel === "Overpaid" ? (
          <p className="text-xs mt-3" style={{ color: "var(--portal-nav-text)" }}>
            Payments on file exceed this invoice total. Contact your service provider if you have questions.
          </p>
        ) : null}
      </div>

      {checkoutReturn ? (
        <div className="portal-card p-5 space-y-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
            Payment update
          </h2>
          {checkoutReturn === "cancel" ? (
            <p className="text-sm leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
              Checkout was canceled before completing payment. You can use{" "}
              <span className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                Pay with BlitzPay
              </span>{" "}
              below when you are ready to try again.
            </p>
          ) : fullyPaid || String(inv.status || "").toLowerCase() === "paid" ? (
            <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--portal-success)" }}>
              Payment received — thank you. This invoice is paid in full on your account.
            </p>
          ) : (
            <>
              <p className="text-sm leading-relaxed" style={{ color: "var(--portal-foreground)" }}>
                Payment submitted. Your bank or card issuer may show a charge right away, but this page only reflects
                payment after your service provider&apos;s system confirms it from Stripe — usually within about a minute.
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
                Until your balance due shows{" "}
                <span className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                  $0.00
                </span>
                , your payment
                is still being confirmed — that does not mean your card was charged twice.
              </p>
              {confirmPollExhausted ? (
                <p className="text-xs leading-relaxed mt-1" style={{ color: "var(--portal-nav-text)" }}>
                  We&apos;re still waiting on the final confirmation. Refresh this page in a few minutes, or contact your
                  service provider if the balance does not update.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <div className="portal-card p-5">
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--portal-foreground)" }}>
          Payment history
        </h2>
        {(data.paymentHistory ?? []).length === 0 ? (
          <p className="text-sm leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
            No payments are posted to this invoice yet. When you pay online or your provider records a payment, it will
            appear here.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--portal-border-light)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-[11px] uppercase tracking-wide"
                  style={{ color: "var(--portal-nav-text)", background: "var(--portal-accent-muted)" }}
                >
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Method</th>
                  <th className="px-3 py-2 font-medium">Reference</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(data.paymentHistory ?? []).map((row, idx) => (
                  <tr key={`${row.paidOn}-${idx}`} className="border-t" style={{ borderColor: "var(--portal-border-light)" }}>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--portal-foreground)" }}>
                      {fmtDate(row.paidOn)}
                    </td>
                    <td className="px-3 py-2 tabular-nums font-medium" style={{ color: "var(--portal-foreground)" }}>
                      {fmtCurrency(row.amountCents)}
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--portal-nav-text)" }}>
                      {row.methodLabel}
                    </td>
                    <td className="px-3 py-2 max-w-[200px]" style={{ color: "var(--portal-nav-text)" }}>
                      {row.referenceDisplay ?? "—"}
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--portal-success)" }}>
                      {row.statusLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {blitzpay ? (
        <div className="portal-card p-5 space-y-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
            Pay online (BlitzPay)
          </h2>
          {prepareError ? <p className="text-sm text-destructive">{prepareError}</p> : null}
          <p className="text-xs leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
            Secure Stripe-hosted payment on your service provider&apos;s connected account. Card and ACH availability is
            controlled by your service provider. Final confirmation may take a moment after you return from Stripe.
          </p>
          {pricing ? (
            <div className="rounded-md border px-3 py-2 text-xs space-y-1" style={{ borderColor: "var(--portal-border-light)" }}>
              {pricing.availablePaymentMethods && pricing.availablePaymentMethods.length > 0 ? (
                <div className="space-y-1 pb-1">
                  <p style={{ color: "var(--portal-nav-text)" }}>Choose payment method</p>
                  <div className="flex flex-wrap gap-2">
                    {pricing.availablePaymentMethods.map((m) => (
                      <button
                        key={m.type}
                        type="button"
                        className="rounded border px-2 py-1 text-[11px]"
                        style={{
                          borderColor: selectedPaymentMethod === m.type ? "var(--portal-accent)" : "var(--portal-border-light)",
                          color: selectedPaymentMethod === m.type ? "var(--portal-accent)" : "var(--portal-foreground)",
                        }}
                        onClick={() => setSelectedPaymentMethod(m.type)}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {partialEffective ? (
                <label className="block space-y-0.5 pb-1">
                  <span style={{ color: "var(--portal-nav-text)" }}>Pay toward invoice (optional)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={`Full balance (${fmtCurrency(pricing.invoiceBalanceCents)})`}
                    value={portalPayPortionDollars}
                    onChange={(e) => setPortalPayPortionDollars(e.target.value)}
                    className="w-full rounded border px-2 py-1 text-[12px] bg-transparent"
                    style={{ borderColor: "var(--portal-border-light)", color: "var(--portal-foreground)" }}
                  />
                  <span className="text-[10px]" style={{ color: "var(--portal-nav-text)" }}>
                    Minimum {fmtCurrency(pricing.phase2k?.partialPayments.minCents ?? 50)} when paying less than the full
                    balance.
                  </span>
                </label>
              ) : null}
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--portal-nav-text)" }}>Invoice balance</span>
                <span style={{ color: "var(--portal-foreground)" }}>{fmtCurrency(pricing.invoiceBalanceCents)}</span>
              </div>
              {payTowardCents != null && payTowardCents !== pricing.invoiceBalanceCents ? (
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--portal-nav-text)" }}>This payment toward invoice</span>
                  <span style={{ color: "var(--portal-foreground)" }}>{fmtCurrency(payTowardCents)}</span>
                </div>
              ) : null}
              {remainingAfterPay != null && payTowardCents != null && payTowardCents < pricing.invoiceBalanceCents ? (
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--portal-nav-text)" }}>Estimated remaining balance</span>
                  <span style={{ color: "var(--portal-foreground)" }}>{fmtCurrency(remainingAfterPay)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--portal-nav-text)" }}>Processing fee</span>
                <span style={{ color: "var(--portal-foreground)" }}>
                  {fmtCurrency(activeMethodPricing?.convenienceFeeCents ?? pricing.convenienceFeeCents)}
                </span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span style={{ color: "var(--portal-foreground)" }}>Total charged</span>
                <span style={{ color: "var(--portal-foreground)" }}>
                  {fmtCurrency(activeMethodPricing?.totalChargeCents ?? pricing.totalChargeCents)}
                </span>
              </div>
              {(activeMethodPricing?.convenienceFeeCents ?? pricing.convenienceFeeCents) > 0 ? (
                <p style={{ color: "var(--portal-nav-text)" }}>{activeMethodPricing?.disclosureCopy ?? pricing.disclosureCopy}</p>
              ) : (
                <p style={{ color: "var(--portal-nav-text)" }}>Your service provider is absorbing processing costs for this payment.</p>
              )}
              {selectedPaymentMethod === "us_bank_account" ? (
                <p style={{ color: "var(--portal-nav-text)" }}>
                  {pricing.availablePaymentMethods?.find((m) => m.type === "us_bank_account")?.timelineCopy ??
                    "Bank (ACH) payments can take multiple business days to settle."}
                </p>
              ) : null}
            </div>
          ) : null}
          {saveEligible && pricing ? (
            <label className="flex items-start gap-2 text-xs leading-snug cursor-pointer" style={{ color: "var(--portal-nav-text)" }}>
              <input
                type="checkbox"
                className="mt-0.5"
                checked={blitzpayAuthAck}
                onChange={(e) => setBlitzpayAuthAck(e.target.checked)}
              />
              <span>{BLITZPAY_FUTURE_PAYMENT_AUTHORIZATION_COPY}</span>
            </label>
          ) : null}
          {fullyPaid ? (
            <p className="text-sm font-medium" style={{ color: "var(--portal-success)" }}>
              This invoice is already paid — no balance is due.
            </p>
          ) : blockedStatus ? (
            <p className="text-sm" style={{ color: "var(--portal-nav-text)" }}>
              This invoice cannot be paid online in its current status.
            </p>
          ) : !workspaceReady ? (
            <p className="text-sm" style={{ color: "var(--portal-nav-text)" }}>
              {blitzpayUnavailableCopy(blitzpay.unavailableReason)}
            </p>
          ) : !meetsCardMinimum ? (
            <p className="text-sm" style={{ color: "var(--portal-nav-text)" }}>
              The balance due is below the online card minimum (USD 0.50). Contact your service provider for other
              payment options.
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                className="w-fit gap-1.5"
                disabled={blitzpayBusy || consentRequiredForPay}
                title={consentRequiredForPay ? "Confirm authorization above to continue." : undefined}
                onClick={() => {
                  setPrepareError(null)
                  void (async () => {
                    setBlitzpayBusy(true)
                    try {
                      const portionBody =
                        partialEffective ?
                          (() => {
                            const c = parseUsdToCents(portalPayPortionDollars)
                            return c != null && c >= 50 ? { invoicePortionCents: c } : {}
                          })()
                        : {}
                      const res = await fetch(`/api/portal/invoices/${encodeURIComponent(invoiceId)}/blitzpay/prepare-pay`, {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          paymentMethodType: selectedPaymentMethod,
                          acknowledgeFuturePaymentAuthorization: blitzpayAuthAck,
                          ...portionBody,
                        }),
                      })
                      const body = (await res.json()) as { error?: string; message?: string; url?: string }
                      if (!res.ok) {
                        setPrepareError(body.message ?? body.error ?? "Could not start BlitzPay checkout.")
                        return
                      }
                      if (body.url) {
                        window.location.assign(body.url)
                      } else {
                        setPrepareError("Checkout URL missing. Please try again.")
                      }
                    } catch (e) {
                      setPrepareError(e instanceof Error ? e.message : "Network error.")
                    } finally {
                      setBlitzpayBusy(false)
                    }
                  })()
                }}
              >
                {blitzpayBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                Pay with BlitzPay
              </Button>
            </div>
          )}
          {pricing?.phase2k ? (
            <div className="rounded-md border px-3 py-2 text-[11px] space-y-1 mt-2" style={{ borderColor: "var(--portal-border-light)" }}>
              <p className="font-semibold" style={{ color: "var(--portal-foreground)" }}>
                Saved pay &amp; scheduling
              </p>
              <p style={{ color: "var(--portal-nav-text)" }}>
                Saved payment method on file:{" "}
                <span style={{ color: "var(--portal-foreground)" }}>{pricing.phase2k.savedPaymentProfile ? "Yes" : "No"}</span>
                {" · "}
                Future payment authorization:{" "}
                <span style={{ color: "var(--portal-foreground)" }}>
                  {pricing.phase2k.autopayAuthorization.status === "active" ? "Active" : "Not active"}
                </span>
              </p>
              {pricing.phase2k.scheduled.length > 0 ? (
                <div style={{ color: "var(--portal-nav-text)" }}>
                  <p className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                    Upcoming scheduled payments
                  </p>
                  <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                    {pricing.phase2k.scheduled.map((s) => (
                      <li key={s.id}>
                        {new Date(s.scheduledFor).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        · {fmtCurrency(s.invoicePortionCents)} · {s.status}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          {!fullyPaid && !blockedStatus && workspaceReady && meetsCardMinimum && canSchedule && pricing ? (
            <div className="rounded-md border px-3 py-2 text-xs space-y-2 mt-2" style={{ borderColor: "var(--portal-border-light)" }}>
              <p className="font-semibold" style={{ color: "var(--portal-foreground)" }}>Schedule a payment</p>
              <p style={{ color: "var(--portal-nav-text)" }}>
                Charges the saved default payment method on the date you pick. You can ask your service provider to cancel a
                pending schedule.
              </p>
              {scheduleMsg ? <p className="text-sm text-destructive">{scheduleMsg}</p> : null}
              <label className="block space-y-0.5">
                <span style={{ color: "var(--portal-nav-text)" }}>Run on (local time)</span>
                <input
                  type="datetime-local"
                  value={scheduleForLocal}
                  onChange={(e) => setScheduleForLocal(e.target.value)}
                  className="w-full max-w-xs rounded border px-2 py-1 text-[12px] bg-transparent"
                  style={{ borderColor: "var(--portal-border-light)", color: "var(--portal-foreground)" }}
                />
              </label>
              <label className="block space-y-0.5">
                <span style={{ color: "var(--portal-nav-text)" }}>Amount (leave blank for full balance)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={fmtCurrency(balanceDue)}
                  value={schedulePortionDollars}
                  onChange={(e) => setSchedulePortionDollars(e.target.value)}
                  className="w-full max-w-xs rounded border px-2 py-1 text-[12px] bg-transparent"
                  style={{ borderColor: "var(--portal-border-light)", color: "var(--portal-foreground)" }}
                />
              </label>
              <label className="flex items-start gap-2 leading-snug cursor-pointer" style={{ color: "var(--portal-nav-text)" }}>
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={scheduleConsentAck}
                  onChange={(e) => setScheduleConsentAck(e.target.checked)}
                />
                <span>
                  I confirm this one-time scheduled charge for the amount and date above, using my saved payment method on
                  file with my service provider.
                </span>
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit gap-1.5"
                disabled={scheduleBusy || !scheduleForLocal.trim() || !scheduleConsentAck}
                onClick={() => {
                  setScheduleMsg(null)
                  void (async () => {
                    setScheduleBusy(true)
                    try {
                      const when = new Date(scheduleForLocal)
                      if (!Number.isFinite(when.getTime())) {
                        setScheduleMsg("Pick a valid date and time.")
                        return
                      }
                      const parsed = parseUsdToCents(schedulePortionDollars)
                      const portion =
                        parsed != null && parsed >= 50 ? parsed
                        : balanceDue >= 50 ? balanceDue
                        : 0
                      const res = await fetch(
                        `/api/portal/invoices/${encodeURIComponent(invoiceId)}/blitzpay/scheduled-payments`,
                        {
                          method: "POST",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            scheduledFor: when.toISOString(),
                            invoicePortionCents: portion,
                            scheduleConsentAcknowledged: true,
                          }),
                        },
                      )
                      const body = (await res.json()) as { error?: string; message?: string }
                      if (!res.ok) {
                        setScheduleMsg(body.message ?? body.error ?? "Could not schedule payment.")
                        return
                      }
                      setScheduleMsg("Scheduled. You will receive email confirmation when the charge completes.")
                      setScheduleForLocal("")
                      setSchedulePortionDollars("")
                      setScheduleConsentAck(false)
                      const r2 = await fetch(
                        `/api/portal/invoices/${encodeURIComponent(invoiceId)}/blitzpay/prepare-pay${portalPortionCentsQuery}`,
                        { method: "GET", credentials: "include", cache: "no-store" },
                      )
                      const j2 = (await r2.json()) as { pricing?: BlitzpayPricingPreview }
                      if (r2.ok && j2.pricing) setPricing(j2.pricing)
                    } catch (e) {
                      setScheduleMsg(e instanceof Error ? e.message : "Network error.")
                    } finally {
                      setScheduleBusy(false)
                    }
                  })()
                }}
              >
                {scheduleBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                Save schedule
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {data.timeline.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--portal-foreground)" }}>
            Activity
          </h2>
          <ServiceLifecycleTimeline title="Invoice timeline" events={data.timeline} />
        </div>
      ) : null}

      {data.workOrders.length > 0 ? (
        <div className="portal-card">
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--portal-border-light)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
              Related service visits
            </h2>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--portal-border-light)" }}>
            {data.workOrders.map((wo) => (
              <div key={wo.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-xs font-mono" style={{ color: "var(--portal-nav-text)" }}>
                    {wo.display}
                  </p>
                  <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>
                    {wo.title}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                    {wo.equipmentName} · {wo.typeLabel}
                    {wo.technicianName ? ` · ${wo.technicianName}` : ""}
                  </p>
                </div>
                <div className="text-left sm:text-right text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
                  <span>{wo.statusLabel}</span>
                  {wo.scheduledOn ? <span className="block">{fmtDate(wo.scheduledOn)}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="portal-card">
        <div className="px-5 py-4 border-b flex items-center justify-between gap-2" style={{ borderColor: "var(--portal-border-light)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
              Certificates & compliance
            </h2>
            {data.certificates.length > 0 ? (
              <p className="text-[11px] mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                {data.certificates.length} certificate{data.certificates.length === 1 ? "" : "s"} on
                related visits ·{" "}
                {data.certificates.filter((c) => c.unlocked).length} available to download
              </p>
            ) : null}
          </div>
          <Link href="/portal/certificates" className="text-xs font-medium" style={{ color: "var(--portal-accent)" }}>
            Archive
          </Link>
        </div>
        {data.certificates.length === 0 ? (
          <p className="p-5 text-sm" style={{ color: "var(--portal-nav-text)" }}>
            No certificates linked to this invoice yet.
          </p>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--portal-border-light)" }}>
            {data.certificates.map((c) => {
              const lockedByPayment = c.reasonCode === "locked_payment"
              const lockedByManual = c.reasonCode === "locked_manual"
              const pillLabel = c.unlocked
                ? "Available"
                : lockedByPayment
                  ? "Awaiting payment"
                  : lockedByManual
                    ? "Awaiting release"
                    : "Locked"
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-start gap-2 min-w-0">
                    {c.unlocked ? (
                      <ShieldCheck size={16} className="shrink-0 mt-0.5" style={{ color: "var(--portal-accent)" }} />
                    ) : lockedByPayment ? (
                      <Clock size={16} className="shrink-0 mt-0.5" style={{ color: "var(--portal-nav-icon)" }} />
                    ) : (
                      <Lock size={16} className="shrink-0 mt-0.5" style={{ color: "var(--portal-nav-icon)" }} />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--portal-foreground)" }}>
                          {c.templateName}
                        </p>
                        <span
                          className="inline-flex items-center text-[10px] font-medium rounded-full border px-2 py-px"
                          style={{
                            borderColor: c.unlocked
                              ? "var(--portal-accent)"
                              : "var(--portal-border-light)",
                            color: c.unlocked ? "var(--portal-accent-text)" : "var(--portal-nav-text)",
                            background: c.unlocked ? "var(--portal-accent-muted)" : "transparent",
                          }}
                        >
                          {pillLabel}
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
                        {c.reasonLabel}
                      </p>
                    </div>
                  </div>
                  {c.downloadPath ? (
                    <a
                      href={c.downloadPath}
                      className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium shrink-0"
                      style={{ borderColor: "var(--portal-border-light)", color: "var(--portal-accent)" }}
                    >
                      <Download size={12} /> Download
                    </a>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium shrink-0"
                      style={{ borderColor: "var(--portal-border-light)", color: "var(--portal-nav-text)" }}
                    >
                      <Lock size={12} /> Not yet available
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
        Certificate availability follows your service provider&apos;s release rules (payment, immediate, or manual release).
        {inv.portalCertificateReleaseOverride ? (
          <span> This invoice may override the default policy when configured.</span>
        ) : null}
      </p>
    </div>
  )
}

export default function PortalInvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="portal-card py-20 text-center text-sm" style={{ color: "var(--portal-nav-text)" }}>
          Loading invoice…
        </div>
      }
    >
      <PortalInvoiceDetailPageInner params={params} />
    </Suspense>
  )
}
