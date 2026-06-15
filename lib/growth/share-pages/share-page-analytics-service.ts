import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { publishGrowthRealtimeEvent } from "@/lib/growth/realtime-events/realtime-events-service"
import { recomputeGrowthLeadEngagementIntelligence } from "@/lib/growth/recompute-engagement-intelligence"
import { checkSharePageAnalyticsRateLimit } from "@/lib/growth/share-pages/share-page-analytics-rate-limit"
import { emitSharePageHighIntentSignal } from "@/lib/growth/share-pages/share-page-analytics-signals"
import {
  recordSharePageBookingCompletedTimelineEvent,
  recordSharePageBookingStartedTimelineEvent,
  recordSharePageCtaClickedTimelineEvent,
  recordSharePageEngagedTimelineEvent,
  recordSharePageResourceOpenedTimelineEvent,
  recordSharePageViewedTimelineEvent,
} from "@/lib/growth/share-pages/share-page-analytics-timeline"
import {
  appendSharePageEvent,
  createSharePageViewSession,
  lookupSharePageByPublicToken,
  updateSharePageViewSession,
} from "@/lib/growth/share-pages/share-page-repository"
import {
  GROWTH_SHARE_PAGE_EVENT_TYPES,
  GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER,
  type GrowthSharePage,
  type GrowthSharePageEventType,
} from "@/lib/growth/share-pages/share-page-types"
import { recordSharePageAttributionEngagement } from "@/lib/growth/tracking/tracking-repository"
import { dispatchSequenceEventWakeSafely } from "@/lib/growth/sequences/conditions/sequence-event-wake-engine"
import { mapSharePageEventToSequenceWakeEvent } from "@/lib/growth/sequences/conditions/sequence-event-wake-types"

export const SHARE_PAGE_ENGAGEMENT_DURATION_MS = 30_000
export const SHARE_PAGE_ENGAGEMENT_SCROLL_PCT = 50

const SCROLL_MILESTONE_EVENTS = new Set<GrowthSharePageEventType>([
  "SHARE_PAGE_SCROLL_25",
  "SHARE_PAGE_SCROLL_50",
  "SHARE_PAGE_SCROLL_75",
  "SHARE_PAGE_SCROLL_100",
])

export type SharePageAnalyticsIngestInput = {
  rawToken: string
  eventType: GrowthSharePageEventType
  sessionKey: string
  sharePageViewId?: string | null
  durationMs?: number
  scrollDepthPct?: number
  eventLabel?: string
  metadata?: Record<string, unknown>
  pageUrl?: string
  referrer?: string | null
  utm?: Record<string, string>
  deviceMetadata?: Record<string, unknown>
  occurredAt?: string
  rateLimitKey?: string
}

export type SharePageAnalyticsIngestResult = {
  ok: boolean
  status: number
  error?: string
  sharePageViewId?: string
  deduplicated?: boolean
  engaged?: boolean
  engagementThresholdCrossed?: boolean
}

function isValidEventType(value: string): value is GrowthSharePageEventType {
  return (GROWTH_SHARE_PAGE_EVENT_TYPES as readonly string[]).includes(value)
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("share_page_events")
}

function viewsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("share_page_views")
}

async function hasExistingMilestoneEvent(
  admin: SupabaseClient,
  sharePageViewId: string,
  eventType: GrowthSharePageEventType,
): Promise<boolean> {
  const { count, error } = await eventsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("share_page_view_id", sharePageViewId)
    .eq("event_type", eventType)

  if (error) throw new Error(error.message)
  return (count ?? 0) > 0
}

async function hasSessionEngagedTimeline(
  admin: SupabaseClient,
  leadId: string,
  sharePageViewId: string,
): Promise<boolean> {
  const { count, error } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("event_type", "share_page_engaged")
    .contains("payload", { share_page_view_id: sharePageViewId })

  if (error) throw new Error(error.message)
  return (count ?? 0) > 0
}

