import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  countGrowthBookingPageBookings,
  insertGrowthBookingPage,
  isGrowthBookingPageSlugTaken,
  isValidBookingPageSlug,
  listGrowthBookingPagesForOwner,
  normalizeBookingPageSlug,
} from "@/lib/growth/booking/booking-page-repository"
import { growthBookingPageCreateSchema } from "@/lib/growth/booking/booking-page-api-schema"
import { validateBookingAvailabilityWindows } from "@/lib/growth/booking/booking-availability-ui"
import { fetchGrowthCalendarConnectionForUser } from "@/lib/growth/calendar/calendar-connection-repository"
import { isValidGrowthCalendarTimezone } from "@/lib/growth/calendar/calendar-timezone"

export const runtime = "nodejs"

function bookingLink(origin: string, slug: string): string {
  return `${origin}/book/${slug}`
}

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const origin = new URL(request.url).origin
  const pages = await listGrowthBookingPagesForOwner(access.admin, access.userId)
  const items = await Promise.all(
    pages.map(async (page) => ({
      ...page,
      bookingLink: bookingLink(origin, page.slug),
      recentBookingsCount: await countGrowthBookingPageBookings(access.admin, page.id),
    })),
  )
  return NextResponse.json({ ok: true, pages: items })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthBookingPageCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid booking page payload." }, { status: 400 })
  }

  const slug = normalizeBookingPageSlug(parsed.data.slug ?? parsed.data.name)
  if (!isValidBookingPageSlug(slug)) {
    return NextResponse.json({ error: "invalid_slug", message: "Booking page slug is invalid." }, { status: 400 })
  }
  if (await isGrowthBookingPageSlugTaken(access.admin, slug)) {
    return NextResponse.json({ error: "slug_taken", message: "That booking link slug is already in use." }, { status: 409 })
  }

  const timezone = parsed.data.timezone ?? "UTC"
  if (!isValidGrowthCalendarTimezone(timezone)) {
    return NextResponse.json({ error: "invalid_timezone", message: "Invalid timezone." }, { status: 400 })
  }

  if (parsed.data.availabilityWindows) {
    const availability = validateBookingAvailabilityWindows(parsed.data.availabilityWindows)
    if (!availability.ok) {
      return NextResponse.json({ error: "invalid_availability", message: availability.message }, { status: 400 })
    }
  }

  const connection = await fetchGrowthCalendarConnectionForUser(access.admin, access.userId)

  const page = await insertGrowthBookingPage(access.admin, {
    ownerUserId: access.userId,
    calendarConnectionId: connection?.id ?? null,
    createdBy: access.userId,
    slug,
    ...parsed.data,
    timezone,
  })

  const origin = new URL(request.url).origin
  return NextResponse.json({
    ok: true,
    page: { ...page, bookingLink: bookingLink(origin, page.slug), recentBookingsCount: 0 },
  })
}
