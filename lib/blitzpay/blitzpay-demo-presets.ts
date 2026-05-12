/**
 * Deterministic demo / sample BlitzPay metrics for documentation, fixtures, FCC showcase copy,
 * and optional future seeding hooks. Illustrative only — no real customer data, no randomness,
 * bounded counts, stable ordering.
 */

/** Hard caps for demo arrays / feeds (performance safety). */
export const BLITZPAY_DEMO_MAX_ACTIVITY_FEED_LINES = 12
export const BLITZPAY_DEMO_MAX_SCENARIO_BULLETS = 6
export const BLITZPAY_DEMO_MAX_REFERENCE_DAY_OFFSETS = 8

export const BLITZPAY_DEMO_ORG_ARCHETYPES = [
  "small_contractor",
  "growing_field_service",
  "mature_multi_department",
  "franchise_style_network",
] as const

export type BlitzpayDemoOrgArchetype = (typeof BLITZPAY_DEMO_ORG_ARCHETYPES)[number]

export type BlitzpayDemoOperationalPresetBundle = {
  treasuryOperatingCents: number
  treasuryHeldReserveCents: number
  pendingPayoutsCents: number
  payrollPendingCommissionCents: number
  apOpenOutstandingCents: number
  mobileFinancialIntentCount: number
  mobileSyncFailureRate: number
  observabilityCoverageRate: number
  queueHealthScore: number
  claimsExposureCents: number
  procurementReorderExposureCents: number
  aiFinancialRiskScore: number
  revenueOptimizationScore: number
}

const ARCHETYPE_METRICS: Record<BlitzpayDemoOrgArchetype, BlitzpayDemoOperationalPresetBundle> = {
  small_contractor: {
    treasuryOperatingCents: 24_200_00,
    treasuryHeldReserveCents: 4_100_00,
    pendingPayoutsCents: 1_800_00,
    payrollPendingCommissionCents: 850_00,
    apOpenOutstandingCents: 9_200_00,
    mobileFinancialIntentCount: 14,
    mobileSyncFailureRate: 0.09,
    observabilityCoverageRate: 0.62,
    queueHealthScore: 72,
    claimsExposureCents: 2_800_00,
    procurementReorderExposureCents: 3_100_00,
    aiFinancialRiskScore: 48,
    revenueOptimizationScore: 54,
  },
  growing_field_service: {
    treasuryOperatingCents: 62_150_00,
    treasuryHeldReserveCents: 11_200_00,
    pendingPayoutsCents: 4_200_00,
    payrollPendingCommissionCents: 2_200_00,
    apOpenOutstandingCents: 19_400_00,
    mobileFinancialIntentCount: 28,
    mobileSyncFailureRate: 0.055,
    observabilityCoverageRate: 0.71,
    queueHealthScore: 81,
    claimsExposureCents: 6_100_00,
    procurementReorderExposureCents: 5_400_00,
    aiFinancialRiskScore: 38,
    revenueOptimizationScore: 58,
  },
  mature_multi_department: {
    treasuryOperatingCents: 128_400_00,
    treasuryHeldReserveCents: 22_500_00,
    pendingPayoutsCents: 8_200_00,
    payrollPendingCommissionCents: 4_150_00,
    apOpenOutstandingCents: 31_900_00,
    mobileFinancialIntentCount: 42,
    mobileSyncFailureRate: 0.04,
    observabilityCoverageRate: 0.78,
    queueHealthScore: 88,
    claimsExposureCents: 12_000_00,
    procurementReorderExposureCents: 9_500_00,
    aiFinancialRiskScore: 34,
    revenueOptimizationScore: 61,
  },
  franchise_style_network: {
    treasuryOperatingCents: 210_300_00,
    treasuryHeldReserveCents: 38_900_00,
    pendingPayoutsCents: 15_600_00,
    payrollPendingCommissionCents: 9_200_00,
    apOpenOutstandingCents: 78_400_00,
    mobileFinancialIntentCount: 86,
    mobileSyncFailureRate: 0.028,
    observabilityCoverageRate: 0.86,
    queueHealthScore: 92,
    claimsExposureCents: 28_000_00,
    procurementReorderExposureCents: 22_600_00,
    aiFinancialRiskScore: 28,
    revenueOptimizationScore: 69,
  },
}

