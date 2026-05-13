"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Loader2, Wallet } from "lucide-react"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

type PayStatus = {
  upcomingPaymentsCount: number
  balancesNeedingAttentionCount: number
  followUpScheduledCount: number
  summary: string
}

type InvRow = {
  id: string
  referenceLabel: string
  title: string
  amountCents: number
  balanceLabel: string
  dueDate: string | null
  issuedAt: string
  collectionHint: string | null
  followUpScheduledFor: string | null
  needsAttention: boolean
}

function fmtCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

export default function PortalBillingPage() {
  const [status, setStatus] = useState<PayStatus | null>(null)
  const [invoices, setInvoices] = useState<InvRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [autopayBusy, setAutopayBusy] = useState(false)
  const [autopayMsg, setAutopayMsg] = useState<string | null>(null)
  const [financingApps, setFinancingApps] = useState<Array<{ id: string; applicationStatus: string; requestedAmountCents: number }>>([])
  const [financingOffersCount, setFinancingOffersCount] = useState(0)
  const [financingDisclaimer, setFinancingDisclaimer] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    Promise.all([fetch("/api/portal/billing/payment-status"), fetch("/api/portal/billing/invoices")])
      .then(async ([rs, ri]) => {
        const sj = (await rs.json()) as PayStatus & { error?: string }
        const ij = (await ri.json()) as { invoices?: InvRow[]; error?: string }
        if (!rs.ok) throw new Error(sj.error || "status")
        if (!ri.ok) throw new Error(ij.error || "invoices")
        if (cancelled) return
        setStatus(sj)
        setInvoices(ij.invoices ?? [])
      })
      .catch(() => {
        if (!cancelled) setErr("We could not load billing information right now.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([fetch("/api/portal/financing/applications", { credentials: "include" }), fetch("/api/portal/financing/offers", { credentials: "include" })])
      .then(async ([ra, ro]) => {
        const aj = (await ra.json()) as {
          applications?: Array<{ id: string; applicationStatus: string; requestedAmountCents: number }>
          disclaimer?: string
          error?: string
        }
        const oj = (await ro.json()) as { offers?: unknown[]; disclaimer?: string; error?: string }
        if (!ra.ok || !ro.ok) {
          if (!cancelled) {
            setFinancingApps([])
            setFinancingOffersCount(0)
            setFinancingDisclaimer(null)
          }
          return
        }
        if (cancelled) return
        setFinancingApps(aj.applications ?? [])
        setFinancingOffersCount((oj.offers ?? []).length)
        setFinancingDisclaimer(aj.disclaimer ?? oj.disclaimer ?? null)
      })
      .catch(() => {
        if (!cancelled) {
          setFinancingApps([])
          setFinancingOffersCount(0)
          setFinancingDisclaimer(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function pauseAutopayIfPossible() {
    setAutopayBusy(true)
    setAutopayMsg(null)
    try {
      const ar = await fetch("/api/portal/billing/autopay", { cache: "no-store", credentials: "include" })
      const aj = (await ar.json()) as { autopayEnrollments?: Array<{ billingProfileId: string }> }
      const bid = aj.autopayEnrollments?.[0]?.billingProfileId
      if (!bid) {
        setAutopayMsg("No autopay enrollment was found to update.")
        return
      }
      const pr = await fetch("/api/portal/billing/autopay", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingProfileId: bid, enrollmentStatus: "paused" }),
      })
      if (!pr.ok) {
        setAutopayMsg("Autopay could not be updated. Please contact your service provider.")
        return
      }
      setAutopayMsg("Autopay preference was set to paused.")
    } catch {
      setAutopayMsg("Something went wrong. Please try again.")
    } finally {
      setAutopayBusy(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full shrink-0"
          style={{ background: "var(--portal-accent)", color: "white" }}
        >
          <Wallet className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className={PAGE_STANDARD_PAGE_TITLE} style={{ color: "var(--portal-foreground)" }}>
            Billing overview
          </h1>
          <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
            A simple view of balances and scheduled follow-ups. Full payment details stay with our secure payment
            partner—we never store complete card or bank numbers here.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--portal-nav-text)" }}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : null}

      {err ? (
        <div className="portal-card p-4 text-sm" style={{ color: "var(--portal-foreground)" }}>
          {err}
        </div>
      ) : null}

      {status ? (
        <div className="portal-card p-5 space-y-3">
          <p className="text-sm font-medium" style={{ color: "var(--portal-foreground)" }}>
            {status.summary}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p style={{ color: "var(--portal-nav-text)" }}>Upcoming</p>
              <p className="text-xl font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>
                {status.upcomingPaymentsCount}
              </p>
            </div>
            <div>
              <p style={{ color: "var(--portal-nav-text)" }}>Needs attention</p>
              <p className="text-xl font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>
                {status.balancesNeedingAttentionCount}
              </p>
            </div>
            <div>
              <p style={{ color: "var(--portal-nav-text)" }}>Follow-up scheduled</p>
              <p className="text-xl font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>
                {status.followUpScheduledCount}
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-white/10">
            <button
              type="button"
              className="portal-btn-secondary text-sm"
              disabled={autopayBusy}
              onClick={() => void pauseAutopayIfPossible()}
            >
              {autopayBusy ? "Updating…" : "Pause autopay (if enrolled)"}
            </button>
            {autopayMsg ? <p className="text-xs mt-2" style={{ color: "var(--portal-nav-text)" }}>{autopayMsg}</p> : null}
          </div>
        </div>
      ) : null}

      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--portal-foreground)" }}>
          Invoices
        </h2>
        <div className="space-y-2">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/portal/invoices/${encodeURIComponent(inv.id)}`}
              className="portal-card p-4 block hover:opacity-95 transition-opacity"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-medium" style={{ color: "var(--portal-foreground)" }}>
                    {inv.referenceLabel}
                  </p>
                  <p className="text-xs line-clamp-1" style={{ color: "var(--portal-nav-text)" }}>
                    {inv.title}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums" style={{ color: "var(--portal-foreground)" }}>
                    {fmtCurrency(inv.amountCents)}
                  </p>
                  <p className="text-xs" style={{ color: "var(--portal-nav-text)" }}>
                    {inv.balanceLabel}
                  </p>
                </div>
              </div>
              {inv.collectionHint ? (
                <p className="text-xs mt-2" style={{ color: inv.needsAttention ? "var(--portal-accent)" : "var(--portal-nav-text)" }}>
                  {inv.collectionHint}
                  {inv.followUpScheduledFor ? ` · Next window ${inv.followUpScheduledFor}` : ""}
                </p>
              ) : null}
            </Link>
          ))}
          {invoices.length === 0 && !loading ? (
            <p className="text-sm" style={{ color: "var(--portal-nav-text)" }}>
              No invoices to show.
            </p>
          ) : null}
        </div>
      </div>

      {financingApps.length > 0 || financingOffersCount > 0 ? (
        <div className="portal-card p-4 space-y-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>
            Financing activity
          </h2>
          {financingDisclaimer ? (
            <p className="text-xs leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
              {financingDisclaimer}
            </p>
          ) : null}
          <p className="text-xs" style={{ color: "var(--portal-nav-text)" }}>
            Open applications: {financingApps.length} · Offers on file: {financingOffersCount}
          </p>
          <ul className="text-sm space-y-1">
            {financingApps.slice(0, 6).map((a) => (
              <li key={a.id} className="flex justify-between gap-2" style={{ color: "var(--portal-foreground)" }}>
                <span className="text-muted-foreground">{a.applicationStatus}</span>
                <span className="tabular-nums font-medium">{fmtCurrency(a.requestedAmountCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Link href="/portal/dashboard" className="text-sm font-medium inline-block" style={{ color: "var(--portal-accent)" }}>
        ← Back to dashboard
      </Link>
    </div>
  )
}
