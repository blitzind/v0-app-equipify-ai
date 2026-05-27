import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listBookingAttributionEvents } from "@/lib/growth/booking-intelligence/booking-attribution"
import {
  listBookingIntentSignals,
  listBookingRecommendations,
  listCalendarRoutingRules,
  listMeetingConversionEvents,
  listSequenceMeetingExitCandidates,
} from "@/lib/growth/booking-intelligence/booking-events"
import {
  GROWTH_CALENDAR_BOOKING_INTELLIGENCE_QA_MARKER,
  type GrowthBookingIntelligenceDashboard,
} from "@/lib/growth/booking-intelligence/booking-types"

export async function fetchGrowthBookingIntelligenceDashboard(
  admin: SupabaseClient,
  input?: { leadId?: string },
): Promise<GrowthBookingIntelligenceDashboard> {
  const [
    intentSignals,
    pendingBookingReviews,
    approvedBookingActions,
    completedMeetings,
    sequenceStopCandidates,
    conversionAttribution,
    routingRules,
    recentConversionEvents,
  ] = await Promise.all([
    listBookingIntentSignals(admin, { leadId: input?.leadId, limit: 100 }),
    listBookingRecommendations(admin, { leadId: input?.leadId, status: "pending_review", limit: 50 }),
    listBookingRecommendations(admin, { leadId: input?.leadId, status: "approved", limit: 30 }),
    listBookingRecommendations(admin, { leadId: input?.leadId, status: "completed", limit: 30 }),
    listSequenceMeetingExitCandidates(admin, { leadId: input?.leadId, limit: 30 }),
    listBookingAttributionEvents(admin, { leadId: input?.leadId, limit: 30 }),
    listCalendarRoutingRules(admin),
    listMeetingConversionEvents(admin, { leadId: input?.leadId, limit: 30 }),
  ])

  const bookingRecommendations = [
    ...pendingBookingReviews,
    ...approvedBookingActions,
    ...completedMeetings,
  ].slice(0, 50)

  return {
    qa_marker: GROWTH_CALENDAR_BOOKING_INTELLIGENCE_QA_MARKER,
    meetingIntentCount: intentSignals.length,
    pendingBookingReviews,
    approvedBookingActions,
    completedMeetings,
    sequenceStopCandidates,
    conversionAttribution,
    bookingRecommendations,
    intentSignals: intentSignals.slice(0, 50),
    routingRules,
    attributionEvents: conversionAttribution,
    recentConversionEvents,
  }
}