/** Legacy default bundle — identical to the mature multi-department archetype. Prefer {@link getBlitzpayDemoOperationalPresetBundle} when modeling a specific demo org. */
export const BLITZPAY_DEMO_OPERATIONAL_PRESETS: BlitzpayDemoOperationalPresetBundle =
  ARCHETYPE_METRICS.mature_multi_department

export function getBlitzpayDemoOperationalPresetBundle(archetype: BlitzpayDemoOrgArchetype): BlitzpayDemoOperationalPresetBundle {
  return ARCHETYPE_METRICS[archetype]
}

export type BlitzpayDemoOrgArchetypeDescriptor = {
  title: string
  tagline: string
  maturityLabel: string
  primaryTradeFocus: string
}

const ARCHETYPE_COPY: Record<BlitzpayDemoOrgArchetype, BlitzpayDemoOrgArchetypeDescriptor> = {
  small_contractor: {
    title: "Compact mechanical contractor",
    tagline: "Two vans, tight cash cycles, and a finance lead wearing multiple hats.",
    maturityLabel: "Foundational",
    primaryTradeFocus: "Residential HVAC service",
  },
  growing_field_service: {
    title: "Growing field service operator",
    tagline: "Dispatch is busy, AP is climbing with growth, and collections need rhythm.",
    maturityLabel: "Scaling",
    primaryTradeFocus: "Plumbing and light commercial service",
  },
  mature_multi_department: {
    title: "Multi-department service company",
    tagline: "Separate install and service desks with steady membership and treasury discipline.",
    maturityLabel: "Operationally mature",
    primaryTradeFocus: "Electrical and equipment service",
  },
  franchise_style_network: {
    title: "Multi-location contractor network",
    tagline: "Several branches with inter-entity balances and a heavier observability footprint.",
    maturityLabel: "Networked",
    primaryTradeFocus: "Mixed trades across regions",
  },
}

export function describeBlitzpayDemoOrgArchetype(archetype: BlitzpayDemoOrgArchetype): BlitzpayDemoOrgArchetypeDescriptor {
  return ARCHETYPE_COPY[archetype]
}

export type BlitzpayDemoFccShowcaseSnapshot = BlitzpayDemoOperationalPresetBundle & {
  archetype: BlitzpayDemoOrgArchetype
  collectionsOutstandingInvoiceCount: number
  collectionsRecoveryRhythm0to100: number
  membershipsActiveCount: number
  membershipsPastDueCount: number
  vendorBillsAwaitingApprovalCount: number
  financingApplicationsInReview: number
  financingOpenOffersCount: number
  procurementLowStockSkuCount: number
  claimsOpenCount: number
  claimsAwaitingDocumentationCount: number
  observabilityWorkflowFailureRatePct: number
  multiEntityLinkedOrgCount: number
  supplierNetworkHealth0to100: number
  revenueOptimizationQueuedOpportunities: number
  aiOpenRecommendationsCount: number
  payrollRunsPendingReview: number
  payrollRunsApprovedAwaitingClose: number
  /** Staggered “as-of” offsets (days, non-positive) for narrative timelines — sorted ascending. */
  referenceDayOffsets: readonly number[]
}

function archetypeIndex(archetype: BlitzpayDemoOrgArchetype): number {
  return BLITZPAY_DEMO_ORG_ARCHETYPES.indexOf(archetype)
}