async function resolveViewSession(
  admin: SupabaseClient,
  page: GrowthSharePage,
  input: SharePageAnalyticsIngestInput,
): Promise<{ viewId: string; created: boolean }> {
  if (input.sharePageViewId) {
    const { data, error } = await viewsTable(admin)
      .select("id, share_page_id")
      .eq("id", input.sharePageViewId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data || data.share_page_id !== page.id) {
      throw new Error("share_page_view_not_found")
    }
    return { viewId: data.id as string, created: false }
  }

  const { data: existingView, error: existingError } = await viewsTable(admin)
    .select("id")
    .eq("share_page_id", page.id)
    .eq("session_key", input.sessionKey)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)
  if (existingView?.id) return { viewId: existingView.id as string, created: false }

  const created = await createSharePageViewSession(admin, {
    sharePageId: page.id,
    leadId: page.leadId,
    sessionKey: input.sessionKey,
    pageUrl: input.pageUrl ?? "",
    referrer: input.referrer ?? null,
    utm: input.utm,
    deviceMetadata: input.deviceMetadata,
    startedAt: input.occurredAt,
    enrollmentId: page.enrollmentId,
    sequenceEnrollmentStepId: page.sequenceEnrollmentStepId,
    sequenceStepId: page.sequenceStepId,
    sequenceExecutionJobId: page.sequenceExecutionJobId,
  })

  return { viewId: created.id, created: true }
}

function resolveEngagementThreshold(input: {
  durationMs?: number
  scrollDepthPct?: number
  eventType: GrowthSharePageEventType
}): boolean {
  if (input.eventType === "SHARE_PAGE_SCROLL_50" || input.eventType === "SHARE_PAGE_SCROLL_75" || input.eventType === "SHARE_PAGE_SCROLL_100") {
    return true
  }
  if (typeof input.scrollDepthPct === "number" && input.scrollDepthPct >= SHARE_PAGE_ENGAGEMENT_SCROLL_PCT) {
    return true
  }
  if (typeof input.durationMs === "number" && input.durationMs >= SHARE_PAGE_ENGAGEMENT_DURATION_MS) {
    return true
  }
  return false
}

async function publishSharePageRealtime(
  admin: SupabaseClient,
  input: {
    eventType: string
    page: GrowthSharePage
    sharePageViewId: string
    payload?: Record<string, unknown>
  },
): Promise<void> {
  await publishGrowthRealtimeEvent(admin, {
    event_type: input.eventType,
    source: "realtime_event_bus",
    organization_id: input.page.organizationId,
    lead_id: input.page.leadId,
    payload: {
      qa_marker: GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER,
      share_page_id: input.page.id,
      share_page_view_id: input.sharePageViewId,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      outreach_execution: false,
      enrollment_execution: false,
      ...(input.payload ?? {}),
    },
  }).catch(() => undefined)
}

