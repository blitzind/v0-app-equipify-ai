import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveSendrAnalyticsDateRange } from "@/lib/growth/sendr/growth-sendr-analytics-date-range"
import {
  formatLeadName,
  loadSendrLaunchSentEvents,
  loadSendrLeadContexts,
  loadSendrPageContexts,
  loadSendrTimelineEventsForOrg,
  timelineEventLabel,
} from "@/lib/growth/sendr/growth-sendr-activity-read-repository"
import type {
  GrowthSendrActivityLeadTimeline,
  GrowthSendrActivityTimelineEvent,
  GrowthSendrAnalyticsDateRange,
} from "@/lib/growth/sendr/growth-sendr-types"

async function loadSendrPagesBySlugs(
  admin: SupabaseClient,
  organizationId: string,
  slugs: string[],
): Promise<Map<string, { id: string; title: string; slug: string | null; leadId: string | null }>> {
  const map = new Map<string, { id: string; title: string; slug: string | null; leadId: string | null }>()
  if (slugs.length === 0) return map

  const { data, error } = await admin
    .schema("growth")
    .from("growth_landing_pages")
    .select("id, title, published_slug, slug, lead_id")
    .eq("organization_id", organizationId)
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
    const entry = {
      id: typed.id,
      title: typed.title,
      slug: typed.published_slug ?? typed.slug,
      leadId: typed.lead_id,
    }
    if (typed.published_slug) map.set(typed.published_slug, entry)
    if (typed.slug) map.set(typed.slug, entry)
  }
  return map
}

export async function getSendrActivityTimelines(
  admin: SupabaseClient,
  input: {
    organizationId: string
    dateRange: GrowthSendrAnalyticsDateRange
    leadId?: string | null
    page?: number
    pageSize?: number
  },
): Promise<{
  items: GrowthSendrActivityLeadTimeline[]
  total: number
  page: number
  pageSize: number
}> {
  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(Math.max(input.pageSize ?? 10, 1), 50)

  const [timelineEvents, launchEvents] = await Promise.all([
    loadSendrTimelineEventsForOrg(admin, input),
    loadSendrLaunchSentEvents(admin, input),
  ])

  const slugs = [
    ...new Set(
      timelineEvents
        .map((event) =>
          typeof event.payload?.published_slug === "string" ? event.payload.published_slug : null,
        )
        .filter(Boolean) as string[],
    ),
  ]
  const pagesBySlug = await loadSendrPagesBySlugs(admin, input.organizationId, slugs)
  const launchPageIds = launchEvents.map((l) => l.landingPageId)
  const launchPages = await loadSendrPageContexts(admin, launchPageIds)

  const grouped = new Map<string, GrowthSendrActivityTimelineEvent[]>()

  for (const event of timelineEvents) {
    if (input.leadId && event.lead_id !== input.leadId) continue
    const payload = event.payload ?? {}
    const slug = typeof payload.published_slug === "string" ? payload.published_slug : null
    const page = slug ? pagesBySlug.get(slug) : undefined

    const bucket = grouped.get(event.lead_id) ?? []
    bucket.push({
      id: event.id,
      occurredAt: event.occurred_at,
      eventType: event.event_type,
      eventLabel: timelineEventLabel(event.event_type),
      title: event.title,
      summary: event.summary,
      landingPageId: page?.id ?? null,
      landingPageTitle: page?.title ?? null,
      landingPageSlug: slug ?? page?.slug ?? null,
      sessionId: typeof payload.session_id === "string" ? payload.session_id : null,
      metadata: payload,
    })
    grouped.set(event.lead_id, bucket)
  }

  for (const launch of launchEvents) {
    const page = launchPages.get(launch.landingPageId)
    const leadId = page?.leadId
    if (!leadId) continue
    if (input.leadId && leadId !== input.leadId) continue

    const bucket = grouped.get(leadId) ?? []
    bucket.push({
      id: `launch-${launch.id}`,
      occurredAt: launch.occurredAt,
      eventType: "launch_sent",
      eventLabel: "Launch Sent",
      title: "Personalized video launch sent",
      summary: `Campaign launch enrolled ${launch.enrolledCount} members to ${launch.landingPageTitle ?? "personalized video page"}.`,
      landingPageId: launch.landingPageId,
      landingPageTitle: launch.landingPageTitle,
      landingPageSlug: page?.slug ?? null,
      sessionId: null,
      metadata: { enrolledCount: launch.enrolledCount, launchRunId: launch.id },
    })
    grouped.set(leadId, bucket)
  }

  const leadIds = [...grouped.keys()]
  const leads = await loadSendrLeadContexts(admin, leadIds)

  const timelines: GrowthSendrActivityLeadTimeline[] = leadIds.map((leadId) => {
    const lead = leads.get(leadId)
    const events = (grouped.get(leadId) ?? []).sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )
    return {
      leadId,
      leadName: formatLeadName(lead),
      companyName: lead?.companyName ?? null,
      intentScore: lead?.intentScore ?? null,
      events,
    }
  })

  timelines.sort((a, b) => {
    const aTime = a.events[0]?.occurredAt ? new Date(a.events[0].occurredAt).getTime() : 0
    const bTime = b.events[0]?.occurredAt ? new Date(b.events[0].occurredAt).getTime() : 0
    return bTime - aTime
  })

  const offset = (page - 1) * pageSize
  return {
    items: timelines.slice(offset, offset + pageSize),
    total: timelines.length,
    page,
    pageSize,
  }
}

export function parseSendrActivityTimelineInput(searchParams: URLSearchParams) {
  return {
    dateRange: resolveSendrAnalyticsDateRange({
      preset: searchParams.get("dateRange"),
      startAt: searchParams.get("startAt"),
      endAt: searchParams.get("endAt"),
    }),
    leadId: searchParams.get("leadId"),
    page: Number(searchParams.get("page") ?? "1"),
    pageSize: Number(searchParams.get("pageSize") ?? "10"),
  }
}
