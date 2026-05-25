import { z } from "zod"
import { GROWTH_BOOKING_LOCATION_TYPES, GROWTH_BOOKING_PUBLIC_THEME_MODES, GROWTH_BOOKING_TIMEZONE_MODES } from "@/lib/growth/booking/booking-page-types"
import { GROWTH_BOOKING_MEETING_PROVIDER_OVERRIDES } from "@/lib/growth/meeting-location/meeting-location-provider-types"

const optionalUrlField = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null))
  .refine((value) => value === null || /^https?:\/\/.+/i.test(value), { message: "Invalid URL." })

export const growthBookingAvailabilityWindowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
})

const sharedFields = {
  pageTitle: z.string().max(120).nullable().optional(),
  brandName: z.string().max(120).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  logoUrl: optionalUrlField,
  heroImageUrl: optionalUrlField,
  brandColor: z.string().max(32).optional(),
  accentColor: z.string().max(32).nullable().optional(),
  footerNote: z.string().max(500).nullable().optional(),
  meetingType: z.string().max(120).nullable().optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  bufferMinutes: z.number().int().min(0).max(120).optional(),
  bufferBeforeMinutes: z.number().int().min(0).max(240).optional(),
  bufferAfterMinutes: z.number().int().min(0).max(240).optional(),
  minimumNoticeHours: z.number().int().min(0).max(168).optional(),
  schedulingHorizonDays: z.number().int().min(1).max(730).optional(),
  maxMeetingsPerDay: z.number().int().min(1).max(50).nullable().optional(),
  timezoneMode: z.enum(GROWTH_BOOKING_TIMEZONE_MODES).optional(),
  publicThemeMode: z.enum(GROWTH_BOOKING_PUBLIC_THEME_MODES).optional(),
  availabilityWindows: z.array(growthBookingAvailabilityWindowSchema).optional(),
  timezone: z.string().optional(),
  locationType: z.enum(GROWTH_BOOKING_LOCATION_TYPES).optional(),
  customLocation: z.string().max(500).nullable().optional(),
  meetingProviderOverride: z.enum(GROWTH_BOOKING_MEETING_PROVIDER_OVERRIDES).optional(),
  autoCreateMeetingLinkOverride: z.boolean().nullable().optional(),
  manualMeetingUrl: optionalUrlField,
  confirmationMessage: z.string().max(2000).nullable().optional(),
  reminderEmailSubject: z.string().max(200).nullable().optional(),
  reminderEmailBody: z.string().max(4000).nullable().optional(),
  enabled: z.boolean().optional(),
}

export const growthBookingPagePatchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  slug: z.string().min(2).max(64).optional(),
  ...sharedFields,
})

export const growthBookingPageCreateSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(64).optional(),
  ...sharedFields,
})
