import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthActivityEventView, GrowthActivityUrgency } from "@/lib/growth/activity/growth-activity-workspace-types"
import { getGrowthActivityUnifiedFeed } from "@/lib/growth/activity/growth-activity-unified-read-service"
import {
  GE_V1_2_UNIFIED_ENGAGEMENT_READ_QA_MARKER,
  type GrowthUnifiedEngagementFeedPayload,
  type GrowthUnifiedEngagementIntensity,
  type GrowthUnifiedEngagementRow,
} from "@/lib/growth/engagement/growth-unified-engagement-read-types"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"

function mapIntensity(urgency: GrowthActivityUrgency): GrowthUnifiedEngagementIntensity {
  return urgency
}

function resolveRecommendedAction(event: GrowthActivityEventView): {
  label: string | null
  href: string | null
} {
  const primary = event.actions[0]
  if (primary) return { label: primary.label, href: primary.href }

  if (event.urgency === "critical" || event.urgency === "high") {
    if (event.leadId) {
      return {
        label: "Review lead",
        href: `${GROWTH_WORKSPACE_BASE_PATH}/leads/${event.leadId}`,
      }
    }
  }

  if (/booking|meeting|demo/i.test(event.title)) {
    return {
      label: "Open meetings",
      href: `${GROWTH_WORKSPACE_BASE_PATH}/meetings`,
    }
  }

  if (/reply|inbox|email/i.test(event.title) || event.category === "communication") {
    return {
      label: "Open inbox",
      href: `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    }
  }

  if (event.landingPageId) {
    return {
      label: "View engagement",
      href: `${GROWTH_WORKSPACE_BASE_PATH}/engagement`,
    }
  }

  return { label: null, href: null }
}

function mapActivityEventToUnifiedRow(event: GrowthActivityEventView): GrowthUnifiedEngagementRow {
  const recommended = resolveRecommendedAction(event)
  return {
    id: event.id,
    prospectName: event.leadName,
    companyName: event.companyName,
    campaignOrPage: event.landingPageTitle ?? event.metadata.sharePageId ?? null,
    eventType: event.type,
    eventLabel: event.title,
    occurredAt: event.occurredAt,
    intensity: mapIntensity(event.urgency),
    recommendedAction: recommended.label,
    recommendedActionHref: recommended.href,
    source: event.source,
    leadId: event.leadId,
    landingPageId: event.landingPageId ?? null,
  }
}

export async function getGrowthUnifiedEngagementFeed(
  admin: SupabaseClient,
  input: {
    organizationId: string
    dateRangePreset?: string | null
    limit?: number
  },
): Promise<GrowthUnifiedEngagementFeedPayload> {
  const feed = await getGrowthActivityUnifiedFeed(admin, {
    organizationId: input.organizationId,
    dateRangePreset: input.dateRangePreset ?? "last_7_days",
    limit: input.limit ?? 100,
  })

  const rows = feed.events.map(mapActivityEventToUnifiedRow)
  const sourceCounts = Object.fromEntries(feed.sourceAudit.map((entry) => [entry.source, entry.eventCount]))

  return {
    qaMarker: GE_V1_2_UNIFIED_ENGAGEMENT_READ_QA_MARKER,
    generatedAt: new Date().toISOString(),
    rows,
    sourceCounts,
  }
}
