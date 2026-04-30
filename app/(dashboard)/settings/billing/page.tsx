"use client"

import { useState, useCallback } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js"
import { useTenant } from "@/lib/tenant-store"
import { PLANS } from "@/lib/plans"
import { INVOICE_HISTORY } from "@/lib/tenant-data"
import type { PlanId } from "@/lib/plans"
import { createCheckoutSession } from "@/app/actions/stripe"
import {
  CreditCard, Check, ArrowRight, AlertTriangle,
  Download, ExternalLink, Zap, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
)

function PlanBadge({ planId }: { planId: PlanId }) {
  const map: Record<PlanId, { color: string; bg: string }> = {
    starter:    { color: "#b45309", bg: "#fffbeb" },
    growth:     { color: "#1d4ed8", bg: "#eff6ff" },
    enterprise: { color: "#6d28d9", bg: "#f5f3ff" },
  }
  const { color, bg } = map[planId]
  return (
    <span className="text-xs font-semibold capitalize px-2.5 py-0.5 rounded-full"
      style={{ color, background: bg }}>
      {planId}
    </span>
  )
}

export default function BillingPage() {
  const { workspace, dispatch, plan, workspaceUsers } = useTenant()
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(workspace.billingCycle)
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutError, setCheckoutError] = useState("")

  const usedSeats = workspaceUsers.filter((u) => u.status === "Active").length

  const fetchClientSecret = useCallback(async () => {
    if (!checkoutPlan) return ""
    const { clientSecret, error } = await createCheckoutSession(checkoutPlan, billingCycle)
    if (error || !clientSecret) {
      setCheckoutError(error ?? "Failed to start checkout.")
      return ""
    }
    return clientSecret
  }, [checkoutPlan, billingCycle])

  function openCheckout(planId: PlanId) {
    setCheckoutPlan(planId)
    setCheckoutError("")
    setCheckoutOpen(true)
  }

  function closeCheckout() {
    setCheckoutOpen(false)
    setCheckoutPlan(null)
  }

  function simulateUpgrade(planId: PlanId) {
    dispatch({ type: "UPGRADE_PLAN", payload: { planId, billingCycle } })
    closeCheckout()
  }

  const hasStripe = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

  // Parse ISO date string directly to avoid timezone-induced day shifts.
  // e.g. "2026-12-31" → { year:2026, month:12, day:31 } in UTC without any Date conversion.
  function fmtIsoDate(iso: string) {
    const [year, month, day] = iso.split("-").map(Number)
    const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
    return `${MONTHS[month - 1]} ${day}, ${year}`
  }
  const nextRenewalDate = fmtIsoDate(workspace.currentPeriodEnd)

  return (
    <div className="flex flex-col gap-6">
      {/* Current plan */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Current subscription</h3>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                  <Zap size={16} className="text-primary-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground capitalize">{plan.name} plan</p>
                    <PlanBadge planId={workspace.planId} />
                    {workspace.subscriptionStatus === "trialing" && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ds-badge-warning border">
                        Trial
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground capitalize">
                    Billed {workspace.billingCycle} &bull; Renews {nextRenewalDate}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Seats</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {usedSeats} / {plan.seats === -1 ? "∞" : plan.seats}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Equipment limit</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {plan.equipmentLimit === -1 ? "Unlimited" : plan.equipmentLimit}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly cost</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    ${((workspace.billingCycle === "annual" ? plan.priceAnnual : plan.priceMonthly) / 100).toFixed(0)}/mo
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => openCheckout(workspace.planId)}
                className="flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md border border-border bg-card hover:bg-secondary text-foreground transition-colors">
                <CreditCard size={13} /> Manage payment
              </button>
              <button
                className="flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors">
                Cancel subscription
              </button>
            </div>
          </div>

          {workspace.subscriptionStatus === "past_due" && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-lg border ds-alert-danger text-sm">
              <AlertTriangle size={14} />
              <span>Your subscription payment is past due. Please update your payment method to avoid service interruption.</span>
              <Button variant="ghost" size="sm" className="ml-auto text-xs h-7">Update now</Button>
            </div>
          )}

          {workspace.subscriptionStatus === "trialing" && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-lg border ds-alert-warning text-sm">
              <AlertTriangle size={14} />
              <span>Your free trial ends on <strong>{fmtIsoDate(workspace.trialEndsAt ?? workspace.currentPeriodEnd)}</strong>. Add a payment method to continue after trial.</span>
              <Button variant="ghost" size="sm" className="ml-auto text-xs h-7">Add card</Button>
            </div>
          )}
        </div>
      </div>

      {/* Plan selector */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Change plan</h3>
            <p className="text-xs text-muted-foreground">Upgrades take effect immediately. Downgrades apply at the next billing cycle.</p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-secondary">
            {(["monthly", "annual"] as const).map((cycle) => (
              <Button key={cycle} onClick={() => setBillingCycle(cycle)} variant="ghost" size="sm"
                className={`text-xs h-7 ${billingCycle === cycle ? "bg-white text-foreground shadow-sm hover:bg-white" : "text-muted-foreground hover:text-foreground"}`}>
                {cycle === "monthly" ? "Monthly" : "Annual"}
                {cycle === "annual" && (
                  <span className="ml-1 text-[9px] font-bold ds-change-positive">-20%</span>
                )}
              </Button>
            ))}
          </div>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((p) => {
            const isCurrent = p.id === workspace.planId
            const monthly = billingCycle === "annual" ? p.priceAnnual : p.priceMonthly
            return (
              <div key={p.id}
                className={`relative rounded-xl border-2 p-5 transition-all ${isCurrent ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}>
                {p.badge && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground whitespace-nowrap">
                    {p.badge}
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                    Current
                  </span>
                )}
                <h4 className="font-semibold text-foreground mt-1 mb-0.5">{p.name}</h4>
                <p className="text-xs text-muted-foreground mb-3">{p.description}</p>
                <div className="mb-4">
                  <span className="text-2xl font-bold text-foreground">${(monthly / 100).toFixed(0)}</span>
                  <span className="text-xs text-muted-foreground">/mo</span>
                </div>
                <ul className="space-y-1.5 mb-4">
                  {p.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Check size={11} className="text-primary mt-0.5 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  disabled={isCurrent}
                  onClick={() => openCheckout(p.id as PlanId)}
                  className={`w-full h-8 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors
                    ${isCurrent
                      ? "bg-primary/10 text-primary cursor-default"
                      : "bg-primary text-primary-foreground hover:opacity-90"}`}>
                  {isCurrent ? (
                    <><Check size={12} /> Current plan</>
                  ) : p.id === "enterprise" && workspace.planId !== "enterprise" ? (
                    <>Contact sales <ArrowRight size={12} /></>
                  ) : (
                    <>Upgrade <ArrowRight size={12} /></>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Invoice history */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Invoice history</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              {["Invoice", "Date", "Description", "Amount", "Status", ""].map((h) => (
                <th key={h} className="text-left px-6 py-3 text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {INVOICE_HISTORY.map((inv) => (
              <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                <td className="px-6 py-3 text-xs font-mono text-foreground">{inv.id}</td>
                <td className="px-6 py-3 text-xs text-muted-foreground">
                  {fmtIsoDate(inv.date)}
                </td>
                <td className="px-6 py-3 text-xs text-foreground">{inv.description}</td>
                <td className="px-6 py-3 text-xs font-medium text-foreground">
                  ${(inv.amount / 100).toFixed(2)}
                </td>
                <td className="px-6 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${inv.status === "Paid" ? "ds-badge-success" : "ds-badge-warning"}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                    <Download size={12} /> PDF
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stripe Checkout modal */}
      {checkoutOpen && checkoutPlan && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-10">
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <CreditCard size={15} />
                {PLANS.find(p => p.id === checkoutPlan)?.name} — {billingCycle}
              </h3>
              <Button variant="ghost" size="icon-sm" onClick={closeCheckout} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </Button>
            </div>
            <div className="p-5">
              {checkoutError ? (
                <div className="space-y-4">
                  <p className="text-sm ds-alert-danger border rounded-lg p-4">
                    {checkoutError}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      To test with real Stripe, add your{" "}
                      <code className="bg-gray-100 px-1 rounded text-[11px]">STRIPE_SECRET_KEY</code> and{" "}
                      <code className="bg-gray-100 px-1 rounded text-[11px]">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>.
                    </p>
                  </div>
                  <button onClick={() => simulateUpgrade(checkoutPlan)}
                    className="w-full h-9 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                    Simulate upgrade (demo)
                  </button>
                </div>
              ) : hasStripe ? (
                <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border ds-alert-warning p-4 text-sm">
                    <p className="font-medium mb-1">Stripe not configured</p>
                    <p className="text-xs leading-relaxed">
                      Add your Stripe environment variables to enable live checkout. In the meantime, use the demo button below.
                    </p>
                    <ul className="mt-2 space-y-0.5 text-xs font-mono">
                      <li>STRIPE_SECRET_KEY</li>
                      <li>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</li>
                    </ul>
                  </div>
                  <Button onClick={() => simulateUpgrade(checkoutPlan)} className="w-full">
                    <Check size={14} /> Simulate upgrade to {PLANS.find(p => p.id === checkoutPlan)?.name}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
