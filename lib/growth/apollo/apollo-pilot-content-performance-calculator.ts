/** Apollo pilot content performance — client-safe. */

import {
  APOLLO_PILOT_OPERATIONS_QA_MARKER,
  type ApolloPilotContentPerformanceMetrics,
  type ApolloPilotContentPerformanceRow,
} from "@/lib/growth/apollo/apollo-pilot-types"

export type ApolloPilotContentSendRecord = {
  channel: string
  variant_key: string
  replied?: boolean
  meeting_booked?: boolean
}

function pct(count: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((count / total) * 1000) / 10
}

export function buildApolloPilotContentPerformanceMetrics(input: {
  cohort_id: string
  sends: ApolloPilotContentSendRecord[]
  computed_at?: string
}): ApolloPilotContentPerformanceMetrics {
  const groups = new Map<string, ApolloPilotContentPerformanceRow>()

  for (const send of input.sends) {
    const key = `${send.channel}::${send.variant_key}`
    const existing = groups.get(key) ?? {
      channel: send.channel,
      variant_key: send.variant_key,
      sends: 0,
      replies: 0,
      meetings: 0,
      reply_rate_pct: 0,
      meeting_rate_pct: 0,
    }
    existing.sends += 1
    if (send.replied) existing.replies += 1
    if (send.meeting_booked) existing.meetings += 1
    groups.set(key, existing)
  }

  const rows = [...groups.values()]
    .map((row) => ({
      ...row,
      reply_rate_pct: pct(row.replies, row.sends),
      meeting_rate_pct: pct(row.meetings, row.sends),
    }))
    .sort((a, b) => b.sends - a.sends)

  return {
    qa_marker: APOLLO_PILOT_OPERATIONS_QA_MARKER,
    cohort_id: input.cohort_id,
    rows,
    computed_at: input.computed_at ?? new Date().toISOString(),
  }
}
