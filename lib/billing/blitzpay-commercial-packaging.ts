/**
 * Commercial packaging helpers — deterministic, no Stripe subscription coupling (Phase 7A.2, expanded 7A.7).
 */
import type { CommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
import { maxCommercialTier, normalizeCommercialProductTier, tierRank } from "@/lib/billing/blitzpay-commercial-tier"
import type { BlitzpayCommercialLane } from "@/lib/billing/blitzpay-feature-catalog"
import type { BlitzpayModuleClassification } from "@/lib/billing/blitzpay-feature-catalog"
import {
  BLITZPAY_FEATURE_CATALOG,
  getBlitzpayFeatureCatalogRow,
  type BlitzpayFeatureKey,
} from "@/lib/billing/blitzpay-feature-catalog"
import { getBlitzpayPlanMetadata, type BlitzpayPlanMetadata } from "@/lib/billing/blitzpay-plan-metadata"
import type { BlitzpayCommercialSurfaceKey } from "@/lib/blitzpay/blitzpay-commercial-readiness"

import type { BlitzpayCommercialModuleKey } from "@/lib/billing/blitzpay-module-registry"
import { BLITZPAY_COMMERCIAL_MODULE_KEYS } from "@/lib/billing/blitzpay-module-registry"

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

/** Strict SaaS → packaging tier ordering (upgrade progression). */
export const BLITZPAY_COMMERCIAL_TIER_SEQUENCE: readonly CommercialProductTier[] = [
  "solo",
  "core",
  "growth",
  "scale",
  "enterprise",
] as const

export type BlitzpayCommercialModulePackagingCategoryKey =
  | "payments_billing"
  | "treasury_cash"
  | "payroll_financial_ops"
  | "procurement_vendor"
  | "financing_revenue"
  | "ai_optimization"
  | "internal_books_compliance"
  | "multi_entity"
  | "enterprise_operations"
  | "operational_core"

const MODULE_COMMERCIAL_CATEGORY: Record<BlitzpayCommercialModuleKey, BlitzpayCommercialModulePackagingCategoryKey> = {
  payments_connect: "payments_billing",
  customer_invoicing: "payments_billing",
  collections: "payments_billing",
  memberships_recurring: "payments_billing",
  treasury_payouts: "treasury_cash",
  cash_planning: "treasury_cash",
  payroll_accruals: "payroll_financial_ops",
  mobile_financial_ops: "payroll_financial_ops",
  vendor_ap: "procurement_vendor",
  procurement_inventory: "procurement_vendor",
  supplier_network: "procurement_vendor",
  financing_marketplace: "financing_revenue",
  revenue_optimization: "financing_revenue",
  ai_copilot: "ai_optimization",
  general_ledger: "internal_books_compliance",
  tax_compliance: "internal_books_compliance",
  multi_entity_franchise: "multi_entity",
  enterprise_observability: "enterprise_operations",
  platform_blitzpay_operations: "enterprise_operations",
  financial_command_center: "operational_core",
  insights_hub: "operational_core",
  claims_protection: "operational_core",
}

export const BLITZPAY_COMMERCIAL_MODULE_PACKAGING_CATEGORY_ORDER: readonly BlitzpayCommercialModulePackagingCategoryKey[] = [
  "payments_billing",
  "treasury_cash",
  "payroll_financial_ops",
  "procurement_vendor",
  "financing_revenue",
  "ai_optimization",
  "internal_books_compliance",
  "multi_entity",
  "enterprise_operations",
  "operational_core",
] as const

const MODULE_PACKAGING_CATEGORY_COPY: Record<
  BlitzpayCommercialModulePackagingCategoryKey,
  { label: string; description: string }
> = {
  payments_billing: {
    label: "Payments & billing",
    description: "Hosted customer pay, invoicing, collections, and recurring agreements.",
  },
  treasury_cash: {
    label: "Treasury & cash flow",
    description: "Payout visibility, operating cash signals, and reserve planning.",
  },
  payroll_financial_ops: {
    label: "Payroll & field financial ops",
    description: "Technician economics, mobile approvals, and accrual-friendly workflows.",
  },
  procurement_vendor: {
    label: "Procurement & vendor operations",
    description: "Vendor bills, procurement finance, and supplier network signals.",
  },
  financing_revenue: {
    label: "Financing & revenue growth",
    description: "Marketplace financing posture and revenue optimization queues.",
  },
  ai_optimization: {
    label: "AI & optimization",
    description: "Deterministic copilots and bounded optimization recommendations.",
  },
  internal_books_compliance: {
    label: "Internal books & compliance",
    description: "General ledger foundations and tax workspace readiness.",
  },
  multi_entity: {
    label: "Multi-entity management",
    description: "Franchise-style rollups with explicit linkage and governance.",
  },
  enterprise_operations: {
    label: "Enterprise operations",
    description: "Observability depth and platform-grade BlitzPay operations consoles.",
  },
  operational_core: {
    label: "Operational visibility",
    description: "Command center, insights hub, and claims or protection tracking.",
  },
}

export function getBlitzpayModulePackagingCategory(module: BlitzpayCommercialModuleKey): BlitzpayCommercialModulePackagingCategoryKey {
  return MODULE_COMMERCIAL_CATEGORY[module]
}

export function getBlitzpayModulePackagingCategoryLabel(module: BlitzpayCommercialModuleKey): string {
  return MODULE_PACKAGING_CATEGORY_COPY[MODULE_COMMERCIAL_CATEGORY[module]].label
}

export function describeBlitzpayCommercialModulePackagingCategory(
  key: BlitzpayCommercialModulePackagingCategoryKey,
): { label: string; description: string } {
  return MODULE_PACKAGING_CATEGORY_COPY[key]
}

const MATURITY_STAGE_ORDER: Record<BlitzpayMaturityStage, number> = {
  launch: 0,
  operate: 1,
  optimize: 2,
  govern: 3,
}

export function blitzpayMaturityStageRank(stage: BlitzpayMaturityStage): number {
  return MATURITY_STAGE_ORDER[stage]
}

export function describeBlitzpayMaturityStage(stage: BlitzpayMaturityStage): { title: string; narrative: string } {
  switch (stage) {
    case "launch":
      return {
        title: "Launch posture",
        narrative: "Core customer money paths and light reporting — ideal when standing up hosted pay.",
      }
    case "operate":
      return {
        title: "Operate posture",
        narrative: "Day-two cash discipline: payouts, payables signals, and field-friendly workflows.",
      }
    case "optimize":
      return {
        title: "Optimize posture",
        narrative: "Finance-led tuning with AI insights, procurement finance, and structured renewals.",
      }
    case "govern":
      return {
        title: "Govern posture",
        narrative: "Multi-entity, observability, and platform operations tuned for audit-friendly scale.",
      }
  }
}

export function describeBlitzpayOnboardingReadinessBand(band: BlitzpayPlanMetadata["onboardingReadinessBand"]): string {
  switch (band) {
    case "quick":
      return "Quick setup"
    case "moderate":
      return "Moderate onboarding"
    case "delegated_finance":
      return "Requires finance oversight"
    case "enterprise_program":
      return "Enterprise rollout recommended"
  }
}

export function getBlitzpayNextPackagingTier(tier: CommercialProductTier): CommercialProductTier | null {
  const idx = BLITZPAY_COMMERCIAL_TIER_SEQUENCE.indexOf(tier)
  if (idx < 0 || idx >= BLITZPAY_COMMERCIAL_TIER_SEQUENCE.length - 1) return null
  return BLITZPAY_COMMERCIAL_TIER_SEQUENCE[idx + 1] ?? null
}

/** Coarse operational maturity implied by SaaS packaging tier (collateral / onboarding posture — not module classification). */
export function blitzpayCommercialTierOperationalPosture(tier: CommercialProductTier): BlitzpayMaturityStage {
  switch (tier) {
    case "solo":
      return "launch"
    case "core":
      return "operate"
    case "growth":
      return "optimize"
    case "scale":
    case "enterprise":
      return "govern"
    default:
      return "operate"
  }
}

export type BlitzpayOnboardingReadinessBand = BlitzpayPlanMetadata["onboardingReadinessBand"]

function isCanonicalCommercialTier(t: CommercialProductTier | null | undefined): t is CommercialProductTier {
  return t === "solo" || t === "core" || t === "growth" || t === "scale" || t === "enterprise"
}

/** Histogram of onboarding bands implied by normalized `plan_id` values in a bounded sample. */
export function summarizeBlitzpayOnboardingReadinessBandSample(planIds: readonly string[]): {
  sampleSize: number
  counts: Record<BlitzpayOnboardingReadinessBand, number>
  dominantBand: BlitzpayOnboardingReadinessBand | null
  summaryLine: string
} {
  const counts: Record<BlitzpayOnboardingReadinessBand, number> = {
    quick: 0,
    moderate: 0,
    delegated_finance: 0,
    enterprise_program: 0,
  }
  for (const raw of planIds) {
    const t = normalizeCommercialProductTier(raw)
    if (!isCanonicalCommercialTier(t)) continue
    const band = getBlitzpayPlanMetadata(t).onboardingReadinessBand
    counts[band] += 1
  }
  const sampleSize = planIds.length
  let dominant: BlitzpayOnboardingReadinessBand | null = null
  let best = -1
  for (const b of ["quick", "moderate", "delegated_finance", "enterprise_program"] as const) {
    const c = counts[b]
    if (c > best) {
      best = c
      dominant = b
    }
  }
  if (best <= 0) dominant = null
  const line =
    dominant ?
      `Onboarding posture skew (sample): ${describeBlitzpayOnboardingReadinessBand(dominant)} most common`
    : "Onboarding posture skew (sample): insufficient canonical plan rows"
  return { sampleSize, counts, dominantBand: dominant, summaryLine: line }
}

/** Histogram of operational-maturity postures derived from tier-normalized plan ids. */
export function summarizeBlitzpayOperationalMaturityPostureSample(planIds: readonly string[]): {
  sampleSize: number
  counts: Record<BlitzpayMaturityStage, number>
  dominantPosture: BlitzpayMaturityStage | null
  summaryLine: string
} {
  const counts: Record<BlitzpayMaturityStage, number> = {
    launch: 0,
    operate: 0,
    optimize: 0,
    govern: 0,
  }
  for (const raw of planIds) {
    const t = normalizeCommercialProductTier(raw)
    if (!isCanonicalCommercialTier(t)) continue
    const posture = blitzpayCommercialTierOperationalPosture(t)
    counts[posture] += 1
  }
  const sampleSize = planIds.length
  let dominant: BlitzpayMaturityStage | null = null
  let best = -1
  for (const s of ["launch", "operate", "optimize", "govern"] as const) {
    const c = counts[s]
    if (c > best) {
      best = c
      dominant = s
    }
  }
  if (best <= 0) dominant = null
  const line =
    dominant ?
      `Operational maturity skew (sample): ${describeBlitzpayMaturityStage(dominant).title} most common`
    : "Operational maturity skew (sample): insufficient canonical plan rows"
  return { sampleSize, counts, dominantPosture: dominant, summaryLine: line }
}

/**
 * Weight packaging module categories by each sampled tenant's plan collateral (`visibleModules`).
 * Not module adoption telemetry — bounded narrative for platform ops only.
 */
export function summarizeBlitzpayModulePackagingCategorySkewSample(planIds: readonly string[]): {
  sampleSize: number
  categoryHits: Record<BlitzpayCommercialModulePackagingCategoryKey, number>
  topCategories: readonly { key: BlitzpayCommercialModulePackagingCategoryKey; hits: number; label: string }[]
  summaryLine: string
} {
  const categoryHits = {} as Record<BlitzpayCommercialModulePackagingCategoryKey, number>
  for (const k of BLITZPAY_COMMERCIAL_MODULE_PACKAGING_CATEGORY_ORDER) {
    categoryHits[k] = 0
  }
  for (const raw of planIds) {
    const t = normalizeCommercialProductTier(raw)
    if (!isCanonicalCommercialTier(t)) continue
    for (const m of getBlitzpayPlanMetadata(t).visibleModules) {
      const cat = getBlitzpayModulePackagingCategory(m)
      categoryHits[cat] += 1
    }
  }
  const sampleSize = planIds.length
  const ranked = BLITZPAY_COMMERCIAL_MODULE_PACKAGING_CATEGORY_ORDER.map((key) => ({
    key,
    hits: categoryHits[key],
    label: MODULE_PACKAGING_CATEGORY_COPY[key].label,
  })).sort((a, b) => b.hits - a.hits)
  const topCategories = ranked.filter((r) => r.hits > 0).slice(0, 3)
  const summaryLine =
    topCategories.length > 0 ?
      `Collateral-weighted packaging lenses (top): ${topCategories.map((c) => `${c.label} (${String(c.hits)})`).join(", ")}`
    : "Collateral-weighted packaging lenses: no canonical plan rows in sample"
  return { sampleSize, categoryHits, topCategories, summaryLine }
}

export type BlitzpayPlatformCommercialPackagingHistogram = {
  planSampleLimit: number
  planIdsSampled: number
  planTierSummary: BlitzpayCommercialPlanSampleSummary
  onboardingReadiness: ReturnType<typeof summarizeBlitzpayOnboardingReadinessBandSample>
  operationalMaturity: ReturnType<typeof summarizeBlitzpayOperationalMaturityPostureSample>
  modulePackagingSkew: ReturnType<typeof summarizeBlitzpayModulePackagingCategorySkewSample>
  /** Bounded, non-PII line for console copy. */
  compositeNarrativeLine: string
}

export function buildBlitzpayPlatformCommercialPackagingHistogram(
  planIds: readonly string[],
  planSampleLimit: number,
): BlitzpayPlatformCommercialPackagingHistogram {
  const planTierSummary = summarizeBlitzpayCommercialPlanSample(planIds)
  const onboardingReadiness = summarizeBlitzpayOnboardingReadinessBandSample(planIds)
  const operationalMaturity = summarizeBlitzpayOperationalMaturityPostureSample(planIds)
  const modulePackagingSkew = summarizeBlitzpayModulePackagingCategorySkewSample(planIds)
  const compositeNarrativeLine = [
    planTierSummary.summaryLine,
    onboardingReadiness.summaryLine,
    operationalMaturity.summaryLine,
    modulePackagingSkew.summaryLine,
  ].join(" · ")
  return {
    planSampleLimit,
    planIdsSampled: planIds.length,
    planTierSummary,
    onboardingReadiness,
    operationalMaturity,
    modulePackagingSkew,
    compositeNarrativeLine,
  }
}

function recommendedTierFromFeatureKeys(keys: readonly BlitzpayFeatureKey[]): CommercialProductTier {
  let acc: CommercialProductTier = "solo"
  for (const k of keys) {
    const row = getBlitzpayFeatureCatalogRow(k)
    if (row) acc = maxCommercialTier(acc, row.minimumPackagingTier)
  }
  return acc
}

/** Upgrade hint when a feature set implies a higher packaging tier than the org sits on today. */
export function buildBlitzpayUpgradeRecommendationSummary(args: {
  currentTier: CommercialProductTier | null | undefined
  featureKeys: readonly BlitzpayFeatureKey[]
}): { needsUpgrade: boolean; recommendedTier: CommercialProductTier; line: string } {
  const cur = args.currentTier ?? "solo"
  const recommended = recommendedTierFromFeatureKeys(args.featureKeys)
  const needsUpgrade = tierRank(recommended) > tierRank(cur)
  const meta = getBlitzpayPlanMetadata(recommended)
  const line = needsUpgrade ?
    `Packaging reference: enablement aligns with ${meta.shortLabel} — ${meta.upgradePathSummary}`
  : `Packaging reference: ${getBlitzpayPlanMetadata(cur).shortLabel} already covers these capabilities in collateral.`
  return { needsUpgrade, recommendedTier: recommended, line }
}

/** Subtle second line for staff surfaces — packaging only, not a paywall. */
export function buildBlitzpayCommercialPositioningHint(tier: CommercialProductTier): string {
  const meta = getBlitzpayPlanMetadata(tier)
  return `${meta.bestForTag} · ${meta.setupComplexityLabel} · ${meta.commonlyEnabledTogetherHint}`
}

export function buildBlitzpayCommercialAwarenessSnippet(args: {
  effectiveTier: CommercialProductTier
  surface: BlitzpayCommercialSurfaceKey
}): { primaryFootnote: string; secondaryHint: string } {
  return {
    primaryFootnote: getBlitzpayPlanPackagingFootnote(args),
    secondaryHint: buildBlitzpayCommercialPositioningHint(args.effectiveTier),
  }
}

export type BlitzpayCommercialPlanSampleSummary = {
  sampleSize: number
  countsApprox: Record<CommercialProductTier, number>
  otherOrUnknownSampleCount: number
  dominantTier: CommercialProductTier | null
  summaryLine: string
}

/**
 * Bounded histogram for platform ops — counts SaaS `plan_id` strings normalized to commercial tiers.
 * Rows beyond the sample are ignored by design (performance safety).
 */
export function summarizeBlitzpayCommercialPlanSample(planIds: readonly string[]): BlitzpayCommercialPlanSampleSummary {
  const counts: Record<CommercialProductTier, number> = {
    solo: 0,
    core: 0,
    growth: 0,
    scale: 0,
    enterprise: 0,
  }
  let other = 0
  for (const raw of planIds) {
    const t = normalizeCommercialProductTier(raw)
    if (t === "solo" || t === "core" || t === "growth" || t === "scale" || t === "enterprise") {
      counts[t] += 1
    } else {
      other += 1
    }
  }
  const sampleSize = planIds.length
  let dominant: CommercialProductTier | null = null
  let best = -1
  for (const tier of BLITZPAY_COMMERCIAL_TIER_SEQUENCE) {
    const c = counts[tier]
    if (c > best) {
      best = c
      dominant = tier
    }
  }
  if (best <= 0) dominant = null
  const lineParts = [`Sample ${String(sampleSize)} active/trialing subscriptions`]
  if (dominant) lineParts.push(`modeled tier skew: ${getBlitzpayPlanMetadata(dominant).shortLabel}`)
  if (other > 0) lineParts.push(`${String(other)} non-canonical plan_id value(s) in sample`)
  return {
    sampleSize,
    countsApprox: counts,
    otherOrUnknownSampleCount: other,
    dominantTier: dominant,
    summaryLine: lineParts.join(" · "),
  }
}

export function listBlitzpayCommercialModuleTriadsForSales(): readonly {
  title: string
  modules: readonly BlitzpayCommercialModuleKey[]
}[] {
  return [
    {
      title: "Cash-in first",
      modules: ["payments_connect", "customer_invoicing", "collections"],
    },
    {
      title: "Field + office bridge",
      modules: ["mobile_financial_ops", "treasury_payouts", "financial_command_center"],
    },
    {
      title: "Finance acceleration",
      modules: ["general_ledger", "ai_copilot", "revenue_optimization"],
    },
  ] as const
}

/** Test hook — verifies every registered module maps to a packaging category. */
export function assertBlitzpayModulePackagingCategoryCoverage(): void {
  for (const m of BLITZPAY_COMMERCIAL_MODULE_KEYS) {
    if (!MODULE_COMMERCIAL_CATEGORY[m]) {
      throw new Error(`Missing commercial packaging category for module ${m}`)
    }
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
  modulePackagingCategoryLabel: string
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
    modulePackagingCategoryLabel: getBlitzpayModulePackagingCategoryLabel(row.module),
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
  version: "7a.7-placeholder" as const,
  tiers: ["solo", "core", "growth", "scale", "enterprise"] as const,
  /** Feature rows × tier booleans derived from catalog mins (deterministic). */
  rows: BLITZPAY_FEATURE_CATALOG.map((f) => ({
    key: f.key,
    label: f.label,
    module: f.module,
    minimumPackagingTier: f.minimumPackagingTier,
  })),
}
