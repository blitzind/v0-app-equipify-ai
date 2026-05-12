/**
 * Commercial SaaS tier identifiers for BlitzPay packaging (Phase 7A.2).
 * Independent of Stripe price IDs — deterministic normalization only.
 */
import type { PlanId } from "@/lib/plans"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"

export type CommercialProductTier = PlanId | "enterprise"

export const BLITZPAY_COMMERCIAL_TIER_RANK: Record<CommercialProductTier, number> = {
  solo: 0,
  core: 1,
  growth: 2,
  scale: 3,
  enterprise: 4,
}

export function normalizeCommercialProductTier(raw: string | null | undefined): CommercialProductTier | null {
  if (!raw?.trim()) return null
  const s = raw.trim().toLowerCase()
  if (s === "enterprise") return "enterprise"
  return normalizePlanIdForRead(s) as PlanId
}

export function tierRank(tier: CommercialProductTier): number {
  return BLITZPAY_COMMERCIAL_TIER_RANK[tier]
}

/** Strict ordering for upgrade recommendations. */
export function maxCommercialTier(a: CommercialProductTier, b: CommercialProductTier): CommercialProductTier {
  return tierRank(a) >= tierRank(b) ? a : b
}
