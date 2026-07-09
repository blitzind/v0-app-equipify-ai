/** GE-AIOS-10B — Composite ranking from score dimensions (deterministic). */

import { scoreApprovalGate } from "@/lib/growth/decision-engine/scoring/approval-score"
import { scoreConfidence } from "@/lib/growth/decision-engine/scoring/confidence-score"
import {
  scoreBusinessUnderstanding,
  scoreCustomerImpact,
  scoreEffort,
} from "@/lib/growth/decision-engine/scoring/effort-score"
import { scoreDependencies } from "@/lib/growth/decision-engine/scoring/dependency-score"
import { scoreRevenueImpact } from "@/lib/growth/decision-engine/scoring/revenue-impact"
import { scoreUrgency } from "@/lib/growth/decision-engine/scoring/urgency-score"
import type {
  DecisionCandidate,
  DecisionContext,
  DecisionScoreBreakdown,
  NextBestAction,
} from "@/lib/growth/decision-engine/types"
import { buildNextBestActionReasons } from "@/lib/growth/decision-engine/recommendations/build-next-best-actions"

const WEIGHTS = {
  revenue_impact: 0.22,
  customer_impact: 0.13,
  urgency: 0.2,
  confidence: 0.15,
  business_understanding: 0.1,
  dependencies: 0.1,
  effort_inverse: 0.05,
  approval_gate: 0.05,
} as const

export function scoreDecisionCandidate(
  candidate: DecisionCandidate,
  context: DecisionContext,
): { breakdown: DecisionScoreBreakdown; overall: number } {
  const breakdown: DecisionScoreBreakdown = {
    revenue_impact: scoreRevenueImpact(candidate, context),
    customer_impact: scoreCustomerImpact(candidate),
    urgency: scoreUrgency(candidate),
    confidence: scoreConfidence(candidate, context),
    business_understanding: scoreBusinessUnderstanding(
      candidate,
      context.businessUnderstanding.hasApprovedProfile,
    ),
    dependencies: scoreDependencies(candidate),
    effort: scoreEffort(candidate),
    approval_gate: scoreApprovalGate(candidate),
  }

  const overall =
    breakdown.revenue_impact * WEIGHTS.revenue_impact +
    breakdown.customer_impact * WEIGHTS.customer_impact +
    breakdown.urgency * WEIGHTS.urgency +
    breakdown.confidence * WEIGHTS.confidence +
    breakdown.business_understanding * WEIGHTS.business_understanding +
    breakdown.dependencies * WEIGHTS.dependencies +
    (100 - breakdown.effort) * WEIGHTS.effort_inverse +
    breakdown.approval_gate * WEIGHTS.approval_gate

  return {
    breakdown,
    overall: Math.min(100, Math.max(0, Math.round(overall))),
  }
}

export function rankNextActions(
  candidates: DecisionCandidate[],
  context: DecisionContext,
): NextBestAction[] {
  const ranked = candidates
    .map((candidate) => {
      const scored = scoreDecisionCandidate(candidate, context)
      const reasons = buildNextBestActionReasons(candidate, context, scored.breakdown)
      return {
        id: candidate.id,
        kind: candidate.kind,
        title: candidate.title,
        reason: reasons,
        overall_score: scored.overall,
        score_breakdown: scored.breakdown,
        depends_on: candidate.dependsOn ?? [],
        blocked_by: candidate.blockedBy ?? [],
        estimated_time_minutes: candidate.estimatedMinutes ?? null,
        requires_operator:
          candidate.requiresHumanApproval === true ||
          candidate.kind === "review_approval" ||
          candidate.kind === "review_reply" ||
          candidate.kind === "request_business_clarification",
        confidence: scored.breakdown.confidence,
        href: candidate.href,
        company_name: candidate.companyName ?? null,
        source_id: candidate.id,
      } satisfies NextBestAction
    })
    .sort((left, right) => {
      if (right.overall_score !== left.overall_score) return right.overall_score - left.overall_score
      return left.id.localeCompare(right.id)
    })

  return ranked
}
