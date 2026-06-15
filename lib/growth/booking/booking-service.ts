import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  isSlotStillAvailable,
} from "@/lib/growth/booking/booking-availability"
import {
  fetchGrowthBookingPageBySlug,
  insertGrowthBookingPageBooking,
  listConfirmedBookingsInRange,
} from "@/lib/growth/booking/booking-page-repository"
import type { GrowthBookingPage, GrowthBookingSlot } from "@/lib/growth/booking/booking-page-types"
import {
  computeBookingHorizonEnd,
  formatDateKeyInTimezone,
} from "@/lib/growth/booking/booking-timezone-utils"
import { getGrowthCalendarConnectionWithFreshAccessToken } from "@/lib/growth/calendar/calendar-connection-service"
import { fetchGoogleCalendarBusyIntervals } from "@/lib/growth/calendar/google-calendar-client"
import { syncGrowthMeetingToGoogleCalendar } from "@/lib/growth/calendar/sync-meeting-calendar"
import { createGrowthLead } from "@/lib/growth/lead-repository"
import { createGrowthMeeting } from "@/lib/growth/meeting-intelligence/mutate-meeting"
import { updateGrowthMeetingRow, fetchGrowthMeetingById } from "@/lib/growth/meeting-intelligence/meeting-repository"
import { resolveOutboundLeadByEmail } from "@/lib/growth/outbound/resolve-lead-by-email"
import { normalizeEmail } from "@/lib/growth/import/normalize"
import { fetchGrowthMeetingLocationPlatformContext } from "@/lib/growth/meeting-location/meeting-location-settings-server"
import { resolveMeetingLocation } from "@/lib/growth/meeting-location/resolve-meeting-location"
import type { GrowthSharePageBookingAttribution } from "@/lib/growth/share-pages/share-page-booking-attribution"
import {
  sharePageBookingAttributionToMeetingSourceAttribution,
  sharePageBookingAttributionToMetadata,
} from "@/lib/growth/share-pages/share-page-booking-attribution"
import { bridgeSharePageBookingCompleted } from "@/lib/growth/share-pages/share-page-booking-bridge"
import { fetchSharePageForBookingAttribution } from "@/lib/growth/share-pages/share-page-booking-service"
import {
  fetchPublicBookingSlots,
  type PublicBookingSlotsResult,
} from "@/lib/growth/booking/public-booking-slots"

export { fetchPublicBookingSlots, type PublicBookingSlotsResult }

export type PublicBookingSubmitResult =
  | {
      ok: true
      bookingId: string
      meetingId: string
      meetingUrl: string | null
      locationLabel: string | null
      locationUrl: string | null
      slotStartAt: string
      slotEndAt: string
      confirmationMessage: string | null
      calendarInvitePending?: boolean
    }
  | { ok: false; code: string; message: string }

import { publicBookingErrorMessage } from "@/lib/growth/booking/booking-public-errors"
import { resolvePublicBookingLocationDisplay } from "@/lib/growth/booking/booking-public-display"

function normalizeSlotIso(value: string): string {
  return new Date(value).toISOString()
}

function sanitizeBusyIntervals(
  intervals: Array<{ start: string; end: string }>,
): Array<{ start: string; end: string }> {
  return intervals.filter((interval) => {
    const startMs = Date.parse(interval.start)
    const endMs = Date.parse(interval.end)
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false
    if (endMs <= startMs) return false
    if (endMs - startMs > 31 * 24 * 60 * 60 * 1000) return false
    return true
  })
}

async function loadOptionalGoogleBusyIntervals(
  admin: SupabaseClient,
  input: { ownerUserId: string; timeMin: string; timeMax: string; timezone: string },
): Promise<Array<{ start: string; end: string }>> {
  try {
    const connection = await getGrowthCalendarConnectionWithFreshAccessToken(admin, input.ownerUserId)
    if (!connection) return []
    const rawBusy = await fetchGoogleCalendarBusyIntervals({
      accessToken: connection.accessToken,
      timeMin: input.timeMin,
      timeMax: input.timeMax,
      timezone: input.timezone,
    })
    return sanitizeBusyIntervals(rawBusy)
  } catch {
    return []
  }
}

