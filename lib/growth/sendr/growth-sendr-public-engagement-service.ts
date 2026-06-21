import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SENDR_ENGAGEMENT_EVENT_TYPES,
  GROWTH_SENDR_LIMITS,
  GROWTH_SENDR_PUBLIC_QA_MARKER,
  type GrowthSendrEngagementEventType,
} from "@/lib/growth/sendr/growth-sendr-config"
import {
  recordSendrBookingCompletedTimeline,
  recordSendrBookingStartedTimeline,
  recordSendrCtaClickedTimeline,
  recordSendrLandingPageViewedTimeline,
  recordSendrVideoCompletedTimeline,
  recordSendrVideoStartedTimeline,
} from "@/lib/growth/sendr/growth-sendr-analytics-timeline"
import { appendGrowthSendrEngagementEvents } from "@/lib/growth/sendr/growth-sendr-engagement-event-service"
import { consumeSendrBudget } from "@/lib/growth/sendr/growth-sendr-guardrails"
import { syncSendrLeadTimelineIntelligence } from "@/lib/growth/sendr/growth-sendr-timeline-intelligence-service"
import {
  resolveSendrPublicPageContext,
  type SendrPublicPageContext,
} from "@/lib/growth/sendr/growth-sendr-public-page-service"
import type { SendrVisitorRenderContext } from "@/lib/growth/sendr/growth-sendr-visitor-render-context"
import type { GrowthSendrEngagementEventInput } from "@/lib/growth/sendr/growth-sendr-types"
import type { GrowthRuntimeResourceType } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

export type SendrPublicEngagementEventInput = {
  eventType: GrowthSendrEngagementEventType
  eventValue?: Record<string, unknown>
}

function resourceTypeForEvent(eventType: GrowthSendrEngagementEventType): GrowthRuntimeResourceType {
  if (eventType.startsWith("video_")) return "video_events"
  if (eventType.startsWith("booking_") || eventType === "calendar_open") return "bookings"
  return "page_views"
}

function isValidPublicEventType(value: string): value is GrowthSendrEngagementEventType {
  return (GROWTH_SENDR_ENGAGEMENT_EVENT_TYPES as readonly string[]).includes(value)
}

async function writeTimelineForEvent(
  admin: SupabaseClient,
  ctx: SendrPublicPageContext,
  input: {
    sessionId: string
    eventType: GrowthSendrEngagementEventType
    eventValue?: Record<string, unknown>
    pageUrl?: string
  },
): Promise<void> {
  if (!ctx.leadId) return

  const base = {
    leadId: ctx.leadId,
    publishedSlug: ctx.publishedSlug,
    sessionId: input.sessionId,
    metadata: input.eventValue,
  }

  switch (input.eventType) {
    case "page_view":
      await recordSendrLandingPageViewedTimeline(admin, { ...base, pageUrl: input.pageUrl })
      break
    case "video_start":
      await recordSendrVideoStartedTimeline(admin, base)
      break
    case "video_complete":
      await recordSendrVideoCompletedTimeline(admin, base)
      break
    case "cta_click":
      await recordSendrCtaClickedTimeline(admin, {
        ...base,
        ctaLabel: typeof input.eventValue?.label === "string" ? input.eventValue.label : null,
      })
      break
    case "calendar_open":
    case "booking_started":
      await recordSendrBookingStartedTimeline(admin, base)
      break
    case "booking_completed":
      await recordSendrBookingCompletedTimeline(admin, base)
      break
    default:
      break
  }
}

export async function ingestSendrPublicEngagementEvents(
  admin: SupabaseClient,
  input: {
    slug: string
    sessionId: string
    events: SendrPublicEngagementEventInput[]
    pageUrl?: string
    renderContext?: SendrVisitorRenderContext
  },
): Promise<{ ok: boolean; status: number; accepted: number; throttled: number; error?: string }> {
  const ctx = await resolveSendrPublicPageContext(admin, input.slug, input.renderContext)
  if (!ctx) {
    return { ok: false, status: 404, accepted: 0, throttled: 0, error: "not_found" }
  }

  const batch = input.events
    .slice(0, GROWTH_SENDR_LIMITS.MAX_MEDIA_EVENT_BATCH)
    .filter((e) => isValidPublicEventType(e.eventType))

  if (batch.length === 0) {
    return { ok: false, status: 400, accepted: 0, throttled: 0, error: "invalid_events" }
  }

  const engagementEvents: GrowthSendrEngagementEventInput[] = batch.map((event) => ({
    sessionId: input.sessionId,
    eventType: event.eventType,
    landingPageId: ctx.landingPageId,
    videoAssetId: event.eventType.startsWith("video_")
      ? typeof event.eventValue?.videoAssetId === "string"
        ? event.eventValue.videoAssetId
        : ctx.videoAssetId
      : null,
    bookingAssetId:
      event.eventType === "calendar_open" ||
      event.eventType.startsWith("booking_")
        ? ctx.bookingAssetId
        : null,
    eventValue: {
      ...(event.eventValue ?? {}),
      published_slug: ctx.publishedSlug,
      qa_marker: GROWTH_SENDR_PUBLIC_QA_MARKER,
      ...(ctx.leadId ? { visitor_lead_id: ctx.leadId } : {}),
    },
  }))

  const result = await appendGrowthSendrEngagementEvents(admin, {
    organizationId: ctx.organizationId,
    events: engagementEvents,
    resourceTypeResolver: resourceTypeForEvent,
  })

  for (const event of batch) {
    if (result.accepted === 0) break
    try {
      const timelineEnabled = await isRuntimeKillSwitchEnabled(admin, "sendr_timeline_enabled")
      if (!timelineEnabled) continue
      const timelineBudget = await consumeSendrBudget(admin, {
        organizationId: ctx.organizationId,
        resourceType: "sendr_timeline_events",
      })
      if (!timelineBudget.allowed) continue
      await writeTimelineForEvent(admin, ctx, {
        sessionId: input.sessionId,
        eventType: event.eventType,
        eventValue: event.eventValue,
        pageUrl: input.pageUrl,
      })
    } catch {
      // timeline is best-effort; never fail public ingest
    }
  }

  if (ctx.leadId && result.accepted > 0) {
    try {
      await syncSendrLeadTimelineIntelligence(admin, {
        organizationId: ctx.organizationId,
        leadId: ctx.leadId,
      })
    } catch {
      // intelligence sync is best-effort
    }
  }

  return {
    ok: true,
    status: 200,
    accepted: result.accepted,
    throttled: result.throttled,
  }
}

export { GROWTH_SENDR_PUBLIC_QA_MARKER }
