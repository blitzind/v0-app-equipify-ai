"use client"

import { useMemo } from "react"
import { useBillingAccess } from "@/lib/billing-access-context"
import { getEffectivePlanId } from "@/lib/billing/effective-plan"
import type { CommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
import { normalizeCommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
import { BLITZPAY_FCC_NAV_ITEMS } from "@/lib/navigation/blitzpay-financial-command-center-nav"
import {
  getBlitzpayFccPrefetchAllowedSlugSet,
  getVisibleBlitzPaySections,
  readBlitzPayTierGateEnforcement,
  resolveBlitzPayFccSectionSurface,
  type BlitzPayResolvedFccNavItem,
} from "@/lib/blitzpay/capabilities"
import { getVisibleOverviewWidgets, type BlitzPayResolvedOverviewWidget } from "@/lib/blitzpay/overview-widgets"
import type { BlitzPayFccSectionId } from "@/lib/blitzpay/sections"

function navSeeds() {
  return BLITZPAY_FCC_NAV_ITEMS.map((i) => ({ slug: i.slug, label: i.label, icon: i.icon }))
}

export type UseBlitzPayCapabilitiesResult = {
  billingReady: boolean
  /** Effective commercial tier (PlanId + enterprise) after trial normalization. */
  commercialTier: CommercialProductTier
  enforceTierGates: boolean
  /** FCC sidebar / mobile nav entries (hidden sections removed when billing is ready). */
  visibleFccSections: BlitzPayResolvedFccNavItem[]
  /** Overview widget rows for future Overview adoption (non-hidden only). */
  visibleOverviewWidgets: BlitzPayResolvedOverviewWidget[]
  prefetchAllowedSlugSet: Set<string> | null
  resolveFccSectionSurface: (slug: BlitzPayFccSectionId) => ReturnType<typeof resolveBlitzPayFccSectionSurface>
  fccSectionAllowsDataLoad: (slug: BlitzPayFccSectionId) => boolean
}

/**
 * Org-scoped BlitzPay capability snapshot for client surfaces (navigation, prefetch, gating).
 * Permissions stay in {@link useOrgPermissions}; this hook only reflects billing tier + packaging.
 */
export function useBlitzPayCapabilities(): UseBlitzPayCapabilitiesResult {
  const billing = useBillingAccess()
  const billingReady = billing.status === "ready"

  const commercialTier = useMemo(() => {
    if (!billingReady) return "solo" as CommercialProductTier
    const raw = billing.subscription?.plan_id ?? "solo"
    const effective = getEffectivePlanId(raw, billing.subscription)
    return (normalizeCommercialProductTier(effective) ?? "solo") as CommercialProductTier
  }, [billingReady, billing.subscription])

  const enforceTierGates = useMemo(() => readBlitzPayTierGateEnforcement(), [])

  const tierOptions = useMemo(
    () => ({ enforceTierGates, billingReady }),
    [enforceTierGates, billingReady],
  )

  const visibleFccSections = useMemo(
    () => getVisibleBlitzPaySections(commercialTier, navSeeds(), tierOptions),
    [commercialTier, tierOptions],
  )

  const visibleOverviewWidgets = useMemo(
    () => getVisibleOverviewWidgets(commercialTier, { enforceTierGates }),
    [commercialTier, enforceTierGates],
  )

  const prefetchAllowedSlugSet = useMemo(() => {
    if (!billingReady) return null
    return getBlitzpayFccPrefetchAllowedSlugSet(commercialTier, { enforceTierGates })
  }, [billingReady, commercialTier, enforceTierGates])

  const resolveFccSectionSurface = useMemo(() => {
    return (slug: BlitzPayFccSectionId) =>
      resolveBlitzPayFccSectionSurface(commercialTier, slug, { enforceTierGates })
  }, [commercialTier, enforceTierGates])

  const fccSectionAllowsDataLoad = useMemo(() => {
    return (slug: BlitzPayFccSectionId) =>
      resolveBlitzPayFccSectionSurface(commercialTier, slug, { enforceTierGates }) === "enabled"
  }, [commercialTier, enforceTierGates])

  return {
    billingReady,
    commercialTier,
    enforceTierGates,
    visibleFccSections,
    visibleOverviewWidgets,
    prefetchAllowedSlugSet,
    resolveFccSectionSurface,
    fccSectionAllowsDataLoad,
  }
}
