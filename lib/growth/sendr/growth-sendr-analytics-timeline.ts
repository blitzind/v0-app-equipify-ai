import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_SENDR_PUBLIC_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type { GrowthSendrTimelineEventType } from "@/lib/growth/sendr/growth-sendr-config"

type SendrTimelineContext = {
  leadId: string
  publishedSlug: string
  sessionId: string
  occurredAt?: string
  metadata?: Record<string, unknown>
}

function basePayload(input: SendrTimelineContext): Record<string, unknown> {
  return {
    published_slug: input.publishedSlug,
    session_id: input.sessionId,
    source: "sendr_public_runtime",
    qa_marker: GROWTH_SENDR_PUBLIC_QA_MARKER,
    ...(input.metadata ?? {}),
  }
}

async function hasSessionTimelineEvent(
  admin: SupabaseClient,
  input: { leadId: string; eventType: GrowthSendrTimelineEventType; sessionId: string },
): Promise<boolean> {
  const { count, error } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", input.leadId)
    .eq("event_type", input.eventType)
    .contains("payload", { session_id: input.sessionId })

  if (error?.message?.includes("does not exist")) return false
  if (error) return false
  return (count ?? 0) > 0
}

export async function recordSendrTimelineEvent(
  admin: SupabaseClient,
  input: SendrTimelineContext & {
    eventType: GrowthSendrTimelineEventType
    title: string
    summary: string
  },
): Promise<void> {
  const exists = await hasSessionTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: input.eventType,
    sessionId: input.sessionId,
  })
  if (exists) return

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: input.eventType,
    title: input.title,
    summary: input.summary,
    payload: basePayload(input),
    occurredAt: input.occurredAt,
  })
}

export async function recordSendrLandingPageViewedTimeline(
  admin: SupabaseClient,
  input: SendrTimelineContext & { pageUrl?: string | null },
): Promise<void> {
  await recordSendrTimelineEvent(admin, {
    ...input,
    eventType: "landing_page_viewed",
    title: "Personalized video page viewed",
    summary: input.pageUrl
      ? `Viewed personalized video page (${input.pageUrl})`
      : "Viewed personalized video page.",
  })
}

export async function recordSendrVideoStartedTimeline(
  admin: SupabaseClient,
  input: SendrTimelineContext,
): Promise<void> {
  await recordSendrTimelineEvent(admin, {
    ...input,
    eventType: "video_started",
    title: "Personalized video started",
    summary: "Started video on personalized video page.",
  })
}

export async function recordSendrVideoCompletedTimeline(
  admin: SupabaseClient,
  input: SendrTimelineContext,
): Promise<void> {
  await recordSendrTimelineEvent(admin, {
    ...input,
    eventType: "video_completed",
    title: "Personalized video completed",
    summary: "Completed video on personalized video page.",
  })
}

export async function recordSendrCtaClickedTimeline(
  admin: SupabaseClient,
  input: SendrTimelineContext & { ctaLabel?: string | null },
): Promise<void> {
  await recordSendrTimelineEvent(admin, {
    ...input,
    eventType: "cta_clicked",
    title: "Personalized video CTA clicked",
    summary: input.ctaLabel
      ? `Clicked "${input.ctaLabel}" on personalized video page`
      : "Clicked call-to-action on personalized video page.",
  })
}

export async function recordSendrBookingStartedTimeline(
  admin: SupabaseClient,
  input: SendrTimelineContext,
): Promise<void> {
  await recordSendrTimelineEvent(admin, {
    ...input,
    eventType: "booking_started",
    title: "Personalized video booking started",
    summary: "Started booking flow from personalized video page.",
  })
}

export async function recordSendrBookingCompletedTimeline(
  admin: SupabaseClient,
  input: SendrTimelineContext,
): Promise<void> {
  await recordSendrTimelineEvent(admin, {
    ...input,
    eventType: "booking_completed",
    title: "Personalized video booking completed",
    summary: "Completed booking from personalized video page.",
  })
}