export function buildBlitzpayDemoFccShowcaseSnapshot(archetype: BlitzpayDemoOrgArchetype): BlitzpayDemoFccShowcaseSnapshot {
  const base = ARCHETYPE_METRICS[archetype]
  const i = archetypeIndex(archetype)
  const offsets = [-1, -3, -7, -10, -14, -21, -30, -45].slice(0, Math.min(BLITZPAY_DEMO_MAX_REFERENCE_DAY_OFFSETS, 4 + i))

  const multiEntityLinkedOrgCount =
    archetype === "small_contractor" ? 0 : archetype === "growing_field_service" ? 1 : archetype === "mature_multi_department" ? 2 : 6

  return {
    ...base,
    archetype,
    collectionsOutstandingInvoiceCount: 4 + i * 2,
    collectionsRecoveryRhythm0to100: 58 + i * 7,
    membershipsActiveCount: 18 + i * 11,
    membershipsPastDueCount: i === 0 ? 2 : i === 1 ? 1 : i === 2 ? 1 : 0,
    vendorBillsAwaitingApprovalCount: 2 + i,
    financingApplicationsInReview: i >= 2 ? 2 : 1,
    financingOpenOffersCount: i >= 1 ? 2 : 1,
    procurementLowStockSkuCount: 3 + i * 2,
    claimsOpenCount: i === 0 ? 2 : i === 1 ? 3 : 2,
    claimsAwaitingDocumentationCount: i === 0 ? 1 : 0,
    observabilityWorkflowFailureRatePct: Math.round(base.mobileSyncFailureRate * 180 + i * 2),
    multiEntityLinkedOrgCount,
    supplierNetworkHealth0to100: 62 + i * 8,
    revenueOptimizationQueuedOpportunities: 4 + i * 2,
    aiOpenRecommendationsCount: 3 + i,
    payrollRunsPendingReview: i === 0 ? 1 : 0,
    payrollRunsApprovedAwaitingClose: 1,
    referenceDayOffsets: [...offsets].sort((a, b) => a - b),
  }
}

/** Inputs aligned with `computeBlitzpayOperationalReadinessStrip` — keep in sync when that helper changes. */
export type BlitzpayDemoOperationalReadinessFactoryInput = {
  reportingForcedSkips?: boolean
  trialBalanceHealthy: boolean
  stripePayoutsEnabled: boolean
  mobileSyncFailureRate: number
  mobileTreasuryVisibilityScore: number
  mobileSignatureCoverageRate: number
  observabilityCoverageRate: number
  queueHealthScore: number
  workflowFailureRate: number
  replayIntegrityScore: number
}

export function buildBlitzpayDemoOperationalReadinessInputs(archetype: BlitzpayDemoOrgArchetype): BlitzpayDemoOperationalReadinessFactoryInput {
  const m = ARCHETYPE_METRICS[archetype]
  const i = archetypeIndex(archetype)
  const workflowFailureRate = archetype === "small_contractor" ? 0.035 : archetype === "growing_field_service" ? 0.022 : 0.012
  return {
    reportingForcedSkips: archetype === "franchise_style_network",
    trialBalanceHealthy: archetype !== "small_contractor",
    stripePayoutsEnabled: true,
    mobileSyncFailureRate: m.mobileSyncFailureRate,
    mobileTreasuryVisibilityScore: Math.min(0.94, 0.52 + i * 0.1),
    mobileSignatureCoverageRate: Math.min(0.96, 0.5 + i * 0.11),
    observabilityCoverageRate: m.observabilityCoverageRate,
    queueHealthScore: m.queueHealthScore,
    workflowFailureRate,
    replayIntegrityScore: Math.max(0.72, 0.9 - i * 0.03),
  }
}

