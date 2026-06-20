import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_SENDR_LIMITS } from "@/lib/growth/sendr/growth-sendr-config"
import { resolveSendrAnalyticsDateRange } from "@/lib/growth/sendr/growth-sendr-analytics-date-range"
import { generateSendrActivityFollowUpRecommendations } from "@/lib/growth/sendr/growth-sendr-activity-follow-up-service"
import {
  formatLeadName,
  loadRecentSendrEngagementEvents,
  loadSendrLeadContexts,
  loadSendrPageContexts,
} from "@/lib/growth/sendr/growth-sendr-activity-read-repository"
import { buildSendrIntentSignalsFromEvents } from "@/lib/growth/sendr/growth-sendr-engagement-intelligence-service"
import { calculateSendrIntentScore } from "@/lib/growth/sendr/growth-sendr-intent-scoring"
import type {
  GrowthSendrActivityHotProspect,
  GrowthSendrAnalyticsDateRange,
} from "@/lib/growth/sendr/growth-sendr-types"

export type GrowthSendrHotProspectSort = "intent" | "recent_activity" | "bookings" | "cta"

function sortHotProspects(
  rows: GrowthSendrActivityHotProspect[],
  sort: GrowthSendrHotProspectSort,
): GrowthSendrActivityHotProspect[] {
  const copy = [...rows]
  switch (sort) {
    case "recent_activity":
      return copy.sort((a, b) => {
        const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0
        const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0
        return bTime - aTime
      })
    case "bookings":
      return copy.sort((a, b) => {
        const rank = (s: GrowthSendrActivityHotProspect["bookingStatus"]) =>
          s === "completed" ? 2 : s === "started" ? 1 : 0
        return rank(b.bookingStatus) - rank(a.bookingStatus) || b.intentScore - a.intentScore
      })
    case "cta":
      return copy.sort((a, b) => b.ctaClicks - a.ctaClicks || b.intentScore - a.intentScore)
    case "intent":
    default:
      return copy.sort((a, b) => b.intentScore - a.intentScore)
  }
}

export async function getSendrHotProspects(
  admin: SupabaseClient,
  input: {
    organizationId: string
    dateRange: GrowthSendrAnalyticsDateRange
    sort?: GrowthSendrHotProspectSort
    page?: number
    pageSize?: number
  },
): Promise<{
  items: GrowthSendrActivityHotProspect[]
  total: number
  page: number
  pageSize: number
  sort: GrowthSendrHotProspectSort
}> {
  const sort = input.sort ?? "intent"
  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 1), 100)

  const events = await loadRecentSendrEngagementEvents(admin, {
    ...input,
    limit: GROWTH_SENDR_LIMITS.MAX_SENDR_ACTIVITY_ROWS,
  })

  const pageIds = [...new Set(events.map((e) => e.landing_page_id).filter(Boolean) as string[])]
  const pages = await loadSendrPageContexts(admin, pageIds)
  const leadIds = [...new Set([...pages.values()].map((p) => p.leadId).filter(Boolean) as string[])]
  const leads = await loadSendrLeadContexts(admin, leadIds)

  const byLead = new Map<string, typeof events>()
  for (const event of events) {
    const page = event.landing_page_id ? pages.get(event.landing_page_id) : undefined
    const leadId = page?.leadId
    if (!leadId) continue
    const bucket = byLead.get(leadId) ?? []
    bucket.push(event)
    byLead.set(leadId, bucket)
  }

  const rows: GrowthSendrActivityHotProspect[] = []

  for (const [leadId, leadEvents] of byLead) {
    const lead = leads.get(leadId)
    const rawEvents = leadEvents.map((e) => ({
      session_id: e.session_id,
      event_type: e.event_type,
      created_at: e.created_at,
    }))
    const signals = buildSendrIntentSignalsFromEvents(rawEvents)
    const scored = calculateSendrIntentScore(signals)
    const intentScore = lead?.intentScore ?? scored.intentScore
    const intentLevel = lead?.intentLevel ?? scored.intentLevel
    const lastActivityAt = leadEvents[0]?.created_at ?? null
    const pageViews = signals.pageViews
    const videoStarts = signals.videoStarts
    const videoCompletes = signals.videoCompletes
    const videoCompletionPercent =
      videoStarts > 0 ? Math.round((videoCompletes / videoStarts) * 100) : 0

    let bookingStatus: GrowthSendrActivityHotProspect["bookingStatus"] = "none"
    if (signals.bookingCompletes > 0) bookingStatus = "completed"
    else if (signals.bookingStarts > 0) bookingStatus = "started"

    const latestPageId = leadEvents.find((e) => e.landing_page_id)?.landing_page_id ?? null
    const latestPage = latestPageId ? pages.get(latestPageId) : undefined

    rows.push({
      leadId,
      leadName: formatLeadName(lead),
      companyName: lead?.companyName ?? null,
      intentScore,
      intentLevel,
      lastActivityAt,
      pageViews,
      videoCompletionPercent,
      ctaClicks: signals.ctaClicks,
      bookingStatus,
      recommendations: generateSendrActivityFollowUpRecommendations({
        intentScore,
        intentLevel,
        signals,
        lastActivityAt,
      }),
      landingPageId: latestPageId,
      landingPageTitle: latestPage?.title ?? null,
    })
  }

  const sorted = sortHotProspects(rows, sort)
  const offset = (page - 1) * pageSize

  return {
    items: sorted.slice(offset, offset + pageSize),
    total: sorted.length,
    page,
    pageSize,
    sort,
  }
}

export function parseSendrHotProspectsInput(searchParams: URLSearchParams) {
  const sortParam = searchParams.get("sort")
  const sort: GrowthSendrHotProspectSort =
    sortParam === "recent_activity" ||
    sortParam === "bookings" ||
    sortParam === "cta" ||
    sortParam === "intent"
      ? sortParam
      : "intent"

  return {
    dateRange: resolveSendrAnalyticsDateRange({
      preset: searchParams.get("dateRange"),
      startAt: searchParams.get("startAt"),
      endAt: searchParams.get("endAt"),
    }),
    sort,
    page: Number(searchParams.get("page") ?? "1"),
    pageSize: Number(searchParams.get("pageSize") ?? "25"),
  }
}
