/** Client-safe meeting location provider types (slice 6.27C). */

import type { GrowthMeetingProvider } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"

export const GROWTH_MEETING_LOCATION_QA_MARKER = "meeting-location-v1" as const

export const GROWTH_MEETING_LOCATION_PROVIDERS = [
  "google_meet",
  "zoom",
  "teams",
  "phone_call",
  "custom_location",
  "no_auto_link",
] as const

export type GrowthMeetingLocationProvider = (typeof GROWTH_MEETING_LOCATION_PROVIDERS)[number]

export const GROWTH_BOOKING_MEETING_PROVIDER_OVERRIDES = [
  "inherit",
  ...GROWTH_MEETING_LOCATION_PROVIDERS,
] as const

export type GrowthBookingMeetingProviderOverride = (typeof GROWTH_BOOKING_MEETING_PROVIDER_OVERRIDES)[number]

export const GROWTH_BOOKING_MEETING_PROVIDER_OVERRIDE_LABELS: Record<
  GrowthBookingMeetingProviderOverride,
  string
> = {
  inherit: "Inherit platform default",
  google_meet: "Google Meet",
  zoom: "Zoom",
  teams: "Microsoft Teams",
  phone_call: "Phone Call",
  custom_location: "Custom Location",
  no_auto_link: "No Auto Link",
}

export const GROWTH_MEETING_LOCATION_PROVIDER_LABELS: Record<GrowthMeetingLocationProvider, string> = {
  google_meet: "Google Meet",
  zoom: "Zoom",
  teams: "Microsoft Teams",
  phone_call: "Phone Call",
  custom_location: "Custom Location",
  no_auto_link: "No Auto Link",
}

export const GROWTH_MEETING_LOCATION_HELPER_COPY =
  "Google Meet links are created through Google Calendar. Zoom and Teams are currently manual-link options until their provider integrations are connected."

export type GrowthMeetingLocationProviderReadiness = {
  provider: GrowthMeetingLocationProvider
  label: string
  status: "ready" | "planned" | "manual_only" | "setup_required"
  statusLabel: string
  allowsManualUrl: boolean
  supportsAutoLink: boolean
}

export type GrowthMeetingLocationSettings = {
  defaultMeetingProvider: GrowthMeetingLocationProvider
  autoCreateMeetingLink: boolean
}

export function mapLocationProviderToMeetingProvider(
  provider: GrowthMeetingLocationProvider,
): GrowthMeetingProvider | null {
  switch (provider) {
    case "google_meet":
      return "google_meet"
    case "zoom":
      return "zoom"
    case "teams":
      return "teams"
    case "phone_call":
      return "phone"
    case "custom_location":
      return "other"
    case "no_auto_link":
      return null
  }
}

export function buildMeetingLocationProviderReadiness(input: {
  googleCalendarConnected: boolean
}): GrowthMeetingLocationProviderReadiness[] {
  return GROWTH_MEETING_LOCATION_PROVIDERS.map((provider) => {
    if (provider === "google_meet") {
      return {
        provider,
        label: GROWTH_MEETING_LOCATION_PROVIDER_LABELS[provider],
        status: input.googleCalendarConnected ? "ready" : "setup_required",
        statusLabel: input.googleCalendarConnected ? "Ready" : "Google Calendar required",
        allowsManualUrl: false,
        supportsAutoLink: true,
      }
    }
    if (provider === "zoom") {
      return {
        provider,
        label: GROWTH_MEETING_LOCATION_PROVIDER_LABELS[provider],
        status: "planned",
        statusLabel: "Planned / manual URL only",
        allowsManualUrl: true,
        supportsAutoLink: false,
      }
    }
    if (provider === "teams") {
      return {
        provider,
        label: GROWTH_MEETING_LOCATION_PROVIDER_LABELS[provider],
        status: "planned",
        statusLabel: "Planned / manual URL only",
        allowsManualUrl: true,
        supportsAutoLink: false,
      }
    }
    if (provider === "phone_call") {
      return {
        provider,
        label: GROWTH_MEETING_LOCATION_PROVIDER_LABELS[provider],
        status: "manual_only",
        statusLabel: "Phone number or call notes",
        allowsManualUrl: false,
        supportsAutoLink: false,
      }
    }
    if (provider === "custom_location") {
      return {
        provider,
        label: GROWTH_MEETING_LOCATION_PROVIDER_LABELS[provider],
        status: "manual_only",
        statusLabel: "Custom URL or location text",
        allowsManualUrl: true,
        supportsAutoLink: false,
      }
    }
    return {
      provider,
      label: GROWTH_MEETING_LOCATION_PROVIDER_LABELS[provider],
      status: "ready",
      statusLabel: "No meeting link required",
      allowsManualUrl: false,
      supportsAutoLink: false,
    }
  })
}

export function meetingLocationNeedsManualUrl(provider: GrowthMeetingLocationProvider): boolean {
  return provider === "zoom" || provider === "teams" || provider === "custom_location"
}

export function meetingLocationNeedsLocationLabel(provider: GrowthMeetingLocationProvider): boolean {
  return provider === "phone_call" || provider === "custom_location"
}

export function legacyBookingLocationToProvider(
  locationType: string,
): GrowthMeetingLocationProvider {
  if (locationType === "phone_call") return "phone_call"
  if (locationType === "custom_location") return "custom_location"
  if (locationType === "zoom") return "zoom"
  if (locationType === "teams") return "teams"
  if (locationType === "no_auto_link") return "no_auto_link"
  return "google_meet"
}
