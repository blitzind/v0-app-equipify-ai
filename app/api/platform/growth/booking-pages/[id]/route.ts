import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  countGrowthBookingPageBookings,
  fetchGrowthBookingPageById,
  isGrowthBookingPageSlugTaken,
  isValidBookingPageSlug,
  listRecentGrowthBookingPageBookings,
  normalizeBookingPageSlug,
  updateGrowthBookingPage,
} from "@/lib/growth/booking/booking-page-repository"
import { GROWTH_BOOKING_LOCATION_TYPES } from "@/lib/growth/booking/booking-page-types"
import { isValidGrowthCalendarTimezone } from "@/lib/growth/calendar/calendar-timezone"

export const runtime = "nodejs"

function bookingLink(origin: string, slug: string): string {
  return `${origin}/book/${slug}`
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid booking page id." }, { status: 400 })
  }

  const page = await fetchGrowthBookingPageById(access.admin, id)
  if (!page || page.ownerUserId !== access.userId) {
    return NextResponse.json({ error: "not_found", message: "Booking page not found." }, { status: 404 })
  }

  const origin = new URL(request.url).origin
  const recentBookings = await listRecentGrowthBookingPageBookings(access.admin, page.id)
  return NextResponse.json({
    ok: true,
    page: {
      ...page,
      bookingLink: bookingLink(origin, page.slug),
      recentBookingsCount: await countGrowthBookingPageBookings(access.admin, page.id),
      recentBookings,
    },
  })
}

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  slug: z.string().min(2).max(64).optional(),
  description: z.string().max(2000).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  brandColor: z.string().max(32).optional(),
  meetingType: z.string().max(120).nullable().optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  bufferMinutes: z.number().int().min(0).max(120).optional(),
  availabilityWindows: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string(),
        endTime: z.string(),
      }),
    )
    .optional(),
  timezone: z.string().optional(),
  locationType: z.enum(GROWTH_BOOKING_LOCATION_TYPES).optional(),
  customLocation: z.string().max(500).nullable().optional(),
  confirmationMessage: z.string().max(2000).nullable().optional(),
  reminderEmailSubject: z.string().max(200).nullable().optional(),
  reminderEmailBody: z.string().max(4000).nullable().optional(),
  enabled: z.boolean().optional(),
})

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid booking page id." }, { status: 400 })
  }

  const existing = await fetchGrowthBookingPageById(access.admin, id)
  if (!existing || existing.ownerUserId !== access.userId) {
    return NextResponse.json({ error: "not_found", message: "Booking page not found." }, { status: 404 })
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid booking page update." }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim()
  if (parsed.data.slug !== undefined) {
    const slug = normalizeBookingPageSlug(parsed.data.slug)
    if (!isValidBookingPageSlug(slug)) {
      return NextResponse.json({ error: "invalid_slug", message: "Booking page slug is invalid." }, { status: 400 })
    }
    if (await isGrowthBookingPageSlugTaken(access.admin, slug, id)) {
      return NextResponse.json({ error: "slug_taken", message: "That booking link slug is already in use." }, { status: 409 })
    }
    patch.slug = slug
  }
  if (parsed.data.description !== undefined) patch.description = parsed.data.description
  if (parsed.data.logoUrl !== undefined) patch.logo_url = parsed.data.logoUrl
  if (parsed.data.brandColor !== undefined) patch.brand_color = parsed.data.brandColor
  if (parsed.data.meetingType !== undefined) patch.meeting_type = parsed.data.meetingType
  if (parsed.data.durationMinutes !== undefined) patch.duration_minutes = parsed.data.durationMinutes
  if (parsed.data.bufferMinutes !== undefined) patch.buffer_minutes = parsed.data.bufferMinutes
  if (parsed.data.availabilityWindows !== undefined) patch.availability_windows = parsed.data.availabilityWindows
  if (parsed.data.timezone !== undefined) {
    if (!isValidGrowthCalendarTimezone(parsed.data.timezone)) {
      return NextResponse.json({ error: "invalid_timezone", message: "Invalid timezone." }, { status: 400 })
    }
    patch.timezone = parsed.data.timezone
  }
  if (parsed.data.locationType !== undefined) patch.location_type = parsed.data.locationType
  if (parsed.data.customLocation !== undefined) patch.custom_location = parsed.data.customLocation
  if (parsed.data.confirmationMessage !== undefined) patch.confirmation_message = parsed.data.confirmationMessage
  if (parsed.data.reminderEmailSubject !== undefined) patch.reminder_email_subject = parsed.data.reminderEmailSubject
  if (parsed.data.reminderEmailBody !== undefined) patch.reminder_email_body = parsed.data.reminderEmailBody
  if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled

  const page = await updateGrowthBookingPage(access.admin, id, patch)
  const origin = new URL(request.url).origin
  return NextResponse.json({
    ok: true,
    page: {
      ...page,
      bookingLink: bookingLink(origin, page.slug),
      recentBookingsCount: await countGrowthBookingPageBookings(access.admin, page.id),
    },
  })
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid booking page id." }, { status: 400 })
  }

  const existing = await fetchGrowthBookingPageById(access.admin, id)
  if (!existing || existing.ownerUserId !== access.userId) {
    return NextResponse.json({ error: "not_found", message: "Booking page not found." }, { status: 404 })
  }

  await updateGrowthBookingPage(access.admin, id, { enabled: false })
  return NextResponse.json({ ok: true, disabled: true })
}
