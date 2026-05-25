import type { GrowthBookingLocationType, GrowthBookingPage } from "@/lib/growth/booking/booking-page-types"
import { legacyBookingLocationToProvider } from "@/lib/growth/meeting-location/meeting-location-provider-types"

export function resolveBookingPageDisplayTitle(page: Pick<GrowthBookingPage, "pageTitle" | "meetingType" | "name">): string {
  return page.pageTitle?.trim() || page.meetingType?.trim() || page.name.trim()
}

export function resolveBookingPageAccentColor(page: Pick<GrowthBookingPage, "accentColor" | "brandColor">): string {
  return page.accentColor?.trim() || page.brandColor
}

export type PublicBookingLocationDisplay = {
  label: string
  url: string | null
}

export function resolvePublicBookingLocationFromPage(
  page: Pick<GrowthBookingPage, "locationType" | "meetingProviderOverride" | "customLocation" | "manualMeetingUrl">,
): PublicBookingLocationDisplay {
  const effectiveType =
    page.meetingProviderOverride !== "inherit"
      ? (page.meetingProviderOverride as GrowthBookingLocationType)
      : legacyBookingLocationToProvider(page.locationType)
  return resolvePublicBookingLocationDisplay({
    locationType: effectiveType,
    customLocation: page.customLocation,
    manualMeetingUrl: page.manualMeetingUrl,
  })
}

export function resolvePublicBookingLocationDisplay(
  page: Pick<GrowthBookingPage, "locationType" | "customLocation" | "manualMeetingUrl">,
): PublicBookingLocationDisplay {
  if (page.locationType === "phone_call") {
    return {
      label: page.customLocation?.trim() || "Phone call — details provided after booking",
      url: null,
    }
  }
  if (page.locationType === "custom_location") {
    if (page.manualMeetingUrl?.trim()) {
      return { label: page.customLocation?.trim() || "Custom location", url: page.manualMeetingUrl.trim() }
    }
    return {
      label: page.customLocation?.trim() || "Custom location — details provided after booking",
      url: null,
    }
  }
  if (page.locationType === "zoom") {
    if (page.manualMeetingUrl?.trim()) {
      return { label: "Zoom meeting", url: page.manualMeetingUrl.trim() }
    }
    return { label: "Zoom — meeting link provided after booking", url: null }
  }
  if (page.locationType === "teams") {
    if (page.manualMeetingUrl?.trim()) {
      return { label: "Microsoft Teams meeting", url: page.manualMeetingUrl.trim() }
    }
    return { label: "Microsoft Teams — meeting link provided after booking", url: null }
  }
  if (page.locationType === "no_auto_link") {
    return { label: page.customLocation?.trim() || "Details provided after booking", url: null }
  }
  return { label: "Google Meet video conference", url: null }
}

export function locationTypeLabel(locationType: GrowthBookingLocationType): string {
  switch (locationType) {
    case "google_meet":
      return "Google Meet"
    case "zoom":
      return "Zoom"
    case "teams":
      return "Microsoft Teams"
    case "phone_call":
      return "Phone call"
    case "custom_location":
      return "Custom location"
    case "no_auto_link":
      return "No video link"
  }
}
