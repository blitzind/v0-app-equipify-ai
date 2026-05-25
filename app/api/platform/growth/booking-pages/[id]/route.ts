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
import { growthBookingPagePatchSchema } from "@/lib/growth/booking/booking-page-api-schema"
import { mapGrowthBookingPagePatch } from "@/lib/growth/booking/booking-page-editor-state"
import { validateBookingAvailabilityWindows } from "@/lib/growth/booking/booking-availability-ui"
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

  const parsed = growthBookingPagePatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid booking page update." }, { status: 400 })
  }

  if (parsed.data.slug !== undefined) {
    const slug = normalizeBookingPageSlug(parsed.data.slug)
    if (!isValidBookingPageSlug(slug)) {
      return NextResponse.json({ error: "invalid_slug", message: "Booking page slug is invalid." }, { status: 400 })
    }
    if (await isGrowthBookingPageSlugTaken(access.admin, slug, id)) {
      return NextResponse.json({ error: "slug_taken", message: "That booking link slug is already in use." }, { status: 409 })
    }
    parsed.data.slug = slug
  }

  if (parsed.data.timezone !== undefined && !isValidGrowthCalendarTimezone(parsed.data.timezone)) {
    return NextResponse.json({ error: "invalid_timezone", message: "Invalid timezone." }, { status: 400 })
  }

  if (parsed.data.availabilityWindows !== undefined) {
    const availability = validateBookingAvailabilityWindows(parsed.data.availabilityWindows)
    if (!availability.ok) {
      return NextResponse.json({ error: "invalid_availability", message: availability.message }, { status: 400 })
    }
  }

  const patch = mapGrowthBookingPagePatch(parsed.data)
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