async function resolveLeadForBooking(
  admin: SupabaseClient,
  page: GrowthBookingPage,
  input: { name: string; email: string; company?: string | null; phone?: string | null; notes?: string | null },
): Promise<string> {
  const email = normalizeEmail(input.email)
  if (!email) throw new Error("invalid_email")

  const resolved = await resolveOutboundLeadByEmail(admin, email)
  if (resolved?.leadId) return resolved.leadId

  const lead = await createGrowthLead(admin, {
    companyName: input.company?.trim() || input.name.trim() || "Booking guest",
    contactName: input.name.trim(),
    contactEmail: email,
    contactPhone: input.phone ?? null,
    sourceKind: "manual",
    sourceDetail: `booking_page:${page.slug}`,
    sourceChannel: "booking_page",
    assignedTo: page.ownerUserId,
    createdBy: page.ownerUserId,
    notes: input.notes ?? null,
  })
  return lead.id
}

function resolveBookingMeetingLocation(
  page: GrowthBookingPage,
  platform: Awaited<ReturnType<typeof fetchGrowthMeetingLocationPlatformContext>>,
) {
  return resolveMeetingLocation({
    platform: platform.settings,
    googleCalendarConnected: platform.googleCalendarConnected,
    bookingOverride: page.meetingProviderOverride,
    bookingAutoCreateOverride: page.autoCreateMeetingLinkOverride,
    legacyLocationType: page.locationType,
    manualMeetingUrl: page.manualMeetingUrl,
    meetingLocationLabel: page.customLocation,
  })
}

