/**
 * Phase 4B — deterministic revenue optimization metrics, opportunity composition, and reporting fields.
 * No server-only import; safe for unit tests.
 */

import { createHash } from "node:crypto"

const PEPPER = process.env.BLITZPAY_REVENUE_OPT_AUDIT_PEPPER ?? "blitzpay_revenue_opt_audit_pepper_dev_only"

export type RevenueOptimizationOpportunityType =
  | "reminder_timing"
  | "membership_pricing"
  | "recovery_sequence"
  | "churn_prevention"
  | "ach_nudge"
  | "technician_coaching"
  | "renewal_timing"
  | "payment_behavior"
  | "financing_offer"
  | "custom"

export type RevenueOptimizationActionType =
  | "review_reminder_timing"
  | "review_membership_price"
  | "review_recovery_sequence"
  | "review_churn_risk"
  | "review_ach_nudge"
  | "review_technician_coaching"
  | "review_renewal_timing"
  | "review_financing_offer"
  | "manual_review"

export type RevenueOptimizationContext = {
  achAccelerationOpportunityCents: number
  reminderConversionRatePct: number
  fieldCollectionRecoveryRatePct: number
  recoveryFlowCompletionRate: number
  failedPaymentRate: number
  blitzpayChurnRiskScore0to100: number
  renewalPipelineCents: number
  recurringRevenueCents: number
  delinquentMembershipRevenueCents: number
  membershipAutoPayAdoptionBasisPoints: number
  savedPaymentMethodRate: number
  autopayEnrollmentRate: number
  technicianAssistedRecoveryRatePct: number
  likelyFieldCollectibleCents: number
  workOrdersWithCollectibleBalancesCount: number
  financingReadyQuotesCount: number
  financingRevenueOpportunity: number
  estimatedRecoverableOverdueCents: number
  collectionSuccessRate: number
  billingReadinessRate: number
}

export type RevenueOpportunityDraft = {
  opportunity_type: RevenueOptimizationOpportunityType
  priority: "low" | "medium" | "high" | "critical"
  title: string
  summary: string
  deterministic_score: number
  estimated_revenue_impact_cents: number | null
  confidence_score: number | null
  supporting_metrics: Record<string, number | string | boolean>
  recommended_action: string
}

const PRIORITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }

export function canonicalizeForRevOptAudit(input: Record<string, unknown>): string {
  const keys = Object.keys(input).sort()
  const out: Record<string, unknown> = {}
  for (const k of keys) out[k] = input[k]
  return JSON.stringify(out)
}

export function buildRevenueOptimizationAuditHash(parts: Record<string, unknown>): string {
  return createHash("sha256").update(PEPPER).update("|").update(canonicalizeForRevOptAudit(parts)).digest("hex")
}

export function defaultActionTypeForOpportunity(t: RevenueOptimizationOpportunityType): RevenueOptimizationActionType {
  switch (t) {
    case "reminder_timing":
      return "review_reminder_timing"
    case "membership_pricing":
      return "review_membership_price"
    case "recovery_sequence":
      return "review_recovery_sequence"
    case "churn_prevention":
      return "review_churn_risk"
    case "ach_nudge":
      return "review_ach_nudge"
    case "technician_coaching":
      return "review_technician_coaching"
    case "renewal_timing":
      return "review_renewal_timing"
    case "financing_offer":
      return "review_financing_offer"
    case "payment_behavior":
    case "custom":
    default:
      return "manual_review"
  }
}

export function compareOpportunitiesDeterministic(a: RevenueOpportunityDraft, b: RevenueOpportunityDraft): number {
  const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
  if (pr !== 0) return pr
  if (b.deterministic_score !== a.deterministic_score) return b.deterministic_score - a.deterministic_score
  return String(a.opportunity_type).localeCompare(String(b.opportunity_type))
}

export function sortRevenueOpportunitiesDeterministic(rows: RevenueOpportunityDraft[]): RevenueOpportunityDraft[] {
  return [...rows].sort(compareOpportunitiesDeterministic)
}

