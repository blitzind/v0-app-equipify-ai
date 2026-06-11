/** Apollo pilot operator analytics — client-safe. */

import {
  APOLLO_PILOT_OPERATIONS_QA_MARKER,
  type ApolloPilotOperatorAnalytics,
} from "@/lib/growth/apollo/apollo-pilot-types"

export type ApolloPilotOperatorReviewRecord = {
  review_type: "draft" | "job"
  outcome: "approved" | "rejected" | "regenerated"
  created_at: string
  resolved_at?: string | null
}

function pct(count: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((count / total) * 1000) / 10
}

export function buildApolloPilotOperatorAnalytics(input: {
  cohort_id: string
  reviews: ApolloPilotOperatorReviewRecord[]
  computed_at?: string
}): ApolloPilotOperatorAnalytics {
  const drafts = input.reviews.filter((r) => r.review_type === "draft")
  const jobs = input.reviews.filter((r) => r.review_type === "job")

  const draftApproved = drafts.filter((r) => r.outcome === "approved").length
  const draftRejected = drafts.filter((r) => r.outcome === "rejected").length
  const draftRegenerated = drafts.filter((r) => r.outcome === "regenerated").length
  const jobApproved = jobs.filter((r) => r.outcome === "approved").length

  const reviewDurations: number[] = []
  let maxAgeHours = 0
  const now = Date.parse(input.computed_at ?? new Date().toISOString())

  for (const review of input.reviews) {
    const created = Date.parse(review.created_at)
    const resolved = review.resolved_at ? Date.parse(review.resolved_at) : now
    if (Number.isFinite(created) && Number.isFinite(resolved) && resolved >= created) {
      reviewDurations.push((resolved - created) / 60000)
    }
    if (Number.isFinite(created)) {
      const ageHours = (now - created) / 3600000
      if (ageHours > maxAgeHours) maxAgeHours = ageHours
    }
  }

  const average_review_time_minutes =
    reviewDurations.length > 0
      ? Math.round((reviewDurations.reduce((s, v) => s + v, 0) / reviewDurations.length) * 10) / 10
      : null

  const daySpan =
    input.reviews.length > 0
      ? Math.max(
          1,
          (now - Date.parse(input.reviews[0]!.created_at)) / 86400000,
        )
      : 1

  return {
    qa_marker: APOLLO_PILOT_OPERATIONS_QA_MARKER,
    cohort_id: input.cohort_id,
    draft_approval_pct: pct(draftApproved, drafts.length),
    draft_rejection_pct: pct(draftRejected, drafts.length),
    draft_regeneration_pct: pct(draftRegenerated, drafts.length),
    job_approval_pct: pct(jobApproved, jobs.length),
    average_review_time_minutes,
    queue_aging_hours_max: maxAgeHours > 0 ? Math.round(maxAgeHours * 10) / 10 : null,
    operator_throughput_per_day:
      input.reviews.length > 0 ? Math.round((input.reviews.length / daySpan) * 10) / 10 : null,
    computed_at: input.computed_at ?? new Date().toISOString(),
  }
}
