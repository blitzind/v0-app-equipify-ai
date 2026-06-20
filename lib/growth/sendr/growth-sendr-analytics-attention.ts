/** GS-SENDR-3B — Deterministic page attention rules (client-safe, no AI). */

import type { GrowthSendrAnalyticsAttentionRow } from "@/lib/growth/sendr/growth-sendr-types"

const MS_PER_DAY = 86_400_000

export function buildSendrAnalyticsPageAttention(input: {
  landingPageId: string
  title: string
  slug: string | null
  status: string
  publishedAt: string | null
  views: number
  ctaClicks: number
  bookings: number
  lastActivityAt: string | null
  now?: Date
}): GrowthSendrAnalyticsAttentionRow | null {
  if (input.status !== "published") return null

  const now = input.now ?? new Date()
  const daysSincePublish = input.publishedAt
    ? (now.getTime() - new Date(input.publishedAt).getTime()) / MS_PER_DAY
    : null
  const daysSinceActivity = input.lastActivityAt
    ? (now.getTime() - new Date(input.lastActivityAt).getTime()) / MS_PER_DAY
    : null

  if (
    input.views === 0 &&
    daysSincePublish != null &&
    daysSincePublish >= 7 &&
    (daysSinceActivity == null || daysSinceActivity >= 7)
  ) {
    return {
      landingPageId: input.landingPageId,
      title: input.title,
      slug: input.slug,
      recommendation: `"${input.title}" is published but has no views in the last 7+ days. Review distribution or page copy.`,
      rule: "no_views_7d",
    }
  }

  if (input.views > 0 && input.ctaClicks === 0) {
    return {
      landingPageId: input.landingPageId,
      title: input.title,
      slug: input.slug,
      recommendation: `"${input.title}" has ${input.views} views but no CTA clicks. Review CTA placement and offer clarity.`,
      rule: "views_no_cta",
    }
  }

  if (input.ctaClicks > 0 && input.bookings === 0) {
    return {
      landingPageId: input.landingPageId,
      title: input.title,
      slug: input.slug,
      recommendation: `"${input.title}" has ${input.ctaClicks} CTA clicks but no bookings. Review calendar flow and booking friction.`,
      rule: "cta_no_bookings",
    }
  }

  return null
}

export function buildSendrLaunchAttentionRecommendation(input: {
  status: string
  enrolled: number
  views: number
  lastError: string | null
}): string | null {
  if (input.status === "failed") {
    return input.lastError
      ? `Launch failed: ${input.lastError}. Review audience eligibility and retry manually.`
      : "Launch failed. Review audience eligibility and retry manually."
  }
  if (input.status === "cancelled") {
    return "Launch was cancelled. Resume manually if enrollment should continue."
  }
  if (["previewing", "ready_to_enroll", "enrolling", "pending"].includes(input.status)) {
    return "Launch is in progress. Operator must continue or cancel manually."
  }
  if (input.status === "completed" && input.enrolled > 0 && input.views === 0) {
    return "Launch enrolled members but page has no views yet. Monitor engagement before follow-up."
  }
  return null
}
