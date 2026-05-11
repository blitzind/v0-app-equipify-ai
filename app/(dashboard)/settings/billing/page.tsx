"use client"

import { Suspense } from "react"
import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, CardElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { useTenant } from "@/lib/tenant-store"
import { PLANS, getPlan } from "@/lib/plans"
import type { PlanId } from "@/lib/plans"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import {
  getEffectiveBillingStatus,
  getOrganizationSubscription,
  getTrialDaysRemaining,
  isSubscriptionActive,
  isTrialActive,
  type EffectiveBillingStatus,
  type OrganizationSubscription,
} from "@/lib/billing/subscriptions"
import { getUsageWithLimits, planIdFromSubscriptionRow, type UsageWithLimits } from "@/lib/billing/usage"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import { getEffectivePlanId } from "@/lib/billing/effective-plan"
import { applyDiscountToMrrCents } from "@/lib/billing/discount-pricing"
import { createPortalSession } from "@/app/actions/stripe"
import { createSetupIntent } from "@/app/actions/stripe-setup"
import {
  getStripeBillingSummary,
  type StripeBillingInvoiceRow,
  type StripeBillingPaymentMethod,
} from "@/app/actions/stripe-billing-data"
import {
  CreditCard, Check, ArrowRight, AlertTriangle,
  Download, Zap, X, Sparkles,
  Users, Package, Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  ONBOARDING_INTENDED_PLAN_STORAGE_KEY,
  parseOnboardingPlan,
} from "@/lib/onboarding-intent"
import { WorkspaceInvoiceDefaultsCard } from "@/components/settings/workspace-invoice-defaults-card"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { MISSING_SUBSCRIPTION_BILLING_NOTE } from "@/lib/billing/access"

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
)

function fmtIsoDate(iso: string) {
  if (!iso) return ""
  const [year, month, day] = iso.split("-").map(Number)
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
  return `${MONTHS[month - 1]} ${day}, ${year}`
}

function fmtIsoDateTime(iso: string | null | undefined) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function isoDiffInDays(startIso: string | null, endIso: string | null): number | null {
  if (!startIso || !endIso) return null
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null
  return Math.max(1, Math.ceil((end - start) / (86400 * 1000)))
}

function formatBillingStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatStripeMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100)
  } catch {
    return `$${(cents / 100).toFixed(2)}`
  }
}

function formatCardBrand(brand: string | null) {
  if (!brand) return "Card"
  return brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase()
}

function invoiceAmountLabel(inv: StripeBillingInvoiceRow) {
  const parts: string[] = []
  if (inv.amountPaid > 0) parts.push(`Paid ${formatStripeMoney(inv.amountPaid, inv.currency)}`)
  if (inv.amountDue > 0) parts.push(`Due ${formatStripeMoney(inv.amountDue, inv.currency)}`)
  if (parts.length === 0) return "—"
  return parts.join(" · ")
}

function barLimit(n: number | "unlimited"): number {
  return n === "unlimited" ? -1 : n
}

const CHECKOUT_PLAN_ORDER: PlanId[] = ["solo", "core", "growth", "scale"]

const PAYMENT_ATTENTION_STATUSES = new Set<EffectiveBillingStatus>([
  "unpaid",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "paused",
  "trial_expired",
])

function nextCheckoutPlanId(id: PlanId | string): PlanId {
  const p = normalizePlanIdForRead(typeof id === "string" ? id : id)
  const i = CHECKOUT_PLAN_ORDER.indexOf(p)
  if (i < 0) return "core"
  return i < CHECKOUT_PLAN_ORDER.length - 1 ? CHECKOUT_PLAN_ORDER[i + 1]! : "scale"
}

/** solo &lt; core &lt; growth &lt; scale */
function planTierIndex(planId: PlanId): number {
  const i = CHECKOUT_PLAN_ORDER.indexOf(planId)
  return i >= 0 ? i : 0
}

function PlanBadge({ planId, label }: { planId: PlanId; label?: string }) {
  const map: Record<PlanId, { color: string; bg: string }> = {
    solo:   { color: "#78350f", bg: "#fffbeb" },
    core:   { color: "#b45309", bg: "#fffbeb" },
    growth: { color: "#1d4ed8", bg: "#eff6ff" },
    scale:  { color: "#6d28d9", bg: "#f5f3ff" },
  }
  const key = normalizePlanIdForRead(planId) as PlanId
  const { color, bg } = map[key] ?? map.solo
  return (
    <span
      className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full", !label && "capitalize")}
      style={{ color, background: bg }}
    >
      {label ?? planId}
    </span>
  )
}

interface UsageBarProps {
  label: string
  icon: React.ElementType
  used: number
  limit: number
  unit?: string
  /** Optional helper under the bar (honesty / enforcement notes). */
  detail?: string
}

