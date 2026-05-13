/**
 * Shared deterministic resolution of BlitzPay surface modes from SaaS tier + packaging metadata.
 * Used by FCC sections, overview widgets, and future BlitzPay shells.
 */
import type { CommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
import { normalizeCommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
import { getBlitzpayPlanMetadata } from "@/lib/billing/blitzpay-plan-metadata"
import { blitzpayModuleWouldBeGatedAtTier, canAccessBlitzpayFeature } from "@/lib/billing/blitzpay-entitlements"
import type { BlitzpayFeatureKey } from "@/lib/billing/blitzpay-feature-catalog"
import type { BlitzpayCommercialModuleKey } from "@/lib/billing/blitzpay-module-registry"
import type { BlitzPaySurfaceMode } from "@/lib/blitzpay/blitzpay-capability-types"

export function readBlitzPayTierGateEnforcement(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.env?.NEXT_PUBLIC_BLITZPAY_ENFORCE_TIER_GATES === "string" &&
    process.env.NEXT_PUBLIC_BLITZPAY_ENFORCE_TIER_GATES === "true"
  )
}

function effectiveTier(tier: CommercialProductTier | null | undefined): CommercialProductTier {
  return (normalizeCommercialProductTier(tier ?? undefined) ?? "solo") as CommercialProductTier
}

/**
 * Core packaging + optional tier-gate resolution for any module-backed surface.
 *
 * When `enforceTierGates` is false (default in production today), packaging drives progressive UX:
 * - `enabled` — module is listed for the effective tier in {@link getBlitzpayPlanMetadata}.
 * - `upgrade_cta` — module is off-plan for the tier and would be gated by packaging minimums.
 * - `preview` — off-plan but the effective tier already satisfies catalog module minimums (edge / contract posture).
 *
 * When `enforceTierGates` is true, catalog minimums are enforced:
 * - `hidden` — {@link canAccessBlitzpayFeature} denies the primary feature at the effective tier.
 * - `enabled` — otherwise.
 */
export function resolveBlitzPayPackagingSurface(
  tier: CommercialProductTier | null | undefined,
  module: BlitzpayCommercialModuleKey,
  primaryFeatureKey: BlitzpayFeatureKey,
  options: { enforceTierGates: boolean },
): BlitzPaySurfaceMode {
  const t = effectiveTier(tier)
  if (options.enforceTierGates) {
    const ok = canAccessBlitzpayFeature(t, primaryFeatureKey, { enforceTierGates: true })
    return ok ? "enabled" : "hidden"
  }

  const visible = new Set(getBlitzpayPlanMetadata(t).visibleModules)
  if (visible.has(module)) return "enabled"

  if (blitzpayModuleWouldBeGatedAtTier(t, module)) return "upgrade_cta"
  return "preview"
}
