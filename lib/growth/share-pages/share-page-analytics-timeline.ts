import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import { GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER } from "@/lib/growth/share-pages/share-page-types"

type SharePageTimelineContext = {
  leadId: string
  sharePageId: string
  sharePageViewId?: string | null
  occurredAt?: string
  metadata?: Record<string, unknown>
}

function basePayload(input: SharePageTimelineContext): Record<string, unknown> {
  return {
    share_page_id: input.sharePageId,
    share_page_view_id: input.sharePageViewId ?? null,
    source: "share_page_analytics",
    qa_marker: GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER,
    ...(input.metadata ?? {}),
  }
}

export async function recordSharePageViewedTimelineEvent(
  admin: SupabaseClient,
  input: SharePageTimelineContext & { pageUrl?: string | null },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "share_page_viewed",
    title: "Share page viewed",
    summary: input.pageUrl ? `Viewed personalized page (${input.pageUrl})` : "Viewed personalized share page.",
    payload: basePayload(input),
    occurredAt: input.occurredAt,
  })
}

export async function recordSharePageEngagedTimelineEvent(
  admin: SupabaseClient,
  input: SharePageTimelineContext & { durationMs?: number; scrollDepthPct?: number },
): Promise<void> {
  const parts: string[] = []
  if (typeof input.durationMs === "number") parts.push(`${Math.round(input.durationMs / 1000)}s on page`)
  if (typeof input.scrollDepthPct === "number") parts.push(`${input.scrollDepthPct}% scroll depth`)

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "share_page_engaged",
    title: "Share page engaged",
    summary: parts.length > 0 ? parts.join(" · ") : "Engagement threshold crossed on share page.",
    payload: basePayload(input),
    occurredAt: input.occurredAt,
  })
}

export async function recordSharePageCtaClickedTimelineEvent(
  admin: SupabaseClient,
  input: SharePageTimelineContext & { ctaLabel?: string | null; trackingKey?: string | null },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "share_page_cta_clicked",
    title: "Share page CTA clicked",
    summary: input.ctaLabel ? `Clicked "${input.ctaLabel}"` : "Clicked call-to-action on share page.",
    payload: basePayload(input),
    occurredAt: input.occurredAt,
  })
}

export async function recordSharePageBookingStartedTimelineEvent(
  admin: SupabaseClient,
  input: SharePageTimelineContext,
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "share_page_booking_started",
    title: "Share page booking started",
    summary: "Started booking flow from share page.",
    payload: basePayload(input),
    occurredAt: input.occurredAt,
  })
}

export async function recordSharePageBookingCompletedTimelineEvent(
  admin: SupabaseClient,
  input: SharePageTimelineContext,
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "share_page_booking_completed",
    title: "Share page booking completed",
    summary: "Completed booking from share page.",
    payload: basePayload(input),
    occurredAt: input.occurredAt,
  })
}

export async function recordSharePageResourceOpenedTimelineEvent(
  admin: SupabaseClient,
  input: SharePageTimelineContext & { resourceTitle?: string | null },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "share_page_resource_opened",
    title: "Share page resource opened",
    summary: input.resourceTitle ? `Opened resource "${input.resourceTitle}"` : "Opened resource on share page.",
    payload: basePayload(input),
    occurredAt: input.occurredAt,
  })
}
