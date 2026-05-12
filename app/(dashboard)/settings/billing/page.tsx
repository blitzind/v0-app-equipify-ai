"use client"

import { Suspense } from "react"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
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
import {
  createSetupIntent,
  getSaaSBillingSetupPrefill,
  updateSaaSSubscriptionStripeCustomerBilling,
} from "@/app/actions/stripe-setup"
import {
  defaultSaasBillingFormFromWorkspace,
  emptySaasSubscriptionBillingForm,
  getBillingCountrySelectOptions,
  mergeStripeCustomerBillingPrefill,
  saasSubscriptionBillingFormSchema,
  type SaasSubscriptionBillingFormValues,
} from "@/lib/billing/saas-subscription-billing-setup"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  ONBOARDING_INTENDED_PLAN_STORAGE_KEY,
  parseOnboardingPlan,
} from "@/lib/onboarding-intent"
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

/** Avoid echoing Stripe ids / mode hints from Elements into the DOM. */
function safeStripeClientMessage(raw: string | undefined, fallback: string) {
  if (!raw?.trim()) return fallback
  const m = raw.trim()
  if (/\bcus_[a-z0-9]+/i.test(m)) return fallback
  if (/\bsub_[a-z0-9]+/i.test(m)) return fallback
  if (/\bprice_[a-z0-9]+/i.test(m)) return fallback
  if (/\b(pk|sk|rk)_(live|test)_/i.test(m)) return fallback
  if (/livemode|test mode|live mode/i.test(m)) {
    return "Billing could not be completed in this environment. Please contact support."
  }
  return m.length > 280 ? fallback : m
}

function buildStripeElementsBillingDetails(v: SaasSubscriptionBillingFormValues) {
  const phone = v.billingPhone.trim()
  return {
    name: v.billingName,
    email: v.billingEmail,
    ...(phone ? { phone } : {}),
    address: {
      line1: v.addressLine1,
      ...(v.addressLine2.trim() ? { line2: v.addressLine2.trim() } : {}),
      city: v.city,
      state: v.state,
      postal_code: v.postalCode,
      country: v.country,
    },
  }
}

function flattenZodFieldErrors(
  err: import("zod").ZodError,
): Partial<Record<keyof SaasSubscriptionBillingFormValues, string>> {
  const out: Partial<Record<keyof SaasSubscriptionBillingFormValues, string>> = {}
  for (const issue of err.issues) {
    const key = issue.path[0]
    if (typeof key === "string") {
      const k = key as keyof SaasSubscriptionBillingFormValues
      if (out[k] == null) out[k] = issue.message
    }
  }
  return out
}

function SaasCardConfirmStep({
  clientSecret,
  billingValues,
  onSuccess,
}: {
  clientSecret: string
  billingValues: SaasSubscriptionBillingFormValues
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
    const sync = await updateSaaSSubscriptionStripeCustomerBilling(billingValues)
    if (!sync.ok) {
      setBusy(false)
      setError(sync.error)
      return
    }
    const result = await stripe.confirmCardSetup(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: buildStripeElementsBillingDetails(billingValues),
      },
    })
    setBusy(false)
    if (result.error) {
      setError(safeStripeClientMessage(result.error.message, "Could not save your payment method."))
      return
    }
    toast({
      title: "Payment method saved",
      description: "Your billing details were applied to Stripe for receipts and verification.",
    })
    onSuccess()
  }

  return (
    <div className="space-y-3 min-w-0">
      <div className="rounded-md border border-border px-3 py-2 bg-background min-w-0">
        <CardElement options={{ hidePostalCode: true }} />
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        You can still edit the billing fields above; we send the latest values to Stripe when you save.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          className="min-h-[44px] sm:min-h-8"
          onClick={() => void submit()}
          disabled={busy || !stripe || !elements}
        >
          {busy ? "Saving…" : "Save payment method"}
        </Button>
      </div>
    </div>
  )
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
    solo:   { color: "#6b21a8", bg: "#f3e8ff" },
    core:   { color: "#b45309", bg: "#fffbeb" },
    growth: { color: "#1d4ed8", bg: "#eff6ff" },
    scale:  { color: "#9a3412", bg: "#fff7ed" },
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

