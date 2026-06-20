import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SENDR_LIMITS,
  GROWTH_SENDR_TIMELINE_EVENT_TYPES,
  type GrowthSendrTimelineEventType,
} from "@/lib/growth/sendr/growth-sendr-config"
import type {
  GrowthSendrActivityEventLabel,
  GrowthSendrAnalyticsDateRange,
  GrowthSendrLeadIntelligenceMetadata,
} from "@/lib/growth/sendr/growth-sendr-types"

const ENGAGEMENT_EVENT_LABELS: Record<string, GrowthSendrActivityEventLabel> = {
  page_view: "Page Viewed",
  video_start: "Video Started",
  video_complete: "Video Completed",
  cta_click: "CTA Clicked",
  booking_started: "Booking Started",
  booking_completed: "Booking Completed",
}

const TIMELINE_EVENT_LABELS: Record<GrowthSendrTimelineEventType, GrowthSendrActivityEventLabel> = {
  landing_page_viewed: "Page Viewed",
  video_started: "Video Started",
  video_completed: "Video Completed",
  cta_clicked: "CTA Clicked",
  booking_started: "Booking Started",
  booking_completed: "Booking Completed",
}

export type RawSendrEngagementEvent = {
  id: string
  session_id: string
  landing_page_id: string | null
  event_type: string
  event_value: Record<string, unknown>
  created_at: string
}

export type SendrPageContext = {
  id: string
  title: string
  slug: string | null
  leadId: string | null
}

export type SendrLeadContext = {
  id: string
  firstName: string | null
  lastName: string | null
  companyName: string | null
  intentScore: number | null
  intentLevel: "low" | "medium" | "high" | null
}

export function engagementEventLabel(eventType: string): GrowthSendrActivityEventLabel {
  return ENGAGEMENT_EVENT_LABELS[eventType] ?? "Page Viewed"
}

export function timelineEventLabel(eventType: string): GrowthSendrActivityEventLabel {
  if (eventType in TIMELINE_EVENT_LABELS) {
    return TIMELINE_EVENT_LABELS[eventType as GrowthSendrTimelineEventType]
  }
  return "Page Viewed"
}

export async function loadRecentSendrEngagementEvents(
  admin: SupabaseClient,
  input: {
    organizationId: string
    dateRange: GrowthSendrAnalyticsDateRange
    limit?: number
  },
): Promise<RawSendrEngagementEvent[]> {
  const limit = Math.min(input.limit ?? GROWTH_SENDR_LIMITS.MAX_SENDR_ACTIVITY_FEED, 500)
  const { data, error } = await admin
    .schema("growth")
    .from("growth_engagement_events")
    .select("id, session_id, landing_page_id, event_type, event_value, created_at")
    .eq("organization_id", input.organizationId)
    .in("event_type", Object.keys(ENGAGEMENT_EVENT_LABELS))
    .gte("created_at", input.dateRange.startAt)
    .lte("created_at", input.dateRange.endAt)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error?.message?.includes("does not exist")) return []
  if (error) return []
  return (data ?? []) as RawSendrEngagementEvent[]
}

export async function loadSendrPageContexts(
  admin: SupabaseClient,
  pageIds: string[],
): Promise<Map<string, SendrPageContext>> {
  const map = new Map<string, SendrPageContext>()
  if (pageIds.length === 0) return map

  const { data, error } = await admin
    .schema("growth")
    .from("growth_landing_pages")
    .select("id, title, published_slug, slug, lead_id")
    .in("id", pageIds.slice(0, GROWTH_SENDR_LIMITS.MAX_SENDR_ACTIVITY_ROWS))
    .is("deleted_at", null)

  if (error) return map
  for (const row of data ?? []) {
    const typed = row as {
      id: string
      title: string
      published_slug: string | null
      slug: string | null
      lead_id: string | null
    }
    map.set(typed.id, {
      id: typed.id,
      title: typed.title,
      slug: typed.published_slug ?? typed.slug,
      leadId: typed.lead_id,
    })
  }
  return map
}