export function composeRevenueOptimizationOpportunities(ctx: RevenueOptimizationContext): RevenueOpportunityDraft[] {
  const out: RevenueOpportunityDraft[] = []

  if (ctx.reminderConversionRatePct < 42 && ctx.estimatedRecoverableOverdueCents > 0) {
    const score = Math.min(100, 55 + Math.floor((42 - ctx.reminderConversionRatePct) * 2))
    out.push({
      opportunity_type: "reminder_timing",
      priority: score >= 72 ? "high" : "medium",
      title: "Reminder timing may be leaving cash on the table",
      summary:
        "Reminder-to-paid conversion is below a healthy baseline while overdue balances exist. Consider shifting reminder windows (earlier weekday sends, spacing before due date) — this does not send messages automatically.",
      deterministic_score: score,
      estimated_revenue_impact_cents: Math.min(ctx.estimatedRecoverableOverdueCents, Math.floor(ctx.estimatedRecoverableOverdueCents * 0.12)),
      confidence_score: 62,
      supporting_metrics: {
        reminder_conversion_rate_pct: ctx.reminderConversionRatePct,
        estimated_recoverable_overdue_cents: ctx.estimatedRecoverableOverdueCents,
      },
      recommended_action: "Review reminder templates and timing with your team; no automatic sends from BlitzPay.",
    })
  }

  if (ctx.recurringRevenueCents > 0 && (ctx.delinquentMembershipRevenueCents > 0 || ctx.membershipAutoPayAdoptionBasisPoints < 4500)) {
    const score = Math.min(100, 48 + Math.floor(ctx.blitzpayChurnRiskScore0to100 * 0.35))
    out.push({
      opportunity_type: "membership_pricing",
      priority: score >= 70 ? "high" : "medium",
      title: "Membership pricing and delinquency deserve a focused review",
      summary:
        "Recurring revenue is active but delinquent membership dollars or autopay adoption suggest pricing, plan packaging, or renewal terms may need tuning — recommendations only; no price changes are applied here.",
      deterministic_score: score,
      estimated_revenue_impact_cents: ctx.delinquentMembershipRevenueCents > 0 ? ctx.delinquentMembershipRevenueCents : Math.floor(ctx.recurringRevenueCents * 0.05),
      confidence_score: 58,
      supporting_metrics: {
        recurring_revenue_cents: ctx.recurringRevenueCents,
        delinquent_membership_revenue_cents: ctx.delinquentMembershipRevenueCents,
        membership_autopay_adoption_bp: ctx.membershipAutoPayAdoptionBasisPoints,
      },
      recommended_action: "Schedule an internal pricing review; customer outreach stays manual.",
    })
  }

  if (ctx.recoveryFlowCompletionRate < 55 && ctx.failedPaymentRate > 8) {
    out.push({
      opportunity_type: "recovery_sequence",
      priority: "medium",
      title: "Recovery sequence completion has headroom",
      summary:
        "Failed-payment volume is elevated versus recovery-flow completion. Review playbook ordering and staff follow-up — Phase 2AB retry caps are not overridden by this recommendation.",
      deterministic_score: Math.min(100, 50 + Math.floor((55 - ctx.recoveryFlowCompletionRate) * 1.2)),
      estimated_revenue_impact_cents: Math.min(ctx.achAccelerationOpportunityCents, ctx.estimatedRecoverableOverdueCents),
      confidence_score: 60,
      supporting_metrics: {
        recovery_flow_completion_rate: ctx.recoveryFlowCompletionRate,
        failed_payment_rate: ctx.failedPaymentRate,
      },
      recommended_action: "Audit recovery steps in BlitzPay collections settings; keep within approved retry windows.",
    })
  }

  if (ctx.blitzpayChurnRiskScore0to100 >= 48) {
    out.push({
      opportunity_type: "churn_prevention",
      priority: ctx.blitzpayChurnRiskScore0to100 >= 72 ? "critical" : "high",
      title: "Churn-prevention indicators are elevated",
      summary:
        "Renewal and membership churn signals exceed a comfortable band. Prioritize retention outreach planning internally — no automatic customer contact.",
      deterministic_score: ctx.blitzpayChurnRiskScore0to100,
      estimated_revenue_impact_cents: Math.min(ctx.renewalPipelineCents, Math.floor(ctx.renewalPipelineCents * 0.15)),
      confidence_score: 64,
      supporting_metrics: { churn_risk_score: ctx.blitzpayChurnRiskScore0to100, renewal_pipeline_cents: ctx.renewalPipelineCents },
      recommended_action: "Align renewals and failed-payment follow-up with your customer success process.",
    })
  }

  if (ctx.achAccelerationOpportunityCents > 5_000 && ctx.savedPaymentMethodRate < 70) {
    out.push({
      opportunity_type: "ach_nudge",
      priority: "medium",
      title: "ACH acceleration opportunity with saved-method headroom",
      summary:
        "There is recoverable balance where ACH acceleration may help once customers save a bank method. This flags segments for manual education — no ACH debits or nudges are sent automatically.",
      deterministic_score: Math.min(100, 45 + Math.floor(ctx.achAccelerationOpportunityCents / 8000)),
      estimated_revenue_impact_cents: Math.floor(ctx.achAccelerationOpportunityCents * 0.2),
      confidence_score: 55,
      supporting_metrics: {
        ach_acceleration_opportunity_cents: ctx.achAccelerationOpportunityCents,
        saved_payment_method_rate: ctx.savedPaymentMethodRate,
      },
      recommended_action: "Identify customer segments for optional saved-ACH enrollment campaigns (manual).",
    })
  }

  if (ctx.likelyFieldCollectibleCents > 10_000 && ctx.technicianAssistedRecoveryRatePct < 45) {
    out.push({
      opportunity_type: "technician_coaching",
      priority: "medium",
      title: "Field collection coaching opportunity",
      summary:
        "Collectible field balances are meaningful while technician-assisted recovery rates trail benchmarks. Use internal coaching — no automatic technician messages.",
      deterministic_score: Math.min(100, 52 + Math.floor(ctx.workOrdersWithCollectibleBalancesCount / 3)),
      estimated_revenue_impact_cents: Math.min(ctx.likelyFieldCollectibleCents, Math.floor(ctx.likelyFieldCollectibleCents * 0.18)),
      confidence_score: 57,
      supporting_metrics: {
        likely_field_collectible_cents: ctx.likelyFieldCollectibleCents,
        technician_assisted_recovery_rate_pct: ctx.technicianAssistedRecoveryRatePct,
        work_orders_with_collectible_balances: ctx.workOrdersWithCollectibleBalancesCount,
      },
      recommended_action: "Review field collect workflow and training materials with leads.",
    })
  }

  if (ctx.renewalPipelineCents > 20_000 && ctx.fieldCollectionRecoveryRatePct < 50) {
    out.push({
      opportunity_type: "renewal_timing",
      priority: "medium",
      title: "Renewal timing and field recovery could be better aligned",
      summary:
        "Renewal pipeline dollars are healthy but field recovery rates suggest timing friction. Adjust renewal windows internally — memberships are not auto-renewed or cancelled here.",
      deterministic_score: Math.min(100, 46 + Math.floor(ctx.renewalPipelineCents / 25_000)),
      estimated_revenue_impact_cents: Math.floor(ctx.renewalPipelineCents * 0.08),
      confidence_score: 54,
      supporting_metrics: {
        renewal_pipeline_cents: ctx.renewalPipelineCents,
        field_collection_recovery_rate_pct: ctx.fieldCollectionRecoveryRatePct,
      },
      recommended_action: "Map renewal dates against field cash collection cadence in planning meetings.",
    })
  }

  if (ctx.autopayEnrollmentRate < 55 || ctx.savedPaymentMethodRate < 60) {
    out.push({
      opportunity_type: "payment_behavior",
      priority: "low",
      title: "Payment behavior coverage can improve",
      summary:
        "Autopay and saved-method adoption sit below typical readiness targets. Improve customer billing profiles over time — no automatic enrollment.",
      deterministic_score: Math.min(100, 40 + Math.floor((100 - ctx.autopayEnrollmentRate) * 0.5)),
      estimated_revenue_impact_cents: Math.floor(ctx.estimatedRecoverableOverdueCents * 0.06),
      confidence_score: 52,
      supporting_metrics: {
        autopay_enrollment_rate: ctx.autopayEnrollmentRate,
        saved_payment_method_rate: ctx.savedPaymentMethodRate,
      },
      recommended_action: "Prioritize accounts for optional autopay invitations during normal billing touchpoints.",
    })
  }

  if (ctx.financingReadyQuotesCount > 0 && ctx.financingRevenueOpportunity > 0) {
    out.push({
      opportunity_type: "financing_offer",
      priority: "low",
      title: "Financing offer follow-up opportunity",
      summary:
        "Open financing-ready quotes indicate staged-pay or third-party financing could unlock revenue. Offers are not auto-approved or auto-sent.",
      deterministic_score: Math.min(100, 38 + ctx.financingReadyQuotesCount * 6),
      estimated_revenue_impact_cents: Math.min(ctx.financingRevenueOpportunity, 250_000),
      confidence_score: 50,
      supporting_metrics: {
        financing_ready_quotes: ctx.financingReadyQuotesCount,
        financing_revenue_opportunity: ctx.financingRevenueOpportunity,
      },
      recommended_action: "Review open quotes with financing options in staff workflows only.",
    })
  }

  return sortRevenueOpportunitiesDeterministic(out).slice(0, 20)
}

