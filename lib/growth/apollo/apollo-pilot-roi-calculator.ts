/** Apollo pilot ROI foundation — client-safe estimates. */

import {
  APOLLO_PILOT_OPERATIONS_QA_MARKER,
  type ApolloPilotRoiEstimate,
  type ApolloPilotRoiMetrics,
} from "@/lib/growth/apollo/apollo-pilot-types"

export type ApolloPilotRoiCountInput = {
  companies: number
  contacts: number
  verified_emails: number
  sequence_ready_contacts: number
  enrollments: number
  meetings: number
  opportunities: number
  customers: number
  apollo_credits_consumed?: number | null
  estimated_credit_cost_usd?: number | null
  revenue_attributed?: number | null
}

function safeDivide(total: number | null | undefined, count: number): number | null {
  if (total == null || !Number.isFinite(total) || count <= 0) return null
  return Math.round((total / count) * 100) / 100
}

function estimate(
  metric_key: string,
  label: string,
  value: number | null,
  estimate_source: string,
  confidence: ApolloPilotRoiEstimate["confidence"],
): ApolloPilotRoiEstimate {
  return { metric_key, label, value, estimate_source, confidence }
}

export function buildApolloPilotRoiMetrics(input: {
  cohort_id: string
  counts: ApolloPilotRoiCountInput
  computed_at?: string
}): ApolloPilotRoiMetrics {
  const credits = input.counts.apollo_credits_consumed
  const costUsd = input.counts.estimated_credit_cost_usd
  const revenue = input.counts.revenue_attributed

  const estimates: ApolloPilotRoiEstimate[] = [
    estimate(
      "cost_per_company",
      "Estimated cost per company",
      safeDivide(costUsd, input.counts.companies),
      costUsd != null ? "apollo_credit_cost_allocation" : "missing_cost_evidence",
      costUsd != null ? "medium" : "low",
    ),
    estimate(
      "cost_per_contact",
      "Estimated cost per contact",
      safeDivide(costUsd, input.counts.contacts),
      costUsd != null ? "apollo_credit_cost_allocation" : "missing_cost_evidence",
      costUsd != null ? "medium" : "low",
    ),
    estimate(
      "cost_per_verified_email",
      "Estimated cost per verified email",
      safeDivide(costUsd, input.counts.verified_emails),
      costUsd != null ? "apollo_credit_cost_allocation" : "missing_cost_evidence",
      costUsd != null ? "medium" : "low",
    ),
    estimate(
      "cost_per_sequence_ready_contact",
      "Estimated cost per sequence-ready contact",
      safeDivide(costUsd, input.counts.sequence_ready_contacts),
      costUsd != null ? "apollo_credit_cost_allocation" : "missing_cost_evidence",
      costUsd != null ? "medium" : "low",
    ),
    estimate(
      "cost_per_enrollment",
      "Estimated cost per enrollment",
      safeDivide(costUsd, input.counts.enrollments),
      costUsd != null ? "apollo_credit_cost_allocation" : "missing_cost_evidence",
      costUsd != null ? "medium" : "low",
    ),
    estimate(
      "cost_per_meeting",
      "Estimated cost per meeting",
      safeDivide(costUsd, input.counts.meetings),
      costUsd != null ? "apollo_credit_cost_allocation" : "missing_cost_evidence",
      costUsd != null ? "medium" : "low",
    ),
    estimate(
      "cost_per_opportunity",
      "Estimated cost per opportunity",
      safeDivide(costUsd, input.counts.opportunities),
      costUsd != null ? "apollo_credit_cost_allocation" : "missing_cost_evidence",
      costUsd != null ? "medium" : "low",
    ),
    estimate(
      "cost_per_customer",
      "Estimated cost per customer",
      safeDivide(costUsd, input.counts.customers),
      costUsd != null ? "apollo_credit_cost_allocation" : "missing_cost_evidence",
      costUsd != null ? "medium" : "low",
    ),
    estimate(
      "revenue_attributed",
      "Revenue attributed",
      revenue,
      revenue != null ? "growth_revenue_attribution_ledger" : "missing_revenue_evidence",
      revenue != null ? "high" : "low",
    ),
  ]

  return {
    qa_marker: APOLLO_PILOT_OPERATIONS_QA_MARKER,
    cohort_id: input.cohort_id,
    apollo_credits_consumed: credits,
    estimates,
    computed_at: input.computed_at ?? new Date().toISOString(),
  }
}
