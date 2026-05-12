/**
 * Plan-aware marketing / positioning metadata for BlitzPay surfaces (Phase 7A.2).
 * Display-only — does not grant capabilities.
 */
import type { CommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
import type { BlitzpayCommercialModuleKey } from "@/lib/billing/blitzpay-module-registry"

export type BlitzpayPlanMetadata = {
  id: CommercialProductTier
  label: string
  shortLabel: string
  positioning: string
  intendedCustomerProfile: string
  /** Short “best for” tagline for strips and future comparison tables. */
  bestForTag: string
  /** How operationally mature the default buyer profile is expected to be. */
  operationalSophisticationLabel: string
  /** Setup / ownership expectation — not a service commitment. */
  setupComplexityLabel: string
  /** Coarse onboarding posture for future checklists and upgrade teasers. */
  onboardingReadinessBand: "quick" | "moderate" | "delegated_finance" | "enterprise_program"
  /** One line: modules or themes that are commonly adopted together at this tier. */
  commonlyEnabledTogetherHint: string
  /** Narrative upgrade path (not a checkout URL). */
  upgradePathSummary: string
  /** Module keys typically highlighted in sales collateral for this tier. */
  visibleModules: readonly BlitzpayCommercialModuleKey[]
}

const SOLO_VISIBLE: BlitzpayCommercialModuleKey[] = [
  "payments_connect",
  "customer_invoicing",
  "collections",
  "financial_command_center",
  "insights_hub",
]

const CORE_VISIBLE: BlitzpayCommercialModuleKey[] = [
  ...SOLO_VISIBLE,
  "treasury_payouts",
  "memberships_recurring",
  "payroll_accruals",
  "cash_planning",
  "vendor_ap",
  "mobile_financial_ops",
]

const GROWTH_VISIBLE: BlitzpayCommercialModuleKey[] = [
  ...CORE_VISIBLE,
  "general_ledger",
  "tax_compliance",
  "financing_marketplace",
  "procurement_inventory",
  "ai_copilot",
  "revenue_optimization",
  "claims_protection",
]

const SCALE_VISIBLE: BlitzpayCommercialModuleKey[] = [
  ...GROWTH_VISIBLE,
  "multi_entity_franchise",
  "supplier_network",
  "enterprise_observability",
]

const ENTERPRISE_VISIBLE: BlitzpayCommercialModuleKey[] = [
  ...SCALE_VISIBLE,
  "platform_blitzpay_operations",
]

export const BLITZPAY_PLAN_METADATA: Record<CommercialProductTier, BlitzpayPlanMetadata> = {
  solo: {
    id: "solo",
    label: "Solo",
    shortLabel: "Solo",
    positioning: "Single-operator cash visibility with hosted customer pay.",
    intendedCustomerProfile: "Owner-operators collecting on jobs with light back office.",
    bestForTag: "Best for owner-operators",
    operationalSophisticationLabel: "Foundational cash and invoice discipline",
    setupComplexityLabel: "Quick setup",
    onboardingReadinessBand: "quick",
    commonlyEnabledTogetherHint: "Payments, hosted invoice pay, and collections reminders are commonly enabled first.",
    upgradePathSummary: "Move to Core when you add staff workflows, memberships, or AP basics.",
    visibleModules: SOLO_VISIBLE,
  },
  core: {
    id: "core",
    label: "Core",
    shortLabel: "Core",
    positioning: "Team operations with memberships, treasury basics, and vendor payables signals.",
    intendedCustomerProfile: "Small teams coordinating dispatch, billing, and vendor bills.",
    bestForTag: "Built for coordinated field & office teams",
    operationalSophisticationLabel: "Team-wide billing and cash rhythm",
    setupComplexityLabel: "Moderate setup with finance touchpoints",
    onboardingReadinessBand: "moderate",
    commonlyEnabledTogetherHint: "Treasury views, memberships, and vendor payables signals often roll out together.",
    upgradePathSummary: "Growth unlocks AI copilot, financing, procurement finance, and deeper compliance.",
    visibleModules: CORE_VISIBLE,
  },
  growth: {
    id: "growth",
    label: "Growth",
    shortLabel: "Growth",
    positioning: "Finance-led acceleration: GL, tax workspace, financing, procurement, AI copilot.",
    intendedCustomerProfile: "Growing shops standardizing books and cash discipline.",
    bestForTag: "Built for growing service teams",
    operationalSophisticationLabel: "Cross-module financial control",
    setupComplexityLabel: "Best with dedicated office staff",
    onboardingReadinessBand: "delegated_finance",
    commonlyEnabledTogetherHint: "Internal books, tax workspace, and AI copilot are commonly adopted as a bundle.",
    upgradePathSummary: "Scale adds multi-entity, supplier network, and enterprise observability depth.",
    visibleModules: GROWTH_VISIBLE,
  },
  scale: {
    id: "scale",
    label: "Scale",
    shortLabel: "Scale",
    positioning: "Multi-location and network-aware financial signals with observability.",
    intendedCustomerProfile: "Regional operators and light franchise groups.",
    bestForTag: "Designed for multi-location operators",
    operationalSophisticationLabel: "Network-aware cash and compliance signals",
    setupComplexityLabel: "Substantial rollout with regional controls",
    onboardingReadinessBand: "delegated_finance",
    commonlyEnabledTogetherHint: "Multi-entity rollups, supplier network signals, and observability depth are commonly layered together.",
    upgradePathSummary: "Enterprise contracts add negotiated controls, replay governance, and platform ops.",
    visibleModules: SCALE_VISIBLE,
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise",
    shortLabel: "Enterprise",
    positioning: "Contracted controls, consolidated operations, and platform-grade tooling.",
    intendedCustomerProfile: "Large groups with bespoke governance and support expectations.",
    bestForTag: "Enterprise operational visibility",
    operationalSophisticationLabel: "Programmatic governance and audit-friendly operations",
    setupComplexityLabel: "Enterprise rollout recommended",
    onboardingReadinessBand: "enterprise_program",
    commonlyEnabledTogetherHint: "Platform operations consoles pair with negotiated controls and custom runbooks.",
    upgradePathSummary: "Packaging is negotiated — feature matrix lives in contract addenda.",
    visibleModules: ENTERPRISE_VISIBLE,
  },
}

export function getBlitzpayPlanMetadata(tier: CommercialProductTier | null | undefined): BlitzpayPlanMetadata {
  const t = tier ?? "solo"
  return BLITZPAY_PLAN_METADATA[t] ?? BLITZPAY_PLAN_METADATA.solo
}
