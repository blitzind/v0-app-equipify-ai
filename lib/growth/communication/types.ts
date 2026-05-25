/** Client-safe Growth Engine communication preference types. */

import type { GrowthCommunicationPreferenceSource } from "@/lib/growth/communication/scope"
import type { GrowthMeetingLocationProvider } from "@/lib/growth/meeting-location/meeting-location-provider-types"

export const GROWTH_CALL_DIAL_MODES = ["tel", "facetime", "google_voice", "custom_url_template"] as const

export type GrowthCallDialMode = (typeof GROWTH_CALL_DIAL_MODES)[number]

/** Platform-scope defaults row (`growth.communication_settings` today). */
export type GrowthPlatformCommunicationSettings = {
  id: string
  activeEmailConnectionId: string | null
  callDialMode: GrowthCallDialMode
  customUrlTemplate: string | null
  showAlternateDialers: boolean
  defaultMeetingProvider: GrowthMeetingLocationProvider
  autoCreateMeetingLink: boolean
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

/** @deprecated Use GrowthPlatformCommunicationSettings — kept for transitional imports. */
export type GrowthCommunicationSettings = GrowthPlatformCommunicationSettings

/** Platform admin user overrides (`growth.user_communication_preferences` today). */
export type GrowthPlatformAdminCommunicationPreferences = {
  userId: string
  callDialMode: GrowthCallDialMode | null
  customUrlTemplate: string | null
  showAlternateDialers: boolean | null
  preferredEmailConnectionId: string | null
  createdAt: string
  updatedAt: string
}

/** @deprecated Use GrowthPlatformAdminCommunicationPreferences — kept for transitional imports. */
export type GrowthUserCommunicationPreferences = GrowthPlatformAdminCommunicationPreferences

export type ResolvedGrowthDialPreferences = {
  callDialMode: GrowthCallDialMode
  customUrlTemplate: string | null
  showAlternateDialers: boolean
  preferredEmailConnectionId: string | null
  source: {
    callDialMode: GrowthCommunicationPreferenceSource
    customUrlTemplate: GrowthCommunicationPreferenceSource
    showAlternateDialers: GrowthCommunicationPreferenceSource
    preferredEmailConnectionId: GrowthCommunicationPreferenceSource
  }
}

export type GrowthLeadCallSession = {
  id: string
  leadId: string
  phoneDialed: string
  dialMode: GrowthCallDialMode
  startedAt: string
  endedAt: string | null
  disposition: string | null
  callEventId: string | null
  createdBy: string | null
  createdAt: string
}

export type GrowthCallDialOption = {
  mode: GrowthCallDialMode
  label: string
  href: string
}
