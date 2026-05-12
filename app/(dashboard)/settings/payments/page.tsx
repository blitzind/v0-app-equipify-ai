"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, CheckCircle2, Circle, Info, Loader2, RefreshCw, ShieldAlert, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useAdmin } from "@/lib/admin-store"
import { BlitzpayRevenueIntelligencePanel } from "@/components/blitzpay/blitzpay-revenue-intelligence-panel"
import { BlitzpayApPanel } from "@/components/blitzpay/blitzpay-ap-panel"
import { BlitzpayCollectionsCopilotPanel } from "@/components/blitzpay/blitzpay-collections-copilot-panel"
import { BlitzpayRecurringRevenuePanel } from "@/components/blitzpay/blitzpay-recurring-revenue-panel"
import { BlitzpayExecutiveDashboard } from "@/components/blitzpay/blitzpay-executive-dashboard"
import { BlitzpayFinancialCommandCenterPanel } from "@/components/blitzpay/blitzpay-financial-command-center-panel"
import { BlitzpayAccountingOverviewPanel } from "@/components/blitzpay/blitzpay-accounting-overview-panel"
import { BlitzpayApBillPayPanel } from "@/components/blitzpay/blitzpay-ap-bill-pay-panel"
import { BlitzpayTaxCompliancePanel } from "@/components/blitzpay/blitzpay-tax-compliance-panel"
import { BlitzpayFinancingMarketplacePanel } from "@/components/blitzpay/blitzpay-financing-marketplace-panel"
import { BlitzpayProcurementInventoryPanel } from "@/components/blitzpay/blitzpay-procurement-inventory-panel"
import { BlitzpayMobileFinancialOpsPanel } from "@/components/blitzpay/blitzpay-mobile-financial-ops-panel"
import { BlitzpayEnterpriseObservabilityPanel } from "@/components/blitzpay/blitzpay-enterprise-observability-panel"
import { BlitzpayPayrollDashboard } from "@/components/blitzpay/blitzpay-payroll-dashboard"
import { BlitzpayCommissionQueue } from "@/components/blitzpay/blitzpay-commission-queue"
import { BlitzpayVendorPayoutsPanel } from "@/components/blitzpay/blitzpay-vendor-payouts-panel"
import { BlitzpayCashAccountsPanel } from "@/components/blitzpay/blitzpay-cash-accounts-panel"
import { BlitzpayCollectionsEnginePanel } from "@/components/blitzpay/blitzpay-collections-engine-panel"
import { BlitzpayBillingProfilesPanel } from "@/components/blitzpay/blitzpay-billing-profiles-panel"
import { BlitzpayTreasuryPanel } from "@/components/blitzpay/blitzpay-treasury-panel"
import { WorkspaceInvoiceDefaultsCard } from "@/components/settings/workspace-invoice-defaults-card"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { blitzpayConnectOnboardingToastDescription } from "@/lib/blitzpay/connect-onboarding-client-messages"
import { formatBlitzpayUiLabel } from "@/lib/blitzpay/blitzpay-ui-labels"
import { cn } from "@/lib/utils"

type BlitzPayStatusPayload = {
  stripe_connect_account_id: string | null
  stripe_connect_status: string | null
  stripe_connect_onboarding_complete: boolean | null
  stripe_charges_enabled: boolean | null
  stripe_payouts_enabled: boolean | null
  stripe_details_submitted: boolean | null
  stripe_requirements_currently_due: unknown
  stripe_requirements_eventually_due: unknown
  stripe_requirements_past_due: unknown
  last_stripe_connect_sync_at: string | null
  blitzpay_last_onboarding_attempt_at?: string | null
  blitzpay_last_onboarding_failure_at?: string | null
  blitzpay_last_onboarding_error_category?: string | null
  blitzpay_last_stripe_request_id?: string | null
  settings?: {
    blitzpay_invoice_pay_enabled?: boolean
    blitzpay_pass_processing_fees_to_customer?: boolean
    blitzpay_fee_mode?: "merchant_absorbs" | "customer_pass_through" | "customer_partial_pass_through"
    blitzpay_fee_percentage_snapshot?: number
    blitzpay_fee_cap_cents?: number | null
    blitzpay_fee_disclosure_copy?: string
    blitzpay_payment_method_card_enabled?: boolean
    blitzpay_payment_method_ach_enabled?: boolean
    blitzpay_ach_convenience_fee_enabled?: boolean
    blitzpay_ach_processing_timeline_copy?: string
    blitzpay_allow_save_payment_methods?: boolean
    blitzpay_reminders_enabled?: boolean
    blitzpay_receipt_emails_enabled?: boolean
    blitzpay_financing_enabled?: boolean
    blitzpay_installment_plans_enabled?: boolean
    blitzpay_financing_monthly_estimate_disclosure?: string | null
  } | null
  payoutVisibility?: {
    estimatedNetPayoutCents: number
    estimatedStripeFeesCents: number
    recentOnlinePaymentTotalCents: number
    recentRefundedTotalCents: number
    reportingSource?: "balance_transactions" | "estimate"
    paidOutToBankCents?: number
    connectedAccountNetActivityCents?: number | null
    paymentMethodMix?: { card: number; us_bank_account: number; unknown: number }
    achSettlement?: { pending: number; settled: number; failed: number }
    payoutStatus: string
    blitzpayActivePaymentPlansCount?: number
    blitzpayFinancingSessionsTotal?: number
  } | null
  operationalAlerts?: Array<{ severity: "critical" | "warning" | "info"; code: string; message: string }>
  storedPaymentProfiles?: {
    totalProfiles: number
    withDefaultMethod: number
    lastUsedMethodMix: { card: number; us_bank_account: number; unknown: number }
  } | null
  stripeMode?: "test" | "live" | "unknown"
}

