import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildBookingSlots, isSlotStillAvailable } from "@/lib/growth/booking/booking-availability"
import {
  fetchGrowthBookingPageBySlug,
  insertGrowthBookingPageBooking,
  listConfirmedBookingsInRange,
} from "@/lib/growth/booking/booking-page-repository"
import type { GrowthBookingPage, GrowthBookingSlot } from "@/lib/growth/booking/booking-page-types"
import { getGrowthCalendarConnectionWithFreshAccessToken } from "@/lib/growth/calendar/calendar-connection-service"
import { fetchGoogleCalendarBusyIntervals } from "@/lib/growth/calendar/google-calendar-client"
import { syncGrowthMeetingToGoogleCalendar } from "@/lib/growth/calendar/sync-meeting-calendar"
import { createGrowthLead } from "@/lib/growth/lead-repository"
import { createGrowthMeeting } from "@/lib/growth/meeting-intelligence/mutate-meeting"
import { updateGrowthMeetingRow, fetchGrowthMeetingById } from "@/lib/growth/meeting-intelligence/meeting-repository"
import { resolveOutboundLeadByEmail } from "@/lib/growth/outbound/resolve-lead-by-email"
import { normalizeEmail } from "@/lib/growth/import/normalize"

export type PublicBookingSlotsResult =
  | { ok: true; slots: GrowthBookingSlot[]; timezone: string }
  | { ok: false; code: string; message: string }

export type PublicBookingSubmitResult =
  | {
      ok: true
      bookingId: string
      meetingId: string
      meetingUrl: string | null
      confirmationMessage: string | null
    }
  | { ok: false; code: string; message: string }

import { publicBookingErrorMessage } from "@/lib/growth/booking/booking-public-errors"

export async function fetchPublicBookingSlots(
  admin: SupabaseClient,
  slug: string,
): Promise<PublicBookingSlotsResult> {
  const page = await fetchGrowthBookingPageBySlug(admin, slug, true)
  if (!page) return { ok: false, code: "page_disabled", message: publicBookingErrorMessage("page_disabled") }

  const now = new Date()
  const timeMax = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
  const existingBookings = await listConfirmedBookingsInRange(admin, page.id, now.toISOString(), timeMax)

  let busyIntervals: Array<{ start: string; end: string }> = []
  try {
    const connection = await getGrowthCalendarConnectionWithFreshAccessToken(admin, page.ownerUserId)
    if (connection) {
      busyIntervals = await fetchGoogleCalendarBusyIntervals({
        accessToken: connection.accessToken,
        timeMin: now.toISOString(),
        timeMax,
        timezone: page.timezone,
      })
    }
  } catch {
    // Availability falls back to booking-page windows + existing bookings only.
  }

  const slots = buildBookingSlots({
    timezone: page.timezone,
    durationMinutes: page.durationMinutes,
    bufferMinutes: page.bufferMinutes,
    availabilityWindows: page.availabilityWindows,
    busyIntervals,
    existingBookings,
  })

  return { ok: true, slots, timezone: page.timezone }
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

function meetingProviderForPage(page: GrowthBookingPage): "google_meet" | "phone" | "other" {
  if (page.locationType === "google_meet") return "google_meet"
  if (page.locationType === "phone_call") return "phone"
  return "other"
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
  const slotsResult = await fetchPublicBookingSlots(admin, input.slug)
  if (!slotsResult.ok) return { ok: false, code: slotsResult.code, message: slotsResult.message }

  const slotAllowed = slotsResult.slots.some(
    (entry) => entry.startAt === slot.startAt && entry.endAt === slot.endAt,
  )
  if (!slotAllowed) {
    return { ok: false, code: "slot_unavailable", message: publicBookingErrorMessage("slot_unavailable") }
  }

  const connection = await getGrowthCalendarConnectionWithFreshAccessToken(admin, page.ownerUserId)
  if (!connection) {
    return { ok: false, code: "calendar_unavailable", message: publicBookingErrorMessage("calendar_unavailable") }
  }

  let busyIntervals: Array<{ start: string; end: string }> = []
  try {
    busyIntervals = await fetchGoogleCalendarBusyIntervals({
      accessToken: connection.accessToken,
      timeMin: slot.startAt,
      timeMax: slot.endAt,
      timezone: page.timezone,
    })
  } catch {
    return { ok: false, code: "calendar_unavailable", message: publicBookingErrorMessage("calendar_unavailable") }
  }

  const existingBookings = await listConfirmedBookingsInRange(admin, page.id, slot.startAt, slot.endAt)
  if (!isSlotStillAvailable(slot, busyIntervals, existingBookings, page.bufferMinutes)) {
    return { ok: false, code: "slot_unavailable", message: publicBookingErrorMessage("slot_unavailable") }
  }

  try {
    const leadId = await resolveLeadForBooking(admin, page, input)
    const title = page.meetingType?.trim() || `${page.name} — ${name}`
    const meetingResult = await createGrowthMeeting(admin, {
      leadId,
      title,
      status: "scheduled",
      startAt: slot.startAt,
      endAt: slot.endAt,
      source: "calendar_sync",
      provider: meetingProviderForPage(page),
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
    })

    const meetingForSync = await fetchGrowthMeetingById(admin, meetingResult.meeting.id)
    if (!meetingForSync) {
      return { ok: false, code: "booking_failed", message: publicBookingErrorMessage("booking_failed") }
    }

    const syncResult = await syncGrowthMeetingToGoogleCalendar(admin, {
      meeting: meetingForSync,
      actorUserId: page.ownerUserId,
      action: "create",
      confirm: true,
      appOrigin: input.appOrigin,
    })

    if (!syncResult.ok) {
      await insertGrowthBookingPageBooking(admin, {
        bookingPageId: page.id,
        meetingId: meetingResult.meeting.id,
        leadId,
        guestName: name,
        guestEmail: email,
        guestCompany: input.company ?? null,
        guestPhone: input.phone ?? null,
        guestNotes: input.notes ?? null,
        slotStartAt: slot.startAt,
        slotEndAt: slot.endAt,
        status: "failed",
        errorMessage: syncResult.message,
      })
      return { ok: false, code: "calendar_unavailable", message: publicBookingErrorMessage("calendar_unavailable") }
    }

    const booking = await insertGrowthBookingPageBooking(admin, {
      bookingPageId: page.id,
      meetingId: syncResult.meeting.id,
      leadId,
      guestName: name,
      guestEmail: email,
      guestCompany: input.company ?? null,
      guestPhone: input.phone ?? null,
      guestNotes: input.notes ?? null,
      slotStartAt: slot.startAt,
      slotEndAt: slot.endAt,
      status: "confirmed",
      calendarEventId: syncResult.meeting.calendarEventId,
      meetingUrl: syncResult.meeting.meetingUrl,
    })

    return {
      ok: true,
      bookingId: booking.id,
      meetingId: syncResult.meeting.id,
      meetingUrl: syncResult.meeting.meetingUrl,
      confirmationMessage: page.confirmationMessage,
    }
  } catch {
    return { ok: false, code: "booking_failed", message: publicBookingErrorMessage("booking_failed") }
  }
}
