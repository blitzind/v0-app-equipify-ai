import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  countGrowthBookingPageBookings,
  insertGrowthBookingPage,
  isGrowthBookingPageSlugTaken,
  isValidBookingPageSlug,
  listGrowthBookingPagesForOwner,
  normalizeBookingPageSlug,
} from "@/lib/growth/booking/booking-page-repository"
import { GROWTH_BOOKING_LOCATION_TYPES } from "@/lib/growth/booking/booking-page-types"
import { GROWTH_BOOKING_MEETING_PROVIDER_OVERRIDES } from "@/lib/growth/meeting-location/meeting-location-provider-types"
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

const createSchema = z.object({
  name: z.string().min(2).max(120),
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
  meetingProviderOverride: z.enum(GROWTH_BOOKING_MEETING_PROVIDER_OVERRIDES).optional(),
  autoCreateMeetingLinkOverride: z.boolean().nullable().optional(),
  manualMeetingUrl: z.string().max(500).nullable().optional(),
  confirmationMessage: z.string().max(2000).nullable().optional(),
  reminderEmailSubject: z.string().max(200).nullable().optional(),
  reminderEmailBody: z.string().max(4000).nullable().optional(),
  enabled: z.boolean().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
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
