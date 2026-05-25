import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_BOOKING_PAGES_QA_MARKER,
  type GrowthBookingAvailabilityWindow,
  type GrowthBookingLocationType,
  type GrowthBookingMeetingProviderOverride,
  type GrowthBookingPage,
  type GrowthBookingPageBookingSummary,
  type GrowthBookingPagePublicView,
} from "@/lib/growth/booking/booking-page-types"
import { isValidBookingPageSlug, normalizeBookingPageSlug } from "@/lib/growth/booking/booking-page-slug"
import {
  resolveBookingPageAccentColor,
  resolveBookingPageDisplayTitle,
  resolvePublicBookingLocationFromPage,
} from "@/lib/growth/booking/booking-public-display"

export { isValidBookingPageSlug, normalizeBookingPageSlug }

const PAGE_SELECT =
  "id, owner_user_id, calendar_connection_id, name, slug, page_title, brand_name, description, logo_url, hero_image_url, brand_color, accent_color, footer_note, meeting_type, duration_minutes, buffer_minutes, buffer_before_minutes, buffer_after_minutes, minimum_notice_hours, scheduling_horizon_days, max_meetings_per_day, timezone_mode, availability_windows, timezone, location_type, custom_location, meeting_provider_override, auto_create_meeting_link_override, manual_meeting_url, confirmation_message, reminder_email_subject, reminder_email_body, enabled, created_at, updated_at"

type PageRow = {
  id: string
  owner_user_id: string
  calendar_connection_id: string | null
  name: string
  slug: string
  page_title: string | null
  brand_name: string | null
  description: string | null
  logo_url: string | null
  hero_image_url: string | null
  brand_color: string
  accent_color: string | null
  footer_note: string | null
  meeting_type: string | null
  duration_minutes: number
  buffer_minutes: number
  buffer_before_minutes: number | null
  buffer_after_minutes: number | null
  minimum_notice_hours: number | null
  scheduling_horizon_days: number | null
  max_meetings_per_day: number | null
  timezone_mode: string | null
  availability_windows: GrowthBookingAvailabilityWindow[] | null
  timezone: string
  location_type: string
  custom_location: string | null
  meeting_provider_override: string
  auto_create_meeting_link_override: boolean | null
  manual_meeting_url: string | null
  confirmation_message: string | null
  reminder_email_subject: string | null
  reminder_email_body: string | null
  enabled: boolean
  created_at: string
  updated_at: string
}

function pagesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("booking_pages")
}

function bookingsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("booking_page_bookings")
}

