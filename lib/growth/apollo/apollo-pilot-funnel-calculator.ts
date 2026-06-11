/** Apollo pilot conversion funnel calculations — client-safe. */

import {
  APOLLO_PILOT_FUNNEL_STAGES,
  APOLLO_PILOT_OPERATIONS_QA_MARKER,
  type ApolloPilotFunnelMetrics,
  type ApolloPilotFunnelStage,
} from "@/lib/growth/apollo/apollo-pilot-types"

export type ApolloPilotFunnelCountInput = {
  companies: number
  contacts: number
  qualified: number
  enrolled: number
  draft_approved: number
  job_approved: number
  sent: number
  replied: number
  meeting: number
  opportunity: number
  revenue: number
}

const STAGE_LABELS: Record<ApolloPilotFunnelStage, string> = {
  companies: "Companies",
  contacts: "Contacts",
  qualified: "Qualified",
  enrolled: "Enrolled",
  draft_approved: "Draft approved",
  job_approved: "Job approved",
  sent: "Sent",
  replied: "Replied",
  meeting: "Meeting",
  opportunity: "Opportunity",
  revenue: "Revenue",
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

export function buildApolloPilotFunnelMetrics(input: {
  cohort_id: string
  counts: ApolloPilotFunnelCountInput
  computed_at?: string
}): ApolloPilotFunnelMetrics {
  const stageCounts = APOLLO_PILOT_FUNNEL_STAGES.map((stage) => {
    switch (stage) {
      case "companies":
        return input.counts.companies
      case "contacts":
        return input.counts.contacts
      case "qualified":
        return input.counts.qualified
      case "enrolled":
        return input.counts.enrolled
      case "draft_approved":
        return input.counts.draft_approved
      case "job_approved":
        return input.counts.job_approved
      case "sent":
        return input.counts.sent
      case "replied":
        return input.counts.replied
      case "meeting":
        return input.counts.meeting
      case "opportunity":
        return input.counts.opportunity
      case "revenue":
        return input.counts.revenue
      default:
        return 0
    }
  })

  const base = stageCounts[0] ?? 0
  const stages = APOLLO_PILOT_FUNNEL_STAGES.map((stage, index) => {
    const count = stageCounts[index] ?? 0
    const prev = index > 0 ? stageCounts[index - 1] ?? 0 : count
    const stage_conversion_pct = index === 0 ? null : pct(count, prev)
    const cumulative_conversion_pct = index === 0 ? (base > 0 ? 100 : null) : pct(count, base)
    const drop_off_pct =
      index === 0 ? null : prev > 0 ? Math.round(((prev - count) / prev) * 1000) / 10 : null

    return {
      stage,
      label: STAGE_LABELS[stage],
      count,
      stage_conversion_pct,
      cumulative_conversion_pct,
      drop_off_pct,
    }
  })

  return {
    qa_marker: APOLLO_PILOT_OPERATIONS_QA_MARKER,
    cohort_id: input.cohort_id,
    stages,
    computed_at: input.computed_at ?? new Date().toISOString(),
  }
}