function UsageBar({ label, icon: Icon, used, limit, unit = "", detail }: UsageBarProps) {
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
      {detail ? <p className="text-[10px] text-muted-foreground leading-snug">{detail}</p> : null}
    </div>
  )
}

function AddCardTrialForm({
  clientSecret,
  onSuccess,
}: {
  clientSecret: string
  onSuccess: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  async function submit() {
    if (!stripe || !elements) return
    setBusy(true)
    setError(null)
    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      setError("Card form is not ready yet. Try again in a moment.")
      setBusy(false)
      return
    }
    const result = await stripe.confirmCardSetup(clientSecret, {
      payment_method: { card: cardElement },
    })
    setBusy(false)
    if (result.error) {
      setError(result.error.message ?? "Could not save your card.")
      return
    }
    toast({ title: "Card saved", description: "Card saved. Choose a plan anytime." })
    onSuccess()
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border px-3 py-2 bg-background">
        <CardElement options={{ hidePostalCode: true }} />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" onClick={() => void submit()} disabled={busy || !stripe || !elements}>
          {busy ? "Saving…" : "Save card"}
        </Button>
      </div>
    </div>
  )
}

function BillingPageContent() {
  const searchParams = useSearchParams()
  const { workspace, dispatch, workspaceUsers } = useTenant()
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const orgPermissions = useOrgPermissions()

  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(workspace.billingCycle)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState("")
  const [showAllInvoices, setShowAllInvoices] = useState(false)

  const [subscription, setSubscription] = useState<OrganizationSubscription | null>(null)
  const [usagePack, setUsagePack] = useState<UsageWithLimits | null>(null)
  type SeatMetricsApi = {
    activeBillable: number
    invitedMemberRowsBillable: number
    pendingTokenInvites: number
    seatsReservedForPlan: number
    activeTotalIncludingAdmins: number
  }
  const [seatMetrics, setSeatMetrics] = useState<SeatMetricsApi | null>(null)
  const [billingLoadError, setBillingLoadError] = useState<string | null>(null)
  const [billingLoading, setBillingLoading] = useState(true)
  const [portalBusy, setPortalBusy] = useState(false)
  const [portalMessage, setPortalMessage] = useState<string | null>(null)

  const [stripeBillingLoading, setStripeBillingLoading] = useState(false)
  const [stripePaymentMethod, setStripePaymentMethod] = useState<StripeBillingPaymentMethod | null>(null)
  const [stripeInvoices, setStripeInvoices] = useState<StripeBillingInvoiceRow[]>([])
  const [stripeBillingNote, setStripeBillingNote] = useState<string | null>(null)
  const [billingRefreshTick, setBillingRefreshTick] = useState(0)
  const [setupOpen, setSetupOpen] = useState(false)
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null)
  const [setupBusy, setSetupBusy] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [intendedPlanId, setIntendedPlanId] = useState<PlanId | null>(null)
  const [highlightedPlanId, setHighlightedPlanId] = useState<PlanId | null>(null)

  useEffect(() => {
    const queryPlan = parseOnboardingPlan(searchParams.get("plan"))
    if (queryPlan) {
      setIntendedPlanId(queryPlan)
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ONBOARDING_INTENDED_PLAN_STORAGE_KEY, queryPlan)
      }
      return
    }

    if (typeof window === "undefined") return
    const storedPlan = parseOnboardingPlan(
      window.localStorage.getItem(ONBOARDING_INTENDED_PLAN_STORAGE_KEY)
    )
    setIntendedPlanId(storedPlan)
  }, [searchParams])

  useEffect(() => {
    if (!intendedPlanId) return
    const planSection = document.getElementById("plan-comparison")
    if (!planSection) return
    planSection.scrollIntoView({ behavior: "smooth", block: "start" })
    setHighlightedPlanId(intendedPlanId)
    const t = window.setTimeout(() => setHighlightedPlanId(null), 2600)
    return () => window.clearTimeout(t)
  }, [intendedPlanId])

  useEffect(() => {
    if (orgStatus !== "ready" || !organizationId) {
      setBillingLoading(orgStatus === "loading")
      return
    }

    let cancelled = false
    setBillingLoading(true)
    setBillingLoadError(null)

    ;(async () => {
      try {
        const supabase = createBrowserSupabaseClient()
        const row = await getOrganizationSubscription(supabase, organizationId)
        if (cancelled) return
        setSubscription(row)
        if (row?.billing_cycle === "monthly" || row?.billing_cycle === "annual") {
          setBillingCycle(row.billing_cycle)
        }

        const planId = planIdFromSubscriptionRow(row?.plan_id)
        const trialOn = row ? isTrialActive(row) : false
        try {
          const pack = await getUsageWithLimits(supabase, organizationId, planId, trialOn)
          if (!cancelled) setUsagePack(pack)
        } catch {
          if (!cancelled) setUsagePack(null)
        }

        try {
          const sm = await fetch(
            `/api/organizations/${encodeURIComponent(organizationId)}/seat-metrics`,
            { cache: "no-store" },
          )
          if (!cancelled) {
            if (sm.ok) {
              setSeatMetrics((await sm.json()) as SeatMetricsApi)
            } else {
              setSeatMetrics(null)
            }
          }
        } catch {
          if (!cancelled) setSeatMetrics(null)
        }
      } catch (e) {
        if (!cancelled) {
          setBillingLoadError(e instanceof Error ? e.message : "Failed to load billing data.")
          setSubscription(null)
          setUsagePack(null)
          setSeatMetrics(null)
        }
      } finally {
        if (!cancelled) setBillingLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [organizationId, orgStatus, billingRefreshTick])

  useEffect(() => {
    if (orgStatus !== "ready" || !organizationId) return

    let cancelled = false
    setStripeBillingLoading(true)
    setStripeBillingNote(null)
    setStripePaymentMethod(null)
    setStripeInvoices([])

    ;(async () => {
      const res = await getStripeBillingSummary()
      if (cancelled) return
      setStripeBillingLoading(false)
      if (res.ok) {
        setStripePaymentMethod(res.paymentMethod)
        setStripeInvoices(res.invoices)
        return
      }
      setStripePaymentMethod(null)
      setStripeInvoices([])
      const lowNoise =
        res.error === "Stripe is not configured." ||
        res.error === "You must be signed in."
      if (!lowNoise) setStripeBillingNote(res.error)
    })()

    return () => {
      cancelled = true
    }
  }, [organizationId, orgStatus, billingRefreshTick])

  const storedPlanId = subscription?.plan_id ?? workspace.planId
  const effectivePlanId = getEffectivePlanId(storedPlanId, subscription)
  const billingIsActive = subscription ? isSubscriptionActive(subscription) : false
  const effectiveBillingStatus: EffectiveBillingStatus = subscription
    ? getEffectiveBillingStatus(subscription)
    : "none"

  const showPaymentAttentionBanner =
    subscription != null && PAYMENT_ATTENTION_STATUSES.has(effectiveBillingStatus)
  const hasStripeCustomer = Boolean(subscription?.stripe_customer_id)
  const portalPrimaryLabel =
    subscription?.status === "past_due" || subscription?.status === "incomplete"
      ? "Fix billing"
      : "Manage billing"
  const pricingFriction =
    subscription?.status === "past_due" || subscription?.status === "incomplete"

  const currentPlanData = getPlan(effectivePlanId)
  const trialLive = subscription ? isTrialActive(subscription) : false
  const intendedPlanIdResolved =
    subscription?.intended_plan_id != null && subscription.intended_plan_id !== ""
      ? normalizePlanIdForRead(subscription.intended_plan_id)
      : null
  const intendedPlanData = intendedPlanIdResolved ? getPlan(intendedPlanIdResolved) : null
  const pricingPlanForDisplay =
    trialLive && intendedPlanData ? intendedPlanData : currentPlanData
  const trialDaysLeft = subscription ? getTrialDaysRemaining(subscription) : 0
  const trialTotalDays = isoDiffInDays(subscription?.trial_starts_at ?? null, subscription?.trial_ends_at ?? null)
  const trialDaysUsed =
    trialTotalDays != null ? Math.min(trialTotalDays, Math.max(0, trialTotalDays - trialDaysLeft)) : null
  const trialProgressPct =
    trialTotalDays && trialTotalDays > 0
      ? Math.min(100, Math.max(0, ((trialDaysUsed ?? 0) / trialTotalDays) * 100))
      : 0
  const trialUrgency =
    trialLive && trialDaysLeft <= 2
      ? "urgent"
      : trialLive && trialDaysLeft <= 6
      ? "warning"
      : trialLive
      ? "info"
      : null

  const usedSeatsActiveApprox =
    usagePack?.usage.seatsUsed ?? workspaceUsers.filter((u) => u.status === "Active").length
  const usedSeatsReservedForPlan =
    seatMetrics?.seatsReservedForPlan ?? usedSeatsActiveApprox
  const usedEquipment = usagePack?.usage.equipmentUsed ?? 0
  const usedApiCalls = usagePack?.usage.apiCallsUsedThisMonth ?? 0

  const seatBarLimit = usagePack ? barLimit(usagePack.limits.users) : currentPlanData.seats === -1 ? -1 : currentPlanData.seats
  const seatUsageDetail =
    seatMetrics != null
      ? `${seatMetrics.activeBillable.toLocaleString()} active (billable) · ${(
          seatMetrics.invitedMemberRowsBillable + seatMetrics.pendingTokenInvites
        ).toLocaleString()} pending invitation(s) · bar compares reserved total to plan`
      : undefined
  const equipBarLimit = usagePack ? barLimit(usagePack.limits.equipment) : currentPlanData.equipmentLimit
  const apiBarLimit =
    usagePack?.limits.apiCallsMonthly != null ? usagePack.limits.apiCallsMonthly : -1

  const subscriptionStatusDisplay =
    subscription?.status ? formatBillingStatus(subscription.status) : formatBillingStatus(workspace.subscriptionStatus)

  const periodEndIso = subscription?.current_period_end ?? workspace.currentPeriodEnd
  const nextRenewalDate = periodEndIso ? fmtIsoDate(periodEndIso.slice(0, 10)) : ""
  const billingCycleLabel = subscription?.billing_cycle ?? workspace.billingCycle

  async function openBillingPortal() {
    setPortalMessage(null)
    setPortalBusy(true)
    try {
      const { url, error } = await createPortalSession()
      if (url) {
        window.location.href = url
        return
      }
      setPortalMessage(error ?? "Could not open billing portal.")
    } finally {
      setPortalBusy(false)
    }
  }

  function jumpToPlanComparison() {
    const planSection = document.getElementById("plan-comparison")
    if (!planSection) return
    planSection.scrollIntoView({ behavior: "smooth", block: "start" })
    planSection.focus({ preventScroll: true })
  }

  function handleBillingPrimaryAction() {
    if (!hasStripeCustomer) {
      setPortalMessage(null)
      jumpToPlanComparison()
      return
    }
    void openBillingPortal()
  }

  async function startHostedCheckout(planId: PlanId) {
    setCheckoutError("")
    setCheckoutBusy(true)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingCycle }),
      })
      const data = (await res.json()) as { url?: string; message?: string }
      if (!res.ok) {
        setCheckoutError(data.message ?? "Could not start checkout.")
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      setCheckoutError("Stripe did not return a checkout URL.")
    } catch {
      setCheckoutError("Could not start checkout.")
    } finally {
      setCheckoutBusy(false)
    }
  }

  const hasStripe = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

  const visibleInvoices = showAllInvoices ? stripeInvoices : stripeInvoices.slice(0, 5)

  const currentMonthlyRate =
    billingCycle === "annual" ? pricingPlanForDisplay.priceAnnual : pricingPlanForDisplay.priceMonthly

  const monthlyCostAfterDiscount = useMemo(() => {
    const base = currentMonthlyRate
    if (!subscription) {
      return { baseCents: base, finalCents: base, showStrike: false as boolean }
    }
    const parsed = applyDiscountToMrrCents(
      base,
      subscription.discount_type,
      subscription.discount_value,
      subscription.discount_expires_at,
    )
    const t = subscription.discount_type?.trim().toLowerCase()
    const showStrike =
      parsed.active && (t === "percent" || t === "fixed") && parsed.finalCents < base
    return { baseCents: base, finalCents: parsed.finalCents, showStrike }
  }, [currentMonthlyRate, subscription])

  async function openAddCardModal() {
    setSetupError(null)
    setSetupBusy(true)
    const res = await createSetupIntent()
    setSetupBusy(false)
    if (!res.clientSecret) {
      setSetupError(res.error ?? "Could not initialize card setup.")
      setSetupOpen(true)
      return
    }
    setSetupClientSecret(res.clientSecret)
    setSetupOpen(true)
  }

  function handleSetupSuccess() {
    setSetupOpen(false)
    setSetupClientSecret(null)
    setSetupError(null)
    setBillingRefreshTick((n) => n + 1)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Equipify account billing — distinct from customer invoice defaults below */}
      <div className="rounded-lg border border-border bg-muted/15 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Equipify subscription & account billing</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Manage your workspace plan, Stripe payment method, and Equipify subscription invoices. Defaults for{" "}
          <strong className="font-medium text-foreground/90">customer invoices</strong> you issue in the field are in{" "}
          <span className="whitespace-nowrap">Invoice payment defaults</span> at the bottom of this page.
        </p>
      </div>

      {/* ── Current subscription ─────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Current subscription</h3>
        </div>
        <div className="px-6 py-5">
          {billingLoadError && (
            <p className="text-xs text-destructive mb-3">{billingLoadError}</p>
          )}
          {billingLoading && orgStatus === "ready" && (
            <p className="text-xs text-muted-foreground mb-3">Loading subscription…</p>
          )}
          {!billingLoading && orgStatus === "ready" && !subscription && (
            <div className="rounded-lg border border-[color:var(--ds-info-border)] bg-[color:var(--ds-info-bg)] px-4 py-3 mb-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">Billing setup</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{MISSING_SUBSCRIPTION_BILLING_NOTE}</p>
              {orgPermissions.canEditOrgBilling && (
                <Button type="button" variant="outline" size="sm" className="mt-1" onClick={jumpToPlanComparison}>
                  Choose a plan
                </Button>
              )}
            </div>
          )}
          {showPaymentAttentionBanner && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 mb-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">Payment needs attention</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Update billing to reduce the chance of interruption. Creating new records may already be limited for your
                workspace.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1"
                disabled={portalBusy}
                onClick={handleBillingPrimaryAction}
              >
                {portalBusy && hasStripeCustomer ? "Opening…" : hasStripeCustomer ? portalPrimaryLabel : "Choose a plan"}
              </Button>
            </div>
          )}
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
                  <Zap size={16} className="text-primary-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">
                      {trialLive ? "Scale trial" : `${currentPlanData.name} plan`}
                    </p>
                    <PlanBadge
                      planId={effectivePlanId}
                      label={trialLive ? "Trial" : undefined}
                    />
                    <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full border border-border bg-secondary text-muted-foreground">
                      {subscriptionStatusDisplay}
                    </span>
                  </div>
                  {trialLive && intendedPlanData && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Intended paid plan:{" "}
                      <span className="font-medium text-foreground">{intendedPlanData.name}</span>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="capitalize">{billingCycleLabel}</span> billing
                    {trialLive && subscription?.trial_ends_at && (
                      <>
                        {" "}
                        · Trial ends {fmtIsoDate(subscription.trial_ends_at.slice(0, 10))}
                        {trialDaysLeft > 0 ?
                          ` · ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left`
                        : ""}
                      </>
                    )}
                    {!trialLive && nextRenewalDate && subscription && subscription.status !== "trialing" && (
                      <>
                        {" "}
                        · Renews {nextRenewalDate}
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats — 1 col on mobile, 3 on sm+ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 rounded-lg border border-border bg-secondary/40 p-4">
              <div className="min-h-[44px] flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Seats reserved</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {usedSeatsReservedForPlan} /{" "}
                  {currentPlanData.seats === -1 ? "\u221e" : currentPlanData.seats}
                </p>
              </div>
              <div className="min-h-[44px] flex flex-col justify-center sm:border-l sm:border-border sm:pl-6">
                <p className="text-xs text-muted-foreground">Equipment used</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {usedEquipment.toLocaleString()} /{" "}
                  {currentPlanData.equipmentLimit === -1
                    ? "Unlimited"
                    : currentPlanData.equipmentLimit.toLocaleString()}
                </p>
              </div>
              <div className="min-h-[44px] flex flex-col justify-center sm:border-l sm:border-border sm:pl-6">
                <p className="text-xs text-muted-foreground">
                  {trialLive && intendedPlanData ? "Est. monthly (after trial)" : "Monthly cost"}
                </p>
                <p className="text-sm mt-0.5">
                  {monthlyCostAfterDiscount.showStrike ? (
                    <>
                      <span className="text-muted-foreground line-through font-normal mr-2">
                        ${(monthlyCostAfterDiscount.baseCents / 100).toFixed(0)}
                      </span>
                      <span className="font-bold text-foreground">
                        ${(monthlyCostAfterDiscount.finalCents / 100).toFixed(0)}
                      </span>
                      <span className="font-semibold text-foreground">/mo</span>
                    </>
                  ) : (
                    <span className="font-semibold text-foreground">
                      {`$${(monthlyCostAfterDiscount.finalCents / 100).toFixed(0)}/mo`}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {subscription?.cancel_at_period_end && (
              <div className="rounded-lg border border-[color:var(--status-warning)] bg-[color:var(--status-warning)]/10 px-3 py-2 text-xs text-foreground">
                Subscription is set to cancel at the end of the current billing period.
                {nextRenewalDate && (
                  <>
                    {" "}
                    Access until <strong>{nextRenewalDate}</strong>.
                  </>
                )}
              </div>
            )}

            {subscription?.payment_failed_at && (
              <p className="text-[11px] text-muted-foreground">
                Last payment issue recorded {fmtIsoDateTime(subscription.payment_failed_at)}.
              </p>
            )}

            {trialLive && subscription?.trial_ends_at && !showPaymentAttentionBanner && (
              <div
                className={cn(
                  "rounded-lg border px-3 py-2.5 space-y-1.5",
                  trialUrgency === "urgent" && "border-destructive/40 bg-destructive/5",
                  trialUrgency === "warning" && "border-[color:var(--status-warning)] bg-[color:var(--status-warning)]/10",
                  trialUrgency === "info" && "border-[color:var(--ds-info-border)] bg-[color:var(--ds-info-bg)]",
                )}
              >
                <p className="text-xs font-semibold text-foreground">
                  You&apos;re using Scale access during your trial.
                </p>
                <p className="text-xs text-muted-foreground">
                  {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} remaining · Trial ends{" "}
                  <strong>{fmtIsoDate(subscription.trial_ends_at.slice(0, 10))}</strong>.
                </p>
                <p className={cn("text-[11px] text-muted-foreground", trialDaysLeft <= 6 && "text-foreground/80 font-medium")}>
                  No card required. Add a card now to avoid interruption later.
                </p>
                {trialTotalDays != null && trialDaysUsed != null && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">
                      {trialDaysUsed} of {trialTotalDays} trial days used
                    </p>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          trialUrgency === "urgent"
                            ? "bg-destructive"
                            : trialUrgency === "warning"
                            ? "bg-[color:var(--status-warning)]"
                            : "bg-[color:var(--ds-info-text)]",
                        )}
                        style={{ width: `${trialProgressPct}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={jumpToPlanComparison}
                  >
                    Choose your plan
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn("h-7 text-xs", trialDaysLeft <= 6 && "text-foreground")}
                    disabled={setupBusy}
                    onClick={() => void openAddCardModal()}
                  >
                    {setupBusy ? "Loading…" : "Add card (optional)"}
                  </Button>
                </div>
                {setupError && <p className="text-xs text-destructive">{setupError}</p>}
              </div>
            )}

            {/* Action buttons — full width on mobile, inline on sm+ */}
            <div className="flex flex-col gap-2">
              {!showPaymentAttentionBanner && !trialLive && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    disabled={portalBusy && hasStripeCustomer}
                    onClick={handleBillingPrimaryAction}
                    className="flex items-center justify-center gap-1.5 min-h-[44px] sm:h-8 px-3 text-sm font-medium rounded-md border border-border bg-card hover:bg-secondary text-foreground transition-colors w-full sm:w-auto disabled:opacity-60">
                    <CreditCard size={13} /> {portalBusy && hasStripeCustomer ? "Opening…" : hasStripeCustomer ? portalPrimaryLabel : "Choose a plan"}
                  </button>
                </div>
              )}
              {hasStripeCustomer ? (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Need to change or cancel? Manage billing in the customer portal.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Choose a plan to continue after trial. No card required until you choose a plan.
                </p>
              )}
              {hasStripeCustomer && portalMessage && (
                <p className="text-xs text-muted-foreground">{portalMessage}</p>
              )}
            </div>
          </div>

          {!showPaymentAttentionBanner &&
            (subscription?.status === "past_due" || workspace.subscriptionStatus === "past_due") && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-lg border ds-alert-danger text-sm">
              <AlertTriangle size={14} />
              <span>
                Your subscription payment is past due. Update your payment method to keep your subscription active and avoid
                interruption.
              </span>
              <Button type="button" variant="ghost" size="sm" className="ml-auto text-xs h-7" onClick={() => void openBillingPortal()}>
                Update now
              </Button>
            </div>
          )}

          {trialLive && subscription?.trial_ends_at && trialDaysLeft <= 6 && (
            <div
              className={cn(
                "mt-4 flex items-center gap-2 p-3 rounded-lg border text-sm",
                trialDaysLeft <= 2
                  ? "border-destructive/40 bg-destructive/5 text-destructive"
                  : "ds-alert-warning",
              )}
            >
              <AlertTriangle size={14} />
              <span>
                Your free trial ends on{" "}
                <strong>{fmtIsoDate(subscription.trial_ends_at.slice(0, 10))}</strong>.
                {" "}Choose a plan to continue after trial.
              </span>
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
            type="button"
            disabled={checkoutBusy}
            onClick={() => void startHostedCheckout(nextCheckoutPlanId(effectivePlanId))}
            className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
          >
            {checkoutBusy ? "Redirecting…" : "Upgrade plan"}
          </button>
        </div>
        <div className="px-4 md:px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-0 sm:divide-x divide-border">
          <div className="sm:pr-6">
            <UsageBar
              label="Team seats (reserved)"
              icon={Users}
              used={usedSeatsReservedForPlan}
              limit={seatBarLimit}
              detail={seatUsageDetail}
            />
          </div>
          <div className="sm:px-6">
            <UsageBar
              label="Equipment records"
              icon={Package}
              used={usedEquipment}
              limit={equipBarLimit}
            />
          </div>
          <div className="sm:pl-6">
            <UsageBar
              label="API calls"
              icon={Activity}
              used={usedApiCalls}
              limit={apiBarLimit}
              unit=" calls"
            />
          </div>
        </div>
        <p className="px-4 md:px-6 pb-4 pt-1 text-[11px] text-muted-foreground leading-snug border-t border-border/70">
          <strong className="font-medium text-foreground/90">Enforced:</strong> team seats and equipment on supported server
          actions (create / invite). Seats compare <strong className="font-medium text-foreground/90">reserved</strong>{" "}
          totals (active billable members + invited roster + pending email invites, excluding platform-admin allowlist) to
          your plan. If live counts cannot be loaded for a subscribed workspace, those actions return a retry message instead
          of skipping the check. <strong className="font-medium text-foreground/90">Tracked, not enforced yet:</strong> the
          API calls bar — there is no app code incrementing monthly API totals today, so it stays at zero until metering is
          wired; the billing team can share timing when that ships.
        </p>
      </div>

      {/* ── Payment method (Stripe) ── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Payment method</h3>
        </div>
        <div className="px-6 py-5">
          <div className="flex flex-col gap-4">
            {stripeBillingLoading && (
              <p className="text-xs text-muted-foreground">Loading payment method…</p>
            )}
            {!stripeBillingLoading && stripeBillingNote && (
              <p className="text-xs text-muted-foreground">{stripeBillingNote}</p>
            )}
            <div className="flex items-center gap-4">
              <div className="w-14 h-9 rounded-md border border-border bg-gradient-to-br from-secondary to-secondary/60 flex items-center justify-center shrink-0">
                <CreditCard size={18} className="text-muted-foreground" />
              </div>
              <div>
                {!stripeBillingLoading && stripePaymentMethod?.last4 ? (
                  <>
                    <p className="text-sm font-medium text-foreground">
                      {formatCardBrand(stripePaymentMethod.brand)} ending in {stripePaymentMethod.last4}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {stripePaymentMethod.expMonth != null && stripePaymentMethod.expYear != null
                        ? `Expires ${String(stripePaymentMethod.expMonth).padStart(2, "0")} / ${stripePaymentMethod.expYear}`
                        : "Expiration on file"}
                      {" · "}
                      Billing email: {workspace.companyEmail}
                    </p>
                  </>
                ) : !stripeBillingLoading ? (
                  <p className="text-sm font-medium text-foreground">No payment method on file yet</p>
                ) : null}
                {!stripeBillingLoading && !stripePaymentMethod?.last4 && (
                  <p className="text-xs text-muted-foreground mt-0.5">Billing email: {workspace.companyEmail}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {hasStripeCustomer ? (
                <button
                  type="button"
                  disabled={portalBusy}
                  onClick={() => void openBillingPortal()}
                  className="flex items-center justify-center min-h-[44px] sm:h-8 px-3 text-xs font-medium rounded-md border border-border bg-card hover:bg-secondary text-foreground transition-colors w-full sm:w-auto disabled:opacity-60"
                >
                  {portalBusy ? "Opening…" : "Manage billing"}
                </button>
              ) : (
                <p className="text-xs text-muted-foreground">Available after checkout</p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Your card is charged automatically each billing cycle. We accept Visa, Mastercard, American Express, and Discover.
          </p>
        </div>
      </div>

      {/* ── Plan selector ────────────────────────────────────────────────────── */}
      <div id="plan-comparison" tabIndex={-1} className="bg-card border border-border rounded-lg overflow-hidden focus:outline-none">
        {checkoutError && (
          <div className="px-6 pt-4">
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {checkoutError}
            </div>
          </div>
        )}
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

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {PLANS.map((p) => {
            const matchesStoredPlan = p.id === effectivePlanId
            const isCurrent = billingIsActive && matchesStoredPlan
            const isPaidCurrent = isCurrent && !trialLive
            const tierCurrent = planTierIndex(effectivePlanId)
            const tierP = planTierIndex(p.id)
            const isUpgrade = !matchesStoredPlan && tierP > tierCurrent
            const isDowngrade = !matchesStoredPlan && tierP < tierCurrent
            const monthly = billingCycle === "annual" ? p.priceAnnual : p.priceMonthly
            const isPopular = p.id === "growth"

            const planCta = (() => {
              if (isCurrent) {
                return trialLive ? (
                  <><Check size={12} /> Keep Scale</>
                ) : (
                  <><Check size={12} /> Current plan</>
                )
              }
              if (!billingIsActive && matchesStoredPlan) {
                const st = subscription?.status
                if (st === "canceled" || st === "paused") {
                  return <>Reactivate {p.name}</>
                }
                return <>Choose {p.name}</>
              }
              if (!billingIsActive && !matchesStoredPlan && pricingFriction) {
                return <>Change to {p.name} <ArrowRight size={12} /></>
              }
              if (!billingIsActive && !matchesStoredPlan) {
                return <>Choose {p.name}</>
              }
              if (trialLive && !matchesStoredPlan) {
                return <>Choose {p.name}</>
              }
              if (isUpgrade) {
                return <>Upgrade to {p.name} <ArrowRight size={12} /></>
              }
              if (isDowngrade) {
                return <>Downgrade to {p.name} <ArrowRight size={12} /></>
              }
              return <>Choose {p.name}</>
            })()

            return (
              <div
                key={p.id}
                className={`relative flex h-full flex-col rounded-xl border-2 p-5 transition-all ${
                  isCurrent
                    ? "border-primary bg-primary/5"
                    : isPopular
                    ? "border-primary/40 bg-card hover:border-primary/60"
                    : "border-border bg-card hover:border-primary/30"
                } ${
                  highlightedPlanId === p.id
                    ? "ring-2 ring-[#2563eb] ring-offset-2 ring-offset-background"
                    : ""
                }`}
              >
                {p.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full bg-primary text-primary-foreground whitespace-nowrap shadow-sm">
                    {p.badge}
                  </span>
                )}
                {isCurrent && (
                  <span
                    className={cn(
                      "absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground",
                      !trialLive && "uppercase",
                    )}
                  >
                    {trialLive ? "Scale (Trial)" : "Current"}
                  </span>
                )}

                <div className="mb-3 mt-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-foreground text-base">{p.name}</h4>
                    {intendedPlanId === p.id && (
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border border-[#93c5fd] bg-[#eff6ff] text-[#1d4ed8]">
                        Intended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.description}</p>
                </div>

                <div className="mb-4">
                  <div className="flex items-end gap-1">
                    <span className="text-2xl font-bold text-foreground">${(monthly / 100).toFixed(0)}</span>
                    <span className="text-xs text-muted-foreground mb-0.5">/mo</span>
                  </div>
                  {billingCycle === "annual" && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      ${((p.priceAnnual / 100) * 12).toFixed(0)} billed annually
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
                  type="button"
                  disabled={isPaidCurrent || checkoutBusy}
                  onClick={() => void startHostedCheckout(p.id)}
                  className={`w-full h-9 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all mt-auto ${
                    isPaidCurrent
                      ? "bg-primary/10 text-primary cursor-default"
                      : "bg-cta text-cta-foreground hover:bg-cta-hover active:bg-cta-active shadow-sm"
                  }`}
                >
                  {checkoutBusy ? "Redirecting…" : planCta}
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

      {/* ── Invoice history (Stripe) ── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Invoice history</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7 gap-1.5"
            disabled={portalBusy}
            onClick={() => void openBillingPortal()}
          >
            <Download size={12} /> Download all
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 dark:bg-card">
              {["Invoice", "Date", "Amount", "Status", ""].map((h) => (
                <th key={h || "actions"} className="text-left px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stripeBillingLoading && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-xs text-muted-foreground">
                  Loading invoices…
                </td>
              </tr>
            )}
            {!stripeBillingLoading && stripeInvoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-xs text-muted-foreground">
                  {stripeBillingNote ??
                    "No invoices yet. They will appear here after your first charge."}
                </td>
              </tr>
            )}
            {!stripeBillingLoading &&
              visibleInvoices.map((inv) => {
                const statusLabel = inv.status ? formatBillingStatus(inv.status) : "—"
                const isPaidLike =
                  inv.status === "paid" || inv.status === "paid_out_of_band" || inv.amountDue === 0
                return (
                  <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-3 text-xs font-mono text-foreground">
                      {inv.number ?? inv.id.slice(0, 12)}
                    </td>
                    <td className="px-6 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtIsoDate(inv.created.slice(0, 10))}
                    </td>
                    <td className="px-6 py-3 text-xs font-medium text-foreground tabular-nums">
                      {invoiceAmountLabel(inv)}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full border",
                          isPaidLike ? "ds-badge-success" : "ds-badge-warning"
                        )}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {inv.hostedInvoiceUrl && (
                          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" asChild>
                            <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                              View
                            </a>
                          </Button>
                        )}
                        {inv.invoicePdf && (
                          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" asChild>
                            <a href={inv.invoicePdf} target="_blank" rel="noopener noreferrer">
                              <Download size={12} /> PDF
                            </a>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
        {!stripeBillingLoading && stripeInvoices.length > 5 && (
          <div className="px-6 py-3 border-t border-border">
            <button
              type="button"
              onClick={() => setShowAllInvoices((v) => !v)}
              className="text-xs text-primary hover:underline font-medium"
            >
              {showAllInvoices
                ? "Show fewer invoices"
                : `Show all ${stripeInvoices.length} invoices`}
            </button>
          </div>
        )}
      </div>

      {/* ── Workspace operational: customer invoice payment defaults (Invoicing Phase 3) ── */}
      <WorkspaceInvoiceDefaultsCard
        organizationId={orgStatus === "ready" ? organizationId : null}
        canEdit={orgPermissions.canEditOrgBilling}
      />

      {setupOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-10">
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <CreditCard size={15} />
                Add card for trial
              </h3>
              <Button variant="ghost" size="icon-sm" onClick={() => setSetupOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </Button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground">
                Save a card now so plan activation is faster before trial ends.
              </p>
              {setupError && <p className="text-xs text-destructive">{setupError}</p>}
              {!setupClientSecret ? (
                <div className="flex justify-end">
                  <Button type="button" size="sm" onClick={() => void openAddCardModal()} disabled={setupBusy}>
                    {setupBusy ? "Loading…" : "Retry"}
                  </Button>
                </div>
              ) : hasStripe ? (
                <Elements stripe={stripePromise} options={{ clientSecret: setupClientSecret }}>
                  <AddCardTrialForm onSuccess={handleSetupSuccess} clientSecret={setupClientSecret} />
                </Elements>
              ) : (
                <p className="text-xs text-muted-foreground">Stripe is not configured for card setup.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading billing...</div>}>
      <BillingPageContent />
    </Suspense>
  )
}
