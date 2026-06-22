"use client"

import type { ComponentType } from "react"
import { GrowthBookingPagesPanel } from "@/components/growth/growth-booking-pages-panel"
import { GrowthCommunicationSettingsPanel } from "@/components/growth/growth-communication-settings"
import { GrowthContentLibraryDashboardView } from "@/components/growth/growth-content-library-dashboard"
import { GrowthGoogleCalendarSettingsPanel } from "@/components/growth/growth-google-calendar-settings-panel"
import { GrowthNativeDialerSettingsPanel } from "@/components/growth/growth-native-dialer-settings-panel"
import { GrowthRealtimeProvidersDashboard } from "@/components/growth/growth-realtime-providers-dashboard"
import { GrowthVoiceInfrastructureSettingsPanel } from "@/components/growth/growth-voice-infrastructure-settings-panel"
import { GrowthSharePagesDashboard } from "@/components/growth/share-pages/growth-share-pages-admin-panel"
import type { WorkspaceSettingsGrowthEngineLiftedSectionId } from "@/lib/settings/workspace-settings-growth-engine-lift"

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANELS: Record<
  WorkspaceSettingsGrowthEngineLiftedSectionId,
  ComponentType
> = {
  "inbox-routing": GrowthCommunicationSettingsPanel,
  "calling-providers": GrowthRealtimeProvidersDashboard,
  "phone-numbers": GrowthVoiceInfrastructureSettingsPanel,
  "dialer-settings": GrowthNativeDialerSettingsPanel,
  "call-routing": GrowthVoiceInfrastructureSettingsPanel,
  voicemail: GrowthVoiceInfrastructureSettingsPanel,
  "calendar-providers": GrowthGoogleCalendarSettingsPanel,
  "booking-pages": GrowthBookingPagesPanel,
  openai: GrowthRealtimeProvidersDashboard,
  "share-page-branding": GrowthSharePagesDashboard,
  "booking-branding": GrowthBookingPagesPanel,
  "media-defaults": GrowthContentLibraryDashboardView,
}

export function getWorkspaceSettingsGrowthEngineLiftedPanel(
  sectionId: string,
): ComponentType | null {
  if (!(sectionId in WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANELS)) return null
  return WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANELS[
    sectionId as WorkspaceSettingsGrowthEngineLiftedSectionId
  ]
}
