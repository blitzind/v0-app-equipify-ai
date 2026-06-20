import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { countGrowthSendrEngagementEventsByTypeToday } from "@/lib/growth/sendr/growth-sendr-engagement-event-service"
import {
  countDistinctSendrLinkedSequences,
  countSendrLinksForSequence,
  listSendrSequencePageLinks,
} from "@/lib/growth/sendr/growth-sendr-sequence-link-repository"
import { getGrowthSendrLandingPage } from "@/lib/growth/sendr/growth-sendr-landing-page-repository"
import type { GrowthSendrWorkspaceMetrics } from "@/lib/growth/sendr/growth-sendr-types"
import { buildSendrPagePublicLink } from "@/lib/growth/sendr/growth-sendr-slug-runtime"

function startOfUtcDay(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

export async function getGrowthSendrWorkspaceMetrics(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthSendrWorkspaceMetrics> {
  const dayStart = startOfUtcDay()

  const [publishedRes, viewsToday, ctaToday, bookingToday, links, activeSequences] = await Promise.all([
    admin
      .schema("growth")
      .from("growth_landing_pages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "published")
      .is("deleted_at", null),
    countGrowthSendrEngagementEventsByTypeToday(admin, organizationId, dayStart, "page_view"),
    countGrowthSendrEngagementEventsByTypeToday(admin, organizationId, dayStart, "cta_click"),
    countGrowthSendrEngagementEventsByTypeToday(admin, organizationId, dayStart, "booking_started"),
    listSendrSequencePageLinks(admin, { organizationId, limit: 100 }),
    countDistinctSendrLinkedSequences(admin, organizationId),
  ])

  const pageIds = [...new Set(links.map((l) => l.landingPageId))].slice(0, 10)
  const topPages: GrowthSendrWorkspaceMetrics["topPages"] = []

  for (const pageId of pageIds) {
    const page = await getGrowthSendrLandingPage(admin, pageId)
    if (!page) continue
    const slug = page.publishedSlug ?? page.slug
    const { count: viewCount } = await admin
      .schema("growth")
      .from("growth_engagement_events")
      .select("id", { count: "exact", head: true })
      .eq("landing_page_id", pageId)
      .eq("event_type", "page_view")
      .gte("created_at", dayStart)
    const { count: ctaCount } = await admin
      .schema("growth")
      .from("growth_engagement_events")
      .select("id", { count: "exact", head: true })
      .eq("landing_page_id", pageId)
      .eq("event_type", "cta_click")
      .gte("created_at", dayStart)
    const views = viewCount ?? 0
    const ctaClicks = ctaCount ?? 0
    topPages.push({
      landingPageId: pageId,
      title: page.title,
      slug,
      views,
      bookings: bookingToday,
      ctaClicks,
      ctaRate: views > 0 ? Math.round((ctaClicks / views) * 100) : 0,
    })
  }

  topPages.sort((a, b) => b.views - a.views)

  return {
    publishedPagesTotal: publishedRes.count ?? 0,
    viewsToday,
    ctaClicksToday: ctaToday,
    attachedToSequencesCount: links.length,
    activeSequenceCount: activeSequences,
    topPages: topPages.slice(0, 5),
  }
}

export async function countSendrLinksForPattern(
  admin: SupabaseClient,
  sequencePatternId: string,
): Promise<number> {
  return countSendrLinksForSequence(admin, sequencePatternId)
}

export { buildSendrPagePublicLink }
