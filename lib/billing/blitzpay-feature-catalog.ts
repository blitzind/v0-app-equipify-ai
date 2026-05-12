/**
 * Canonical BlitzPay feature registry (Phase 7A.2).
 * Typed keys + deterministic packaging tiers — **not** coupled to Stripe subscriptions.
 * Enforcement remains opt-in via {@link canAccessBlitzpayFeature} options in `blitzpay-entitlements.ts`.
 */
import type { CommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
import { BLITZPAY_COMMERCIAL_TIER_RANK } from "@/lib/billing/blitzpay-commercial-tier"
import type { BlitzpayCommercialModuleKey } from "@/lib/billing/blitzpay-module-registry"
import { BLITZPAY_COMMERCIAL_MODULE_KEYS } from "@/lib/billing/blitzpay-module-registry"

export type BlitzpayModuleClassification =
  | "foundational"
  | "operational"
  | "advanced"
  | "enterprise"
  | "platform_admin"

/** Commercial lane for badges / upgrade copy (not a Stripe product id). */
export type BlitzpayCommercialLane =
  | "solo_suite"
  | "core_operations"
  | "growth_acceleration"
  | "scale_network"
  | "enterprise_control"
  | "platform_operations"

export type BlitzpayFeatureCatalogRow = {
  readonly key: BlitzpayFeatureKey
  readonly label: string
  readonly module: BlitzpayCommercialModuleKey
  /** Minimum tier where this capability is *positioned* in packaging — access stays permissive until enforcement flips. */
  readonly minimumPackagingTier: CommercialProductTier
  readonly moduleClassification: BlitzpayModuleClassification
  readonly commercialLane: BlitzpayCommercialLane
  /** Short hint for soft-gated UI / teasers. */
  readonly packagingHint: string
}

const ROWS = [
  {
    key: "blitzpay.payments.connect",
    label: "BlitzPay Connect & hosted pay",
    module: "payments_connect",
    minimumPackagingTier: "solo",
    moduleClassification: "foundational",
    commercialLane: "solo_suite",
    packagingHint: "Included on every packaged tier.",
  },
  {
    key: "blitzpay.invoices.customer",
    label: "Customer invoicing & balances",
    module: "customer_invoicing",
    minimumPackagingTier: "solo",
    moduleClassification: "foundational",
    commercialLane: "solo_suite",
    packagingHint: "Core billing workflows for every workspace.",
  },
  {
    key: "blitzpay.collections.visibility",
    label: "Collections visibility & recovery orchestration",
    module: "collections",
    minimumPackagingTier: "solo",
    moduleClassification: "operational",
    commercialLane: "solo_suite",
    packagingHint: "Read-first collections signals; messaging stays human-in-the-loop.",
  },
  {
    key: "blitzpay.fcc.summary",
    label: "Financial command center summary",
    module: "financial_command_center",
    minimumPackagingTier: "solo",
    moduleClassification: "operational",
    commercialLane: "solo_suite",
    packagingHint: "Unified AR/AP/treasury snapshot tiles.",
  },
  {
    key: "blitzpay.insights.hub",
    label: "Insights financial hub",
    module: "insights_hub",
    minimumPackagingTier: "solo",
    moduleClassification: "operational",
    commercialLane: "solo_suite",
    packagingHint: "Staff insights surfaces for financial modules.",
  },
  {
    key: "blitzpay.treasury.payouts",
    label: "Treasury & payout visibility",
    module: "treasury_payouts",
    minimumPackagingTier: "core",
    moduleClassification: "operational",
    commercialLane: "core_operations",
    packagingHint: "Typically positioned with Core+ operations bundles.",
  },
  {
    key: "blitzpay.memberships.native",
    label: "Native memberships & renewals",
    module: "memberships_recurring",
    minimumPackagingTier: "core",
    moduleClassification: "operational",
    commercialLane: "core_operations",
    packagingHint: "Recurring agreements beyond one-off invoices.",
  },
  {
    key: "blitzpay.payroll.accruals",
    label: "Payroll accruals & commissions",
    module: "payroll_accruals",
    minimumPackagingTier: "core",
    moduleClassification: "operational",
    commercialLane: "core_operations",
    packagingHint: "Accrual visibility for technicians and contractors.",
  },
  {
    key: "blitzpay.cash.planning",
    label: "Cash buckets & runway planning",
    module: "cash_planning",
    minimumPackagingTier: "core",
    moduleClassification: "operational",
    commercialLane: "core_operations",
    packagingHint: "Internal planning buckets — not custodial cash.",
  },
  {
    key: "blitzpay.vendor.ap",
    label: "Vendor AP & payables",
    module: "vendor_ap",
    minimumPackagingTier: "core",
    moduleClassification: "operational",
    commercialLane: "core_operations",
    packagingHint: "Vendor aging and pay-run planning signals.",
  },
  {
    key: "blitzpay.mobile.field",
    label: "Mobile financial intents & sync",
    module: "mobile_financial_ops",
    minimumPackagingTier: "core",
    moduleClassification: "operational",
    commercialLane: "core_operations",
    packagingHint: "Field capture with server validation gates.",
  },
  {
    key: "blitzpay.gl.books",
    label: "Internal general ledger & trial balance",
    module: "general_ledger",
    minimumPackagingTier: "growth",
    moduleClassification: "advanced",
    commercialLane: "growth_acceleration",
    packagingHint: "Double-entry books for finance-led teams.",
  },
  {
    key: "blitzpay.tax.compliance",
    label: "Tax & compliance workspace",
    module: "tax_compliance",
    minimumPackagingTier: "growth",
    moduleClassification: "advanced",
    commercialLane: "growth_acceleration",
    packagingHint: "Jurisdiction + readiness signals — not filing automation.",
  },
  {
    key: "blitzpay.financing.marketplace",
    label: "Financing marketplace",
    module: "financing_marketplace",
    minimumPackagingTier: "growth",
    moduleClassification: "advanced",
    commercialLane: "growth_acceleration",
    packagingHint: "Applications and offers — no on-platform lending.",
  },
  {
    key: "blitzpay.procurement.inventory",
    label: "Procurement & inventory finance",
    module: "procurement_inventory",
    minimumPackagingTier: "growth",
    moduleClassification: "advanced",
    commercialLane: "growth_acceleration",
    packagingHint: "Valuation, rebates, and reorder signals.",
  },
  {
    key: "blitzpay.ai.copilot",
    label: "AI financial copilot",
    module: "ai_copilot",
    minimumPackagingTier: "growth",
    moduleClassification: "advanced",
    commercialLane: "growth_acceleration",
    packagingHint: "Advisory narratives — deterministic guardrails.",
  },
  {
    key: "blitzpay.revenue.optimize",
    label: "Revenue optimization queues",
    module: "revenue_optimization",
    minimumPackagingTier: "growth",
    moduleClassification: "advanced",
    commercialLane: "growth_acceleration",
    packagingHint: "Opportunity hygiene without autonomous outreach.",
  },
  {
    key: "blitzpay.claims.protection",
    label: "Claims & protection programs",
    module: "claims_protection",
    minimumPackagingTier: "growth",
    moduleClassification: "advanced",
    commercialLane: "growth_acceleration",
    packagingHint: "Reserves and claim rows — human adjudication.",
  },
  {
    key: "blitzpay.multi_entity",
    label: "Multi-entity & franchise finance",
    module: "multi_entity_franchise",
    minimumPackagingTier: "scale",
    moduleClassification: "enterprise",
    commercialLane: "scale_network",
    packagingHint: "Linked org reporting — explicit membership only.",
  },
  {
    key: "blitzpay.supplier.network",
    label: "Supplier network intelligence",
    module: "supplier_network",
    minimumPackagingTier: "scale",
    moduleClassification: "enterprise",
    commercialLane: "scale_network",
    packagingHint: "Aggregate benchmarks — no cross-org PII trading.",
  },
  {
    key: "blitzpay.observability.advanced",
    label: "Enterprise observability & workflow health",
    module: "enterprise_observability",
    minimumPackagingTier: "scale",
    moduleClassification: "enterprise",
    commercialLane: "scale_network",
    packagingHint: "Queue/worker health and bounded replay visibility.",
  },
  {
    key: "blitzpay.observability.replay",
    label: "Controlled workflow replay tooling",
    module: "enterprise_observability",
    minimumPackagingTier: "enterprise",
    moduleClassification: "enterprise",
    commercialLane: "enterprise_control",
    packagingHint: "Governed replays — owner/admin/platform roles only.",
  },
  {
    key: "blitzpay.platform.ops",
    label: "Platform BlitzPay operations",
    module: "platform_blitzpay_operations",
    minimumPackagingTier: "enterprise",
    moduleClassification: "platform_admin",
    commercialLane: "platform_operations",
    packagingHint: "Equipify staff consoles — not a tenant entitlement surface.",
  },
] as const satisfies ReadonlyArray<{
  key: string
  label: string
  module: BlitzpayCommercialModuleKey
  minimumPackagingTier: CommercialProductTier
  moduleClassification: BlitzpayModuleClassification
  commercialLane: BlitzpayCommercialLane
  packagingHint: string
}>

export type BlitzpayFeatureKey = (typeof ROWS)[number]["key"]

export const BLITZPAY_FEATURE_CATALOG: readonly BlitzpayFeatureCatalogRow[] = ROWS

const KEY_SET = new Set<string>(ROWS.map((r) => r.key))

/** O(1) catalog lookup — unknown keys are absent (callers should treat as non-catalog). */
export function getBlitzpayFeatureCatalogRow(key: string): BlitzpayFeatureCatalogRow | undefined {
  if (!KEY_SET.has(key)) return undefined
  return ROWS.find((r) => r.key === key) as BlitzpayFeatureCatalogRow | undefined
}

export const BLITZPAY_FEATURE_KEYS: readonly BlitzpayFeatureKey[] = ROWS.map((r) => r.key as BlitzpayFeatureKey)

/** Minimum packaging tier per module = max(min tier) across catalog rows for that module. */
export function deriveBlitzpayModuleMinimumTiers(): Record<BlitzpayCommercialModuleKey, CommercialProductTier> {
  const out: Partial<Record<BlitzpayCommercialModuleKey, CommercialProductTier>> = {}
  for (const row of ROWS) {
    const cur = out[row.module]
    if (!cur || BLITZPAY_COMMERCIAL_TIER_RANK[row.minimumPackagingTier] > BLITZPAY_COMMERCIAL_TIER_RANK[cur]) {
      out[row.module] = row.minimumPackagingTier
    }
  }
  for (const m of BLITZPAY_COMMERCIAL_MODULE_KEYS) {
    if (!out[m]) out[m] = "solo"
  }
  return out as Record<BlitzpayCommercialModuleKey, CommercialProductTier>
}