async function handleSideEffects(
  admin: SupabaseClient,
  page: GrowthSharePage,
  input: {
    eventType: GrowthSharePageEventType
    sharePageViewId: string
    occurredAt: string
    durationMs?: number
    scrollDepthPct?: number
    eventLabel?: string
    metadata?: Record<string, unknown>
    pageUrl?: string
    deduplicated?: boolean
  },
): Promise<{ engaged: boolean; engagementThresholdCrossed: boolean }> {
  const lead = await fetchGrowthLeadById(admin, page.leadId)
  const companyName = lead?.companyName?.trim() || "Unknown company"
  const domain = lead?.website?.trim() || null
  const context = {
    leadId: page.leadId,
    sharePageId: page.id,
    sharePageViewId: input.sharePageViewId,
    occurredAt: input.occurredAt,
  }

  let engaged = false
  let engagementThresholdCrossed = false

  if (input.eventType === "SHARE_PAGE_VIEWED" && !input.deduplicated) {
    await recordSharePageViewedTimelineEvent(admin, { ...context, pageUrl: input.pageUrl ?? null })
    await recordSharePageAttributionEngagement(admin, page.leadId, {
      incrementPageViews: 1,
      activityAt: input.occurredAt,
    })
    await emitSharePageHighIntentSignal(admin, {
      organizationId: page.organizationId,
      leadId: page.leadId,
      sharePageId: page.id,
      sharePageViewId: input.sharePageViewId,
      signalType: "share_page_viewed",
      companyName,
      domain,
      occurredAt: input.occurredAt,
      providerEventId: `${page.id}:${input.sharePageViewId}:viewed`,
      excerpt: "Lead viewed personalized share page.",
    })
    await publishSharePageRealtime(admin, {
      eventType: "share_page_viewed",
      page,
      sharePageViewId: input.sharePageViewId,
    })
  }

  if (input.eventType === "SHARE_PAGE_CTA_CLICKED" && !input.deduplicated) {
    await recordSharePageCtaClickedTimelineEvent(admin, {
      ...context,
      ctaLabel: input.eventLabel ?? null,
      trackingKey: typeof input.metadata?.tracking_key === "string" ? input.metadata.tracking_key : null,
    })
    await recordSharePageAttributionEngagement(admin, page.leadId, {
      incrementPageCtaClicks: 1,
      activityAt: input.occurredAt,
    })
    await emitSharePageHighIntentSignal(admin, {
      organizationId: page.organizationId,
      leadId: page.leadId,
      sharePageId: page.id,
      sharePageViewId: input.sharePageViewId,
      signalType: "share_page_cta_clicked",
      companyName,
      domain,
      occurredAt: input.occurredAt,
      providerEventId: `${page.id}:${input.sharePageViewId}:cta:${input.metadata?.tracking_key ?? input.eventLabel ?? "cta"}`,
      excerpt: input.eventLabel ? `Lead clicked CTA "${input.eventLabel}" on share page.` : "Lead clicked CTA on share page.",
    })
  }

  if (input.eventType === "SHARE_PAGE_BOOKING_STARTED" && !input.deduplicated) {
    await recordSharePageBookingStartedTimelineEvent(admin, context)
    await emitSharePageHighIntentSignal(admin, {
      organizationId: page.organizationId,
      leadId: page.leadId,
      sharePageId: page.id,
      sharePageViewId: input.sharePageViewId,
      signalType: "share_page_booking_started",
      companyName,
      domain,
      occurredAt: input.occurredAt,
      providerEventId: `${page.id}:${input.sharePageViewId}:booking_started`,
      excerpt: "Lead started booking flow from share page.",
    })
  }

  if (input.eventType === "SHARE_PAGE_BOOKING_COMPLETED" && !input.deduplicated) {
    await recordSharePageBookingCompletedTimelineEvent(admin, context)
    await recordSharePageAttributionEngagement(admin, page.leadId, {
      incrementPageBookingsCompleted: 1,
      activityAt: input.occurredAt,
    })
    await emitSharePageHighIntentSignal(admin, {
      organizationId: page.organizationId,
      leadId: page.leadId,
      sharePageId: page.id,
      sharePageViewId: input.sharePageViewId,
      signalType: "share_page_booking_completed",
      companyName,
      domain,
      occurredAt: input.occurredAt,
      providerEventId: `${page.id}:${input.sharePageViewId}:booking_completed`,
      excerpt: "Lead completed booking from share page.",
    })
    await publishSharePageRealtime(admin, {
      eventType: "share_page_booking_completed",
      page,
      sharePageViewId: input.sharePageViewId,
    })
  }

  if (input.eventType === "SHARE_PAGE_RESOURCE_OPENED" && !input.deduplicated) {
    await recordSharePageResourceOpenedTimelineEvent(admin, {
      ...context,
      resourceTitle: input.eventLabel ?? null,
    })
  }

  const thresholdCrossed = resolveEngagementThreshold({
    durationMs: input.durationMs,
    scrollDepthPct: input.scrollDepthPct,
    eventType: input.eventType,
  })

  if (thresholdCrossed) {
    const alreadyEngaged = await hasSessionEngagedTimeline(admin, page.leadId, input.sharePageViewId)
    if (!alreadyEngaged) {
      engagementThresholdCrossed = true
      engaged = true
      await recordSharePageEngagedTimelineEvent(admin, {
        ...context,
        durationMs: input.durationMs,
        scrollDepthPct: input.scrollDepthPct,
      })
      await recordSharePageAttributionEngagement(admin, page.leadId, {
        incrementPageEngaged: 1,
        activityAt: input.occurredAt,
      })
      await emitSharePageHighIntentSignal(admin, {
        organizationId: page.organizationId,
        leadId: page.leadId,
        sharePageId: page.id,
        sharePageViewId: input.sharePageViewId,
        signalType: "share_page_engaged",
        companyName,
        domain,
        occurredAt: input.occurredAt,
        providerEventId: `${page.id}:${input.sharePageViewId}:engaged`,
        excerpt: "Lead crossed engagement threshold on share page.",
        metadata: {
          duration_ms: input.durationMs ?? null,
          scroll_depth_pct: input.scrollDepthPct ?? null,
        },
      })
      await publishSharePageRealtime(admin, {
        eventType: "share_page_engaged",
        page,
        sharePageViewId: input.sharePageViewId,
        payload: {
          duration_ms: input.durationMs ?? null,
          scroll_depth_pct: input.scrollDepthPct ?? null,
        },
      })
    }
  }

  if (
    input.eventType === "SHARE_PAGE_VIEWED" ||
    input.eventType === "SHARE_PAGE_CTA_CLICKED" ||
    input.eventType === "SHARE_PAGE_BOOKING_COMPLETED" ||
    engagementThresholdCrossed
  ) {
    await recomputeGrowthLeadEngagementIntelligence(admin, page.leadId).catch(() => undefined)
  }

  return { engaged, engagementThresholdCrossed }
}

