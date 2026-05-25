import type { GrowthBookingPage } from "@/lib/growth/booking/booking-page-types"

export function mapGrowthBookingPagePatch(parsed: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if (parsed.name !== undefined) patch.name = String(parsed.name).trim()
  if (parsed.slug !== undefined) patch.slug = parsed.slug
  if (parsed.pageTitle !== undefined) patch.page_title = parsed.pageTitle
  if (parsed.brandName !== undefined) patch.brand_name = parsed.brandName
  if (parsed.description !== undefined) patch.description = parsed.description
  if (parsed.logoUrl !== undefined) patch.logo_url = parsed.logoUrl
  if (parsed.heroImageUrl !== undefined) patch.hero_image_url = parsed.heroImageUrl
  if (parsed.brandColor !== undefined) patch.brand_color = parsed.brandColor
  if (parsed.accentColor !== undefined) patch.accent_color = parsed.accentColor
  if (parsed.footerNote !== undefined) patch.footer_note = parsed.footerNote
  if (parsed.meetingType !== undefined) patch.meeting_type = parsed.meetingType
  if (parsed.durationMinutes !== undefined) patch.duration_minutes = parsed.durationMinutes
  if (parsed.bufferMinutes !== undefined) patch.buffer_minutes = parsed.bufferMinutes
  if (parsed.bufferBeforeMinutes !== undefined) patch.buffer_before_minutes = parsed.bufferBeforeMinutes
  if (parsed.bufferAfterMinutes !== undefined) patch.buffer_after_minutes = parsed.bufferAfterMinutes
  if (parsed.minimumNoticeHours !== undefined) patch.minimum_notice_hours = parsed.minimumNoticeHours
  if (parsed.schedulingHorizonDays !== undefined) patch.scheduling_horizon_days = parsed.schedulingHorizonDays
  if (parsed.maxMeetingsPerDay !== undefined) patch.max_meetings_per_day = parsed.maxMeetingsPerDay
  if (parsed.timezoneMode !== undefined) patch.timezone_mode = parsed.timezoneMode
  if (parsed.availabilityWindows !== undefined) patch.availability_windows = parsed.availabilityWindows
  if (parsed.timezone !== undefined) patch.timezone = parsed.timezone
  if (parsed.locationType !== undefined) patch.location_type = parsed.locationType
  if (parsed.customLocation !== undefined) patch.custom_location = parsed.customLocation
  if (parsed.meetingProviderOverride !== undefined) patch.meeting_provider_override = parsed.meetingProviderOverride
  if (parsed.autoCreateMeetingLinkOverride !== undefined) {
    patch.auto_create_meeting_link_override = parsed.autoCreateMeetingLinkOverride
  }
  if (parsed.manualMeetingUrl !== undefined) patch.manual_meeting_url = parsed.manualMeetingUrl
  if (parsed.confirmationMessage !== undefined) patch.confirmation_message = parsed.confirmationMessage
  if (parsed.reminderEmailSubject !== undefined) patch.reminder_email_subject = parsed.reminderEmailSubject
  if (parsed.reminderEmailBody !== undefined) patch.reminder_email_body = parsed.reminderEmailBody
  if (parsed.enabled !== undefined) patch.enabled = parsed.enabled
  return patch
}

export function growthBookingPageToEditorState(page: GrowthBookingPage) {
  return {
    name: page.name,
    slug: page.slug,
    pageTitle: page.pageTitle ?? "",
    brandName: page.brandName ?? "",
    description: page.description ?? "",
    logoUrl: page.logoUrl ?? "",
    heroImageUrl: page.heroImageUrl ?? "",
    brandColor: page.brandColor,
    accentColor: page.accentColor ?? page.brandColor,
    footerNote: page.footerNote ?? "",
    meetingType: page.meetingType ?? "",
    durationMinutes: String(page.durationMinutes),
    bufferMinutes: String(page.bufferMinutes),
    bufferBeforeMinutes: String(page.bufferBeforeMinutes),
    bufferAfterMinutes: String(page.bufferAfterMinutes),
    minimumNoticeHours: String(page.minimumNoticeHours),
    schedulingHorizonDays: String(page.schedulingHorizonDays),
    schedulingHorizonPreset:
      page.schedulingHorizonDays === 30 ||
      page.schedulingHorizonDays === 60 ||
      page.schedulingHorizonDays === 90 ||
      page.schedulingHorizonDays === 180 ||
      page.schedulingHorizonDays === 365
        ? String(page.schedulingHorizonDays)
        : "custom",
    maxMeetingsPerDay: page.maxMeetingsPerDay != null ? String(page.maxMeetingsPerDay) : "",
    timezone: page.timezone,
    timezoneMode: page.timezoneMode,
    confirmationMessage: page.confirmationMessage ?? "",
    meetingProviderOverride: page.meetingProviderOverride,
    autoCreateMeetingLinkOverride: page.autoCreateMeetingLinkOverride,
    manualMeetingUrl: page.manualMeetingUrl ?? "",
    customLocation: page.customLocation ?? "",
    enabled: page.enabled,
    availabilityWindows: page.availabilityWindows,
  }
}
