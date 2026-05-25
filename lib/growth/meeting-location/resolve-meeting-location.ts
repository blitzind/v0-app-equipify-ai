import type {
  GrowthBookingMeetingProviderOverride,
  GrowthMeetingLocationProvider,
  GrowthMeetingLocationSettings,
} from "@/lib/growth/meeting-location/meeting-location-provider-types"
import {
  legacyBookingLocationToProvider,
  mapLocationProviderToMeetingProvider,
} from "@/lib/growth/meeting-location/meeting-location-provider-types"

export type ResolvedMeetingLocation = {
  locationProvider: GrowthMeetingLocationProvider
  meetingProvider: ReturnType<typeof mapLocationProviderToMeetingProvider>
  autoCreateMeetingLink: boolean
  includeGoogleMeetOnCalendarCreate: boolean
  meetingUrl: string | null
  meetingLocationLabel: string | null
  manualMeetingUrl: string | null
  providerConnectionRequired: boolean
  warning: string | null
}

function resolveEffectiveProvider(input: {
  platform: GrowthMeetingLocationSettings
  bookingOverride?: GrowthBookingMeetingProviderOverride | null
  legacyLocationType?: string | null
  meetingLocationType?: GrowthMeetingLocationProvider | null
}): GrowthMeetingLocationProvider {
  if (input.meetingLocationType) return input.meetingLocationType
  if (input.bookingOverride && input.bookingOverride !== "inherit") return input.bookingOverride
  if (input.legacyLocationType) return legacyBookingLocationToProvider(input.legacyLocationType)
  return input.platform.defaultMeetingProvider
}

export function resolveMeetingLocation(input: {
  platform: GrowthMeetingLocationSettings
  googleCalendarConnected: boolean
  bookingOverride?: GrowthBookingMeetingProviderOverride | null
  bookingAutoCreateOverride?: boolean | null
  legacyLocationType?: string | null
  meetingLocationType?: GrowthMeetingLocationProvider | null
  meetingAutoCreate?: boolean | null
  manualMeetingUrl?: string | null
  meetingLocationLabel?: string | null
  existingMeetingUrl?: string | null
}): ResolvedMeetingLocation {
  const locationProvider = resolveEffectiveProvider(input)
  const autoCreateMeetingLink =
    input.meetingAutoCreate ??
    input.bookingAutoCreateOverride ??
    input.platform.autoCreateMeetingLink

  const manualMeetingUrl = input.manualMeetingUrl?.trim() || null
  const meetingLocationLabel = input.meetingLocationLabel?.trim() || null
  const meetingProvider = mapLocationProviderToMeetingProvider(locationProvider)

  let meetingUrl = input.existingMeetingUrl ?? null
  let providerConnectionRequired = false
  let warning: string | null = null
  let includeGoogleMeetOnCalendarCreate = false

  if (locationProvider === "google_meet") {
    if (!input.googleCalendarConnected) {
      providerConnectionRequired = true
      warning = "Connect Google Calendar in Growth Settings to auto-create Google Meet links."
    } else if (autoCreateMeetingLink) {
      includeGoogleMeetOnCalendarCreate = true
    }
  } else if (locationProvider === "zoom") {
    providerConnectionRequired = !manualMeetingUrl
    if (manualMeetingUrl) meetingUrl = manualMeetingUrl
    else warning = "Zoom connection required — paste a manual Zoom URL or connect Zoom when available."
  } else if (locationProvider === "teams") {
    providerConnectionRequired = !manualMeetingUrl
    if (manualMeetingUrl) meetingUrl = manualMeetingUrl
    else warning = "Microsoft Teams connection required — paste a manual Teams URL or connect Teams when available."
  } else if (locationProvider === "phone_call") {
    if (manualMeetingUrl) meetingUrl = manualMeetingUrl
    else meetingUrl = null
  } else if (locationProvider === "custom_location") {
    if (manualMeetingUrl) meetingUrl = manualMeetingUrl
    else if (meetingLocationLabel) meetingUrl = null
  } else if (locationProvider === "no_auto_link") {
    meetingUrl = null
  }

  return {
    locationProvider,
    meetingProvider,
    autoCreateMeetingLink,
    includeGoogleMeetOnCalendarCreate,
    meetingUrl,
    meetingLocationLabel,
    manualMeetingUrl,
    providerConnectionRequired,
    warning,
  }
}

export function applyResolvedMeetingLocationPatch(resolved: ResolvedMeetingLocation): Record<string, unknown> {
  return {
    provider: resolved.meetingProvider,
    meeting_location_type: resolved.locationProvider,
    meeting_location_label: resolved.meetingLocationLabel,
    manual_meeting_url: resolved.manualMeetingUrl,
    meeting_url: resolved.meetingUrl,
    auto_create_meeting_link: resolved.autoCreateMeetingLink,
    provider_connection_required: resolved.providerConnectionRequired,
  }
}