export async function ingestSharePageAnalyticsForPage(
  admin: SupabaseClient,
  input: Omit<SharePageAnalyticsIngestInput, "rawToken"> & { page: GrowthSharePage; skipRateLimit?: boolean },
): Promise<SharePageAnalyticsIngestResult> {
  const eventType = typeof input.eventType === "string" ? input.eventType.trim() : ""
  if (!isValidEventType(eventType)) {
    return { ok: false, status: 400, error: "invalid_event_type" }
  }

  const sessionKey = typeof input.sessionKey === "string" ? input.sessionKey.trim() : ""
  if (!sessionKey || sessionKey.length < 8) {
    return { ok: false, status: 400, error: "invalid_session_key" }
  }

  const page = input.page
  if (!input.skipRateLimit) {
    const rateLimit = checkSharePageAnalyticsRateLimit(input.rateLimitKey ?? `${page.id}:${sessionKey}`)
    if (!rateLimit.allowed) {
      return { ok: false, status: 429, error: "rate_limited" }
    }
  }

  const occurredAt = input.occurredAt ?? new Date().toISOString()
  const { viewId } = await resolveViewSession(admin, page, input)

  if (typeof input.durationMs === "number" || typeof input.scrollDepthPct === "number") {
    await updateSharePageViewSession(admin, viewId, {
      durationMs: input.durationMs,
      maxScrollDepthPct: input.scrollDepthPct,
      lastActivityAt: occurredAt,
      pageUrl: input.pageUrl,
      referrer: input.referrer ?? undefined,
      deviceMetadata: input.deviceMetadata,
    })
  }

  let deduplicated = false
  if (SCROLL_MILESTONE_EVENTS.has(eventType)) {
    deduplicated = await hasExistingMilestoneEvent(admin, viewId, eventType)
  } else if (
    eventType === "SHARE_PAGE_VIEWED" ||
    eventType === "SHARE_PAGE_BOOKING_STARTED" ||
    eventType === "SHARE_PAGE_BOOKING_COMPLETED"
  ) {
    deduplicated = await hasExistingMilestoneEvent(admin, viewId, eventType)
  }

  if (!deduplicated) {
    await appendSharePageEvent(admin, {
      sharePageId: page.id,
      leadId: page.leadId,
      sharePageViewId: viewId,
      eventType,
      eventLabel: input.eventLabel ?? "",
      enrollmentId: page.enrollmentId,
      sequenceEnrollmentStepId: page.sequenceEnrollmentStepId,
      sequenceStepId: page.sequenceStepId,
      sequenceExecutionJobId: page.sequenceExecutionJobId,
      metadata: {
        qa_marker: GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER,
        ...(input.metadata ?? {}),
      },
      occurredAt,
    })
  }

  const sideEffects = await handleSideEffects(admin, page, {
    eventType,
    sharePageViewId: viewId,
    occurredAt,
    durationMs: input.durationMs,
    scrollDepthPct: input.scrollDepthPct,
    eventLabel: input.eventLabel,
    metadata: input.metadata,
    pageUrl: input.pageUrl,
    deduplicated,
  })

  const wakeEvent = mapSharePageEventToSequenceWakeEvent(eventType)
  if (wakeEvent && !deduplicated) {
    dispatchSequenceEventWakeSafely(admin, {
      leadId: page.leadId,
      sequenceEnrollmentId: page.enrollmentId,
      sequenceEnrollmentStepId: page.sequenceEnrollmentStepId,
      source: "share_page",
      event: wakeEvent,
      occurredAt,
    })
  }
  if (sideEffects.engagementThresholdCrossed) {
    dispatchSequenceEventWakeSafely(admin, {
      leadId: page.leadId,
      sequenceEnrollmentId: page.enrollmentId,
      sequenceEnrollmentStepId: page.sequenceEnrollmentStepId,
      source: "share_page",
      event: "share_page.engaged",
      occurredAt,
    })
  }

  return {
    ok: true,
    status: 200,
    sharePageViewId: viewId,
    deduplicated,
    engaged: sideEffects.engaged,
    engagementThresholdCrossed: sideEffects.engagementThresholdCrossed,
  }
}