export type BlitzpayPhase4bReportingFields = {
  revenueOptimizationScore: number
  estimatedRevenueOpportunityCents: number
  paymentBehaviorCoverageRate: number
  churnPreventionOpportunityCount: number
  achNudgeOpportunityCount: number
  renewalOptimizationOpportunityCount: number
  technicianCoachingOpportunityCount: number
  optimizationExperimentCount: number
}

export function computeBlitzpayPhase4bReportingFields(
  ctx: RevenueOptimizationContext,
  opts?: { activeExperimentCount?: number },
): BlitzpayPhase4bReportingFields {
  const opps = composeRevenueOptimizationOpportunities(ctx)
  const experimentCount = Math.max(0, Math.round(opts?.activeExperimentCount ?? 0))
  const maxScore = opps.reduce((m, o) => Math.max(m, o.deterministic_score), 0)
  const avgTop = opps.length === 0 ? 0 : Math.floor(opps.slice(0, 3).reduce((s, o) => s + o.deterministic_score, 0) / Math.min(3, opps.length))
  const revenueOptimizationScore = Math.min(100, Math.max(maxScore, avgTop))

  let est = 0
  for (const o of opps) {
    est += o.estimated_revenue_impact_cents ?? 0
  }
  const estimatedRevenueOpportunityCents = Math.min(50_000_000, Math.max(0, est))

  const paymentBehaviorCoverageRate = Math.min(
    100,
    Math.floor((ctx.autopayEnrollmentRate + ctx.savedPaymentMethodRate + ctx.billingReadinessRate) / 3),
  )

  const countType = (t: RevenueOptimizationOpportunityType) => opps.filter((o) => o.opportunity_type === t).length

  return {
    revenueOptimizationScore,
    estimatedRevenueOpportunityCents,
    paymentBehaviorCoverageRate,
    churnPreventionOpportunityCount: countType("churn_prevention"),
    achNudgeOpportunityCount: countType("ach_nudge"),
    renewalOptimizationOpportunityCount: countType("renewal_timing"),
    technicianCoachingOpportunityCount: countType("technician_coaching"),
    optimizationExperimentCount: experimentCount,
  }
}