export function validateBlitzpayDemoFixtureCoherence(snapshot: BlitzpayDemoFccShowcaseSnapshot): { ok: true } | { ok: false; reason: string } {
  const nonNeg = [
    snapshot.treasuryOperatingCents,
    snapshot.treasuryHeldReserveCents,
    snapshot.pendingPayoutsCents,
    snapshot.payrollPendingCommissionCents,
    snapshot.apOpenOutstandingCents,
    snapshot.claimsExposureCents,
    snapshot.procurementReorderExposureCents,
  ]
  if (nonNeg.some((n) => !Number.isFinite(n) || n < 0 || !Number.isInteger(n))) {
    return { ok: false, reason: "currency fields must be non-negative integers" }
  }
  if (snapshot.claimsExposureCents > Math.floor(snapshot.apOpenOutstandingCents * 0.55)) {
    return { ok: false, reason: "claims exposure should stay modest versus AP for believable demos" }
  }
  if (snapshot.procurementReorderExposureCents > snapshot.apOpenOutstandingCents) {
    return { ok: false, reason: "procurement reorder exposure should not exceed AP outstanding in demo fixtures" }
  }
  if (snapshot.mobileFinancialIntentCount > 200) {
    return { ok: false, reason: "mobile intent sample count too large for demo bounds" }
  }
  if (snapshot.referenceDayOffsets.length > BLITZPAY_DEMO_MAX_REFERENCE_DAY_OFFSETS) {
    return { ok: false, reason: "too many reference offsets" }
  }
  if (snapshot.referenceDayOffsets.some((d) => d > 0 || d < -120)) {
    return { ok: false, reason: "reference offsets must be in [-120, 0]" }
  }
  for (let k = 1; k < snapshot.referenceDayOffsets.length; k += 1) {
    if (snapshot.referenceDayOffsets[k]! < snapshot.referenceDayOffsets[k - 1]!) {
      return { ok: false, reason: "reference offsets must be sorted ascending" }
    }
  }
  return { ok: true }
}

export type BlitzpayDemoShowcaseMetricKey =
  | "treasury_movement"
  | "collections_pulse"
  | "payroll_visibility"
  | "ap_aging_signal"
  | "financing_pipeline"
  | "procurement_exposure"
  | "claims_activity"
  | "observability_health"
  | "ai_advisory_queue"
  | "revenue_optimization_queue"
  | "multi_entity_footprint"
  | "supplier_network_posture"

const SHOWCASE_METRIC_LABELS: Record<BlitzpayDemoShowcaseMetricKey, string> = {
  treasury_movement: "Treasury movement (operating versus held)",
  collections_pulse: "Collections rhythm (open invoices versus recovery score)",
  payroll_visibility: "Payroll visibility (pending commissions and run posture)",
  ap_aging_signal: "Vendor AP posture (open balances versus approvals)",
  financing_pipeline: "Financing pipeline (applications in review and open offers)",
  procurement_exposure: "Procurement exposure (low-stock signals versus reorder dollars)",
  claims_activity: "Claims and protection activity (open versus documentation)",
  observability_health: "Observability health (coverage versus workflow noise)",
  ai_advisory_queue: "AI advisory queue depth (open recommendations)",
  revenue_optimization_queue: "Revenue optimization opportunities queued",
  multi_entity_footprint: "Multi-entity footprint (linked org count)",
  supplier_network_posture: "Supplier network health score",
}

/**
 * Human-facing label for FCC-style showcase tiles — never echoes internal key strings to UI.
 */
export function getBlitzpayDemoShowcaseMetricLabel(key: BlitzpayDemoShowcaseMetricKey): string {
  return SHOWCASE_METRIC_LABELS[key]
}

export type BlitzpayDemoModuleHealthTag = {
  moduleLabel: string
  tone: "healthy" | "attention" | "elevated"
}

export function getBlitzpayDemoModuleHealthTags(archetype: BlitzpayDemoOrgArchetype): readonly BlitzpayDemoModuleHealthTag[] {
  const snap = buildBlitzpayDemoFccShowcaseSnapshot(archetype)
  const tags: BlitzpayDemoModuleHealthTag[] = [
    { moduleLabel: "Treasury", tone: snap.treasuryOperatingCents > 40_000_00 ? "healthy" : "attention" },
    { moduleLabel: "Collections", tone: snap.collectionsRecoveryRhythm0to100 >= 70 ? "healthy" : "attention" },
    { moduleLabel: "Payroll accruals", tone: snap.payrollPendingCommissionCents < 6_000_00 ? "healthy" : "elevated" },
    { moduleLabel: "Vendor AP", tone: snap.vendorBillsAwaitingApprovalCount <= 2 ? "healthy" : "attention" },
    { moduleLabel: "Financing desk", tone: snap.financingApplicationsInReview <= 1 ? "healthy" : "attention" },
    { moduleLabel: "Procurement", tone: snap.procurementLowStockSkuCount <= 5 ? "healthy" : "attention" },
    { moduleLabel: "Claims", tone: snap.claimsAwaitingDocumentationCount === 0 ? "healthy" : "elevated" },
    { moduleLabel: "Observability", tone: snap.queueHealthScore >= 85 ? "healthy" : "attention" },
    { moduleLabel: "AI insights", tone: snap.aiOpenRecommendationsCount <= 4 ? "healthy" : "attention" },
    { moduleLabel: "Revenue optimization", tone: snap.revenueOptimizationQueuedOpportunities <= 8 ? "healthy" : "attention" },
  ]
  return tags
}

