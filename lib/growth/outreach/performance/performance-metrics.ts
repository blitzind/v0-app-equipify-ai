/** Outreach performance rate calculations (Phase 4.6). Client-safe. */

import type {
  OutreachPerformanceAttributedSend,
  OutreachPerformanceRateMetrics,
} from "@/lib/growth/outreach/performance/performance-types"

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

export function computeOutreachPerformanceRates(
  rows: OutreachPerformanceAttributedSend[],
): OutreachPerformanceRateMetrics {
  const sentRows = rows.filter((row) => row.sent)
  const sends = sentRows.length
  const replies = sentRows.filter((row) => row.replied).length
  const positiveInterestReplies = sentRows.filter((row) => row.positiveInterest).length
  const meetingsBooked = sentRows.filter((row) => row.meetingBooked).length
  const opportunitiesCreated = sentRows.filter((row) => row.opportunityCreated).length

  return {
    sends,
    replies,
    positiveInterestReplies,
    meetingsBooked,
    opportunitiesCreated,
    replyRate: rate(replies, sends),
    positiveInterestRate: rate(positiveInterestReplies, sends),
    meetingRate: rate(meetingsBooked, sends),
    opportunityConversionRate: rate(opportunitiesCreated, sends),
  }
}

export function bucketUtilizationPercentage(value: number | null | undefined): {
  bucketLabel: string
  bucketMin: number
  bucketMax: number
} {
  const pct = value ?? 0
  if (pct <= 0) return { bucketLabel: "0%", bucketMin: 0, bucketMax: 0 }
  if (pct <= 25) return { bucketLabel: "1–25%", bucketMin: 1, bucketMax: 25 }
  if (pct <= 50) return { bucketLabel: "26–50%", bucketMin: 26, bucketMax: 50 }
  if (pct <= 75) return { bucketLabel: "51–75%", bucketMin: 51, bucketMax: 75 }
  return { bucketLabel: "76–100%", bucketMin: 76, bucketMax: 100 }
}

export function bucketNumericScore(value: number | null | undefined, label: string): {
  bucketLabel: string
  bucketMin: number
  bucketMax: number
} {
  const score = value ?? 0
  if (score <= 0) return { bucketLabel: `${label}: none`, bucketMin: 0, bucketMax: 0 }
  if (score < 45) return { bucketLabel: `${label}: low`, bucketMin: 1, bucketMax: 44 }
  if (score < 70) return { bucketLabel: `${label}: medium`, bucketMin: 45, bucketMax: 69 }
  return { bucketLabel: `${label}: high`, bucketMin: 70, bucketMax: 100 }
}

export function sortPerformanceGroups<T extends { replyRate: number | null; sends: number }>(
  rows: T[],
  direction: "asc" | "desc",
): T[] {
  return [...rows].sort((a, b) => {
    const rateA = a.replyRate ?? -1
    const rateB = b.replyRate ?? -1
    if (rateA !== rateB) return direction === "desc" ? rateB - rateA : rateA - rateB
    return b.sends - a.sends
  })
}