function mapPage(row: PageRow): GrowthBookingPage {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    calendarConnectionId: row.calendar_connection_id,
    name: row.name,
    slug: row.slug,
    pageTitle: row.page_title,
    brandName: row.brand_name,
    description: row.description,
    logoUrl: row.logo_url,
    heroImageUrl: row.hero_image_url,
    brandColor: row.brand_color,
    accentColor: row.accent_color,
    footerNote: row.footer_note,
    meetingType: row.meeting_type,
    durationMinutes: row.duration_minutes,
    bufferMinutes: row.buffer_minutes,
    bufferBeforeMinutes: row.buffer_before_minutes ?? 0,
    bufferAfterMinutes: row.buffer_after_minutes ?? row.buffer_minutes ?? 0,
    minimumNoticeHours: row.minimum_notice_hours ?? 0,
    schedulingHorizonDays: row.scheduling_horizon_days ?? 90,
    maxMeetingsPerDay: row.max_meetings_per_day ?? null,
    timezoneMode: (row.timezone_mode ?? "visitor_local") as GrowthBookingPage["timezoneMode"],
    availabilityWindows: row.availability_windows ?? [],
    timezone: row.timezone,
    locationType: row.location_type as GrowthBookingLocationType,
    customLocation: row.custom_location,
    meetingProviderOverride: row.meeting_provider_override as GrowthBookingMeetingProviderOverride,
    autoCreateMeetingLinkOverride: row.auto_create_meeting_link_override,
    manualMeetingUrl: row.manual_meeting_url,
    confirmationMessage: row.confirmation_message,
    reminderEmailSubject: row.reminder_email_subject,
    reminderEmailBody: row.reminder_email_body,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toPublicBookingPageView(page: GrowthBookingPage): GrowthBookingPagePublicView {
  const location = resolvePublicBookingLocationFromPage(page)
  return {
    slug: page.slug,
    name: page.name,
    pageTitle: resolveBookingPageDisplayTitle(page),
    brandName: page.brandName,
    description: page.description,
    logoUrl: page.logoUrl,
    heroImageUrl: page.heroImageUrl,
    brandColor: page.brandColor,
    accentColor: resolveBookingPageAccentColor(page),
    footerNote: page.footerNote,
    meetingType: page.meetingType,
    durationMinutes: page.durationMinutes,
    timezone: page.timezone,
    timezoneMode: page.timezoneMode,
    schedulingHorizonDays: page.schedulingHorizonDays,
    minimumNoticeHours: page.minimumNoticeHours,
    locationType: page.locationType,
    locationLabel: location.label,
    locationUrl: location.url,
    confirmationMessage: page.confirmationMessage,
  }
}

export async function fetchGrowthBookingPageBySlug(
  admin: SupabaseClient,
  slug: string,
  enabledOnly = false,
): Promise<GrowthBookingPage | null> {
  let query = pagesTable(admin).select(PAGE_SELECT).eq("slug", slug)
  if (enabledOnly) query = query.eq("enabled", true)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapPage(data as PageRow) : null
}

export async function fetchGrowthBookingPageById(
  admin: SupabaseClient,
  pageId: string,
): Promise<GrowthBookingPage | null> {
  const { data, error } = await pagesTable(admin).select(PAGE_SELECT).eq("id", pageId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapPage(data as PageRow) : null
}

export async function listGrowthBookingPagesForOwner(
  admin: SupabaseClient,
  ownerUserId: string,
): Promise<GrowthBookingPage[]> {
  const { data, error } = await pagesTable(admin)
    .select(PAGE_SELECT)
    .eq("owner_user_id", ownerUserId)
    .order("updated_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapPage(row as PageRow))
}

export async function isGrowthBookingPageSlugTaken(
  admin: SupabaseClient,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  let query = pagesTable(admin).select("id").eq("slug", slug)
  if (excludeId) query = query.neq("id", excludeId)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data?.id)
}

export async function insertGrowthBookingPage(
  admin: SupabaseClient,
  input: {
    ownerUserId: string
    calendarConnectionId?: string | null
    name: string
    slug: string
    pageTitle?: string | null
    brandName?: string | null
    description?: string | null
    logoUrl?: string | null
    heroImageUrl?: string | null
    brandColor?: string
    accentColor?: string | null
    footerNote?: string | null
    meetingType?: string | null
    durationMinutes?: number
    bufferMinutes?: number
    bufferBeforeMinutes?: number
    bufferAfterMinutes?: number
    minimumNoticeHours?: number
    schedulingHorizonDays?: number
    maxMeetingsPerDay?: number | null
    timezoneMode?: GrowthBookingPage["timezoneMode"]
    availabilityWindows?: GrowthBookingAvailabilityWindow[]
    timezone?: string
    locationType?: GrowthBookingLocationType
    customLocation?: string | null
    meetingProviderOverride?: GrowthBookingMeetingProviderOverride
    autoCreateMeetingLinkOverride?: boolean | null
    manualMeetingUrl?: string | null
    confirmationMessage?: string | null
    reminderEmailSubject?: string | null
    reminderEmailBody?: string | null
    enabled?: boolean
    createdBy?: string | null
  },
): Promise<GrowthBookingPage> {
  const { data, error } = await pagesTable(admin)
    .insert({
      owner_user_id: input.ownerUserId,
      calendar_connection_id: input.calendarConnectionId ?? null,
      name: input.name.trim(),
      slug: input.slug,
      page_title: input.pageTitle ?? null,
      brand_name: input.brandName ?? null,
      description: input.description ?? null,
      logo_url: input.logoUrl ?? null,
      hero_image_url: input.heroImageUrl ?? null,
      brand_color: input.brandColor ?? "#059669",
      accent_color: input.accentColor ?? null,
      footer_note: input.footerNote ?? null,
      meeting_type: input.meetingType ?? null,
      duration_minutes: input.durationMinutes ?? 30,
      buffer_minutes: input.bufferMinutes ?? 0,
      buffer_before_minutes: input.bufferBeforeMinutes ?? 0,
      buffer_after_minutes: input.bufferAfterMinutes ?? input.bufferMinutes ?? 0,
      minimum_notice_hours: input.minimumNoticeHours ?? 0,
      scheduling_horizon_days: input.schedulingHorizonDays ?? 90,
      max_meetings_per_day: input.maxMeetingsPerDay ?? null,
      timezone_mode: input.timezoneMode ?? "visitor_local",
      availability_windows: input.availabilityWindows ?? [],
      timezone: input.timezone ?? "UTC",
      location_type: input.locationType ?? "google_meet",
      custom_location: input.customLocation ?? null,
      meeting_provider_override: input.meetingProviderOverride ?? "inherit",
      auto_create_meeting_link_override: input.autoCreateMeetingLinkOverride ?? null,
      manual_meeting_url: input.manualMeetingUrl ?? null,
      confirmation_message: input.confirmationMessage ?? null,
      reminder_email_subject: input.reminderEmailSubject ?? null,
      reminder_email_body: input.reminderEmailBody ?? null,
      enabled: input.enabled ?? false,
      created_by: input.createdBy ?? input.ownerUserId,
      qa_marker: GROWTH_BOOKING_PAGES_QA_MARKER,
    })
    .select(PAGE_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapPage(data as PageRow)
}

export async function updateGrowthBookingPage(
  admin: SupabaseClient,
  pageId: string,
  patch: Record<string, unknown>,
): Promise<GrowthBookingPage> {
  const { data, error } = await pagesTable(admin)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", pageId)
    .select(PAGE_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapPage(data as PageRow)
}

export async function listRecentGrowthBookingPageBookings(
  admin: SupabaseClient,
  bookingPageId: string,
  limit = 10,
): Promise<GrowthBookingPageBookingSummary[]> {
  const { data, error } = await bookingsTable(admin)
    .select("id, guest_name, guest_email, guest_company, slot_start_at, slot_end_at, status, meeting_id, created_at")
    .eq("booking_page_id", bookingPageId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: row.id as string,
    guestName: row.guest_name as string,
    guestEmail: row.guest_email as string,
    guestCompany: (row.guest_company as string | null) ?? null,
    slotStartAt: row.slot_start_at as string,
    slotEndAt: row.slot_end_at as string,
    status: row.status as string,
    meetingId: (row.meeting_id as string | null) ?? null,
    createdAt: row.created_at as string,
  }))
}

export async function countGrowthBookingPageBookings(
  admin: SupabaseClient,
  bookingPageId: string,
): Promise<number> {
  const { count, error } = await bookingsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("booking_page_id", bookingPageId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function listConfirmedBookingsInRange(
  admin: SupabaseClient,
  bookingPageId: string,
  timeMin: string,
  timeMax: string,
): Promise<Array<{ startAt: string; endAt: string }>> {
  const { data, error } = await bookingsTable(admin)
    .select("slot_start_at, slot_end_at")
    .eq("booking_page_id", bookingPageId)
    .eq("status", "confirmed")
    .gte("slot_start_at", timeMin)
    .lte("slot_end_at", timeMax)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    startAt: row.slot_start_at as string,
    endAt: row.slot_end_at as string,
  }))
}

export async function insertGrowthBookingPageBooking(
  admin: SupabaseClient,
  input: {
    bookingPageId: string
    meetingId?: string | null
    leadId?: string | null
    guestName: string
    guestEmail: string
    guestCompany?: string | null
    guestPhone?: string | null
    guestNotes?: string | null
    slotStartAt: string
    slotEndAt: string
    status?: string
    calendarEventId?: string | null
    meetingUrl?: string | null
    errorMessage?: string | null
  },
): Promise<{ id: string }> {
  const { data, error } = await bookingsTable(admin)
    .insert({
      booking_page_id: input.bookingPageId,
      meeting_id: input.meetingId ?? null,
      lead_id: input.leadId ?? null,
      guest_name: input.guestName.trim(),
      guest_email: input.guestEmail.trim().toLowerCase(),
      guest_company: input.guestCompany ?? null,
      guest_phone: input.guestPhone ?? null,
      guest_notes: input.guestNotes ?? null,
      slot_start_at: input.slotStartAt,
      slot_end_at: input.slotEndAt,
      status: input.status ?? "confirmed",
      calendar_event_id: input.calendarEventId ?? null,
      meeting_url: input.meetingUrl ?? null,
      error_message: input.errorMessage ?? null,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return { id: data.id as string }
}
