/**
 * BlitzPay commercial / module entitlement foundations (Phase 7A → 7A.2).
 *
 * Product tiers: Solo, Core, Growth, Scale, Enterprise (`PlanId` + enterprise contract tier).
 * **Default:** permissive — {@link canAccessBlitzpayFeature} returns true unless `enforceTierGates` is enabled
 * (intended for future server guards / tests only; not enabled in production UI in Phase 7A.2).
 */

import {
  BLITZPAY_FEATURE_CATALOG,
  deriveBlitzpayModuleMinimumTiers,
  getBlitzpayFeatureCatalogRow,
  type BlitzpayFeatureKey,
} from "@/lib/billing/blitzpay-feature-catalog"
import type { CommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
import { normalizeCommercialProductTier, tierRank, maxCommercialTier } from "@/lib/billing/blitzpay-commercial-tier"
import type { BlitzpayCommercialModuleKey } from "@/lib/billing/blitzpay-module-registry"

export const BLITZPAY_ENTITLEMENTS_FOUNDATION_VERSION = "7a.2" as const

export type { CommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
export { normalizeCommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
export type { BlitzpayCommercialModuleKey } from "@/lib/billing/blitzpay-module-registry"
export type { BlitzpayFeatureKey } from "@/lib/billing/blitzpay-feature-catalog"

const MODULE_MIN_TIER: Record<BlitzpayCommercialModuleKey, CommercialProductTier> = deriveBlitzpayModuleMinimumTiers()

/**
 * Phase 7A.2 default: every module stays available on every tier (no customer-facing lockout).
 */
export function isBlitzpayModuleEnabledForTier(
  _plan: CommercialProductTier | null | undefined,
  _module: BlitzpayCommercialModuleKey,
): boolean {
  return true
}

/** True when the org's tier is below the **packaging** minimum for the module (preview for future gates). */
export function blitzpayModuleWouldBeGatedAtTier(
  plan: CommercialProductTier | null | undefined,
  module: BlitzpayCommercialModuleKey,
): boolean {
  if (!plan) return false
  return tierRank(plan) < tierRank(MODULE_MIN_TIER[module])
}

export function blitzpayModuleDisabledReason(
  plan: CommercialProductTier | null | undefined,
  module: BlitzpayCommercialModuleKey,
): string | null {
  if (!blitzpayModuleWouldBeGatedAtTier(plan, module)) return null
  return "This area is not included on your current plan. Ask an owner or billing admin about upgrading."
}

export function blitzpayCommercialUpgradeHint(module: BlitzpayCommercialModuleKey): string {
  const min = MODULE_MIN_TIER[module]
  return `Packaging reference: ${min} tier or higher — full access remains on during rollout; confirm contracts in Settings → Billing.`
}

export type BlitzpayEntitlementAccessOptions = {
  /**
   * When true, applies packaging tier minimums from the feature catalog.
   * **Keep false in production** until product explicitly enables hard gates server-side.
   */
  enforceTierGates?: boolean
}

/**
 * Server-safe: deterministic, no network. **Permissive by default** (`enforceTierGates` omitted/false).
 */
export function canAccessBlitzpayFeature(
  plan: CommercialProductTier | null | undefined,
  feature: BlitzpayFeatureKey,
  options?: BlitzpayEntitlementAccessOptions,
): boolean {
  if (!options?.enforceTierGates) return true
  const row = getBlitzpayFeatureCatalogRow(feature)
  if (!row) return true
  const effective = plan ?? "solo"
  return tierRank(effective) >= tierRank(row.minimumPackagingTier)
}

/** Features whose packaging minimum is satisfied by `tier`. */
export function getBlitzpayPlanFeatures(tier: CommercialProductTier | null | undefined): BlitzpayFeatureKey[] {
  const t = tier ?? "solo"
  return BLITZPAY_FEATURE_CATALOG.filter((f) => tierRank(t) >= tierRank(f.minimumPackagingTier)).map(
    (f) => f.key as BlitzpayFeatureKey,
  )
}

/** Smallest tier that covers all supplied features (max of each feature's minimum). */
export function getBlitzpayRecommendedTier(features: readonly BlitzpayFeatureKey[]): CommercialProductTier {
  let acc: CommercialProductTier = "solo"
  for (const k of features) {
    const row = getBlitzpayFeatureCatalogRow(k)
    if (row) acc = maxCommercialTier(acc, row.minimumPackagingTier)
  }
  return acc
}

export type BlitzpayEntitlementAuditSnapshot = {
  foundationVersion: typeof BLITZPAY_ENTITLEMENTS_FOUNDATION_VERSION
  resolvedTier: CommercialProductTier | null
  featureCatalogSize: number
  modulesThatWouldGateIfEnforced: BlitzpayCommercialModuleKey[]
  featuresBelowTierIfEnforced: BlitzpayFeatureKey[]
  enforcementModeEnabled: boolean
}

export function buildBlitzpayEntitlementAuditSnapshot(
  plan: CommercialProductTier | null | undefined,
  options?: BlitzpayEntitlementAccessOptions,
): BlitzpayEntitlementAuditSnapshot {
  const resolved = plan ?? null
  const effective = resolved ?? "solo"
  const modulesThatWouldGate = (Object.keys(MODULE_MIN_TIER) as BlitzpayCommercialModuleKey[]).filter((m) =>
    blitzpayModuleWouldBeGatedAtTier(effective, m),
  )
  const featuresBelowTier = BLITZPAY_FEATURE_CATALOG.filter(
    (f) => tierRank(effective) < tierRank(f.minimumPackagingTier),
  ).map((f) => f.key as BlitzpayFeatureKey)
  return {
    foundationVersion: BLITZPAY_ENTITLEMENTS_FOUNDATION_VERSION,
    resolvedTier: resolved,
    featureCatalogSize: BLITZPAY_FEATURE_CATALOG.length,
    modulesThatWouldGateIfEnforced: modulesThatWouldGate,
    featuresBelowTierIfEnforced: featuresBelowTier,
    enforcementModeEnabled: Boolean(options?.enforceTierGates),
  }
}

export {
  getBlitzpayUpgradeMetadata,
  getBlitzpayCommercialCategory,
  getBlitzpayCommercialLane,
  getBlitzpayPlanPackagingFootnote,
  blitzpayModuleMaturityStage,
  BLITZPAY_FUTURE_PRICING_MATRIX_PLACEHOLDER,
} from "@/lib/billing/blitzpay-commercial-packaging"
export type { BlitzpayUpgradeMetadata } from "@/lib/billing/blitzpay-commercial-packaging"
export { getBlitzpayPlanMetadata, BLITZPAY_PLAN_METADATA } from "@/lib/billing/blitzpay-plan-metadata"
export type { BlitzpayPlanMetadata } from "@/lib/billing/blitzpay-plan-metadata"
