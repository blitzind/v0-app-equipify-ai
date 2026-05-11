"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, RefreshCw, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useAdmin } from "@/lib/admin-store"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { blitzpayConnectOnboardingToastDescription } from "@/lib/blitzpay/connect-onboarding-client-messages"
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
  const { rawRole, status: permStatus } = useOrgPermissions()
  const { isPlatformAdmin } = useAdmin()
  const returnHandled = useRef(false)

  const canConfigure = isPlatformAdmin || rawRole === "owner" || rawRole === "admin"

  const [loading, setLoading] = useState(true)
  const [bp, setBp] = useState<BlitzPayStatusPayload | null>(null)
  const [enableBusy, setEnableBusy] = useState(false)
  const [linkBusy, setLinkBusy] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)

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
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgStatus, toast])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

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
  const statusLabel = STATUS_LABEL[statusKey] ?? statusKey.replace(/_/g, " ")
  const hasAccount = Boolean(bp?.stripe_connect_account_id && String(bp.stripe_connect_account_id).trim())
  const dueNow = asStringList(bp?.stripe_requirements_currently_due)
  const duePast = asStringList(bp?.stripe_requirements_past_due)

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" aria-hidden />
          <h1 className="text-lg font-semibold text-foreground">BlitzPay</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Accept card and ACH payments through Equipify using BlitzPay. This step connects your workspace to a Stripe
          Express account so you can get paid by your customers. Card charges and ACH collection arrive in a later
          release — for now, complete onboarding and keep this status current.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading BlitzPay status…
          </div>
        ) : (
          <div className="space-y-5">
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
            </dl>

            {(dueNow.length > 0 || duePast.length > 0) && (
              <div
                className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm"
                role="status"
              >
                <p className="font-medium text-foreground">Stripe needs more information</p>
                <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                  Your connected account has outstanding requirements. Continue onboarding in Stripe to finish setup.
                </p>
                {duePast.length > 0 ?
                  <p className="text-xs text-destructive mt-2">Past due: {duePast.join(", ")}</p>
                : null}
                {dueNow.length > 0 ?
                  <p className="text-xs text-muted-foreground mt-1">Currently due: {dueNow.join(", ")}</p>
                : null}
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
                disabled={!canConfigure || enableBusy || hasAccount}
                onClick={() => void handleEnable()}
              >
                {enableBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Enable BlitzPay
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={
                  !canConfigure || linkBusy || statusKey === "ready" || statusKey === "disabled"
                }
                onClick={() => void handleContinueOnboarding()}
              >
                {linkBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Continue onboarding
              </Button>
            </div>
          </div>
        )}
      </div>
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
