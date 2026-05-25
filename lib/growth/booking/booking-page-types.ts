/** Client-safe Growth booking page types (slice 6.27B). */

import type { GrowthBookingMeetingProviderOverride } from "@/lib/growth/meeting-location/meeting-location-provider-types"

export const GROWTH_BOOKING_PAGES_QA_MARKER = "booking-pages-v1" as const

export const GROWTH_BOOKING_LOCATION_TYPES = [
  "google_meet",
  "zoom",
  "teams",
  "phone_call",
  "custom_location",
  "no_auto_link",
] as const
export type GrowthBookingLocationType = (typeof GROWTH_BOOKING_LOCATION_TYPES)[number]

export type { GrowthBookingMeetingProviderOverride }

export const GROWTH_BOOKING_PAGE_STATUSES = ["enabled", "disabled"] as const

export const GROWTH_BOOKING_TIMEZONE_MODES = ["fixed_host", "visitor_local", "visitor_override"] as const
export type GrowthBookingTimezoneMode = (typeof GROWTH_BOOKING_TIMEZONE_MODES)[number]

export const GROWTH_BOOKING_PUBLIC_THEME_MODES = ["system", "light", "dark"] as const
export type GrowthBookingPublicThemeMode = (typeof GROWTH_BOOKING_PUBLIC_THEME_MODES)[number]

export const GROWTH_BOOKING_PUBLIC_THEME_MODE_LABELS: Record<GrowthBookingPublicThemeMode, string> = {
  system: "System / Visitor Preference",
  light: "Force Light",
  dark: "Force Dark",
}

export type GrowthBookingAvailabilityWindow = {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export type GrowthBookingPage = {
  id: string
  ownerUserId: string
  calendarConnectionId: string | null
  name: string
  slug: string
  pageTitle: string | null
  brandName: string | null
  description: string | null
  logoUrl: string | null
  heroImageUrl: string | null
  brandColor: string
  accentColor: string | null
  footerNote: string | null
  meetingType: string | null
  durationMinutes: number
  bufferMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  minimumNoticeHours: number
  schedulingHorizonDays: number
  maxMeetingsPerDay: number | null
  timezoneMode: GrowthBookingTimezoneMode
  publicThemeMode: GrowthBookingPublicThemeMode
  availabilityWindows: GrowthBookingAvailabilityWindow[]
  timezone: string
  locationType: GrowthBookingLocationType
  customLocation: string | null
  meetingProviderOverride: GrowthBookingMeetingProviderOverride
  autoCreateMeetingLinkOverride: boolean | null
  manualMeetingUrl: string | null
  confirmationMessage: string | null
  reminderEmailSubject: string | null
  reminderEmailBody: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type GrowthBookingPagePublicView = {
  slug: string
  name: string
  pageTitle: string
  brandName: string | null
  description: string | null
  logoUrl: string | null
  heroImageUrl: string | null
  brandColor: string
  accentColor: string
  footerNote: string | null
  meetingType: string | null
  durationMinutes: number
  timezone: string
  timezoneMode: GrowthBookingTimezoneMode
  publicThemeMode: GrowthBookingPublicThemeMode
  schedulingHorizonDays: number
  minimumNoticeHours: number
  locationType: GrowthBookingLocationType
  locationLabel: string
  locationUrl: string | null
  confirmationMessage: string | null
}

export type GrowthBookingSlot = {
  startAt: string
  endAt: string
}

export type GrowthBookingPageBookingSummary = {
  id: string
  guestName: string
  guestEmail: string
  guestCompany: string | null
  slotStartAt: string
  slotEndAt: string
  status: string
  meetingId: string | null
  createdAt: string
}

export type GrowthBookingPageListItem = GrowthBookingPage & {
  bookingLink: string
  recentBookingsCount: number
}