function znum(n: number | undefined | null): number {
  if (n == null || !Number.isFinite(n)) return 0
  return Math.round(n)
}

/** Normalize partial snapshot fields into a bounded optimization context. */
export function normalizeRevenueOptimizationContext(p: Partial<RevenueOptimizationContext>): RevenueOptimizationContext {
  return {
    achAccelerationOpportunityCents: znum(p.achAccelerationOpportunityCents),
    reminderConversionRatePct: znum(p.reminderConversionRatePct),
    fieldCollectionRecoveryRatePct: znum(p.fieldCollectionRecoveryRatePct),
    recoveryFlowCompletionRate: znum(p.recoveryFlowCompletionRate),
    failedPaymentRate: znum(p.failedPaymentRate),
    blitzpayChurnRiskScore0to100: znum(p.blitzpayChurnRiskScore0to100),
    renewalPipelineCents: znum(p.renewalPipelineCents),
    recurringRevenueCents: znum(p.recurringRevenueCents),
    delinquentMembershipRevenueCents: znum(p.delinquentMembershipRevenueCents),
    membershipAutoPayAdoptionBasisPoints: znum(p.membershipAutoPayAdoptionBasisPoints),
    savedPaymentMethodRate: znum(p.savedPaymentMethodRate),
    autopayEnrollmentRate: znum(p.autopayEnrollmentRate),
    technicianAssistedRecoveryRatePct: znum(p.technicianAssistedRecoveryRatePct),
    likelyFieldCollectibleCents: znum(p.likelyFieldCollectibleCents),
    workOrdersWithCollectibleBalancesCount: znum(p.workOrdersWithCollectibleBalancesCount),
    financingReadyQuotesCount: znum(p.financingReadyQuotesCount),
    financingRevenueOpportunity: znum(p.financingRevenueOpportunity),
    estimatedRecoverableOverdueCents: znum(p.estimatedRecoverableOverdueCents),
    collectionSuccessRate: znum(p.collectionSuccessRate),
    billingReadinessRate: znum(p.billingReadinessRate),
  }
}
