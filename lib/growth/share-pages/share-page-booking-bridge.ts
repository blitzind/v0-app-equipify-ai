import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { ingestSharePageAnalyticsForPage } from "@/lib/growth/share-pages/share-page-analytics-service"
import { fetchSharePageForBookingAttribution } from "@/lib/growth/share-pages/share-page-booking-service"
import {
  sharePageBookingAttributionToMetadata,
  type GrowthSharePageBookingAttribution,
} from "@/lib/growth/share-pages/share-page-booking-attribution"
import type { GrowthSharePageEventType } from "@/lib/growth/share-pages/share-page-types"

function bookingAttributionSessionKey(attribution: GrowthSharePageBookingAttribution): string {
  return `booking_${attribution.sharePageId}_${attribution.leadId}`
}

export async function bridgeSharePageBookingAnalyticsEvent(
  admin: SupabaseClient,
  input: {
    eventType: Extract<GrowthSharePageEventType, "SHARE_PAGE_BOOKING_STARTED" | "SHARE_PAGE_BOOKING_COMPLETED">
    attribution: GrowthSharePageBookingAttribution
    bookingId?: string | null
    meetingId?: string | null
    occurredAt?: string
  },
): Promise<{ ok: boolean; reason?: string }> {
  const page = await fetchSharePageForBookingAttribution(admin, input.attribution)
  if (!page) return { ok: false, reason: "share_page_not_eligible" }

  const result = await ingestSharePageAnalyticsForPage(admin, {
    page,
    eventType: input.eventType,
    sessionKey: bookingAttributionSessionKey(input.attribution),
    eventLabel: input.eventType === "SHARE_PAGE_BOOKING_COMPLETED" ? "Booking completed" : "Booking started",
    metadata: {
      ...sharePageBookingAttributionToMetadata(input.attribution),
      booking_id: input.bookingId ?? null,
      meeting_id: input.meetingId ?? null,
      bridge: "share_page_booking",
    },
    occurredAt: input.occurredAt,
    skipRateLimit: true,
  })

  return result.ok ? { ok: true } : { ok: false, reason: result.error }
}

export async function bridgeSharePageBookingCompleted(
  admin: SupabaseClient,
  input: {
    attribution: GrowthSharePageBookingAttribution
    bookingId: string
    meetingId: string
    occurredAt?: string
  },
): Promise<{ ok: boolean; reason?: string }> {
  return bridgeSharePageBookingAnalyticsEvent(admin, {
    eventType: "SHARE_PAGE_BOOKING_COMPLETED",
    attribution: input.attribution,
    bookingId: input.bookingId,
    meetingId: input.meetingId,
    occurredAt: input.occurredAt,
  })
}

export async function bridgeSharePageBookingStarted(
  admin: SupabaseClient,
  input: {
    attribution: GrowthSharePageBookingAttribution
    occurredAt?: string
  },
): Promise<{ ok: boolean; reason?: string }> {
  return bridgeSharePageBookingAnalyticsEvent(admin, {
    eventType: "SHARE_PAGE_BOOKING_STARTED",
    attribution: input.attribution,
    occurredAt: input.occurredAt,
  })
}
