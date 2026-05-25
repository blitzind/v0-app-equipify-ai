import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthCalendarConnectionForUser } from "@/lib/growth/calendar/calendar-connection-repository"
import { fetchGrowthPlatformCommunicationSettings } from "@/lib/growth/communication/settings-repository"
import type { GrowthMeetingLocationSettings } from "@/lib/growth/meeting-location/meeting-location-provider-types"
import type { GrowthMeetingLocationProvider } from "@/lib/growth/meeting-location/meeting-location-provider-types"

export async function fetchGrowthMeetingLocationSettings(
  admin: SupabaseClient,
): Promise<GrowthMeetingLocationSettings> {
  const settings = await fetchGrowthPlatformCommunicationSettings(admin)
  return {
    defaultMeetingProvider: settings.defaultMeetingProvider,
    autoCreateMeetingLink: settings.autoCreateMeetingLink,
  }
}

export async function isGrowthGoogleCalendarConnectedForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const connection = await fetchGrowthCalendarConnectionForUser(admin, userId)
  return Boolean(connection)
}

export type GrowthMeetingLocationPlatformContext = {
  settings: GrowthMeetingLocationSettings
  googleCalendarConnected: boolean
}

export async function fetchGrowthMeetingLocationPlatformContext(
  admin: SupabaseClient,
  userId: string,
): Promise<GrowthMeetingLocationPlatformContext> {
  const settings = await fetchGrowthPlatformCommunicationSettings(admin)
  const googleCalendarConnected = await isGrowthGoogleCalendarConnectedForUser(admin, userId)
  return {
    settings: {
      defaultMeetingProvider: settings.defaultMeetingProvider,
      autoCreateMeetingLink: settings.autoCreateMeetingLink,
    },
    googleCalendarConnected,
  }
}

export function parseMeetingLocationProvider(value: string | null | undefined): GrowthMeetingLocationProvider | null {
  if (!value) return null
  const allowed = [
    "google_meet",
    "zoom",
    "teams",
    "phone_call",
    "custom_location",
    "no_auto_link",
  ] as const
  return (allowed as readonly string[]).includes(value) ? (value as GrowthMeetingLocationProvider) : null
}