export async function ingestSharePageAnalyticsEvent(
  admin: SupabaseClient,
  input: SharePageAnalyticsIngestInput,
): Promise<SharePageAnalyticsIngestResult> {
  const eventType = typeof input.eventType === "string" ? input.eventType.trim() : ""
  if (!isValidEventType(eventType)) {
    return { ok: false, status: 400, error: "invalid_event_type" }
  }

  const sessionKey = typeof input.sessionKey === "string" ? input.sessionKey.trim() : ""
  if (!sessionKey || sessionKey.length < 8) {
    return { ok: false, status: 400, error: "invalid_session_key" }
  }

  const lookup = await lookupSharePageByPublicToken(admin, input.rawToken.trim())
  if (lookup.access === "not_found") {
    return { ok: false, status: 404, error: "not_found" }
  }
  if (lookup.access === "expired") {
    return { ok: false, status: 410, error: "expired" }
  }
  if (lookup.access === "revoked" || lookup.access === "archived") {
    return { ok: false, status: 403, error: lookup.access }
  }
  if (lookup.access !== "granted" || !lookup.page) {
    return { ok: false, status: 403, error: lookup.access }
  }

  return ingestSharePageAnalyticsForPage(admin, {
    ...input,
    page: lookup.page,
  })
}

export async function assertSharePageAnalyticsSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error: scoreError } = await admin.schema("growth").from("engagement_scores").select("page_views").limit(1)
  if (scoreError) return false

  const { error: signalProbe } = await admin
    .schema("growth")
    .from("signals")
    .select("signal_type")
    .eq("signal_type", "share_page_viewed")
    .limit(1)

  return !signalProbe
}