type BlitzpayLaunchChecklistItem = {
  id: string
  label: string
  ok: boolean
  detail: string
}

type PayoutLedgerPanelPayload = {
  payouts: Array<{
    id: string
    stripePayoutIdTail: string
    status: string
    amountCents: number
    currency: string
    arrivalDate: string | null
    stripeCreatedAt: string
    balanceTransactionCount: number
    balanceTransactionSyncedAt: string | null
  }>
  recentRuns: Array<{
    id: string
    trigger: string
    status: string
    payoutsTouched: number
    balanceTransactionsUpserted: number
    createdAt: string
    finishedAt: string | null
    error: string | null
  }>
  sinceIso: string
  balanceTransactionTotals: {
    activityRowCount: number
    sumGrossCents: number
    sumStripeFeesCents: number
    sumNetCents: number
    paymentLikeNetCents: number
    refundLikeNetCents: number
    disputeLikeNetCents: number
  }
  paidOutToBankCents: number
}

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  onboarding_started: "Onboarding started",
  action_required: "Action required",
  pending_verification: "Pending verification",
  ready: "Ready",
  disabled: "Disabled",
}

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === "string" && x.length > 0)
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return "—"
  }
}

function BlitzPaySettingsPageInner() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const orgPermissions = useOrgPermissions()
  const { rawRole, status: permStatus } = orgPermissions
  const canEditOrgInvoiceDefaults =
    orgPermissions.status === "ready" && orgPermissions.has("canEditOrgBilling")
  const { isPlatformAdmin } = useAdmin()
  const returnHandled = useRef(false)

  const canConfigure = isPlatformAdmin || rawRole === "owner" || rawRole === "admin"
  const canViewPayoutLedger =
    permStatus === "ready" && (orgPermissions.has("canViewFinancials") || orgPermissions.has("canEditInvoices"))
  const canViewBlitzpayRevenue =
    permStatus === "ready" &&
    (isPlatformAdmin ||
      orgPermissions.has("canViewFinancialReports") ||
      orgPermissions.has("canViewFinancials"))

  const canViewFinancialCommandCenter =
    permStatus === "ready" &&
    (isPlatformAdmin ||
      orgPermissions.has("canViewFinancialReports") ||
      orgPermissions.has("canViewFinancials"))

  const [loading, setLoading] = useState(true)
  const [bp, setBp] = useState<BlitzPayStatusPayload | null>(null)
  const [enableBusy, setEnableBusy] = useState(false)
  const [linkBusy, setLinkBusy] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)
  const [saveFeesBusy, setSaveFeesBusy] = useState(false)
  const [payoutLedgerLoading, setPayoutLedgerLoading] = useState(false)
  const [payoutLedgerSyncBusy, setPayoutLedgerSyncBusy] = useState(false)
  const [payoutLedgerPanel, setPayoutLedgerPanel] = useState<PayoutLedgerPanelPayload | null>(null)
  const [onlinePayEnabled, setOnlinePayEnabled] = useState(false)
  const [cardEnabled, setCardEnabled] = useState(true)
  const [achEnabled, setAchEnabled] = useState(false)
  const [achTimelineCopy, setAchTimelineCopy] = useState("Bank (ACH) payments can take 3-5 business days to settle.")
  const [saveMethodsEnabled, setSaveMethodsEnabled] = useState(true)
  const [remindersEnabled, setRemindersEnabled] = useState(true)
  const [receiptEmailsEnabled, setReceiptEmailsEnabled] = useState(true)
  const [financingEnabled, setFinancingEnabled] = useState(false)
  const [installmentPlansEnabled, setInstallmentPlansEnabled] = useState(false)
  const [financingMonthlyCopy, setFinancingMonthlyCopy] = useState("")
  const [launchLoading, setLaunchLoading] = useState(false)
  const [launchItems, setLaunchItems] = useState<BlitzpayLaunchChecklistItem[] | null>(null)
  const [launchScore, setLaunchScore] = useState<{ passed: number; total: number } | null>(null)
  const [launchPresentation, setLaunchPresentation] = useState<{ statusPhrase: string; subline: string } | null>(null)
  const [launchTechnicalItems, setLaunchTechnicalItems] = useState<BlitzpayLaunchChecklistItem[] | null>(null)

  const loadStatus = useCallback(async () => {
    if (!organizationId || orgStatus !== "ready") {
      setBp(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/status`, {
        cache: "no-store",
      })
      const json = (await res.json()) as { blitzpay?: BlitzPayStatusPayload; message?: string }
      if (!res.ok) {
        setBp(null)
        toast({
          variant: "destructive",
          title: "Could not load BlitzPay",
          description: json.message ?? res.statusText,
        })
        return
      }
      setBp((json.blitzpay as BlitzPayStatusPayload) ?? null)
      const s = (json.blitzpay as BlitzPayStatusPayload | undefined)?.settings
      if (s) {
        setOnlinePayEnabled(Boolean(s.blitzpay_invoice_pay_enabled))
        setCardEnabled(s.blitzpay_payment_method_card_enabled !== false)
        setAchEnabled(Boolean(s.blitzpay_payment_method_ach_enabled))
        setAchTimelineCopy(
          (s.blitzpay_ach_processing_timeline_copy ?? "Bank (ACH) payments can take 3-5 business days to settle.").trim(),
        )
        setSaveMethodsEnabled(s.blitzpay_allow_save_payment_methods !== false)
        setRemindersEnabled(s.blitzpay_reminders_enabled !== false)
        setReceiptEmailsEnabled(s.blitzpay_receipt_emails_enabled !== false)
        setFinancingEnabled(Boolean(s.blitzpay_financing_enabled))
        setInstallmentPlansEnabled(Boolean(s.blitzpay_installment_plans_enabled))
        setFinancingMonthlyCopy(
          typeof s.blitzpay_financing_monthly_estimate_disclosure === "string" ?
            s.blitzpay_financing_monthly_estimate_disclosure
          : "",
        )
      }
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgStatus, toast])

  const loadLaunchReadiness = useCallback(async () => {
    if (!organizationId || orgStatus !== "ready" || !canConfigure) {
      setLaunchItems(null)
      setLaunchScore(null)
      setLaunchPresentation(null)
      setLaunchTechnicalItems(null)
      return
    }
    setLaunchLoading(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/launch-readiness`,
        { cache: "no-store" },
      )
      const j = (await res.json()) as {
        checklist?: BlitzpayLaunchChecklistItem[]
        score?: { passed: number; total: number }
        presentation?: { statusPhrase: string; subline: string }
        technicalDiagnostics?: BlitzpayLaunchChecklistItem[]
        message?: string
      }
      if (!res.ok) {
        setLaunchItems(null)
        setLaunchScore(null)
        setLaunchPresentation(null)
        setLaunchTechnicalItems(null)
        return
      }
      setLaunchItems(j.checklist ?? null)
      setLaunchScore(j.score ?? null)
      setLaunchPresentation(j.presentation ?? null)
      setLaunchTechnicalItems(Array.isArray(j.technicalDiagnostics) ? j.technicalDiagnostics : null)
    } finally {
      setLaunchLoading(false)
    }
  }, [organizationId, orgStatus, canConfigure])

  useEffect(() => {
    void loadLaunchReadiness()
  }, [loadLaunchReadiness])

  const loadPayoutLedger = useCallback(async () => {
    if (!organizationId || orgStatus !== "ready" || !canViewPayoutLedger) {
      setPayoutLedgerPanel(null)
      return
    }
    setPayoutLedgerLoading(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/payout-ledger?since=${encodeURIComponent(
          new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        )}`,
        { cache: "no-store" },
      )
      const json = (await res.json()) as { payoutLedger?: PayoutLedgerPanelPayload; message?: string }
      if (!res.ok) {
        setPayoutLedgerPanel(null)
        return
      }
      setPayoutLedgerPanel(json.payoutLedger ?? null)
    } finally {
      setPayoutLedgerLoading(false)
    }
  }, [organizationId, orgStatus, canViewPayoutLedger])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    void loadPayoutLedger()
  }, [loadPayoutLedger])

  const runSync = useCallback(async () => {
    if (!organizationId) return
    setSyncBusy(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/sync`, {
        method: "POST",
      })
      const json = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Sync failed",
          description: blitzpayConnectOnboardingToastDescription(json.error, json.message ?? res.statusText),
        })
        return
      }
      toast({ title: "Status updated", description: "BlitzPay account details were refreshed." })
      await loadStatus()
    } finally {
      setSyncBusy(false)
    }
  }, [organizationId, loadStatus, toast])

  const runPayoutLedgerSync = useCallback(async () => {
    if (!organizationId || !canConfigure) return
    setPayoutLedgerSyncBusy(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/payout-ledger`, {
        method: "POST",
      })
      const json = (await res.json()) as { error?: string; message?: string; ok?: boolean }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Payout sync failed",
          description: json.message ?? json.error ?? res.statusText,
        })
        return
      }
      toast({ title: "Payout ledger synced", description: "Latest payouts and balance lines were pulled from Stripe." })
      await loadPayoutLedger()
      await loadStatus()
    } finally {
      setPayoutLedgerSyncBusy(false)
    }
  }, [organizationId, canConfigure, loadPayoutLedger, loadStatus, toast])

  useEffect(() => {
    if (!organizationId || orgStatus !== "ready") return
    const returned = searchParams.get("blitzpay_return") === "1"
    const refreshed = searchParams.get("blitzpay_refresh") === "1"
    if (!returned && !refreshed) {
      returnHandled.current = false
      return
    }
    if (returnHandled.current) return
    returnHandled.current = true
    router.replace("/settings/payments")
    toast({
      title: "BlitzPay onboarding returned",
      description: "Refreshing account status from Stripe…",
    })
    void (async () => {
      await runSync()
    })()
  }, [organizationId, orgStatus, searchParams, router, toast, runSync])

  async function handleEnable() {
    if (!organizationId || !canConfigure) return
    setEnableBusy(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/enable`, {
        method: "POST",
      })
      const json = (await res.json()) as { error?: string; message?: string; alreadyHadAccount?: boolean }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Could not enable BlitzPay",
          description: blitzpayConnectOnboardingToastDescription(json.error, json.message ?? res.statusText),
        })
        return
      }
      toast({
        title: json.alreadyHadAccount ? "BlitzPay already enabled" : "BlitzPay enabled",
        description: json.alreadyHadAccount
          ? "Your workspace already had a connected account. Status was refreshed."
          : "A Stripe Express account was created for this workspace.",
      })
      await loadStatus()
    } finally {
      setEnableBusy(false)
    }
  }

  async function handleContinueOnboarding() {
    if (!organizationId || !canConfigure) return
    setLinkBusy(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/account-link`, {
        method: "POST",
      })
      const json = (await res.json()) as { url?: string; error?: string; message?: string }
      if (!res.ok || !json.url) {
        toast({
          variant: "destructive",
          title: "Could not start onboarding",
          description: blitzpayConnectOnboardingToastDescription(json.error, json.message ?? res.statusText),
        })
        return
      }
      window.location.href = json.url
    } finally {
      setLinkBusy(false)
    }
  }

  async function handleSavePaymentSettings() {
    if (!organizationId || !canConfigure) return
    setSaveFeesBusy(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blitzpay_invoice_pay_enabled: onlinePayEnabled,
          blitzpay_payment_method_card_enabled: cardEnabled,
          blitzpay_payment_method_ach_enabled: achEnabled,
          blitzpay_ach_processing_timeline_copy: achTimelineCopy,
          blitzpay_allow_save_payment_methods: saveMethodsEnabled,
          blitzpay_reminders_enabled: remindersEnabled,
          blitzpay_receipt_emails_enabled: receiptEmailsEnabled,
          blitzpay_financing_enabled: financingEnabled,
          blitzpay_installment_plans_enabled: installmentPlansEnabled,
          blitzpay_financing_monthly_estimate_disclosure: financingMonthlyCopy.trim() || null,
        }),
      })
      const j = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Could not save payment settings",
          description: j.message ?? j.error ?? res.statusText,
        })
        return
      }
      toast({ title: "Payment settings saved" })
      await loadStatus()
      await loadLaunchReadiness()
    } finally {
      setSaveFeesBusy(false)
    }
  }

  if (orgStatus !== "ready" || !organizationId) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading workspace…
      </div>
    )
  }

  if (permStatus !== "ready") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading permissions…
      </div>
    )
  }

  const statusKey = bp?.stripe_connect_status ?? "not_started"
  const statusLabel = STATUS_LABEL[statusKey] ?? formatBlitzpayUiLabel(statusKey)
  const hasAccount = Boolean(bp?.stripe_connect_account_id && String(bp.stripe_connect_account_id).trim())
  const dueNow = asStringList(bp?.stripe_requirements_currently_due)
  const duePast = asStringList(bp?.stripe_requirements_past_due)
  const hasRequirementsDue = dueNow.length > 0 || duePast.length > 0
  const onboardingComplete = Boolean(bp?.stripe_connect_onboarding_complete)
  const chargesEnabled = Boolean(bp?.stripe_charges_enabled)
  const canContinueOnboarding = hasAccount && (!onboardingComplete || hasRequirementsDue)
  const canEnableBlitzpay =
    !enableBusy &&
    canConfigure &&
    (!hasAccount || (onboardingComplete && chargesEnabled && !hasRequirementsDue))

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Payments</h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Connect BlitzPay to accept customer payments, and set workspace-wide payment terms for{" "}
          <strong className="font-medium text-foreground/90">customer invoices</strong> you create in Equipify.
        </p>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">BlitzPay</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Accept card and ACH payments through Equipify using BlitzPay. This step connects your workspace to a Stripe
          Express account so you can get paid by your customers. Card charges and ACH collection arrive in a later
          release — for now, complete onboarding and keep this status current.
        </p>
      </div>

      <div className="w-full min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading BlitzPay status…
          </div>
        ) : (
          <div className="space-y-5">
            {bp?.operationalAlerts && bp.operationalAlerts.length > 0 ? (
              <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                <p className="text-xs font-semibold text-foreground">Operational signals</p>
                <ul className="space-y-1.5">
                  {bp.operationalAlerts.map((a) => (
                    <li key={a.code} className="flex items-start gap-2 text-[11px] leading-snug">
                      {a.severity === "critical" ? (
                        <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" aria-hidden />
                      ) : a.severity === "warning" ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
                      ) : (
                        <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
                      )}
                      <span className="text-muted-foreground">{a.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                <p className={cn("text-sm font-semibold mt-0.5", statusKey === "ready" && "text-emerald-700")}>
                  {statusLabel}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={syncBusy || !hasAccount}
                onClick={() => void runSync()}
              >
                {syncBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                Refresh status
              </Button>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">Charges enabled</dt>
                <dd className="font-medium">{bp?.stripe_charges_enabled ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Payouts enabled</dt>
                <dd className="font-medium">{bp?.stripe_payouts_enabled ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Details submitted</dt>
                <dd className="font-medium">{bp?.stripe_details_submitted ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Onboarding complete</dt>
                <dd className="font-medium">{bp?.stripe_connect_onboarding_complete ? "Yes" : "No"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-xs">Last synced</dt>
                <dd className="font-medium">{formatWhen(bp?.last_stripe_connect_sync_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Environment mode</dt>
                <dd className="font-medium">{bp?.stripeMode === "live" ? "Live mode" : bp?.stripeMode === "test" ? "Test mode" : "Unknown"}</dd>
              </div>
            </dl>

            {hasRequirementsDue && (
              <div
                className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm"
                role="status"
              >
                <p className="font-medium text-foreground">Stripe needs more information before BlitzPay can accept payments.</p>
                <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                  Your connected account has outstanding requirements. Continue onboarding in Stripe to finish setup.
                </p>
                <details className="mt-2">
                  <summary className="text-[11px] text-muted-foreground cursor-pointer">Developer details</summary>
                  {duePast.length > 0 ? (
                    <p className="text-[11px] text-destructive mt-1">Past due keys: {duePast.join(", ")}</p>
                  ) : null}
                  {dueNow.length > 0 ? (
                    <p className="text-[11px] text-muted-foreground mt-1">Currently due keys: {dueNow.join(", ")}</p>
                  ) : null}
                </details>
              </div>
            )}

            {!canConfigure ?
              <p className="text-xs text-muted-foreground border-t border-border pt-3">
                Only workspace owners and admins can enable BlitzPay or open Stripe onboarding. You can still review
                this page.
              </p>
            : null}

            <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
              <Button
                type="button"
                disabled={!canEnableBlitzpay}
                onClick={() => void handleEnable()}
              >
                {enableBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Enable BlitzPay
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!canConfigure || linkBusy || !canContinueOnboarding}
                onClick={() => void handleContinueOnboarding()}
              >
                {linkBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Continue onboarding
              </Button>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-semibold">Online payments</p>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={onlinePayEnabled}
                  onChange={(e) => setOnlinePayEnabled(e.target.checked)}
                  disabled={!canConfigure || !bp?.stripe_charges_enabled}
                />
                Enable BlitzPay hosted checkout
              </label>
              {!bp?.stripe_charges_enabled ? (
                <p className="text-[11px] text-muted-foreground">
                  Stripe charges must be enabled before online payments can be turned on.
                </p>
              ) : null}

              <p className="text-xs font-semibold">BlitzPay fee policy</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                BlitzPay online payment fees are managed by Equipify. If enabled for your account, customers will see
                the processing fee before paying online.
              </p>
              <p className="text-xs font-semibold">Accepted payment methods</p>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={cardEnabled}
                  onChange={(e) => setCardEnabled(e.target.checked)}
                  disabled={!canConfigure}
                />
                Card
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={achEnabled}
                  onChange={(e) => setAchEnabled(e.target.checked)}
                  disabled={!canConfigure}
                />
                Bank transfer (ACH)
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={saveMethodsEnabled}
                  onChange={(e) => setSaveMethodsEnabled(e.target.checked)}
                  disabled={!canConfigure}
                />
                Allow Checkout to save payment methods for future invoices
              </label>
              <p className="text-xs font-semibold pt-2 border-t border-border mt-2">Communications & collections</p>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={remindersEnabled}
                  onChange={(e) => setRemindersEnabled(e.target.checked)}
                  disabled={!canConfigure}
                />
                Send automated payment reminder emails (BlitzPay collections)
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={receiptEmailsEnabled}
                  onChange={(e) => setReceiptEmailsEnabled(e.target.checked)}
                  disabled={!canConfigure}
                />
                Send automatic payment receipt emails after successful checkout
              </label>
              <p className="text-xs font-semibold pt-2 border-t border-border mt-2">Revenue acceleration (Phase 2O)</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Financing workflows are provider-agnostic placeholders — Equipify does not make lending decisions.
                Installment plans schedule expectations; payments still post through BlitzPay and standard invoice
                payments.
              </p>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={financingEnabled}
                  onChange={(e) => setFinancingEnabled(e.target.checked)}
                  disabled={!canConfigure}
                />
                Enable financing-ready messaging on quotes and portal
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={installmentPlansEnabled}
                  onChange={(e) => setInstallmentPlansEnabled(e.target.checked)}
                  disabled={!canConfigure}
                />
                Allow staged / installment payment plans on invoices
              </label>
              <label className="text-xs text-muted-foreground block">
                Optional monthly estimate copy (include the literal token {"{{amount}}"} for the estimate total)
                <textarea
                  className="mt-1 w-full min-h-[72px] rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  value={financingMonthlyCopy}
                  onChange={(e) => setFinancingMonthlyCopy(e.target.value)}
                  disabled={!canConfigure || !financingEnabled}
                  placeholder="Example: illustrative payment plans may be available for projects around {{amount}}."
                />
              </label>
              {bp?.payoutVisibility?.blitzpayActivePaymentPlansCount != null ? (
                <p className="text-[11px] text-muted-foreground">
                  Active installment plans (org): {bp.payoutVisibility.blitzpayActivePaymentPlansCount} · Financing
                  sessions: {bp.payoutVisibility.blitzpayFinancingSessionsTotal ?? 0}
                </p>
              ) : null}
              <label className="text-xs text-muted-foreground block">
                ACH timing guidance
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                  value={achTimelineCopy}
                  onChange={(e) => setAchTimelineCopy(e.target.value)}
                  disabled={!canConfigure || !achEnabled}
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="text-xs text-muted-foreground">
                  Payout visibility (last 30 days)
                  <p className="mt-1 text-sm text-foreground">
                    {bp?.payoutVisibility?.reportingSource === "balance_transactions" ? "Net (Stripe ledger)" : "Est. net payout"}
                    :{" "}
                    {bp?.payoutVisibility
                      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                          bp.payoutVisibility.estimatedNetPayoutCents / 100,
                        )
                      : "—"}
                  </p>
                  <p className="text-[11px]">
                    Online volume:{" "}
                    {bp?.payoutVisibility
                      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                          bp.payoutVisibility.recentOnlinePaymentTotalCents / 100,
                        )
                      : "—"}
                  </p>
                  {bp?.payoutVisibility?.paidOutToBankCents != null && bp.payoutVisibility.paidOutToBankCents > 0 ? (
                    <p className="text-[11px] mt-0.5">
                      Paid out to bank (synced):{" "}
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                        bp.payoutVisibility.paidOutToBankCents / 100,
                      )}
                    </p>
                  ) : null}
                  {bp?.payoutVisibility?.paymentMethodMix ? (
                    <p className="text-[11px] mt-0.5">
                      Method mix — card: {bp.payoutVisibility.paymentMethodMix.card}, ACH:{" "}
                      {bp.payoutVisibility.paymentMethodMix.us_bank_account}
                    </p>
                  ) : null}
                  {bp?.payoutVisibility?.achSettlement ? (
                    <p className="text-[11px] mt-0.5">
                      ACH states — pending: {bp.payoutVisibility.achSettlement.pending}, settled:{" "}
                      {bp.payoutVisibility.achSettlement.settled}
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Deposits and payouts are handled by Stripe based on your connected account schedule. Refunds and disputes can affect net deposits.
              </p>
              <Button type="button" size="sm" onClick={() => void handleSavePaymentSettings()} disabled={!canConfigure || saveFeesBusy}>
                {saveFeesBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save payment settings
              </Button>
              {bp?.storedPaymentProfiles ? (
                <div className="rounded-md border border-border/80 p-2 text-[11px] space-y-0.5">
                  <p className="font-medium text-foreground">Stored payment profiles (staff)</p>
                  <p className="text-muted-foreground">
                    Profiles: {bp.storedPaymentProfiles.totalProfiles} · with default: {bp.storedPaymentProfiles.withDefaultMethod}
                  </p>
                  <p className="text-muted-foreground">
                    Last used mix — card: {bp.storedPaymentProfiles.lastUsedMethodMix.card}, ACH:{" "}
                    {bp.storedPaymentProfiles.lastUsedMethodMix.us_bank_account}
                  </p>
                </div>
              ) : null}

              {canConfigure ? (
                <div className="border-t border-border pt-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold">Launch readiness</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      disabled={launchLoading}
                      onClick={() => void loadLaunchReadiness()}
                    >
                      {launchLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                      Refresh checklist
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    High-level checks before you take live payments: platform readiness, your Stripe connection, invoice
                    pay settings, email, reminders, and a successful test charge.
                  </p>
                  {launchLoading && !launchItems ? (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading checklist…
                    </p>
                  ) : launchScore && launchItems && launchItems.length > 0 ? (
                    <>
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-foreground">
                          Launch readiness: {launchPresentation?.statusPhrase ?? "—"}
                        </p>
                        {launchPresentation?.subline ? (
                          <p className="text-[11px] text-muted-foreground">{launchPresentation.subline}</p>
                        ) : null}
                      </div>
                      <ul className="space-y-1.5">
                        {launchItems.map((item) => (
                          <li key={item.id} className="flex items-start gap-2 text-[11px]">
                            {item.ok ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
                            )}
                            <span>
                              <span className="font-medium text-foreground">{item.label}</span>
                              <span className="text-muted-foreground"> — {item.detail}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                      {launchTechnicalItems && launchTechnicalItems.length > 0 ? (
                        <details className="rounded-md border border-border/80 bg-muted/20 px-2 py-1.5 text-[11px]">
                          <summary className="cursor-pointer font-medium text-foreground select-none">
                            Technical details (Equipify platform)
                          </summary>
                          <p className="text-muted-foreground mt-1.5 mb-1 leading-relaxed">
                            Environment variables, schema probe output, and migration-related signals. For full org-wide
                            tools open{" "}
                            <Link href="/admin" className="text-primary underline-offset-2 hover:underline">
                              Admin → BlitzPay Ops
                            </Link>{" "}
                            and select the BlitzPay Ops tab.
                          </p>
                          <ul className="space-y-1 border-t border-border/60 pt-1.5 mt-1.5">
                            {launchTechnicalItems.map((item) => (
                              <li key={item.id} className="flex items-start gap-2 font-mono text-[10px] leading-snug">
                                {item.ok ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
                                ) : (
                                  <Circle className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
                                )}
                                <span>
                                  <span className="font-medium text-foreground">{item.label}</span>
                                  <span className="text-muted-foreground"> — {item.detail}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Checklist unavailable.</p>
                  )}
                </div>
              ) : null}

              {canViewBlitzpayRevenue && organizationId ? (
                <div className="border-t border-border pt-4">
                  <BlitzpayRevenueIntelligencePanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
                </div>
              ) : null}

              {canViewFinancialCommandCenter && organizationId ? (
                <div id="blitzpay-executive-dashboard-anchor" className="border-t border-border pt-4">
                  <BlitzpayExecutiveDashboard organizationId={organizationId} orgReady={orgStatus === "ready"} />
                </div>
              ) : null}

              {canViewFinancialCommandCenter && organizationId ? (
                <div id="blitzpay-cash-accounts-anchor" className="border-t border-border pt-4">
                  <BlitzpayCashAccountsPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
                </div>
              ) : null}

              {canViewFinancialCommandCenter && organizationId ? (
                <div id="blitzpay-payroll-anchor" className="border-t border-border pt-4 space-y-4">
                  <BlitzpayPayrollDashboard organizationId={organizationId} orgReady={orgStatus === "ready"} />
                  <BlitzpayCommissionQueue organizationId={organizationId} orgReady={orgStatus === "ready"} />
                  <BlitzpayVendorPayoutsPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
                </div>
              ) : null}

              {canViewFinancialCommandCenter && organizationId ? (
                <div className="border-t border-border pt-4">
                  <BlitzpayRecurringRevenuePanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
                </div>
              ) : null}

              {canViewFinancialCommandCenter && organizationId ? (
                <div className="border-t border-border pt-4">
                  <BlitzpayCollectionsCopilotPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
                </div>
              ) : null}

              {canViewFinancialCommandCenter && organizationId ? (
                <div id="blitzpay-collections-engine-anchor" className="border-t border-border pt-4">
                  <BlitzpayCollectionsEnginePanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
                </div>
              ) : null}

              {canViewFinancialCommandCenter && organizationId ? (
                <div id="blitzpay-billing-profiles-anchor" className="border-t border-border pt-4">
                  <BlitzpayBillingProfilesPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
                </div>
              ) : null}

              {canViewFinancialCommandCenter && organizationId ? (
                <div id="blitzpay-financial-command-center-anchor" className="border-t border-border pt-4">
                  <BlitzpayFinancialCommandCenterPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
                </div>
              ) : null}

              {canViewFinancialCommandCenter && organizationId ? (
                <div id="blitzpay-accounting-overview-anchor" className="border-t border-border pt-4">
                  <BlitzpayAccountingOverviewPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
                </div>
              ) : null}

              {canViewFinancialCommandCenter && organizationId ? (
                <div className="border-t border-border pt-4">
                  <BlitzpayApBillPayPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
                </div>
              ) : null}

              {canViewFinancialCommandCenter && organizationId ? (
                <div className="border-t border-border pt-4">
                  <BlitzpayTaxCompliancePanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
                </div>
              ) : null}

              {canViewFinancialCommandCenter && organizationId ? (
                <div className="border-t border-border pt-4">
                  <BlitzpayFinancingMarketplacePanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
                </div>
              ) : null}

              {canViewFinancialCommandCenter && organizationId ? (
                <div className="border-t border-border pt-4">
                  <BlitzpayProcurementInventoryPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
                </div>
              ) : null}

              {canViewFinancialCommandCenter && organizationId ? (
                <div id="blitzpay-mobile-financial-ops-anchor" className="border-t border-border pt-4">
                  <BlitzpayMobileFinancialOpsPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
                </div>
              ) : null}

              {canViewFinancialCommandCenter && organizationId ? (
                <div className="border-t border-border pt-4">
                  <BlitzpayEnterpriseObservabilityPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
                </div>
              ) : null}
            </div>

              {canViewPayoutLedger && hasAccount ? (
              <div className="border-t border-border pt-4 space-y-4">
                <BlitzpayTreasuryPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
                <BlitzpayApPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
                <div id="blitzpay-payout-ledger-anchor" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold">Payout ledger (staff)</p>
                  {canConfigure ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={payoutLedgerSyncBusy}
                      onClick={() => void runPayoutLedgerSync()}
                    >
                      {payoutLedgerSyncBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Sync from Stripe
                    </Button>
                  ) : null}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Operational finance data from Stripe Connect payouts and balance transactions. Not shown to portal
                  customers. Sync after payouts settle or when troubleshooting reconciliation.
                </p>
                {payoutLedgerLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading payout ledger…
                  </div>
                ) : payoutLedgerPanel ? (
                  <div className="space-y-3 text-xs">
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <p className="font-medium text-foreground">Last 30 days (synced activity)</p>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-[11px]">
                        <div>
                          <dt className="text-muted-foreground">Balance tx rows</dt>
                          <dd className="font-medium">{payoutLedgerPanel.balanceTransactionTotals.activityRowCount}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Stripe fees (sum)</dt>
                          <dd className="font-medium">
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                              payoutLedgerPanel.balanceTransactionTotals.sumStripeFeesCents / 100,
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Net activity</dt>
                          <dd className="font-medium">
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                              payoutLedgerPanel.balanceTransactionTotals.sumNetCents / 100,
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Paid out (paid payouts)</dt>
                          <dd className="font-medium">
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                              payoutLedgerPanel.paidOutToBankCents / 100,
                            )}
                          </dd>
                        </div>
                      </dl>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Refund-like net:{" "}
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                          payoutLedgerPanel.balanceTransactionTotals.refundLikeNetCents / 100,
                        )}
                        {" · "}
                        Dispute-like net:{" "}
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                          payoutLedgerPanel.balanceTransactionTotals.disputeLikeNetCents / 100,
                        )}
                      </p>
                    </div>
                    {payoutLedgerPanel.payouts.length > 0 ? (
                      <div className="min-w-0 max-w-full overflow-x-auto rounded-lg border border-border">
                        <table className="w-full min-w-0 text-left text-sm">
                          <thead className="bg-muted/40">
                            <tr>
                              <th className="p-2 font-medium">Arrival</th>
                              <th className="p-2 font-medium">Status</th>
                              <th className="p-2 font-medium text-right">Amount</th>
                              <th className="p-2 font-medium text-right">BTs</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payoutLedgerPanel.payouts.map((p) => (
                              <tr key={p.id} className="border-t border-border">
                                <td className="p-2">{p.arrivalDate ?? formatWhen(p.stripeCreatedAt)}</td>
                                <td className="p-2">{p.status}</td>
                                <td className="p-2 text-right font-medium">
                                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                                    p.amountCents / 100,
                                  )}
                                </td>
                                <td className="p-2 text-right text-muted-foreground">{p.balanceTransactionCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">No payouts stored yet — run sync or wait for payout webhooks.</p>
                    )}
                    {payoutLedgerPanel.recentRuns.length > 0 ? (
                      <details className="text-[11px]">
                        <summary className="cursor-pointer text-muted-foreground">Recent reconciliation runs</summary>
                        <ul className="mt-2 space-y-1 list-disc pl-4">
                          {payoutLedgerPanel.recentRuns.map((r) => (
                            <li key={r.id}>
                              {formatWhen(r.createdAt)} — {r.trigger} {r.status}{" "}
                              {r.payoutsTouched > 0 ? `(${r.payoutsTouched} payouts)` : ""}
                              {r.error ? ` — ${r.error}` : ""}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Could not load payout ledger.</p>
                )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <WorkspaceInvoiceDefaultsCard
        organizationId={organizationId}
        canEdit={canEditOrgInvoiceDefaults}
      />
    </div>
  )
}

export default function BlitzPaySettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      }
    >
      <BlitzPaySettingsPageInner />
    </Suspense>
  )
}