export async function submitPublicBooking(
  admin: SupabaseClient,
  input: {
    slug: string
    name: string
    email: string
    company?: string | null
    phone?: string | null
    notes?: string | null
    slotStartAt: string
    slotEndAt: string
    appOrigin: string
    attribution?: GrowthSharePageBookingAttribution
  },
): Promise<PublicBookingSubmitResult> {
  const page = await fetchGrowthBookingPageBySlug(admin, input.slug, true)
  if (!page) return { ok: false, code: "page_disabled", message: publicBookingErrorMessage("page_disabled") }

  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  if (!name || !email) {
    return { ok: false, code: "invalid_form", message: publicBookingErrorMessage("invalid_form") }
  }

  const slot: GrowthBookingSlot = { startAt: input.slotStartAt, endAt: input.slotEndAt }
  const now = new Date()
  const horizonEnd = computeBookingHorizonEnd(now, page.schedulingHorizonDays)
  const slotStartMs = new Date(slot.startAt).getTime()
  const minimumNoticeMs = page.minimumNoticeHours * 60 * 60 * 1000
  if (slotStartMs < now.getTime() + minimumNoticeMs || slotStartMs > horizonEnd.getTime()) {
    return { ok: false, code: "slot_unavailable", message: publicBookingErrorMessage("slot_unavailable") }
  }

  const monthKey = formatDateKeyInTimezone(new Date(slot.startAt), page.timezone).slice(0, 7)
  const slotsResult = await fetchPublicBookingSlots(admin, input.slug, { month: monthKey })
  if (!slotsResult.ok) return { ok: false, code: slotsResult.code, message: slotsResult.message }

  const slotAllowed = slotsResult.slots.some(
    (entry) =>
      normalizeSlotIso(entry.startAt) === normalizeSlotIso(slot.startAt) &&
      normalizeSlotIso(entry.endAt) === normalizeSlotIso(slot.endAt),
  )
  if (!slotAllowed) {
    return { ok: false, code: "slot_unavailable", message: publicBookingErrorMessage("slot_unavailable") }
  }

  const busyIntervals = await loadOptionalGoogleBusyIntervals(admin, {
    ownerUserId: page.ownerUserId,
    timeMin: slot.startAt,
    timeMax: slot.endAt,
    timezone: page.timezone,
  })

  const existingBookings = await listConfirmedBookingsInRange(admin, page.id, slot.startAt, slot.endAt)
  if (
    !isSlotStillAvailable(slot, busyIntervals, existingBookings, {
      bufferBeforeMinutes: page.bufferBeforeMinutes,
      bufferAfterMinutes: page.bufferAfterMinutes,
      bufferMinutes: page.bufferMinutes,
    })
  ) {
    return { ok: false, code: "slot_unavailable", message: publicBookingErrorMessage("slot_unavailable") }
  }

  try {
    const platformContext = await fetchGrowthMeetingLocationPlatformContext(admin, page.ownerUserId)
    const resolvedLocation = resolveBookingMeetingLocation(page, platformContext)

    const attributedSharePage = input.attribution
      ? await fetchSharePageForBookingAttribution(admin, input.attribution)
      : null
    const leadId =
      attributedSharePage?.leadId ??
      (await resolveLeadForBooking(admin, page, input))

    const meetingSourceAttribution = input.attribution
      ? sharePageBookingAttributionToMeetingSourceAttribution(input.attribution)
      : null

    const title = page.meetingType?.trim() || `${page.name} — ${name}`
    const meetingResult = await createGrowthMeeting(admin, {
      leadId,
      title,
      status: "scheduled",
      startAt: slot.startAt,
      endAt: slot.endAt,
      source: "calendar_sync",
      meetingLocationType: resolvedLocation.locationProvider,
      autoCreateMeetingLink: resolvedLocation.autoCreateMeetingLink,
      manualMeetingUrl: resolvedLocation.manualMeetingUrl,
      meetingLocationLabel: resolvedLocation.meetingLocationLabel,
      meetingUrl: resolvedLocation.meetingUrl,
      notes: input.notes ?? null,
      attendeeEmails: [email],
      timezone: page.timezone,
      ownerUserId: page.ownerUserId,
      actor: { userId: page.ownerUserId },
    })
    if (!meetingResult.ok) {
      return { ok: false, code: "booking_failed", message: publicBookingErrorMessage("booking_failed") }
    }

    await updateGrowthMeetingRow(admin, meetingResult.meeting.id, {
      booking_page_id: page.id,
      calendar_sync_status: "pending",
      ...(meetingSourceAttribution ? { source_attribution: meetingSourceAttribution } : {}),
    })

    const meetingForSync = await fetchGrowthMeetingById(admin, meetingResult.meeting.id)
    if (!meetingForSync) {
      return { ok: false, code: "booking_failed", message: publicBookingErrorMessage("booking_failed") }
    }

    const locationDisplay = resolvePublicBookingLocationDisplay({
      locationType: page.locationType,
      customLocation: page.customLocation,
      manualMeetingUrl: resolvedLocation.meetingUrl ?? page.manualMeetingUrl,
    })

    let calendarInvitePending = false
    let syncedMeeting = meetingForSync
    let calendarEventId: string | null = null

    try {
      const syncResult = await syncGrowthMeetingToGoogleCalendar(admin, {
        meeting: meetingForSync,
        actorUserId: page.ownerUserId,
        action: "create",
        confirm: true,
        appOrigin: input.appOrigin,
      })

      if (syncResult.ok) {
        syncedMeeting = syncResult.meeting
        calendarEventId = syncResult.meeting.calendarEventId
        await updateGrowthMeetingRow(admin, meetingResult.meeting.id, {
          calendar_sync_status: "synced",
        })
      } else {
        calendarInvitePending = true
        await updateGrowthMeetingRow(admin, meetingResult.meeting.id, {
          calendar_sync_status: "failed",
        })
      }
    } catch {
      calendarInvitePending = true
      await updateGrowthMeetingRow(admin, meetingResult.meeting.id, {
        calendar_sync_status: "failed",
      })
    }

    const bookingMetadata = input.attribution
      ? sharePageBookingAttributionToMetadata(input.attribution)
      : {}

    const booking = await insertGrowthBookingPageBooking(admin, {
      bookingPageId: page.id,
      meetingId: syncedMeeting.id,
      leadId,
      guestName: name,
      guestEmail: email,
      guestCompany: input.company ?? null,
      guestPhone: input.phone ?? null,
      guestNotes: input.notes ?? null,
      slotStartAt: slot.startAt,
      slotEndAt: slot.endAt,
      status: "confirmed",
      calendarEventId,
      meetingUrl: syncedMeeting.meetingUrl,
      errorMessage: calendarInvitePending ? "calendar_invite_pending" : null,
      metadata: bookingMetadata,
    })

    if (input.attribution && attributedSharePage) {
      await bridgeSharePageBookingCompleted(admin, {
        attribution: input.attribution,
        bookingId: booking.id,
        meetingId: syncedMeeting.id,
      }).catch(() => undefined)
    }

    const confirmationMessage = calendarInvitePending
      ? page.confirmationMessage?.trim()
        ? `${page.confirmationMessage.trim()} Calendar invite is pending.`
        : "Your meeting is confirmed. Calendar invite is pending."
      : page.confirmationMessage

    return {
      ok: true,
      bookingId: booking.id,
      meetingId: syncedMeeting.id,
      meetingUrl: syncedMeeting.meetingUrl,
      locationLabel: locationDisplay.label,
      locationUrl: syncedMeeting.meetingUrl ?? locationDisplay.url,
      slotStartAt: slot.startAt,
      slotEndAt: slot.endAt,
      confirmationMessage,
      calendarInvitePending,
    }
  } catch {
    return { ok: false, code: "booking_failed", message: publicBookingErrorMessage("booking_failed") }
  }
}
