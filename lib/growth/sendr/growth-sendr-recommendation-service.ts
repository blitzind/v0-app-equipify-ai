/** GS-SENDR-2E — Deterministic next-best-action rules (client-safe, no AI). */

import type { GrowthSendrIntentSignals } from "@/lib/growth/sendr/growth-sendr-intent-scoring"
import type { GrowthSendrRecommendation } from "@/lib/growth/sendr/growth-sendr-types"

const MS_PER_DAY = 86_400_000

export function generateSendrRecommendations(input: {
  intentScore: number
  intentLevel: "low" | "medium" | "high"
  signals: GrowthSendrIntentSignals
  lastSendrActivityAt: string | null
  now?: Date
}): GrowthSendrRecommendation[] {
  const now = input.now ?? new Date()
  const recommendations: GrowthSendrRecommendation[] = []
  const daysSinceActivity = input.lastSendrActivityAt
    ? (now.getTime() - new Date(input.lastSendrActivityAt).getTime()) / MS_PER_DAY
    : null

  if (input.intentLevel === "high" || input.signals.bookingCompletes > 0) {
    recommendations.push({
      id: "book_meeting_immediately",
      priority: 1,
      title: "Book meeting immediately",
      reason: "High SENDR intent or completed booking signal detected.",
      actionKind: "meeting",
    })
  }

  if (input.signals.videoCompletes > 0) {
    recommendations.push({
      id: "call_prospect_video_complete",
      priority: 2,
      title: "Call prospect",
      reason: "Prospect completed video on SENDR page.",
      actionKind: "call",
    })
  }

  if (input.signals.pageViews >= 2 || input.signals.repeatSessions > 0) {
    recommendations.push({
      id: "send_follow_up_email_repeat_view",
      priority: 3,
      title: "Send follow-up email",
      reason: "Prospect viewed SENDR page more than once.",
      actionKind: "email",
    })
  }

  if (input.signals.bookingStarts > 0 && input.signals.bookingCompletes === 0) {
    recommendations.push({
      id: "send_booking_reminder",
      priority: 4,
      title: "Send reminder",
      reason: "Booking started but not completed on SENDR page.",
      actionKind: "reminder",
    })
  }

  if (
    daysSinceActivity != null &&
    daysSinceActivity >= 7 &&
    input.signals.pageViews > 0 &&
    input.intentLevel === "low"
  ) {
    recommendations.push({
      id: "archive_or_retry_stale",
      priority: 5,
      title: "Archive or retry",
      reason: "No SENDR engagement in 7+ days after initial activity.",
      actionKind: "archive",
    })
  }

  return recommendations.sort((a, b) => a.priority - b.priority).slice(0, 5)
}

export function generateSendrPageAttentionRecommendations(input: {
  pageViews: number
  ctaRate: number
  bookingRate: number
  title: string
}): { attentionReason: string } | null {
  if (input.pageViews >= 20 && input.ctaRate < 5) {
    return {
      attentionReason: `"${input.title}" has high views (${input.pageViews}) but low CTA rate (${input.ctaRate}%).`,
    }
  }
  if (input.ctaRate >= 10 && input.bookingRate < 3 && input.pageViews >= 10) {
    return {
      attentionReason: `"${input.title}" has strong CTA clicks (${input.ctaRate}%) but low bookings (${input.bookingRate}%).`,
    }
  }
  return null
}