export async function loadSendrLeadContexts(
  admin: SupabaseClient,
  leadIds: string[],
): Promise<Map<string, SendrLeadContext>> {
  const map = new Map<string, SendrLeadContext>()
  if (leadIds.length === 0) return map

  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("id, first_name, last_name, company_name, metadata")
    .in("id", leadIds.slice(0, GROWTH_SENDR_LIMITS.MAX_SENDR_ACTIVITY_PROSPECTS))

  if (error) return map
  for (const row of data ?? []) {
    const typed = row as {
      id: string
      first_name: string | null
      last_name: string | null
      company_name: string | null
      metadata: { sendr_intelligence?: GrowthSendrLeadIntelligenceMetadata }
    }
    const intel = typed.metadata?.sendr_intelligence
    map.set(typed.id, {
      id: typed.id,
      firstName: typed.first_name,
      lastName: typed.last_name,
      companyName: typed.company_name,
      intentScore: intel?.intentScore ?? null,
      intentLevel: intel?.intentLevel ?? null,
    })
  }
  return map
}

export async function loadSendrTimelineEventsForOrg(
  admin: SupabaseClient,
  input: {
    organizationId: string
    dateRange: GrowthSendrAnalyticsDateRange
    limit?: number
  },
): Promise<
  Array<{
    id: string
    lead_id: string
    event_type: string
    title: string
    summary: string | null
    payload: Record<string, unknown>
    occurred_at: string
  }>
> {
  const limit = Math.min(input.limit ?? GROWTH_SENDR_LIMITS.MAX_SENDR_ACTIVITY_ROWS, 1000)

  const { data: leads, error: leadError } = await admin
    .schema("growth")
    .from("leads")
    .select("id")
    .eq("promoted_organization_id", input.organizationId)
    .limit(GROWTH_SENDR_LIMITS.MAX_SENDR_ACTIVITY_PROSPECTS)

  if (leadError?.message?.includes("does not exist")) return []
  const leadIds = (leads ?? []).map((r) => String((r as { id: string }).id))
  if (leadIds.length === 0) return []

  const { data, error } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("id, lead_id, event_type, title, summary, payload, occurred_at")
    .in("lead_id", leadIds)
    .in("event_type", [...GROWTH_SENDR_TIMELINE_EVENT_TYPES])
    .gte("occurred_at", input.dateRange.startAt)
    .lte("occurred_at", input.dateRange.endAt)
    .order("occurred_at", { ascending: false })
    .limit(limit)

  if (error?.message?.includes("does not exist")) return []
  if (error) return []

  return (data ?? []).filter((row) => {
    const payload = (row as { payload?: Record<string, unknown> }).payload ?? {}
    return payload.source === "sendr_public_runtime" || payload.qa_marker != null
  }) as Array<{
    id: string
    lead_id: string
    event_type: string
    title: string
    summary: string | null
    payload: Record<string, unknown>
    occurred_at: string
  }>
}

export async function loadSendrLaunchSentEvents(
  admin: SupabaseClient,
  input: {
    organizationId: string
    dateRange: GrowthSendrAnalyticsDateRange
    limit?: number
  },
): Promise<
  Array<{
    id: string
    occurredAt: string
    landingPageId: string
    landingPageTitle: string | null
    enrolledCount: number
  }>
> {
  const { data, error } = await admin
    .schema("growth")
    .from("growth_sendr_launch_runs")
    .select("id, landing_page_id, started_at, enrolled_count, status")
    .eq("organization_id", input.organizationId)
    .in("status", ["completed", "enrolling"])
    .gt("enrolled_count", 0)
    .gte("started_at", input.dateRange.startAt)
    .lte("started_at", input.dateRange.endAt)
    .order("started_at", { ascending: false })
    .limit(Math.min(input.limit ?? 50, 50))

  if (error?.message?.includes("does not exist")) return []
  if (error) return []

  const pageIds = [...new Set((data ?? []).map((r) => String((r as { landing_page_id: string }).landing_page_id)))]
  const pages = await loadSendrPageContexts(admin, pageIds)

  return (data ?? []).map((row) => {
    const typed = row as {
      id: string
      landing_page_id: string
      started_at: string
      enrolled_count: number
    }
    const page = pages.get(typed.landing_page_id)
    return {
      id: typed.id,
      occurredAt: typed.started_at,
      landingPageId: typed.landing_page_id,
      landingPageTitle: page?.title ?? null,
      enrolledCount: typed.enrolled_count,
    }
  })
}

export function formatLeadName(lead: SendrLeadContext | undefined): string | null {
  if (!lead) return null
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ")
  return name || null
}
