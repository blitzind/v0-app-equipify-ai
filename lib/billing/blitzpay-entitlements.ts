/**
 * BlitzPay commercial / module entitlement foundations (Phase 7A).
 *
 * Product tiers: Solo, Core, Growth, Scale, Enterprise (`PlanId` + enterprise contract tier).
 * Phase 7A is intentionally permissive: helpers exist for future gating without locking workflows today.
 */

import type { PlanId } from "@/lib/plans"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"

export const BLITZPAY_ENTITLEMENTS_FOUNDATION_VERSION = "7a.1" as const

/** SaaS plan id or negotiated enterprise (not necessarily a `PlanId` row). */
export type CommercialProductTier = PlanId | "enterprise"

export type BlitzpayCommercialModuleKey =
  | "payments_connect"
  | "customer_invoicing"
  | "treasury_payouts"
  | "collections"
  | "memberships_recurring"
  | "payroll_accruals"
  | "cash_planning"
  | "general_ledger"
  | "vendor_ap"
  | "tax_compliance"
  | "financing_marketplace"
  | "procurement_inventory"
  | "ai_copilot"
  | "revenue_optimization"
  | "multi_entity_franchise"
  | "supplier_network"
  | "claims_protection"
  | "mobile_financial_ops"
  | "enterprise_observability"
  | "financial_command_center"
  | "insights_hub"

const TIER_RANK: Record<CommercialProductTier, number> = {
  solo: 0,
  core: 1,
  growth: 2,
  scale: 3,
  enterprise: 4,
}

/** Minimum commercial tier for each module — all Solo+ today; adjust when packaging tightens. */
const MODULE_MIN_TIER: Record<BlitzpayCommercialModuleKey, CommercialProductTier> = {
  payments_connect: "solo",
  customer_invoicing: "solo",
  treasury_payouts: "solo",
  collections: "solo",
  memberships_recurring: "solo",
  payroll_accruals: "solo",
  cash_planning: "solo",
  general_ledger: "solo",
  vendor_ap: "solo",
  tax_compliance: "solo",
  financing_marketplace: "solo",
  procurement_inventory: "solo",
  ai_copilot: "solo",
  revenue_optimization: "solo",
  multi_entity_franchise: "solo",
  supplier_network: "solo",
  claims_protection: "solo",
  mobile_financial_ops: "solo",
  enterprise_observability: "solo",
  financial_command_center: "solo",
  insights_hub: "solo",
}

export function normalizeCommercialProductTier(raw: string | null | undefined): CommercialProductTier | null {
  if (!raw?.trim()) return null
  const s = raw.trim().toLowerCase()
  if (s === "enterprise") return "enterprise"
  return normalizePlanIdForRead(s) as PlanId
}

/**
 * Phase 7A default: every module stays available on every tier (no customer-facing lockout).
 */
export function isBlitzpayModuleEnabledForTier(
  _plan: CommercialProductTier | null | undefined,
  _module: BlitzpayCommercialModuleKey,
): boolean {
  return true
}

/** Future gate: true when the org's tier is below the configured minimum for the module. */
export function blitzpayModuleWouldBeGatedAtTier(
  plan: CommercialProductTier | null | undefined,
  module: BlitzpayCommercialModuleKey,
): boolean {
  if (!plan) return false
  return TIER_RANK[plan] < TIER_RANK[MODULE_MIN_TIER[module]]
}

/** Reserved for upgrade / disabled tooltips — returns null while gating is off. */
export function blitzpayModuleDisabledReason(
  plan: CommercialProductTier | null | undefined,
  module: BlitzpayCommercialModuleKey,
): string | null {
  if (!blitzpayModuleWouldBeGatedAtTier(plan, module)) return null
  return "This area is not included on your current plan. Ask an owner or billing admin about upgrading."
}

export function blitzpayCommercialUpgradeHint(_module: BlitzpayCommercialModuleKey): string {
  return "When you outgrow your current plan, your admin can move you to a tier that unlocks more automation and reporting depth."
}