const ACTIVITY_BY_ARCH: Record<BlitzpayDemoOrgArchetype, readonly string[]> = {
  small_contractor: [
    "Field tech captured a customer authorization before starting a coil replacement.",
    "Dispatch linked a follow-up visit to the same customer after a parts delay note.",
    "Accounts receivable scheduled a hosted payment reminder on a residential invoice.",
    "A vendor bill for consumables is awaiting a second approver under the small-team threshold.",
    "Treasury snapshot shows operating cash slightly below the internal reserve target.",
  ],
  growing_field_service: [
    "Two install crews closed work orders; billing queued invoices for the commercial job pack.",
    "Membership renewals show one account in grace with autopay retry already logged.",
    "AP aging flagged a supplier concentration line item for finance review next week.",
    "Collections playbook suggested ACH preference for a repeat commercial payer.",
    "Mobile sync batch finished with a small number of queued items still offline.",
    "Financing marketplace returned one counteroffer for a vehicle replacement bundle.",
  ],
  mature_multi_department: [
    "Service desk posted deferred revenue recognition for a completed PM contract block.",
    "Treasury held reserve increased after a large payout cleared over the weekend.",
    "Claims desk moved one protection-plan case from intake to documentation review.",
    "Procurement flagged three SKUs under forecasted minimums without auto-reordering.",
    "Observability workflow replay was reviewed by an owner after a transient queue spike.",
    "Revenue optimization surfaced a polite installment option for a seasonal payer.",
    "Multi-entity rollup shows a modest inter-company balance awaiting settlement planning.",
  ],
  franchise_style_network: [
    "Regional controller approved a payroll run with two items still pending mobile sign-off.",
    "Supplier network benchmark shows bulk refrigerant savings versus peer aggregate.",
    "Inter-company balances ticked up after a shared inventory transfer between branches.",
    "Enterprise observability noted a bounded idempotency conflict rate after a deploy window.",
    "AI advisory recommended tightening collection touchpoints for one high-variance branch.",
    "Storm financial planning row was updated for a coastal service territory drill.",
    "Franchise-style membership mix shows healthy renewal cadence with one branch trailing.",
  ],
}

export function getBlitzpayDemoActivityFeedLines(archetype: BlitzpayDemoOrgArchetype): readonly string[] {
  return ACTIVITY_BY_ARCH[archetype].slice(0, BLITZPAY_DEMO_MAX_ACTIVITY_FEED_LINES)
}

export type BlitzpayDemoScenarioCard = {
  headline: string
  bullets: readonly string[]
}

export function getBlitzpayDemoScenarioCard(archetype: BlitzpayDemoOrgArchetype): BlitzpayDemoScenarioCard {
  const d = describeBlitzpayDemoOrgArchetype(archetype)
  const lines = ACTIVITY_BY_ARCH[archetype]
  const bullets = [
    `${d.primaryTradeFocus}: believable volumes, not perfect scorecards.`,
    "Cash, AP, payroll, and collections move together — warnings appear beside strengths.",
    "Cross-module references stay consistent: claims stay smaller than AP, procurement stays bounded.",
    lines[0] ?? "Operational summaries stay short and specific for screenshots.",
  ].slice(0, BLITZPAY_DEMO_MAX_SCENARIO_BULLETS)
  return { headline: d.title, bullets }
}

/** Stable ordering for pickers and tests. */
export function listBlitzpayDemoOrgArchetypesSorted(): readonly BlitzpayDemoOrgArchetype[] {
  return [...BLITZPAY_DEMO_ORG_ARCHETYPES].sort((a, b) => a.localeCompare(b))
}
