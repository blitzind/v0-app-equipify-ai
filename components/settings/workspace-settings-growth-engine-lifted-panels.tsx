"use client"

import type { ComponentType } from "react"
import { GrowthAiCopilotSettingsPanel } from "@/components/growth/growth-ai-copilot-settings"
import { GrowthBookingPagesPanel } from "@/components/growth/growth-booking-pages-panel"
import { GrowthCommunicationSettingsPanel } from "@/components/growth/growth-communication-settings"
import { GrowthComplianceDashboardPanel } from "@/components/growth/growth-compliance-dashboard"
import { GrowthContentLibraryDashboardView } from "@/components/growth/growth-content-library-dashboard"
import { GrowthDeliverabilityDashboard } from "@/components/growth/growth-deliverability-dashboard"
import { GrowthGoogleCalendarSettingsPanel } from "@/components/growth/growth-google-calendar-settings-panel"
import { GrowthConnectedMailboxesDashboard } from "@/components/growth/mailboxes/growth-connected-mailboxes-dashboard"
import { GrowthMeetingLocationSettingsPanel } from "@/components/growth/growth-meeting-location-settings-panel"
import { GrowthNativeDialerSettingsPanel } from "@/components/growth/growth-native-dialer-settings-panel"
import { GrowthProvidersDashboard } from "@/components/growth/growth-providers-dashboard"
import { GrowthRealtimeProvidersDashboard } from "@/components/growth/growth-realtime-providers-dashboard"
import { GrowthReputationProtectionDashboardView } from "@/components/growth/growth-reputation-protection-dashboard"
import { GrowthSenderInfrastructureDashboard } from "@/components/growth/growth-sender-infrastructure-dashboard"
import { GrowthSenderPoolsDashboardView } from "@/components/growth/growth-sender-pools-dashboard"
import { GrowthVoiceInfrastructureSettingsPanel } from "@/components/growth/growth-voice-infrastructure-settings-panel"
import { GrowthWarmupDashboardPanel } from "@/components/growth/growth-warmup-dashboard"
import { GrowthSharePagesDashboard } from "@/components/growth/share-pages/growth-share-pages-admin-panel"
import type { WorkspaceSettingsGrowthEngineLiftedSectionId } from "@/lib/settings/workspace-settings-growth-engine-lift"

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANELS: Record<
  WorkspaceSettingsGrowthEngineLiftedSectionId,
  ComponentType
> = {
  "connected-mailboxes": GrowthConnectedMailboxesDashboard,
  gmail: GrowthProvidersDashboard,
  "microsoft-365": GrowthProvidersDashboard,
  "inbox-routing": GrowthCommunicationSettingsPanel,
  "sending-domains": GrowthSenderInfrastructureDashboard,
  "dns-verification": GrowthDeliverabilityDashboard,
  warmup: GrowthWarmupDashboardPanel,
  "sending-limits": GrowthReputationProtectionDashboardView,
  "sender-pools": GrowthSenderPoolsDashboardView,
  "mailbox-health": GrowthDeliverabilityDashboard,
  "calling-providers": GrowthRealtimeProvidersDashboard,
  "phone-numbers": GrowthVoiceInfrastructureSettingsPanel,
  "dialer-settings": GrowthNativeDialerSettingsPanel,
  "call-routing": GrowthVoiceInfrastructureSettingsPanel,
  voicemail: GrowthVoiceInfrastructureSettingsPanel,
  "calendar-providers": GrowthGoogleCalendarSettingsPanel,
  "booking-pages": GrowthBookingPagesPanel,
  "meeting-preferences": GrowthMeetingLocationSettingsPanel,
  "unsubscribe-settings": GrowthComplianceDashboardPanel,
  "suppression-lists": GrowthComplianceDashboardPanel,
  "compliance-rules": GrowthComplianceDashboardPanel,
  openai: GrowthRealtimeProvidersDashboard,
  "copilot-preferences": GrowthAiCopilotSettingsPanel,
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
