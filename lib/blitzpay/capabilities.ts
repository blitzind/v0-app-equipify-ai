/**
 * Central BlitzPay capability helpers for the Financial Command Center (FCC) and related surfaces.
 * Tier matrix lives in {@link fcc-tier-navigation}; org permissions and API RLS remain authoritative.
 */
import type { LucideIcon } from "lucide-react"
import type { CommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
import type { BlitzPaySurfaceMode } from "@/lib/blitzpay/blitzpay-capability-types"
import {
  BLITZPAY_FCC_SECTION_BY_ID,
  BLITZPAY_FCC_SECTION_IDS,
  type BlitzPayFccSectionCapabilityId,
  type BlitzPayFccSectionId,
} from "@/lib/blitzpay/sections"
import type { BlitzPayOverviewWidgetCapabilityId } from "@/lib/blitzpay/overview-widgets"
import { readBlitzPayTierGateEnforcement } from "@/lib/blitzpay/packaging-surface"
import {
  resolveFccTierSectionRoute,
  isFccSectionAllowedForTier,
} from "@/lib/blitzpay/fcc-tier-navigation"

export type BlitzPayCapabilityId = BlitzPayFccSectionCapabilityId | BlitzPayOverviewWidgetCapabilityId

export type BlitzPayFccNavSeedItem = {
  slug: BlitzPayFccSectionId
  label: string
  icon: LucideIcon
}

export type BlitzPayResolvedFccNavItem = BlitzPayFccNavSeedItem & {
  surface: BlitzPaySurfaceMode
  capabilityId: BlitzPayFccSectionCapabilityId
}

export { readBlitzPayTierGateEnforcement } from "@/lib/blitzpay/packaging-surface"

export function resolveBlitzPayFccSectionSurface(
  tier: CommercialProductTier | null | undefined,
  sectionId: BlitzPayFccSectionId,
  options: { enforceTierGates: boolean },
): BlitzPaySurfaceMode {
  return resolveFccTierSectionRoute(tier, sectionId, { strictEnforcement: options.enforceTierGates })
}

/** True when the full FCC panel may mount and fetch org-scoped APIs (not upgrade preview). */
export function blitzPayFccSectionAllowsClientDataLoad(
  tier: CommercialProductTier | null | undefined,
  sectionId: BlitzPayFccSectionId,
  options: { enforceTierGates: boolean },
): boolean {
  return resolveBlitzPayFccSectionSurface(tier, sectionId, options) === "enabled"
}

/**
 * FCC nav entries for the tier matrix. Omits non-enabled when billing is ready.
 * While billing is still loading, returns all seed items as `enabled` to avoid flicker.
 */
export function getVisibleBlitzPaySections(
  tier: CommercialProductTier | null | undefined,
  navItems: readonly BlitzPayFccNavSeedItem[],
  options: { enforceTierGates: boolean; billingReady: boolean },
): BlitzPayResolvedFccNavItem[] {
  if (!options.billingReady) {
    return navItems.map((item) => ({
      ...item,
      surface: "enabled" as const,
      capabilityId: BLITZPAY_FCC_SECTION_BY_ID[item.slug].capabilityId,
    }))
  }

  return navItems
    .map((item) => {
      const def = BLITZPAY_FCC_SECTION_BY_ID[item.slug]
      const surface = resolveBlitzPayFccSectionSurface(tier, item.slug, {
        enforceTierGates: options.enforceTierGates,
      })
      return { ...item, surface, capabilityId: def.capabilityId }
    })
    .filter((row) => row.surface === "enabled")
}

/** Slugs eligible for background chunk prefetch (tier-enabled only). */
export function getBlitzpayFccPrefetchAllowedSlugSet(
  tier: CommercialProductTier | null | undefined,
  _opts?: { enforceTierGates?: boolean },
): Set<string> {
  const out = new Set<string>()
  for (const id of BLITZPAY_FCC_SECTION_IDS) {
    if (isFccSectionAllowedForTier(tier, id)) out.add(id)
  }
  return out
}

/** Curated upgrade-preview routes that are not included on the current tier (empty when strict enforcement is on). */
export function getBlitzPayUpgradePreviewEligibleSectionIds(
  tier: CommercialProductTier | null | undefined,
  options: { enforceTierGates: boolean },
): BlitzPayFccSectionId[] {
  if (options.enforceTierGates) return []
  return BLITZPAY_FCC_SECTION_IDS.filter(
    (id) => resolveFccTierSectionRoute(tier, id, { strictEnforcement: false }) === "upgrade_preview",
  )
}
