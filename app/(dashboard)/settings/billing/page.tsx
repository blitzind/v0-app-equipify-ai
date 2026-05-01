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
  Download, Zap, X, Phone, Sparkles,
  Users, Package, Activity, MoreHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
)

function fmtIsoDate(iso: string) {
  if (!iso) return ""
  const [year, month, day] = iso.split("-").map(Number)
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
  return `${MONTHS[month - 1]} ${day}, ${year}`
}

function PlanBadge({ planId }: { planId: PlanId }) {
  const map: Record<PlanId, { color: string; bg: string }> = {
    starter:    { color: "#b45309", bg: "#fffbeb" },
    growth:     { color: "#1d4ed8", bg: "#eff6ff" },
    scale:      { color: "#6d28d9", bg: "#f5f3ff" },
    enterprise: { color: "#166534", bg: "#f0fdf4" },
  }
  const { color, bg } = map[planId] ?? map.starter
  return (
    <span className="text-xs font-semibold capitalize px-2.5 py-0.5 rounded-full"
      style={{ color, background: bg }}>
      {planId}
    </span>
  )
}

interface UsageBarProps {
  label: string
  icon: React.ElementType
  used: number
  limit: number
  unit?: string
}

function UsageBar({ label, icon: Icon, used, limit, unit = "" }: UsageBarProps) {
  const isUnlimited = limit === -1
  const pct = isUnlimited ? 0 : Math.min((used / limit) * 100, 100)
  const isWarning = !isUnlimited && pct >= 80
  const isCritical = !isUnlimited && pct >= 95

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={13} className="text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-foreground">{label}</span>
        </div>
        <span className={cn("text-xs font-semibold tabular-nums",
          isCritical ? "text-destructive" : isWarning ? "text-[color:var(--status-warning)]" : "text-muted-foreground"
        )}>
          {isUnlimited
            ? `${used.toLocaleString()}${unit} / Unlimited`
            : `${used.toLocaleString()}${unit} / ${limit.toLocaleString()}${unit}`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        {!isUnlimited && (
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isCritical ? "bg-destructive" : isWarning ? "bg-[color:var(--status-warning)]" : "bg-primary"
            )}
            style={{ width: `${pct}%` }}
          />
        )}
        {isUnlimited && <div className="h-full rounded-full bg-primary/30 w-[15%]" />}
      </div>
      {isWarning && !isCritical && (
        <p className="text-[10px] text-[color:var(--status-warning)]">Approaching limit — consider upgrading.</p>
      )}
      {isCritical && (
        <p className="text-[10px] text-destructive">At limit — upgrade to add more.</p>
      )}
    </div>
  )
}

// Richer invoice data
const RICH_INVOICE_HISTORY = [
  { id: "INV-S005", date: "2026-05-01", amount: 31800, status: "Paid",    description: "Growth Plan — Annual (May 2026)" },
  { id: "INV-S004", date: "2026-04-01", amount: 31800, status: "Paid",    description: "Growth Plan — Annual (Apr 2026)" },
  { id: "INV-S003", date: "2026-03-01", amount: 31800, status: "Paid",    description: "Growth Plan — Annual (Mar 2026)" },
  { id: "INV-S002", date: "2026-02-01", amount: 31800, status: "Paid",    description: "Growth Plan — Annual (Feb 2026)" },
  { id: "INV-S001", date: "2026-01-01", amount: 31800, status: "Paid",    description: "Growth Plan — Annual (Jan 2026)" },
  { id: "INV-A012", date: "2025-12-01", amount: 31800, status: "Paid",    description: "Growth Plan — Annual (Dec 2025)" },
  { id: "INV-A011", date: "2025-11-01", amount: 31800, status: "Paid",    description: "Growth Plan — Annual (Nov 2025)" },
  { id: "INV-A010", date: "2025-10-01", amount: 31800, status: "Paid",    description: "Growth Plan — Annual (Oct 2025)" },
  { id: "INV-A009", date: "2025-09-01", amount: 39700, status: "Paid",    description: "Growth Plan — Monthly (Sep 2025)" },
  { id: "INV-A008", date: "2025-08-01", amount: 39700, status: "Paid",    description: "Growth Plan — Monthly (Aug 2025)" },
  { id: "INV-A007", date: "2025-07-14", amount: 19700, status: "Paid",    description: "Starter Plan — Monthly (Jul 2025)" },
  { id: "INV-A006", date: "2025-07-01", amount: 0,     status: "Credit",  description: "Prorated credit — Starter to Growth" },
]

