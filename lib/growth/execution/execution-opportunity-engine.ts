import { commandLeadFocusHref } from "@/lib/growth/command/command-action-catalog"
import type {
  ExpansionOpportunityItem,
  ExpansionRecommendationKind,
  ExecutionPrioritySignal,
} from "@/lib/growth/execution/execution-priority-types"
import {
  EXPANSION_RECOMMENDATION_LABELS,
} from "@/lib/growth/execution/execution-priority-types"
import { computeExecutionPriorityScore } from "@/lib/growth/execution/execution-priority-score"

export type ExpansionContext = {
  leadId: string | null
  customerProfileId: string | null
  companyName: string
  healthScore: number
  lifecycleStage: string
  expansionScore: number
  engagementTier: string | null
  contactsEngaged: number
  meetingQualityScore: number | null
  callOverallScore: number | null
  renewalPosture: "strong" | "neutral" | "weak"
  reviewStatus: string | null
  referralStatus: string | null
}

function activeSignals(ctx: ExpansionContext): ExecutionPrioritySignal[] {
  const input: Partial<Record<string, boolean>> = {}
  if (["healthy", "activated", "expansion_candidate"].includes(ctx.lifecycleStage)) {
    input.expansion_candidate = true
  }
  if (ctx.healthScore >= 70) input.buying_signal_detected = true
  if (ctx.contactsEngaged >= 2) input.buying_signal_detected = true
  if ((ctx.meetingQualityScore ?? 0) >= 70) input.high_confidence_close_window = true
  if ((ctx.callOverallScore ?? 0) >= 65) input.buying_signal_detected = true
  if (ctx.renewalPosture === "strong") input.expansion_candidate = true
  return computeExecutionPriorityScore(input).signals
}

function resolveRecommendation(ctx: ExpansionContext): ExpansionRecommendationKind {
  if (ctx.expansionScore >= 75 && ctx.healthScore >= 70) return "upsell"
  if (ctx.expansionScore >= 60) return "cross_sell"
  if (["referral_eligible", "referral_requested"].includes(ctx.referralStatus ?? "")) return "referral_ask"
  if (ctx.healthScore >= 80 && (ctx.callOverallScore ?? 0) >= 70) return "case_study_candidate"
  if (["review_pending", "review_requested"].includes(ctx.reviewStatus ?? "")) return "review_ask"
  if (ctx.contactsEngaged >= 3 && ctx.healthScore >= 65) return "referral_ask"
  return "cross_sell"
}

function resolveWhy(ctx: ExpansionContext, recommendation: ExpansionRecommendationKind): string {
  if (recommendation === "upsell") return "Strong adoption and expansion score support an upsell conversation."
  if (recommendation === "cross_sell") return "Positive engagement signals a cross-sell opportunity."
  if (recommendation === "referral_ask") return "Multiple engaged contacts with healthy renewal posture."
  if (recommendation === "case_study_candidate") return "High meeting and call quality — good case study candidate."
  return "Healthy customer with positive engagement — good time for a review ask."
}

export function buildExpansionOpportunity(ctx: ExpansionContext): ExpansionOpportunityItem | null {
  const signals = activeSignals(ctx)
  if (signals.length === 0) return null
  if (ctx.healthScore < 55 && ctx.expansionScore < 50) return null

  const recommendation = resolveRecommendation(ctx)
  const { executionPriorityScore } = computeExecutionPriorityScore(
    Object.fromEntries(signals.map((s) => [s.key, true])),
  )

  const href = ctx.leadId
    ? commandLeadFocusHref(ctx.leadId, "command")
    : "/admin/growth/customer-lifecycle"

  return {
    id: `expand:${ctx.customerProfileId ?? ctx.leadId ?? "unknown"}:${recommendation}`,
    leadId: ctx.leadId,
    customerProfileId: ctx.customerProfileId,
    companyName: ctx.companyName,
    recommendation,
    recommendationLabel: EXPANSION_RECOMMENDATION_LABELS[recommendation],
    executionPriorityScore,
    signals,
    why: resolveWhy(ctx, recommendation),
    ctaHref: href,
  }
}

export function buildExpansionOpportunities(contexts: ExpansionContext[]): ExpansionOpportunityItem[] {
  return contexts
    .map(buildExpansionOpportunity)
    .filter((item): item is ExpansionOpportunityItem => item !== null)
    .sort((a, b) => b.executionPriorityScore - a.executionPriorityScore)
}
