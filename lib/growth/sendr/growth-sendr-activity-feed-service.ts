import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveSendrAnalyticsDateRange } from "@/lib/growth/sendr/growth-sendr-analytics-date-range"
import {
  engagementEventLabel,
  formatLeadName,
  loadRecentSendrEngagementEvents,
  loadSendrLeadContexts,
  loadSendrPageContexts,
} from "@/lib/growth/sendr/growth-sendr-activity-read-repository"
import type {
  GrowthSendrActivityFeedRow,
  GrowthSendrAnalyticsDateRange,
} from "@/lib/growth/sendr/growth-sendr-types"

export async function buildSendrActivityFeedRows(
  admin: SupabaseClient,
  input: {
    organizationId: string
    dateRange: GrowthSendrAnalyticsDateRange
    limit?: number
  },
): Promise<GrowthSendrActivityFeedRow[]> {
  const events = await loadRecentSendrEngagementEvents(admin, input)
  const pageIds = [...new Set(events.map((e) => e.landing_page_id).filter(Boolean) as string[])]
  const pages = await loadSendrPageContexts(admin, pageIds)
  const leadIds = [...new Set([...pages.values()].map((p) => p.leadId).filter(Boolean) as string[])]
  const leads = await loadSendrLeadContexts(admin, leadIds)

  return events.map((event) => {
    const page = event.landing_page_id ? pages.get(event.landing_page_id) : undefined
    const leadId = page?.leadId ?? null
    const lead = leadId ? leads.get(leadId) : undefined

    return {
      id: event.id,
      occurredAt: event.created_at,
      eventType: event.event_type,
      eventLabel: engagementEventLabel(event.event_type),
      leadId,
      leadName: formatLeadName(lead),
      companyName: lead?.companyName ?? null,
      landingPageId: event.landing_page_id,
      landingPageTitle: page?.title ?? null,
      sessionId: event.session_id,
      intentScore: lead?.intentScore ?? null,
      metadata: event.event_value ?? {},
    }
  })
}

export async function getSendrActivityFeed(
  admin: SupabaseClient,
  input: {
    organizationId: string
    dateRange: GrowthSendrAnalyticsDateRange
    page?: number
    pageSize?: number
  },
): Promise<{
  items: GrowthSendrActivityFeedRow[]
  total: number
  page: number
  pageSize: number
}> {
  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(Math.max(input.pageSize ?? 50, 1), 100)
  const rows = await buildSendrActivityFeedRows(admin, input)
  const offset = (page - 1) * pageSize

  return {
    items: rows.slice(offset, offset + pageSize),
    total: rows.length,
    page,
    pageSize,
  }
}

export function parseSendrActivityFeedInput(searchParams: URLSearchParams) {
  return {
    dateRange: resolveSendrAnalyticsDateRange({
      preset: searchParams.get("dateRange"),
      startAt: searchParams.get("startAt"),
      endAt: searchParams.get("endAt"),
    }),
    page: Number(searchParams.get("page") ?? "1"),
    pageSize: Number(searchParams.get("pageSize") ?? "50"),
  }
}
