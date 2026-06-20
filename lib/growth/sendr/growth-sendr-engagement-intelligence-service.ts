import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  calculateSendrEngagementRates,
  calculateSendrIntentScore,
  emptySendrIntentSignals,
  type GrowthSendrIntentSignals,
} from "@/lib/growth/sendr/growth-sendr-intent-scoring"
import { getGrowthSendrLandingPage } from "@/lib/growth/sendr/growth-sendr-landing-page-repository"
import type { GrowthSendrPageEngagementIntelligence } from "@/lib/growth/sendr/growth-sendr-types"

type RawEvent = {
  session_id: string
  event_type: string
  created_at: string
}

function countByType(events: RawEvent[], type: string): number {
  return events.filter((e) => e.event_type === type).length
}

function uniqueSessions(events: RawEvent[]): Set<string> {
  return new Set(events.map((e) => e.session_id).filter(Boolean))
}

function repeatVisitorCount(events: RawEvent[]): number {
  const viewsBySession = new Map<string, number>()
  for (const event of events.filter((e) => e.event_type === "page_view")) {
    viewsBySession.set(event.session_id, (viewsBySession.get(event.session_id) ?? 0) + 1)
  }
  let repeats = 0
  for (const count of viewsBySession.values()) {
    if (count > 1) repeats += 1
  }
  const sessionCounts = new Map<string, number>()
  for (const event of events.filter((e) => e.event_type === "page_view")) {
    sessionCounts.set(event.session_id, 1)
  }
  const multiSessionVisitors = [...sessionCounts.keys()].length
  return Math.max(repeats, multiSessionVisitors > 1 ? multiSessionVisitors - 1 : 0)
}

export async function loadSendrEngagementEventsForPage(
  admin: SupabaseClient,
  input: { organizationId: string; landingPageId: string; limit?: number },
): Promise<RawEvent[]> {
  const limit = Math.min(input.limit ?? 500, 500)
  const { data, error } = await admin
    .schema("growth")
    .from("growth_engagement_events")
    .select("session_id, event_type, created_at")
    .eq("organization_id", input.organizationId)
    .eq("landing_page_id", input.landingPageId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error?.message?.includes("does not exist")) return []
  if (error) return []
  return (data ?? []) as RawEvent[]
}

export async function loadSendrEngagementEventsForLead(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; limit?: number },
): Promise<Array<RawEvent & { landing_page_id: string | null }>> {
  const limit = Math.min(input.limit ?? 500, 500)
  const { data: pages, error: pageError } = await admin
    .schema("growth")
    .from("growth_landing_pages")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("lead_id", input.leadId)
    .is("deleted_at", null)
    .limit(20)
  if (pageError?.message?.includes("does not exist")) return []
  const pageIds = (pages ?? []).map((p) => String((p as { id: string }).id))
  if (pageIds.length === 0) return []

  const { data, error } = await admin
    .schema("growth")
    .from("growth_engagement_events")
    .select("session_id, event_type, created_at, landing_page_id")
    .eq("organization_id", input.organizationId)
    .in("landing_page_id", pageIds)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) return []
  return (data ?? []) as Array<RawEvent & { landing_page_id: string | null }>
}

export function buildSendrIntentSignalsFromEvents(events: RawEvent[]): GrowthSendrIntentSignals {
  const sessions = uniqueSessions(events.filter((e) => e.event_type === "page_view"))
  const pageViews = countByType(events, "page_view")
  const repeatSessions = Math.max(0, sessions.size > 0 ? repeatVisitorCount(events) : 0)

  return {
    pageViews,
    videoStarts: countByType(events, "video_start"),
    videoCompletes: countByType(events, "video_complete"),
    ctaClicks: countByType(events, "cta_click"),
    calendarOpens: countByType(events, "calendar_open"),
    bookingStarts: countByType(events, "booking_started"),
    bookingCompletes: countByType(events, "booking_completed"),
    uniqueSessions: sessions.size,
    repeatSessions,
  }
}

export async function computeSendrPageEngagementIntelligence(
  admin: SupabaseClient,
  input: { organizationId: string; landingPageId: string },
): Promise<GrowthSendrPageEngagementIntelligence | null> {
  const page = await getGrowthSendrLandingPage(admin, input.landingPageId)
  if (!page || page.organizationId !== input.organizationId) return null

  const events = await loadSendrEngagementEventsForPage(admin, input)
  const pageViews = countByType(events, "page_view")
  const uniqueVisitors = uniqueSessions(events.filter((e) => e.event_type === "page_view")).size
  const repeatVisitors = repeatVisitorCount(events)
  const videoStarts = countByType(events, "video_start")
  const videoCompletes = countByType(events, "video_complete")
  const ctaClicks = countByType(events, "cta_click")
  const calendarOpens = countByType(events, "calendar_open")
  const bookingStarts = countByType(events, "booking_started")
  const bookingCompletes = countByType(events, "booking_completed")

  const rates = calculateSendrEngagementRates({
    pageViews,
    uniqueVisitors,
    repeatVisitors,
    ctaClicks,
    bookingCompletes,
    videoStarts,
    videoCompletes,
  })

  return {
    landingPageId: page.id,
    title: page.title,
    slug: page.publishedSlug ?? page.slug,
    pageViews,
    uniqueVisitors,
    repeatVisitors,
    videoStarts,
    videoCompletes,
    ctaClicks,
    calendarOpens,
    bookingStarts,
    bookingCompletes,
    ...rates,
  }
}

export function computeSendrLeadIntentFromEvents(events: RawEvent[]) {
  const signals = buildSendrIntentSignalsFromEvents(events)
  return {
    signals,
    ...calculateSendrIntentScore(signals),
    sendrEngagementCount: events.length,
    lastSendrActivityAt: events[0]?.created_at ?? null,
  }
}

export { calculateSendrIntentScore, emptySendrIntentSignals }
