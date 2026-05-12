/**
 * Commercial packaging helpers — deterministic, no Stripe subscription coupling (Phase 7A.2).
 */
import type { CommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
import { tierRank } from "@/lib/billing/blitzpay-commercial-tier"
import type { BlitzpayCommercialLane } from "@/lib/billing/blitzpay-feature-catalog"
import type { BlitzpayModuleClassification } from "@/lib/billing/blitzpay-feature-catalog"
import {
  BLITZPAY_FEATURE_CATALOG,
  getBlitzpayFeatureCatalogRow,
  type BlitzpayFeatureKey,
} from "@/lib/billing/blitzpay-feature-catalog"
import { getBlitzpayPlanMetadata } from "@/lib/billing/blitzpay-plan-metadata"
import type { BlitzpayCommercialSurfaceKey } from "@/lib/blitzpay/blitzpay-commercial-readiness"

export type BlitzpayMaturityStage = "launch" | "operate" | "optimize" | "govern"

const LANE_LABEL: Record<BlitzpayCommercialLane, string> = {
  solo_suite: "Solo suite",
  core_operations: "Core operations",
  growth_acceleration: "Growth acceleration",
  scale_network: "Scale & network",
  enterprise_control: "Enterprise control",
  platform_operations: "Platform operations",
}

/** Human label for commercial lane / upgrade badges. */
export function getBlitzpayCommercialCategory(featureKey: BlitzpayFeatureKey | string): string {
  const row = getBlitzpayFeatureCatalogRow(featureKey)
  if (!row) return "BlitzPay"
  return LANE_LABEL[row.commercialLane] ?? "BlitzPay"
}

export function getBlitzpayCommercialLane(featureKey: BlitzpayFeatureKey | string): BlitzpayCommercialLane | null {
  return getBlitzpayFeatureCatalogRow(featureKey)?.commercialLane ?? null
}

export function blitzpayModuleMaturityStage(args: { moduleClassification: BlitzpayModuleClassification }): BlitzpayMaturityStage {
  switch (args.moduleClassification) {
    case "foundational":
      return "launch"
    case "operational":
      return "operate"
    case "advanced":
      return "optimize"
    case "enterprise":
    case "platform_admin":
      return "govern"
    default:
      return "operate"
  }
}

export type BlitzpayUpgradeMetadata = {
  featureKey: BlitzpayFeatureKey
  featureLabel: string
  currentTier: CommercialProductTier
  /** Smallest tier that satisfies packaging for this feature. */
  recommendedTier: CommercialProductTier
  headline: string
  detail: string
  /** Relative path only — caller wraps with origin if needed. */
  billingSettingsPath: "/settings/billing"
}

export function getBlitzpayUpgradeMetadata(
  currentTier: CommercialProductTier | null | undefined,
  featureKey: BlitzpayFeatureKey,
): BlitzpayUpgradeMetadata | null {
  const row = getBlitzpayFeatureCatalogRow(featureKey)
  if (!row) return null
  const cur = currentTier ?? "solo"
  const recommended = row.minimumPackagingTier
  const meta = getBlitzpayPlanMetadata(recommended)
  const headline =
    tierRank(recommended) > tierRank(cur) ?
      `Typically packaged from ${meta.shortLabel}`
    : `Included in ${getBlitzpayPlanMetadata(cur).shortLabel} packaging reference`
  return {
    featureKey,
    featureLabel: row.label,
    currentTier: cur,
    recommendedTier: recommended,
    headline,
    detail: row.packagingHint,
    billingSettingsPath: "/settings/billing",
  }
}

/** Subtle footnote for staff BlitzPay surfaces — non-blocking, informational. */
export function getBlitzpayPlanPackagingFootnote(args: {
  effectiveTier: CommercialProductTier
  surface: BlitzpayCommercialSurfaceKey
}): string {
  const meta = getBlitzpayPlanMetadata(args.effectiveTier)
  const surfaceHint =
    args.surface === "platform_blitzpay_ops" ?
      "Tenant packaging tiers apply to customer orgs; this console is platform-only."
    : "BlitzPay stays fully available while packaging metadata catches up to your contract."
  return `${meta.label}: ${meta.positioning} ${surfaceHint}`
}

/** Placeholder matrix for future pricing pages — counts only, no currency. */
export const BLITZPAY_FUTURE_PRICING_MATRIX_PLACEHOLDER = {
  version: "7a.2-placeholder" as const,
  tiers: ["solo", "core", "growth", "scale", "enterprise"] as const,
  /** Feature rows × tier booleans derived from catalog mins (deterministic). */
  rows: BLITZPAY_FEATURE_CATALOG.map((f) => ({
    key: f.key,
    label: f.label,
    module: f.module,
    minimumPackagingTier: f.minimumPackagingTier,
  })),
}
