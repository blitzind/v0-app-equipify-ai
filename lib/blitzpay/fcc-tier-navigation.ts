/**
 * Tier-aware FCC navigation allow-lists (product matrix).
 * Progressive expansion by SaaS tier — independent of Stripe price IDs.
 */
import type { CommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
import { normalizeCommercialProductTier, tierRank } from "@/lib/billing/blitzpay-commercial-tier"
import type { BlitzPayFccSectionId } from "@/lib/blitzpay/sections"
import { BLITZPAY_FCC_SECTION_IDS } from "@/lib/blitzpay/sections"

/** Deep links that show a polished upgrade preview instead of redirecting (keep list small). */
export const FCC_TIER_UPGRADE_PREVIEW_SLUGS = [
  "multi-entity-finance",
  "enterprise-observability",
  "procurement-inventory",
  "financing-marketplace",
] as const satisfies readonly BlitzPayFccSectionId[]

const FCC_TIER_UPGRADE_PREVIEW_SET = new Set<string>(FCC_TIER_UPGRADE_PREVIEW_SLUGS)

const SOLO: readonly BlitzPayFccSectionId[] = [
  "overview",
  "collections",
  "billing-profiles",
  "executive-health",
]

const CORE_ADD: readonly BlitzPayFccSectionId[] = [
  "revenue-optimization",
  "recurring-revenue",
  "mobile-financial-ops",
  "ai-financial-copilot",
]

const GROWTH_ADD: readonly BlitzPayFccSectionId[] = [
  "payroll-commissions",
  "vendor-bills",
  "contractor-settlements",
  "operating-cash",
  "command-center-data",
  "internal-books",
]

const SCALE_ADD: readonly BlitzPayFccSectionId[] = [
  "multi-entity-finance",
  "enterprise-observability",
  "supplier-network",
  "tax-compliance",
  "procurement-inventory",
  "claims-protection",
  "financing-marketplace",
]

function effectiveTier(tier: CommercialProductTier | null | undefined): CommercialProductTier {
  return (normalizeCommercialProductTier(tier ?? undefined) ?? "solo") as CommercialProductTier
}

function sectionsForTierRank(rank: number): ReadonlySet<BlitzPayFccSectionId> {
  const out = new Set<BlitzPayFccSectionId>(SOLO)
  if (rank >= tierRank("core")) for (const s of CORE_ADD) out.add(s)
  if (rank >= tierRank("growth")) for (const s of GROWTH_ADD) out.add(s)
  if (rank >= tierRank("scale")) for (const s of SCALE_ADD) out.add(s)
  if (rank >= tierRank("enterprise")) for (const s of BLITZPAY_FCC_SECTION_IDS) out.add(s)
  return out
}

export function getFccTierAllowedSectionSet(tier: CommercialProductTier | null | undefined): Set<BlitzPayFccSectionId> {
  return new Set(sectionsForTierRank(tierRank(effectiveTier(tier))))
}

export function isFccSectionAllowedForTier(
  tier: CommercialProductTier | null | undefined,
  sectionId: BlitzPayFccSectionId,
): boolean {
  return getFccTierAllowedSectionSet(tier).has(sectionId)
}

export type FccTierRouteResolution = "enabled" | "hidden" | "upgrade_preview"

/**
 * Route + mount resolution for an FCC slug at a tier.
 * When `strictEnforcement` is true (legacy env), upgrade preview routes become `hidden` (redirect).
 */
export function resolveFccTierSectionRoute(
  tier: CommercialProductTier | null | undefined,
  sectionId: BlitzPayFccSectionId,
  options: { strictEnforcement: boolean },
): FccTierRouteResolution {
  if (isFccSectionAllowedForTier(tier, sectionId)) return "enabled"
  if (options.strictEnforcement) return "hidden"
  if (FCC_TIER_UPGRADE_PREVIEW_SET.has(sectionId)) return "upgrade_preview"
  return "hidden"
}