function BillingPageContent() {
  const searchParams = useSearchParams()
  const { workspace, dispatch, workspaceUsers } = useTenant()
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const orgPermissions = useOrgPermissions()
  /** `useOrgPermissions()` exposes capabilities via `.has()` / `.permissions`, not top-level flags. */
  const canEditOrgInvoiceDefaults =
    orgPermissions.status === "ready" && orgPermissions.has("canEditOrgBilling")

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
  const [manageBillingOpen, setManageBillingOpen] = useState(false)
  const [externalPortalBusy, setExternalPortalBusy] = useState(false)
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
  const [setupBillingForm, setSetupBillingForm] = useState<SaasSubscriptionBillingFormValues>(() =>
    emptySaasSubscriptionBillingForm(),
  )
  const [setupBillingFieldErrors, setSetupBillingFieldErrors] = useState<
    Partial<Record<keyof SaasSubscriptionBillingFormValues, string>>
  >({})
  const [setupPrefillKind, setSetupPrefillKind] = useState<"none" | "workspace" | "stripe">("none")
  const [intendedPlanId, setIntendedPlanId] = useState<PlanId | null>(null)
  const [highlightedPlanId, setHighlightedPlanId] = useState<PlanId | null>(null)

  const billingCountrySelectOptions = useMemo(() => getBillingCountrySelectOptions(), [])

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

  const manageDialogScheduleLine =
    trialLive && subscription?.trial_ends_at
      ? `Trial ends ${fmtIsoDate(subscription.trial_ends_at.slice(0, 10))}`
      : nextRenewalDate && subscription && subscription.status !== "trialing"
        ? `Next renewal ${nextRenewalDate}`
        : periodEndIso
          ? `Billing period through ${fmtIsoDate(periodEndIso.slice(0, 10))}`
          : null

  function openManageBillingModal() {
    setPortalMessage(null)
    setManageBillingOpen(true)
  }

  async function openExternalStripeBillingPortal() {
    setPortalMessage(null)
    setExternalPortalBusy(true)
    try {
      const { url, error } = await createPortalSession()
      if (url) {
        window.location.href = url
        return
      }
      setPortalMessage(
        error ??
          "We couldn't open the external billing page. Please try again or contact support.",
      )
    } finally {
      setExternalPortalBusy(false)
    }
  }

  function handleAddPaymentFromManageBilling() {
    setManageBillingOpen(false)
    window.setTimeout(() => void openAddCardModal(), 120)
  }

  function handleComparePlansFromManageBilling() {
    setManageBillingOpen(false)
    window.setTimeout(() => jumpToPlanComparison(), 120)
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
    openManageBillingModal()
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
    setSetupBillingFieldErrors({})
    setSetupClientSecret(null)
    setSetupOpen(true)
    setSetupBusy(true)
    const ws = defaultSaasBillingFormFromWorkspace(workspace)
    const pre = await getSaaSBillingSetupPrefill()
    const merged = pre.ok ? mergeStripeCustomerBillingPrefill(ws, pre.stripeOverlay) : ws
    setSetupBillingForm(merged)
    if (
      pre.ok &&
      pre.stripeOverlay &&
      (pre.stripeOverlay.addressLine1?.trim() ||
        pre.stripeOverlay.city?.trim() ||
        pre.stripeOverlay.postalCode?.trim())
    ) {
      setSetupPrefillKind("stripe")
    } else if (
      (workspace.name ?? "").trim() ||
      (workspace.companyEmail ?? "").trim() ||
      (workspace.companyAddress ?? "").trim() ||
      (workspace.companyPhone ?? "").trim()
    ) {
      setSetupPrefillKind("workspace")
    } else {
      setSetupPrefillKind("none")
    }
    if (!pre.ok) setSetupError(pre.error)
    setSetupBusy(false)
  }

  async function handlePrepareSetupIntent() {
    setSetupError(null)
    setSetupBillingFieldErrors({})
    const parsed = saasSubscriptionBillingFormSchema.safeParse(setupBillingForm)
    if (!parsed.success) {
      setSetupBillingFieldErrors(flattenZodFieldErrors(parsed.error))
      return
    }
    setSetupBusy(true)
    const res = await createSetupIntent(parsed.data)
    setSetupBusy(false)
    if (!res.clientSecret) {
      setSetupError(res.error ?? "Could not initialize card setup.")
      return
    }
    setSetupClientSecret(res.clientSecret)
  }

  function closePaymentSetupModal() {
    setSetupOpen(false)
    setSetupClientSecret(null)
    setSetupError(null)
    setSetupBillingFieldErrors({})
    setSetupBillingForm(emptySaasSubscriptionBillingForm())
    setSetupPrefillKind("none")
  }

  function handleSetupSuccess() {
    closePaymentSetupModal()
    setBillingRefreshTick((n) => n + 1)
  }

  return (
    <div className="flex flex-col gap-6">
      <Dialog
        open={manageBillingOpen}
        onOpenChange={(open) => {
          setManageBillingOpen(open)
          if (!open) setPortalMessage(null)
        }}
      >
        <DialogContent
          showCloseButton
          className={cn(
            "flex w-[calc(100%-1.25rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg",
            "max-h-[min(90vh,680px)]",
          )}
        >
          <div className="shrink-0 border-b border-border px-5 pb-4 pt-5 pr-12">
            <DialogHeader className="text-left">
              <DialogTitle className="text-base">Manage billing</DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                Subscription and payment details for this workspace. Changes sync to our payment processor; sensitive
                identifiers are never shown here.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {portalMessage && (
              <div
                className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-foreground leading-relaxed"
                role="status"
              >
                {portalMessage}
              </div>
            )}

            <section className="space-y-2 rounded-lg border border-border bg-secondary/30 px-3 py-3">
              <h4 className="text-xs font-semibold text-foreground">Plan & status</h4>
              <p className="text-sm text-foreground">
                {trialLive ? "Scale trial" : `${currentPlanData.name} plan`}{" "}
                <span className="text-muted-foreground">({billingCycleLabel})</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Status: <span className="font-medium text-foreground">{subscriptionStatusDisplay}</span>
              </p>
              {manageDialogScheduleLine ? (
                <p className="text-xs text-muted-foreground">{manageDialogScheduleLine}</p>
              ) : null}
            </section>

            <section className="space-y-2 rounded-lg border border-border bg-secondary/30 px-3 py-3">
              <h4 className="text-xs font-semibold text-foreground">Default payment method</h4>
              {stripeBillingLoading ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : stripePaymentMethod?.last4 ? (
                <p className="text-sm text-foreground">
                  {formatCardBrand(stripePaymentMethod.brand)} ending in {stripePaymentMethod.last4}
                  {stripePaymentMethod.expMonth != null && stripePaymentMethod.expYear != null
                    ? ` · Expires ${String(stripePaymentMethod.expMonth).padStart(2, "0")} / ${stripePaymentMethod.expYear}`
                    : null}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No card on file yet.</p>
              )}
              {!stripeBillingLoading && stripeBillingNote ? (
                <p className="text-[11px] text-muted-foreground leading-snug">{stripeBillingNote}</p>
              ) : null}
              {canEditOrgInvoiceDefaults && hasStripe ? (
                <Button type="button" variant="outline" size="sm" className="mt-1 w-full sm:w-auto" onClick={handleAddPaymentFromManageBilling}>
                  Add or update payment method
                </Button>
              ) : (
                <p className="text-[11px] text-muted-foreground">Ask a workspace billing admin to update the card on file.</p>
              )}
            </section>

            <section className="space-y-2 rounded-lg border border-border bg-secondary/30 px-3 py-3">
              <h4 className="text-xs font-semibold text-foreground">Billing contact</h4>
              <dl className="space-y-1.5 text-xs text-muted-foreground">
                <div>
                  <dt className="font-medium text-foreground/90">Company</dt>
                  <dd className="break-words">{workspace.name || "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground/90">Email</dt>
                  <dd className="break-all">{workspace.companyEmail?.trim() || "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground/90">Phone</dt>
                  <dd>{workspace.companyPhone?.trim() || "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground/90">Address</dt>
                  <dd className="whitespace-pre-wrap break-words">
                    {workspace.companyAddress?.trim() || "—"}
                  </dd>
                </div>
              </dl>
              <p className="text-[10px] text-muted-foreground leading-snug pt-1">
                Company profile edits are under{" "}
                <Link href="/settings/workspace" className="text-primary font-medium underline-offset-2 hover:underline">
                  Settings → Workspace
                </Link>
                .
              </p>
            </section>

            <section className="space-y-2 rounded-lg border border-border bg-secondary/30 px-3 py-3">
              <h4 className="text-xs font-semibold text-foreground">Invoices & receipts</h4>
              {stripeBillingLoading ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : stripeInvoices.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {stripeBillingNote ?? "No invoices yet. They will appear after your first charge."}
                </p>
              ) : (
                <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {stripeInvoices.slice(0, 12).map((inv) => {
                    const statusLabel = inv.status ? formatBillingStatus(inv.status) : "—"
                    const label = inv.number?.trim() || "Subscription invoice"
                    return (
                      <li
                        key={inv.id}
                        className="flex flex-col gap-1 rounded-md border border-border/80 bg-background/80 px-2.5 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{label}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {fmtIsoDate(inv.created.slice(0, 10))} · {invoiceAmountLabel(inv)} · {statusLabel}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-1">
                          {inv.hostedInvoiceUrl ? (
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" asChild>
                              <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                                View
                              </a>
                            </Button>
                          ) : null}
                          {inv.invoicePdf ? (
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1" asChild>
                              <a href={inv.invoicePdf} target="_blank" rel="noopener noreferrer">
                                <Download size={12} /> PDF
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-2 rounded-lg border border-dashed border-border px-3 py-3">
              <h4 className="text-xs font-semibold text-foreground">Change or cancel plan</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">Compare and change plan:</span> choose a plan on this page
                to start checkout (you may leave Equipify briefly for secure payment).
              </p>
              <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleComparePlansFromManageBilling}>
                Compare plans on this page
              </Button>
              <div className="rounded-md bg-muted/50 px-2.5 py-2 text-[11px] text-muted-foreground leading-snug">
                Canceling or downgrading your subscription through a self-serve control is not available in this dialog
                yet.{" "}
                <span className="font-medium text-foreground/90">This billing action will be available here soon.</span>
              </div>
            </section>
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-muted/20 px-5 py-4">
            <div className="rounded-md border border-border bg-background/80 px-3 py-2.5 space-y-2">
              <p className="text-[11px] font-medium text-foreground">Advanced billing (external)</p>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Only use this if you need an account change we have not moved into Equipify yet. This opens a secure
                external billing page hosted by our payment processor.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={externalPortalBusy || !hasStripeCustomer}
                onClick={() => void openExternalStripeBillingPortal()}
              >
                {externalPortalBusy ? "Opening…" : "Continue to external billing page"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug text-center sm:text-left">
              You will be billed by Blitz Industries, Inc., the parent company of Equipify.ai.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Equipify account subscription billing — customer invoice defaults live under Settings → Payments */}
      <div className="rounded-lg border border-border bg-muted/15 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Equipify subscription & account billing</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Manage your workspace plan, Stripe payment method, and Equipify subscription invoices. Defaults for{" "}
          <strong className="font-medium text-foreground/90">customer invoices</strong> you issue in Equipify live under{" "}
          <Link href="/settings/payments" className="text-primary font-medium underline-offset-4 hover:underline">
            Settings → Payments
          </Link>{" "}
          (<span className="whitespace-nowrap">Invoice payment defaults</span>).
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
              {canEditOrgInvoiceDefaults && (
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
                onClick={handleBillingPrimaryAction}
              >
                {hasStripeCustomer ? portalPrimaryLabel : "Choose a plan"}
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
                    onClick={handleBillingPrimaryAction}
                    className="flex items-center justify-center gap-1.5 min-h-[44px] sm:h-8 px-3 text-sm font-medium rounded-md border border-border bg-card hover:bg-secondary text-foreground transition-colors w-full sm:w-auto disabled:opacity-60">
                    <CreditCard size={13} /> {hasStripeCustomer ? portalPrimaryLabel : "Choose a plan"}
                  </button>
                </div>
              )}
              {hasStripeCustomer ? (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Need to change or cancel? Open <span className="font-medium text-foreground/90">Manage billing</span>{" "}
                  for plan details, payment method, invoices, and billing contact — without leaving Equipify.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Choose a plan to continue after trial. No card required until you choose a plan.
                </p>
              )}
              {hasStripeCustomer && portalMessage && !manageBillingOpen && (
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto text-xs h-7"
                onClick={() => (hasStripeCustomer ? openManageBillingModal() : void openAddCardModal())}
              >
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
                  onClick={openManageBillingModal}
                  className="flex items-center justify-center min-h-[44px] sm:h-8 px-3 text-xs font-medium rounded-md border border-border bg-card hover:bg-secondary text-foreground transition-colors w-full sm:w-auto disabled:opacity-60"
                >
                  Manage billing
                </button>
              ) : hasStripe ? (
                <div className="flex w-full flex-col gap-2 sm:max-w-xl">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Add a payment method now so your service continues after the trial. Saving a card does not end your trial
                    early; you are only charged when your plan billing starts (for example after checkout confirms your
                    subscription).
                  </p>
                  {canEditOrgInvoiceDefaults ?
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        disabled={setupBusy}
                        onClick={() => void openAddCardModal()}
                        className="flex min-h-[44px] items-center justify-center rounded-md border border-primary bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60 sm:h-8 sm:min-h-0"
                      >
                        {setupBusy ? "Loading…" : "Add payment method"}
                      </button>
                      <button
                        type="button"
                        disabled={checkoutBusy}
                        onClick={() => {
                          setPortalMessage(null)
                          jumpToPlanComparison()
                        }}
                        className="flex min-h-[44px] items-center justify-center rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60 sm:h-8 sm:min-h-0"
                      >
                        Choose plan & checkout
                      </button>
                    </div>
                  : <p className="text-xs text-muted-foreground">Ask a workspace billing admin to add a payment method.</p>}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Card setup requires Stripe to be configured for this app (publishable key missing).
                </p>
              )}
            </div>
            {portalMessage && !manageBillingOpen ? (
              <div
                className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-foreground leading-relaxed"
                role="status"
              >
                {portalMessage}
              </div>
            ) : null}
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
        <div className="px-6 py-4 border-b border-border flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <h3 className="text-sm font-semibold text-foreground">Invoice history</h3>
          <div className="flex flex-col items-stretch sm:items-end gap-1 min-w-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 gap-1.5"
              disabled
              title="This billing action will be available here soon."
            >
              <Download size={12} /> Download all
            </Button>
            <p className="text-[10px] text-muted-foreground text-center sm:text-right leading-snug max-w-xs">
              This billing action will be available here soon. Open each invoice below for PDF or hosted receipt.
            </p>
          </div>
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

      {setupOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-6 sm:py-10 px-3 min-[375px]:px-4">
          <div className="relative bg-card text-foreground rounded-xl border border-border shadow-2xl w-full max-w-md min-w-0 max-h-[calc(100vh-3rem)] flex flex-col mt-2 sm:mt-0">
            <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border shrink-0">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 min-w-0">
                <CreditCard size={15} className="shrink-0" />
                <span className="truncate">Add payment method</span>
              </h3>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={closePaymentSetupModal}
                className="text-muted-foreground shrink-0"
                aria-label="Close"
              >
                <X size={18} />
              </Button>
            </div>
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto min-w-0 min-h-0 flex-1">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Add a card on file for when your trial ends. This does not charge you immediately unless your plan
                requires it at checkout.
              </p>
              {setupError && <p className="text-xs text-destructive">{setupError}</p>}
              {setupPrefillKind === "workspace" && (
                <p className="text-[11px] text-muted-foreground leading-snug rounded-md border border-border bg-secondary/40 px-3 py-2">
                  Prefilled from your company profile.
                </p>
              )}
              {setupPrefillKind === "stripe" && (
                <p className="text-[11px] text-muted-foreground leading-snug rounded-md border border-border bg-secondary/40 px-3 py-2">
                  Prefilled from your billing details on file.
                </p>
              )}

              <div className="space-y-3 min-w-0">
                <h4 className="text-xs font-semibold text-foreground">Billing information</h4>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  We&apos;ll use this information for receipts, invoices, and payment verification. You can edit it if a
                  different person or company should be billed.
                </p>
                <div className="grid grid-cols-1 gap-3 min-w-0">
                  <div className="space-y-1.5 min-w-0">
                    <Label htmlFor="saas-bill-name" className="text-xs">
                      Billing name / company <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="saas-bill-name"
                      className="min-h-[44px] sm:min-h-9 text-sm min-w-0"
                      value={setupBillingForm.billingName}
                      onChange={(e) => {
                        setSetupBillingForm((p) => ({ ...p, billingName: e.target.value }))
                        setSetupBillingFieldErrors((er) => ({ ...er, billingName: undefined }))
                      }}
                      autoComplete="organization"
                    />
                    {setupBillingFieldErrors.billingName && (
                      <p className="text-[11px] text-destructive">{setupBillingFieldErrors.billingName}</p>
                    )}
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <Label htmlFor="saas-bill-email" className="text-xs">
                      Billing email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="saas-bill-email"
                      type="email"
                      className="min-h-[44px] sm:min-h-9 text-sm min-w-0"
                      value={setupBillingForm.billingEmail}
                      onChange={(e) => {
                        setSetupBillingForm((p) => ({ ...p, billingEmail: e.target.value }))
                        setSetupBillingFieldErrors((er) => ({ ...er, billingEmail: undefined }))
                      }}
                      autoComplete="email"
                    />
                    {setupBillingFieldErrors.billingEmail && (
                      <p className="text-[11px] text-destructive">{setupBillingFieldErrors.billingEmail}</p>
                    )}
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <Label htmlFor="saas-bill-phone" className="text-xs">
                      Billing phone <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="saas-bill-phone"
                      type="tel"
                      className="min-h-[44px] sm:min-h-9 text-sm min-w-0"
                      value={setupBillingForm.billingPhone}
                      onChange={(e) => {
                        setSetupBillingForm((p) => ({ ...p, billingPhone: e.target.value }))
                        setSetupBillingFieldErrors((er) => ({ ...er, billingPhone: undefined }))
                      }}
                      autoComplete="tel"
                    />
                    {setupBillingFieldErrors.billingPhone && (
                      <p className="text-[11px] text-destructive">{setupBillingFieldErrors.billingPhone}</p>
                    )}
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <Label htmlFor="saas-bill-a1" className="text-xs">
                      Address line 1 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="saas-bill-a1"
                      className="min-h-[44px] sm:min-h-9 text-sm min-w-0"
                      value={setupBillingForm.addressLine1}
                      onChange={(e) => {
                        setSetupBillingForm((p) => ({ ...p, addressLine1: e.target.value }))
                        setSetupBillingFieldErrors((er) => ({ ...er, addressLine1: undefined }))
                      }}
                      autoComplete="address-line1"
                    />
                    {setupBillingFieldErrors.addressLine1 && (
                      <p className="text-[11px] text-destructive">{setupBillingFieldErrors.addressLine1}</p>
                    )}
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <Label htmlFor="saas-bill-a2" className="text-xs">
                      Address line 2 <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="saas-bill-a2"
                      className="min-h-[44px] sm:min-h-9 text-sm min-w-0"
                      value={setupBillingForm.addressLine2}
                      onChange={(e) => {
                        setSetupBillingForm((p) => ({ ...p, addressLine2: e.target.value }))
                        setSetupBillingFieldErrors((er) => ({ ...er, addressLine2: undefined }))
                      }}
                      autoComplete="address-line2"
                    />
                    {setupBillingFieldErrors.addressLine2 && (
                      <p className="text-[11px] text-destructive">{setupBillingFieldErrors.addressLine2}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                    <div className="space-y-1.5 min-w-0">
                      <Label htmlFor="saas-bill-city" className="text-xs">
                        City <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="saas-bill-city"
                        className="min-h-[44px] sm:min-h-9 text-sm min-w-0"
                        value={setupBillingForm.city}
                        onChange={(e) => {
                          setSetupBillingForm((p) => ({ ...p, city: e.target.value }))
                          setSetupBillingFieldErrors((er) => ({ ...er, city: undefined }))
                        }}
                        autoComplete="address-level2"
                      />
                      {setupBillingFieldErrors.city && (
                        <p className="text-[11px] text-destructive">{setupBillingFieldErrors.city}</p>
                      )}
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <Label htmlFor="saas-bill-state" className="text-xs">
                        State / region <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="saas-bill-state"
                        className="min-h-[44px] sm:min-h-9 text-sm min-w-0"
                        value={setupBillingForm.state}
                        onChange={(e) => {
                          setSetupBillingForm((p) => ({ ...p, state: e.target.value }))
                          setSetupBillingFieldErrors((er) => ({ ...er, state: undefined }))
                        }}
                        autoComplete="address-level1"
                      />
                      {setupBillingFieldErrors.state && (
                        <p className="text-[11px] text-destructive">{setupBillingFieldErrors.state}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                    <div className="space-y-1.5 min-w-0">
                      <Label htmlFor="saas-bill-postal" className="text-xs">
                        Postal code <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="saas-bill-postal"
                        className="min-h-[44px] sm:min-h-9 text-sm min-w-0"
                        value={setupBillingForm.postalCode}
                        onChange={(e) => {
                          setSetupBillingForm((p) => ({ ...p, postalCode: e.target.value }))
                          setSetupBillingFieldErrors((er) => ({ ...er, postalCode: undefined }))
                        }}
                        autoComplete="postal-code"
                      />
                      {setupBillingFieldErrors.postalCode && (
                        <p className="text-[11px] text-destructive">{setupBillingFieldErrors.postalCode}</p>
                      )}
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <Label htmlFor="saas-bill-country" className="text-xs">
                        Country <span className="text-destructive">*</span>
                      </Label>
                      <select
                        id="saas-bill-country"
                        className={cn(
                          "flex min-h-[44px] sm:min-h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        )}
                        value={setupBillingForm.country}
                        onChange={(e) => {
                          setSetupBillingForm((p) => ({ ...p, country: e.target.value }))
                          setSetupBillingFieldErrors((er) => ({ ...er, country: undefined }))
                        }}
                        autoComplete="country"
                      >
                        <option value="">Select country</option>
                        {billingCountrySelectOptions.map((o) => (
                          <option key={o.code} value={o.code}>
                            {o.name} ({o.code})
                          </option>
                        ))}
                      </select>
                      {setupBillingFieldErrors.country && (
                        <p className="text-[11px] text-destructive">{setupBillingFieldErrors.country}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {!setupClientSecret ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    First we save your billing contact to Stripe, then you can enter your card on the next step.
                  </p>
                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" className="min-h-[44px] sm:min-h-8" onClick={closePaymentSetupModal}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-[44px] sm:min-h-8"
                      onClick={() => void handlePrepareSetupIntent()}
                      disabled={setupBusy}
                    >
                      {setupBusy ? "Continuing…" : "Save payment method"}
                    </Button>
                  </div>
                </div>
              ) : hasStripe ? (
                <div className="space-y-3 min-w-0">
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Enter your card below, then tap <span className="font-medium text-foreground">Save payment method</span>{" "}
                    again.
                  </p>
                  <Elements stripe={stripePromise} options={{ clientSecret: setupClientSecret }}>
                    <SaasCardConfirmStep
                      onSuccess={handleSetupSuccess}
                      clientSecret={setupClientSecret}
                      billingValues={setupBillingForm}
                    />
                  </Elements>
                </div>
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
