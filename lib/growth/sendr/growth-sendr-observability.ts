import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { countGrowthSendrAgentEventsToday } from "@/lib/growth/sendr/growth-sendr-conversation-agent-repository"
import { countGrowthSendrBookingsToday } from "@/lib/growth/sendr/growth-sendr-booking-runtime-repository"
import {
  countGrowthSendrEngagementEventsByTypeToday,
  countGrowthSendrEngagementEventsToday,
} from "@/lib/growth/sendr/growth-sendr-engagement-event-service"
import { countGrowthSendrLandingPagesPublishedToday } from "@/lib/growth/sendr/growth-sendr-landing-page-repository"
import {
  countSendrLaunchFailuresToday,
  countSendrLaunchPreviewsToday,
  countSendrLaunchesToday,
  sumSendrLaunchMembersEnrolledToday,
} from "@/lib/growth/sendr/growth-sendr-launch-run-repository"
import { countGrowthSendrMediaAssetsCreatedToday } from "@/lib/growth/sendr/growth-sendr-media-asset-repository"
import { countSendrLinksCreatedToday, countSendrTimelineEventsToday } from "@/lib/growth/sendr/growth-sendr-sequence-link-repository"
import { countSendrIntelligenceUpdatesToday } from "@/lib/growth/sendr/growth-sendr-timeline-intelligence-service"
import { probeSendrSchemaReady } from "@/lib/growth/sendr/growth-sendr-schema-health"
import type { GrowthSendrObservabilitySnapshot } from "@/lib/growth/sendr/growth-sendr-types"
import { countGrowthSendrVideoEventsToday } from "@/lib/growth/sendr/growth-sendr-video-runtime-repository"

function startOfUtcDay(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

export async function getGrowthSendrObservabilitySnapshot(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<GrowthSendrObservabilitySnapshot> {
  const fallback: GrowthSendrObservabilitySnapshot = {
    schemaReady: false,
    assetsCreatedToday: 0,
    pagesPublishedToday: 0,
    publicPageViewsToday: 0,
    videoEventsToday: 0,
    bookingsToday: 0,
    ctaClicksToday: 0,
    agentEventsToday: 0,
    pagesLinkedToday: 0,
    urlResolutionsToday: 0,
    timelineEventsToday: 0,
    intentCalculationsToday: 0,
    recommendationsGeneratedToday: 0,
    timelineWritesToday: 0,
    launchesToday: 0,
    launchPreviewsToday: 0,
    launchFailuresToday: 0,
    launchThrottlesToday: 0,
    membersEnrolledViaLaunchesToday: 0,
    rowsReadToday: 0,
    rowsWrittenToday: 0,
    failuresToday: 0,
    throttlesToday: 0,
  }

  try {
    const schemaReady = await probeSendrSchemaReady(admin)
    if (!schemaReady) return { ...fallback, schemaReady: false }

    const dayStart = startOfUtcDay()
    const [
      assetsCreatedToday,
      pagesPublishedToday,
      publicPageViewsToday,
      videoEventsToday,
      bookingsToday,
      ctaClicksToday,
      agentEventsToday,
      engagementEventsToday,
      pagesLinkedToday,
      timelineEventsToday,
      intentCalculationsToday,
      launchesToday,
      launchPreviewsToday,
      launchFailuresToday,
      membersEnrolledViaLaunchesToday,
    ] = await Promise.all([
      countGrowthSendrMediaAssetsCreatedToday(admin, input.organizationId, dayStart),
      countGrowthSendrLandingPagesPublishedToday(admin, input.organizationId, dayStart),
      countGrowthSendrEngagementEventsByTypeToday(admin, input.organizationId, dayStart, "page_view"),
      countGrowthSendrVideoEventsToday(admin, input.organizationId, dayStart),
      countGrowthSendrBookingsToday(admin, input.organizationId, dayStart),
      countGrowthSendrEngagementEventsByTypeToday(admin, input.organizationId, dayStart, "cta_click"),
      countGrowthSendrAgentEventsToday(admin, input.organizationId, dayStart),
      countGrowthSendrEngagementEventsToday(admin, input.organizationId, dayStart),
      countSendrLinksCreatedToday(admin, input.organizationId, dayStart),
      countSendrTimelineEventsToday(admin, input.organizationId, dayStart),
      countSendrIntelligenceUpdatesToday(admin, input.organizationId, dayStart),
      countSendrLaunchesToday(admin, input.organizationId, dayStart),
      countSendrLaunchPreviewsToday(admin, input.organizationId),
      countSendrLaunchFailuresToday(admin, input.organizationId, dayStart),
      sumSendrLaunchMembersEnrolledToday(admin, input.organizationId, dayStart),
    ])

    return {
      schemaReady: true,
      assetsCreatedToday,
      pagesPublishedToday,
      publicPageViewsToday,
      videoEventsToday,
      bookingsToday,
      ctaClicksToday,
      agentEventsToday,
      pagesLinkedToday,
      urlResolutionsToday: publicPageViewsToday,
      timelineEventsToday,
      intentCalculationsToday,
      recommendationsGeneratedToday: intentCalculationsToday,
      timelineWritesToday: timelineEventsToday,
      launchesToday,
      launchPreviewsToday,
      launchFailuresToday,
      launchThrottlesToday: 0,
      membersEnrolledViaLaunchesToday,
      rowsReadToday:
        engagementEventsToday * 2 +
        pagesLinkedToday +
        intentCalculationsToday +
        launchPreviewsToday * 120,
      rowsWrittenToday:
        engagementEventsToday +
        assetsCreatedToday +
        pagesPublishedToday +
        pagesLinkedToday +
        intentCalculationsToday +
        launchesToday * 120 +
        membersEnrolledViaLaunchesToday,
      failuresToday: launchFailuresToday,
      throttlesToday: 0,
    }
  } catch {
    return fallback
  }
}
