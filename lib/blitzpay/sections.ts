/**
 * Canonical Financial Command Center (BlitzPay FCC) section registry.
 * Single source for section IDs, commercial modules, and catalog feature keys used in capability resolution.
 */
import type { BlitzpayFeatureKey } from "@/lib/billing/blitzpay-feature-catalog"
import type { BlitzpayCommercialModuleKey } from "@/lib/billing/blitzpay-module-registry"

export const BLITZPAY_FCC_SECTION_IDS = [
  "overview",
  "executive-health",
  "ai-financial-copilot",
  "revenue-optimization",
  "recurring-revenue",
  "collections",
  "billing-profiles",
  "command-center-data",
  "multi-entity-finance",
  "supplier-network",
  "claims-protection",
  "mobile-financial-ops",
  "enterprise-observability",
  "internal-books",
  "vendor-bills",
  "tax-compliance",
  "financing-marketplace",
  "procurement-inventory",
  "operating-cash",
  "payroll-commissions",
  "contractor-settlements",
] as const

export type BlitzPayFccSectionId = (typeof BLITZPAY_FCC_SECTION_IDS)[number]

export type BlitzPayFccSectionCapabilityId = `blitzpay.fcc.section.${BlitzPayFccSectionId}`

export type BlitzPayFccSectionDefinition = {
  readonly id: BlitzPayFccSectionId
  readonly capabilityId: BlitzPayFccSectionCapabilityId
  readonly module: BlitzpayCommercialModuleKey
  /** Primary catalog feature used for `canAccessBlitzpayFeature` when tier gates are enforced. */
  readonly primaryFeatureKey: BlitzpayFeatureKey
}

function capId(id: BlitzPayFccSectionId): BlitzPayFccSectionCapabilityId {
  return `blitzpay.fcc.section.${id}`
}

/**
 * Deterministic FCC section definitions (slug order matches legacy nav ordering).
 */
export const BLITZPAY_FCC_SECTION_BY_ID = {
  overview: {
    id: "overview",
    capabilityId: capId("overview"),
    module: "financial_command_center",
    primaryFeatureKey: "blitzpay.fcc.summary",
  },
  "executive-health": {
    id: "executive-health",
    capabilityId: capId("executive-health"),
    module: "financial_command_center",
    primaryFeatureKey: "blitzpay.fcc.summary",
  },
  "ai-financial-copilot": {
    id: "ai-financial-copilot",
    capabilityId: capId("ai-financial-copilot"),
    module: "ai_copilot",
    primaryFeatureKey: "blitzpay.ai.copilot",
  },
  "revenue-optimization": {
    id: "revenue-optimization",
    capabilityId: capId("revenue-optimization"),
    module: "revenue_optimization",
    primaryFeatureKey: "blitzpay.revenue.optimize",
  },
  "recurring-revenue": {
    id: "recurring-revenue",
    capabilityId: capId("recurring-revenue"),
    module: "memberships_recurring",
    primaryFeatureKey: "blitzpay.memberships.native",
  },
  collections: {
    id: "collections",
    capabilityId: capId("collections"),
    module: "collections",
    primaryFeatureKey: "blitzpay.collections.visibility",
  },
  "billing-profiles": {
    id: "billing-profiles",
    capabilityId: capId("billing-profiles"),
    module: "customer_invoicing",
    primaryFeatureKey: "blitzpay.invoices.customer",
  },
  "command-center-data": {
    id: "command-center-data",
    capabilityId: capId("command-center-data"),
    module: "financial_command_center",
    primaryFeatureKey: "blitzpay.fcc.summary",
  },
  "multi-entity-finance": {
    id: "multi-entity-finance",
    capabilityId: capId("multi-entity-finance"),
    module: "multi_entity_franchise",
    primaryFeatureKey: "blitzpay.multi_entity",
  },
  "supplier-network": {
    id: "supplier-network",
    capabilityId: capId("supplier-network"),
    module: "supplier_network",
    primaryFeatureKey: "blitzpay.supplier.network",
  },
  "claims-protection": {
    id: "claims-protection",
    capabilityId: capId("claims-protection"),
    module: "claims_protection",
    primaryFeatureKey: "blitzpay.claims.protection",
  },
  "mobile-financial-ops": {
    id: "mobile-financial-ops",
    capabilityId: capId("mobile-financial-ops"),
    module: "mobile_financial_ops",
    primaryFeatureKey: "blitzpay.mobile.field",
  },
  "enterprise-observability": {
    id: "enterprise-observability",
    capabilityId: capId("enterprise-observability"),
    module: "enterprise_observability",
    primaryFeatureKey: "blitzpay.observability.advanced",
  },
  "internal-books": {
    id: "internal-books",
    capabilityId: capId("internal-books"),
    module: "general_ledger",
    primaryFeatureKey: "blitzpay.gl.books",
  },
  "vendor-bills": {
    id: "vendor-bills",
    capabilityId: capId("vendor-bills"),
    module: "vendor_ap",
    primaryFeatureKey: "blitzpay.vendor.ap",
  },
  "tax-compliance": {
    id: "tax-compliance",
    capabilityId: capId("tax-compliance"),
    module: "tax_compliance",
    primaryFeatureKey: "blitzpay.tax.compliance",
  },
  "financing-marketplace": {
    id: "financing-marketplace",
    capabilityId: capId("financing-marketplace"),
    module: "financing_marketplace",
    primaryFeatureKey: "blitzpay.financing.marketplace",
  },
  "procurement-inventory": {
    id: "procurement-inventory",
    capabilityId: capId("procurement-inventory"),
    module: "procurement_inventory",
    primaryFeatureKey: "blitzpay.procurement.inventory",
  },
  "operating-cash": {
    id: "operating-cash",
    capabilityId: capId("operating-cash"),
    module: "cash_planning",
    primaryFeatureKey: "blitzpay.cash.planning",
  },
  "payroll-commissions": {
    id: "payroll-commissions",
    capabilityId: capId("payroll-commissions"),
    module: "payroll_accruals",
    primaryFeatureKey: "blitzpay.payroll.accruals",
  },
  "contractor-settlements": {
    id: "contractor-settlements",
    capabilityId: capId("contractor-settlements"),
    module: "treasury_payouts",
    primaryFeatureKey: "blitzpay.treasury.payouts",
  },
} as const satisfies Record<BlitzPayFccSectionId, BlitzPayFccSectionDefinition>

export const BLITZPAY_FCC_SLUG_SET = new Set<string>(BLITZPAY_FCC_SECTION_IDS)

/** Maps FCC slug → commercial module (used for prefetch + packaging alignment). */
export const BLITZPAY_FCC_PREFETCH_MODULE_BY_SLUG: Record<BlitzPayFccSectionId, BlitzpayCommercialModuleKey> =
  Object.fromEntries(
    BLITZPAY_FCC_SECTION_IDS.map((id) => [id, BLITZPAY_FCC_SECTION_BY_ID[id].module]),
  ) as Record<BlitzPayFccSectionId, BlitzpayCommercialModuleKey>

export function isBlitzPayFccSectionId(value: string): value is BlitzPayFccSectionId {
  return (BLITZPAY_FCC_SECTION_IDS as readonly string[]).includes(value)
}

export function getBlitzPayFccSectionDefinition(
  sectionId: string,
): BlitzPayFccSectionDefinition | undefined {
  if (!isBlitzPayFccSectionId(sectionId)) return undefined
  return BLITZPAY_FCC_SECTION_BY_ID[sectionId]
}
