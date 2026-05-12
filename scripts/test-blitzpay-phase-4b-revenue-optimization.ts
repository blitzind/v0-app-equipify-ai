/**
 * BlitzPay Phase 4B — revenue optimization foundations (deterministic helpers + static guards).
 * Run: pnpm test:blitzpay-phase-4b-revenue-optimization
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  computeAchNudgeFitScore0to100,
  computeAutopayFitScore0to100,
  computeLatePaymentRiskScore0to100,
  computePaymentReliabilityScore0to100,
  computeRenewalRiskScore0to100,
  type CustomerInvoiceSignals,
} from "../lib/blitzpay/blitzpay-customer-payment-behavior"
import { computeExperimentLiftBasisPoints, formatExperimentLiftSummary } from "../lib/blitzpay/blitzpay-optimization-experiments"
import {
  buildRevenueOptimizationAuditHash,
  compareOpportunitiesDeterministic,
  composeRevenueOptimizationOpportunities,
  computeBlitzpayPhase4bReportingFields,
  normalizeRevenueOptimizationContext,
  sortRevenueOpportunitiesDeterministic,
  type RevenueOpportunityDraft,
} from "../lib/blitzpay/blitzpay-revenue-optimization-metrics"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")

function readUtf8(rel: string): string {
  return fs.readFileSync(path.join(APP_ROOT, rel), "utf8")
}

const signals: CustomerInvoiceSignals = {
  openNonPaidCount: 2,
  overdueCount: 1,
  paidLast90dCount: 3,
  totalOpenCents: 40_000,
  hasSavedPaymentMethod: false,
  autopayEnrolled: false,
}

assert.equal(computePaymentReliabilityScore0to100(signals) >= 0, true)
assert.equal(computeLatePaymentRiskScore0to100(signals) >= 0, true)
assert.equal(computeAutopayFitScore0to100(signals) >= 0, true)
assert.equal(computeAchNudgeFitScore0to100(signals) >= 0, true)
assert.equal(computeRenewalRiskScore0to100(signals, 55) >= 0, true)

const ctx = normalizeRevenueOptimizationContext({
  reminderConversionRatePct: 30,
  estimatedRecoverableOverdueCents: 100_000,
  recoveryFlowCompletionRate: 40,
  failedPaymentRate: 12,
  blitzpayChurnRiskScore0to100: 70,
  renewalPipelineCents: 50_000,
  recurringRevenueCents: 200_000,
  delinquentMembershipRevenueCents: 10_000,
  membershipAutoPayAdoptionBasisPoints: 4000,
  achAccelerationOpportunityCents: 20_000,
  savedPaymentMethodRate: 50,
  likelyFieldCollectibleCents: 50_000,
  technicianAssistedRecoveryRatePct: 30,
  workOrdersWithCollectibleBalancesCount: 12,
  fieldCollectionRecoveryRatePct: 40,
  financingReadyQuotesCount: 2,
  financingRevenueOpportunity: 5000,
  collectionSuccessRate: 60,
  billingReadinessRate: 55,
  autopayEnrollmentRate: 40,
})

const opps = composeRevenueOptimizationOpportunities(ctx)
assert.ok(opps.length >= 1)
const sorted = sortRevenueOpportunitiesDeterministic([...opps].reverse())
const ref = [...opps].sort(compareOpportunitiesDeterministic)
assert.equal(sorted[0]?.opportunity_type, ref[0]?.opportunity_type)

const p4b = computeBlitzpayPhase4bReportingFields(ctx, { activeExperimentCount: 2 })
assert.equal(typeof p4b.revenueOptimizationScore, "number")
assert.equal(p4b.optimizationExperimentCount, 2)
assert.ok(p4b.estimatedRevenueOpportunityCents >= 0)

const lift = computeExperimentLiftBasisPoints({ baselineValue: 100, observedValue: 110 })
assert.equal(lift, 1000)
assert.match(formatExperimentLiftSummary(lift), /10/)

const h1 = buildRevenueOptimizationAuditHash({ a: 1, z: 2, t: "x" })
const h2 = buildRevenueOptimizationAuditHash({ z: 2, a: 1, t: "x" })
assert.equal(h1, h2)

const mig = readUtf8("supabase/migrations/20261117120000_blitzpay_phase_4b_revenue_optimization.sql")
assert.match(mig, /blitzpay_revenue_optimization_opportunities/)
assert.match(mig, /blitzpay_rev_opt_audit_block_mutation/)

for (const rel of [
  "app/api/organizations/[organizationId]/blitzpay/revenue-optimization/opportunities/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/revenue-optimization/generate/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/revenue-optimization/actions/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/revenue-optimization/actions/[id]/acknowledge/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/revenue-optimization/actions/[id]/complete/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/revenue-optimization/opportunities/[id]/dismiss/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/revenue-optimization/experiments/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/revenue-optimization/payment-behavior/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/revenue-optimization/health/route.ts",
]) {
  const src = readUtf8(rel)
  assert.match(src, /requireAnyOrgPermission/)
  assert.match(src, /blitzpaySchemaGuardNextResponse/)
}

const svcPath = readUtf8("lib/blitzpay/blitzpay-revenue-optimization-service.ts")
assert.match(svcPath, /export const BLITZPAY_REV_OPT_LIST_CAP = 50/)
assert.match(svcPath, /export const BLITZPAY_REV_OPT_BEHAVIOR_CUSTOMER_CAP = 40/)
assert.match(svcPath, /\.limit\(/)

const schemaSrc = readUtf8("lib/blitzpay/blitzpay-schema-health.ts")
assert.match(schemaSrc, /blitzpay_revenue_optimization_opportunities/)
assert.match(schemaSrc, /blitzpay_customer_payment_behavior_scores/)

const tie: RevenueOpportunityDraft[] = [
  {
    opportunity_type: "reminder_timing",
    priority: "high",
    title: "r",
    summary: "s",
    deterministic_score: 50,
    estimated_revenue_impact_cents: 0,
    confidence_score: 50,
    supporting_metrics: {},
    recommended_action: "x",
  },
  {
    opportunity_type: "ach_nudge",
    priority: "high",
    title: "a",
    summary: "s",
    deterministic_score: 50,
    estimated_revenue_impact_cents: 0,
    confidence_score: 50,
    supporting_metrics: {},
    recommended_action: "x",
  },
]
const tieSorted = sortRevenueOpportunitiesDeterministic(tie)
assert.equal(tieSorted[0]?.opportunity_type, "ach_nudge")

console.log("blitzpay phase 4b revenue optimization tests passed")
