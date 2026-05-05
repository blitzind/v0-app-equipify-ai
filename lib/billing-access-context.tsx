"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import {
  getOrganizationSubscription,
  isTrialActive,
  type OrganizationSubscription,
} from "@/lib/billing/subscriptions"
import { getUsageWithLimits, planIdFromSubscriptionRow, type UsageWithLimits } from "@/lib/billing/usage"
import {
  evaluateEquipmentCreate,
  evaluateSeatInvite,
  evaluateStandardCreate,
  type RecordEligibility,
} from "@/lib/billing/record-eligibility"
import {
  canAccessAiInsights,
  canAccessApiFeatures,
  canAccessMaintenancePlansFeature,
} from "@/lib/billing/feature-access"

type BillingAccessContextValue = {
  status: "loading" | "ready"
  subscription: OrganizationSubscription | null
  usagePack: UsageWithLimits | null
  /** Active + invited members (for seat limit when inviting). */
  seatSlotsUsed: number | null
  refresh: () => Promise<void>
  standardCreateEligibility: RecordEligibility
  equipmentCreateEligibility: RecordEligibility
  seatInviteEligibility: RecordEligibility
  insightsAllowed: boolean
  maintenancePlansFeatureAllowed: boolean
  apiFeaturesAllowed: boolean
}

const BillingAccessContext = createContext<BillingAccessContextValue | null>(null)

export function BillingAccessProvider({ children }: { children: ReactNode }) {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready">("loading")
  const [subscription, setSubscription] = useState<OrganizationSubscription | null>(null)
  const [usagePack, setUsagePack] = useState<UsageWithLimits | null>(null)
  const [seatSlotsUsed, setSeatSlotsUsed] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (orgStatus !== "ready" || !organizationId) {
      setLoadStatus("loading")
      return
    }

    setLoadStatus("loading")
    const supabase = createBrowserSupabaseClient()

    try {
      const row = await getOrganizationSubscription(supabase, organizationId)
      setSubscription(row)
      const planId = planIdFromSubscriptionRow(row?.plan_id)
      const trialOn = row ? isTrialActive(row) : false
      const pack = await getUsageWithLimits(supabase, organizationId, planId, trialOn)
      setUsagePack(pack)

      const { count, error: seatErr } = await supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .in("status", ["active", "invited"])

      if (seatErr) {
        setSeatSlotsUsed(null)
      } else {
        setSeatSlotsUsed(count ?? 0)
      }
    } catch {
      setSubscription(null)
      setUsagePack(null)
      setSeatSlotsUsed(null)
    } finally {
      setLoadStatus("ready")
    }
  }, [organizationId, orgStatus])

  useEffect(() => {
    if (orgStatus !== "ready" || !organizationId) {
      setSubscription(null)
      setUsagePack(null)
      setSeatSlotsUsed(null)
      setLoadStatus(orgStatus === "loading" ? "loading" : "ready")
      return
    }
    void load()
  }, [organizationId, orgStatus, load])

  const planIdRaw = subscription?.plan_id ?? "solo"

  const value = useMemo<BillingAccessContextValue>(() => {
    const standardCreateEligibility = evaluateStandardCreate(subscription)
    const equipmentCreateEligibility = evaluateEquipmentCreate(subscription, usagePack)
    const seatInviteEligibility = evaluateSeatInvite(subscription, usagePack, seatSlotsUsed)

    return {
      status: loadStatus,
      subscription,
      usagePack,
      seatSlotsUsed,
      refresh: load,
      standardCreateEligibility,
      equipmentCreateEligibility,
      seatInviteEligibility,
      insightsAllowed: canAccessAiInsights(planIdRaw, subscription),
      maintenancePlansFeatureAllowed: canAccessMaintenancePlansFeature(planIdRaw, subscription),
      apiFeaturesAllowed: canAccessApiFeatures(planIdRaw, subscription),
    }
  }, [subscription, usagePack, seatSlotsUsed, loadStatus, planIdRaw, load])

  return <BillingAccessContext.Provider value={value}>{children}</BillingAccessContext.Provider>
}

export function useBillingAccess() {
  const ctx = useContext(BillingAccessContext)
  if (!ctx) {
    throw new Error("useBillingAccess must be used within BillingAccessProvider")
  }
  return ctx
}

/** Safe when provider might be absent (e.g. tests); returns permissive defaults. */
export function useBillingAccessOptional(): BillingAccessContextValue | null {
  return useContext(BillingAccessContext)
}