export default function BillingPage() {
  const { workspace, dispatch, plan, workspaceUsers } = useTenant()
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(workspace.billingCycle)
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutError, setCheckoutError] = useState("")
  const [showAllInvoices, setShowAllInvoices] = useState(false)

  const usedSeats = workspaceUsers.filter((u) => u.status === "Active").length
  // Mock usage numbers
  const usedEquipment = 847
  const usedApiCalls = 14200
  const apiCallLimit = plan.id === "starter" ? 5000 : plan.id === "growth" ? 25000 : -1

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

  const currentPlanData = plan
  const nextRenewalDate = fmtIsoDate(workspace.currentPeriodEnd)

  const currentMonthlyRate = workspace.billingCycle === "annual"
    ? currentPlanData.priceAnnual
    : currentPlanData.priceMonthly

  const visibleInvoices = showAllInvoices ? RICH_INVOICE_HISTORY : RICH_INVOICE_HISTORY.slice(0, 5)

  return (
    <div className="flex flex-col gap-6">

      {/* ── Current subscription ─────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Current subscription</h3>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
                  <Zap size={16} className="text-primary-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">{currentPlanData.name} Plan</p>
                    <PlanBadge planId={workspace.planId} />
                    {workspace.subscriptionStatus === "trialing" && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ds-badge-warning border">
                        Trial
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">
                    Billed {workspace.billingCycle}
                    {nextRenewalDate && ` \u2022 Renews ${nextRenewalDate}`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Seats used</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {usedSeats} / {currentPlanData.seats === -1 ? "\u221e" : currentPlanData.seats}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Equipment limit</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {currentPlanData.equipmentLimit === -1
                      ? "Unlimited"
                      : currentPlanData.equipmentLimit.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly cost</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {currentPlanData.isCustomPricing
                      ? "Custom"
                      : `$${(currentMonthlyRate / 100).toFixed(0)}/mo`}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
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
              <span>
                Your free trial ends on{" "}
                <strong>{fmtIsoDate(workspace.trialEndsAt ?? workspace.currentPeriodEnd)}</strong>.
                {" "}Add a payment method to continue after trial.
              </span>
              <Button variant="ghost" size="sm" className="ml-auto text-xs h-7">Add card</Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Usage metrics ────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Usage</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Current billing period</p>
          </div>
          <button
            onClick={() => openCheckout(workspace.planId === "starter" ? "growth" : workspace.planId === "growth" ? "scale" : "enterprise")}
            className="text-xs font-medium text-primary hover:underline"
          >
            Upgrade plan
          </button>
        </div>
        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-border">
          <div className="pb-5 sm:pb-0 sm:pr-6">
            <UsageBar
              label="Team seats"
              icon={Users}
              used={usedSeats}
              limit={currentPlanData.seats}
            />
          </div>
          <div className="pt-5 sm:pt-0 sm:px-6">
            <UsageBar
              label="Equipment records"
              icon={Package}
              used={usedEquipment}
              limit={currentPlanData.equipmentLimit}
            />
          </div>
          <div className="pt-5 sm:pt-0 sm:pl-6">
            <UsageBar
              label="API calls"
              icon={Activity}
              used={usedApiCalls}
              limit={apiCallLimit}
              unit=" calls"
            />
          </div>
        </div>
      </div>

      {/* ── Card on file ─────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Payment method</h3>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              {/* Card tile */}
              <div className="w-14 h-9 rounded-md border border-border bg-gradient-to-br from-secondary to-secondary/60 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 38 24" className="w-8 h-5">
                  <rect width="38" height="24" rx="4" fill="#1a1f71" />
                  <circle cx="15" cy="12" r="7" fill="#eb001b" fillOpacity="0.9" />
                  <circle cx="23" cy="12" r="7" fill="#f79e1b" fillOpacity="0.9" />
                  <path d="M19 7.3a7 7 0 0 1 0 9.4A7 7 0 0 1 19 7.3z" fill="#ff5f00" fillOpacity="0.85" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Mastercard ending in 4242</p>
                <p className="text-xs text-muted-foreground">Expires 09 / 2028 &bull; Billing email: {workspace.companyEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openCheckout(workspace.planId)}
                className="h-8 px-3 text-xs font-medium rounded-md border border-border bg-card hover:bg-secondary text-foreground transition-colors"
              >
                Update card
              </button>
              <button className="h-8 px-3 text-xs font-medium rounded-md border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors">
                Remove
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Your card is charged automatically each billing cycle. We accept Visa, Mastercard, American Express, and Discover.
          </p>
        </div>
      </div>

      {/* ── Plan selector ────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Change plan</h3>
            <p className="text-xs text-muted-foreground">
              Upgrades take effect immediately. Downgrades apply at the next billing cycle.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-secondary">
            {(["monthly", "annual"] as const).map((cycle) => (
              <Button
                key={cycle}
                onClick={() => setBillingCycle(cycle)}
                variant="ghost"
                size="sm"
                className={`text-xs h-7 ${billingCycle === cycle
                  ? "bg-card text-foreground shadow-sm hover:bg-card"
                  : "text-muted-foreground hover:text-foreground"}`}
              >
                {cycle === "monthly" ? "Monthly" : "Annual"}
                {cycle === "annual" && (
                  <span className="ml-1.5 text-[9px] font-bold ds-change-positive">Save 20%</span>
                )}
              </Button>
            ))}
          </div>
        </div>

        <div className="px-6 pt-5 pb-1">
          <p className="text-xs text-muted-foreground">
            Equipify helps reduce admin work, recover missed service revenue, and automate operations with built-in AI.
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
          {PLANS.map((p) => {
            const isCurrent = p.id === workspace.planId
            const isDowngrade =
              !isCurrent &&
              PLANS.findIndex((pl) => pl.id === p.id) <
              PLANS.findIndex((pl) => pl.id === workspace.planId)
            const monthly = billingCycle === "annual" ? p.priceAnnual : p.priceMonthly
            const isPopular = p.id === "growth"

            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-xl border-2 p-5 transition-all ${
                  isCurrent
                    ? "border-primary bg-primary/5"
                    : isPopular
                    ? "border-primary/40 bg-card hover:border-primary/60"
                    : "border-border bg-card hover:border-primary/30"
                }`}
              >
                {p.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full bg-primary text-primary-foreground whitespace-nowrap shadow-sm">
                    {p.badge}
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                    Current
                  </span>
                )}

                <div className="mb-3 mt-1">
                  <h4 className="font-semibold text-foreground text-base">{p.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.description}</p>
                </div>

                <div className="mb-4">
                  {p.isCustomPricing ? (
                    <div>
                      <span className="text-2xl font-bold text-foreground">Custom</span>
                    </div>
                  ) : (
                    <div className="flex items-end gap-1">
                      <span className="text-2xl font-bold text-foreground">${(monthly / 100).toFixed(0)}</span>
                      <span className="text-xs text-muted-foreground mb-0.5">/mo</span>
                    </div>
                  )}
                  {!p.isCustomPricing && billingCycle === "annual" && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      ${(p.priceAnnual / 100 * 12).toFixed(0)} billed annually
                    </p>
                  )}
                </div>

                <ul className="space-y-2 mb-5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check size={11} className="text-primary mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {p.aiLabel && p.aiFeatures ? (
                  <div className="mb-4 rounded-lg border border-[color:var(--ds-info-border)] bg-[color:var(--ds-info-bg)] p-3">
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <Sparkles size={11} className="text-[color:var(--ds-info-text)] shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--ds-info-text)]">
                        {p.aiLabel}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {p.aiFeatures.map((f) => (
                        <li key={f} className="flex items-start gap-1.5 text-[11px] text-[color:var(--ds-info-text)]">
                          <span className="mt-[3px] shrink-0 w-1 h-1 rounded-full bg-[color:var(--ds-info-subtle)]" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mb-4 rounded-lg border border-border bg-secondary/40 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles size={11} className="text-muted-foreground/50 shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">
                        AI Access
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium">Not Included</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">Upgrade to unlock AI tools.</p>
                  </div>
                )}

                <button
                  disabled={isCurrent}
                  onClick={() => openCheckout(p.id as PlanId)}
                  className={`w-full h-9 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all mt-auto ${
                    isCurrent
                      ? "bg-primary/10 text-primary cursor-default"
                      : p.isCustomPricing
                      ? "bg-foreground text-background hover:opacity-90"
                      : isDowngrade
                      ? "bg-secondary text-foreground border border-border hover:bg-secondary/80"
                      : "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                  }`}
                >
                  {isCurrent ? (
                    <><Check size={12} /> Current plan</>
                  ) : p.isCustomPricing ? (
                    <><Phone size={12} /> {p.cta}</>
                  ) : isDowngrade ? (
                    <>{p.cta} <ArrowRight size={12} /></>
                  ) : (
                    <>{p.cta} <ArrowRight size={12} /></>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        <div className="px-6 pb-5">
          <p className="text-xs text-muted-foreground text-center">
            No long-term contracts. Cancel anytime. Annual plans save 20%. AI features available on Growth plans and above.
          </p>
        </div>
      </div>

      {/* ── Invoice history ──────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Invoice history</h3>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5">
            <Download size={12} /> Download all
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              {["Invoice", "Date", "Description", "Amount", "Status", ""].map((h) => (
                <th key={h} className="text-left px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleInvoices.map((inv) => (
              <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                <td className="px-6 py-3 text-xs font-mono text-foreground">{inv.id}</td>
                <td className="px-6 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtIsoDate(inv.date)}</td>
                <td className="px-6 py-3 text-xs text-foreground">{inv.description}</td>
                <td className="px-6 py-3 text-xs font-medium text-foreground tabular-nums">
                  {inv.amount === 0 ? "—" : `$${(inv.amount / 100).toFixed(2)}`}
                </td>
                <td className="px-6 py-3">
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full border",
                    inv.status === "Paid"   ? "ds-badge-success" :
                    inv.status === "Credit" ? "ds-badge-info" :
                    "ds-badge-warning"
                  )}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  {inv.status !== "Credit" && (
                    <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                      <Download size={12} /> PDF
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {RICH_INVOICE_HISTORY.length > 5 && (
          <div className="px-6 py-3 border-t border-border">
            <button
              onClick={() => setShowAllInvoices((v) => !v)}
              className="text-xs text-primary hover:underline font-medium"
            >
              {showAllInvoices
                ? "Show fewer invoices"
                : `Show all ${RICH_INVOICE_HISTORY.length} invoices`}
            </button>
          </div>
        )}
      </div>

      {/* ── Stripe Checkout modal ────────────────────────────────────────────── */}
      {checkoutOpen && checkoutPlan && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-10">
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <CreditCard size={15} />
                {PLANS.find((p) => p.id === checkoutPlan)?.name} — {billingCycle}
              </h3>
              <Button variant="ghost" size="icon-sm" onClick={closeCheckout} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </Button>
            </div>
            <div className="p-5">
              {checkoutPlan === "enterprise" ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-700">
                    Our team will reach out within one business day to discuss your requirements and custom pricing.
                  </p>
                  <Button onClick={closeCheckout} className="w-full">
                    Close
                  </Button>
                </div>
              ) : checkoutError ? (
                <div className="space-y-4">
                  <p className="text-sm ds-alert-danger border rounded-lg p-4">
                    {checkoutError}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    To test with real Stripe, add your{" "}
                    <code className="bg-gray-100 px-1 rounded text-[11px]">STRIPE_SECRET_KEY</code> and{" "}
                    <code className="bg-gray-100 px-1 rounded text-[11px]">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>.
                  </p>
                  <button
                    onClick={() => simulateUpgrade(checkoutPlan)}
                    className="w-full h-9 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                  >
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
                      Add your Stripe keys to enable live checkout. Use the demo button to simulate an upgrade.
                    </p>
                    <ul className="mt-2 space-y-0.5 text-xs font-mono">
                      <li>STRIPE_SECRET_KEY</li>
                      <li>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</li>
                    </ul>
                  </div>
                  <Button onClick={() => simulateUpgrade(checkoutPlan)} className="w-full">
                    <Check size={14} /> Simulate upgrade to {PLANS.find((p) => p.id === checkoutPlan)?.name}
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
