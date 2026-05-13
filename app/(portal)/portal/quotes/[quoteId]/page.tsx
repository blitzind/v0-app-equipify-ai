"use client"

import Link from "next/link"
import { use, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BLITZPAY_FUTURE_PAYMENT_AUTHORIZATION_COPY } from "@/lib/blitzpay/blitzpay-consent-copy"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { cn } from "@/lib/utils"

function fmtCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

type QuoteDetail = {
  id: string
  quoteNumber: string
  title: string
  amountCents: number
  statusLabel: string
  statusDb: string
  createdAt: string
  expiresAt: string | null
  expiredByDate?: boolean
  canApprove: boolean
  canDecline: boolean
  archivedAt: string | null
  blitzpayDepositMode: string
  blitzpayDepositCollectedCents: number
  blitzpayRemainingQuoteCents: number
  blitzpayFinancingReady: boolean
  blitzpayConvertedInvoiceId: string | null
  portalFinancing?: {
    orgFinancingEnabled: boolean
    orgInstallmentPlansEnabled: boolean
    monthlyEstimateCopy: string | null
    tips: string[]
  }
}

type QuotePricing = {
  quoteTotalCents: number
  depositTargetCents: number
  depositCollectedCents: number
  remainingQuoteCents: number
  convenienceFeeCents: number
  totalChargeCents: number
  disclosureCopy: string
  financingReady: boolean
  financingMessage: string
  availablePaymentMethods: Array<{
    type: "card" | "us_bank_account"
    label: string
    convenienceFeeCents: number
    totalChargeCents: number
    disclosureCopy: string
    timelineCopy: string | null
  }>
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function PortalQuoteDetailPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [detail, setDetail] = useState<QuoteDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pricing, setPricing] = useState<QuotePricing | null>(null)
  const [prepareError, setPrepareError] = useState<string | null>(null)
  const [blitzpayBusy, setBlitzpayBusy] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<"card" | "us_bank_account">("card")
  const [blitzpayAuthAck, setBlitzpayAuthAck] = useState(false)
  const [checkoutBanner, setCheckoutBanner] = useState<"success" | "cancel" | null>(null)

  const fromPaymentLink = searchParams.get("blitzpay_link") === "1"

  useEffect(() => {
    const st = searchParams.get("status")
    const b = searchParams.get("blitzpay")
    if (b === "1" && st === "success") {
      setCheckoutBanner("success")
      router.replace(`/portal/quotes/${encodeURIComponent(quoteId)}`, { scroll: false })
    } else if (b === "1" && st === "cancel") {
      setCheckoutBanner("cancel")
      router.replace(`/portal/quotes/${encodeURIComponent(quoteId)}`, { scroll: false })
    }
  }, [searchParams, router, quoteId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadError(null)
      const r = await fetch(`/api/portal/quotes/${encodeURIComponent(quoteId)}`)
      const j = (await r.json().catch(() => ({}))) as QuoteDetail & { error?: string }
      if (cancelled) return
      if (!r.ok) {
        setLoadError(typeof j.error === "string" ? j.error : "Could not load quote.")
        setDetail(null)
        return
      }
      setDetail(j as QuoteDetail)
    })()
    return () => {
      cancelled = true
    }
  }, [quoteId])

  useEffect(() => {
    if (!detail || detail.archivedAt) return
    let cancelled = false
    void (async () => {
      const r = await fetch(`/api/portal/quotes/${encodeURIComponent(quoteId)}/blitzpay/prepare-pay`)
      const j = (await r.json().catch(() => ({}))) as { pricing?: QuotePricing; error?: string; message?: string }
      if (cancelled) return
      if (!r.ok) {
        setPricing(null)
        return
      }
      if (j.pricing) {
        setPricing(j.pricing)
        const first = j.pricing.availablePaymentMethods?.[0]?.type
        if (first === "card" || first === "us_bank_account") setSelectedMethod(first)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [detail, quoteId])

  const selectedPreview = useMemo(() => {
    if (!pricing?.availablePaymentMethods?.length) return null
    return pricing.availablePaymentMethods.find((m) => m.type === selectedMethod) ?? pricing.availablePaymentMethods[0]
  }, [pricing, selectedMethod])

  async function startCheckout() {
    if (!detail) return
    setPrepareError(null)
    setBlitzpayBusy(true)
    try {
      const r = await fetch(`/api/portal/quotes/${encodeURIComponent(quoteId)}/blitzpay/prepare-pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethodType: selectedMethod,
          acknowledgeFuturePaymentAuthorization: blitzpayAuthAck,
        }),
      })
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string; message?: string }
      if (!r.ok) {
        setPrepareError(typeof j.message === "string" ? j.message : "Could not start checkout.")
        return
      }
      if (typeof j.url === "string" && j.url) {
        window.location.href = j.url
      } else {
        setPrepareError("Checkout URL missing.")
      }
    } finally {
      setBlitzpayBusy(false)
    }
  }

  if (loadError) {
    return (
      <div className="space-y-4 px-1">
        <Link
          href="/portal/quotes"
          className="inline-flex items-center gap-1 text-sm"
          style={{ color: "var(--portal-accent)" }}
        >
          <ChevronLeft className="h-4 w-4" />
          Back to quotes
        </Link>
        <p className="text-sm" style={{ color: "var(--portal-foreground)" }}>
          {loadError}
        </p>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex items-center gap-2 px-1 py-8 text-sm" style={{ color: "var(--portal-nav-text)" }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    )
  }

  const showPayCard =
    !detail.archivedAt &&
    detail.blitzpayDepositMode !== "none" &&
    detail.statusDb !== "draft" &&
    detail.statusDb !== "declined" &&
    detail.statusDb !== "expired" &&
    pricing &&
    pricing.depositTargetCents >= 50

  return (
    <div className="mx-auto max-w-lg space-y-6 px-1 pb-10">
      <div>
        <Link
          href="/portal/quotes"
          className="inline-flex items-center gap-1 text-sm"
          style={{ color: "var(--portal-accent)" }}
        >
          <ChevronLeft className="h-4 w-4" />
          Quotes
        </Link>
        <h1 className={cn(PAGE_STANDARD_PAGE_TITLE, "mt-2")} style={{ color: "var(--portal-foreground)" }}>
          {detail.quoteNumber}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--portal-nav-text)" }}>
          {detail.title}
        </p>
      </div>

      {checkoutBanner === "success" ? (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: "var(--portal-border-light)", color: "var(--portal-foreground)" }}
        >
          Payment submitted. If the total still shows a balance, refresh in a moment while we confirm with your bank.
        </div>
      ) : null}
      {checkoutBanner === "cancel" ? (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: "var(--portal-border-light)", color: "var(--portal-nav-text)" }}
        >
          Checkout was canceled. You can try again when you are ready.
        </div>
      ) : null}

      {fromPaymentLink ? (
        <p className="text-xs leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
          You opened a secure payment link for this estimate. Review the amount below, then continue to pay.
        </p>
      ) : null}

      <div className="portal-card space-y-3 p-4">
        <div className="flex justify-between gap-3 text-sm">
          <span style={{ color: "var(--portal-nav-text)" }}>Status</span>
          <span className="font-medium" style={{ color: "var(--portal-foreground)" }}>
            {detail.statusLabel}
            {detail.expiredByDate ? " — past valid date" : ""}
          </span>
        </div>
        <div className="flex justify-between gap-3 text-sm">
          <span style={{ color: "var(--portal-nav-text)" }}>Estimate total</span>
          <span className="font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>
            {fmtCurrency(detail.amountCents)}
          </span>
        </div>
        <div className="flex justify-between gap-3 text-sm">
          <span style={{ color: "var(--portal-nav-text)" }}>Deposit collected</span>
          <span className="tabular-nums" style={{ color: "var(--portal-foreground)" }}>
            {fmtCurrency(detail.blitzpayDepositCollectedCents)}
          </span>
        </div>
        <div className="flex justify-between gap-3 text-sm">
          <span style={{ color: "var(--portal-nav-text)" }}>Remaining on estimate</span>
          <span className="font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>
            {fmtCurrency(detail.blitzpayRemainingQuoteCents)}
          </span>
        </div>
        <p className="text-[11px]" style={{ color: "var(--portal-nav-text)" }}>
          Issued {fmtDate(detail.createdAt)}
          {detail.expiresAt ? ` · Valid through ${fmtDate(detail.expiresAt)}` : ""}
        </p>
      </div>

      {detail.blitzpayFinancingReady ? (
        <div
          className="flex gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed"
          style={{ borderColor: "var(--portal-border-light)", color: "var(--portal-nav-text)" }}
        >
          <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: "var(--portal-accent)" }} />
          <span>
            {pricing?.financingMessage ??
              "Your provider may offer financing in a future release. This page only supports standard card or bank payments today."}
          </span>
        </div>
      ) : null}

      {detail.portalFinancing?.orgFinancingEnabled ? (
        <div className="portal-card space-y-2 p-4 text-xs" style={{ color: "var(--portal-nav-text)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
            Payment options
          </p>
          {detail.portalFinancing.monthlyEstimateCopy ? (
            <p className="leading-relaxed">{detail.portalFinancing.monthlyEstimateCopy}</p>
          ) : (
            <p className="leading-relaxed">
              Monthly financing may be available for larger projects. Your service provider will share next steps when
              ready — this is not a credit application.
            </p>
          )}
          {detail.portalFinancing.orgInstallmentPlansEnabled ? (
            <p className="text-[11px] leading-relaxed opacity-90">
              Staged billing (multiple payments tied to milestones) may be offered on invoices after you approve work.
            </p>
          ) : null}
          {detail.portalFinancing.tips.length > 0 ? (
            <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
              {detail.portalFinancing.tips.map((t, idx) => (
                <li key={idx}>{t}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {showPayCard ? (
        <div className="portal-card space-y-3 p-4">
          <p className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
            Pay online
          </p>
          {selectedPreview ? (
            <div className="space-y-2 text-xs" style={{ color: "var(--portal-nav-text)" }}>
              <div className="flex justify-between gap-2">
                <span>Due now (deposit / prepay)</span>
                <span className="tabular-nums font-medium text-foreground">{fmtCurrency(pricing.depositTargetCents)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Processing fee</span>
                <span className="tabular-nums">{fmtCurrency(selectedPreview.convenienceFeeCents)}</span>
              </div>
              <div className="flex justify-between gap-2 border-t border-border/60 pt-2 font-semibold text-foreground">
                <span>Total charge</span>
                <span className="tabular-nums">{fmtCurrency(selectedPreview.totalChargeCents)}</span>
              </div>
              <p className="pt-1 leading-relaxed">{selectedPreview.disclosureCopy}</p>
            </div>
          ) : null}

          {pricing && pricing.availablePaymentMethods.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {pricing.availablePaymentMethods.map((m) => (
                <button
                  key={m.type}
                  type="button"
                  className="rounded-md border px-2 py-1 text-xs"
                  style={{
                    borderColor: selectedMethod === m.type ? "var(--portal-accent)" : "var(--portal-border-light)",
                    color: "var(--portal-foreground)",
                  }}
                  onClick={() => setSelectedMethod(m.type)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          ) : null}

          <label className="flex cursor-pointer items-start gap-2 text-xs" style={{ color: "var(--portal-nav-text)" }}>
            <input
              type="checkbox"
              className="mt-0.5"
              checked={blitzpayAuthAck}
              onChange={(e) => setBlitzpayAuthAck(e.target.checked)}
            />
            <span>{BLITZPAY_FUTURE_PAYMENT_AUTHORIZATION_COPY}</span>
          </label>

          {prepareError ? (
            <p className="text-xs text-rose-600 dark:text-rose-300">{prepareError}</p>
          ) : null}

          <Button
            type="button"
            className="w-full"
            disabled={blitzpayBusy || !blitzpayAuthAck}
            onClick={() => void startCheckout()}
          >
            {blitzpayBusy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting…
              </>
            ) : (
              "Continue to secure checkout"
            )}
          </Button>
        </div>
      ) : detail.blitzpayDepositMode === "none" ? (
        <p className="text-xs" style={{ color: "var(--portal-nav-text)" }}>
          Online deposit payment is not required for this estimate. Contact your provider if you have questions.
        </p>
      ) : null}

      {(detail.canApprove || detail.canDecline) && (
        <div className="flex flex-wrap gap-2">
          {detail.canApprove ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() =>
                void (async () => {
                  const r = await fetch(`/api/portal/quotes/${encodeURIComponent(quoteId)}/approve`, {
                    method: "POST",
                  })
                  if (r.ok) router.refresh()
                })()
              }
            >
              Approve quote
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" className="text-xs" asChild>
            <Link href="/portal/quotes">Back to list</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
