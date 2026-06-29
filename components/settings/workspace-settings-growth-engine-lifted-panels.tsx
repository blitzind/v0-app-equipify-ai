"use client"

import { Suspense, type ComponentType } from "react"
import dynamic from "next/dynamic"
import { GrowthAdminWidgetErrorBoundary } from "@/components/growth/growth-admin-widget-error-boundary"
import { growthEngineCustomerSettingsHref } from "@/lib/growth/navigation/growth-workspace-settings-canonical"
import type { WorkspaceSettingsGrowthEngineLiftedSectionId } from "@/lib/settings/workspace-settings-growth-engine-lift"

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANEL_ERROR_BOUNDARY_QA_MARKER =
  "workspace-settings-growth-engine-lifted-panel-error-boundary-v1" as const

function LiftedPanelFallback({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
      Loading {label}…
    </div>
  )
}

function dynamicLiftedPanel(
  label: string,
  loader: () => Promise<{ default: ComponentType }>,
): ComponentType {
  return dynamic(loader, { loading: () => <LiftedPanelFallback label={label} /> })
}

function withLiftedPanelShell(
  label: string,
  Panel: ComponentType,
  options?: { suspense?: boolean },
): ComponentType {
  function LiftedPanelShell() {
    const panel = <Panel />
    const content = options?.suspense
      ? <Suspense fallback={<LiftedPanelFallback label={label} />}>{panel}</Suspense>
      : panel

    return (
      <GrowthAdminWidgetErrorBoundary
        label={label}
        qaMarker={WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANEL_ERROR_BOUNDARY_QA_MARKER}
      >
        {content}
      </GrowthAdminWidgetErrorBoundary>
    )
  }

  return LiftedPanelShell
}

const GrowthConnectedMailboxesDashboard = dynamicLiftedPanel("connected mailboxes", () =>
  import("@/components/growth/mailboxes/growth-connected-mailboxes-dashboard").then((module) => ({
    default: module.GrowthConnectedMailboxesDashboard,
  })),
)

const GrowthWarmupDashboardPanel = dynamicLiftedPanel("warmup", () =>
  import("@/components/growth/growth-warmup-dashboard").then((module) => ({
    default: module.GrowthWarmupDashboardPanel,
  })),
)

const GrowthProvidersDashboard = dynamicLiftedPanel("provider connections", () =>
  import("@/components/growth/growth-providers-dashboard").then((module) => ({
    default: module.GrowthProvidersDashboard,
  })),
)

const GrowthCommunicationSettingsPanel = dynamicLiftedPanel("communication preferences", () =>
  import("@/components/growth/growth-communication-settings").then((module) => ({
    default: module.GrowthCommunicationSettingsPanel,
  })),
)

const GrowthSenderInfrastructureDashboard = dynamicLiftedPanel("sending domains", () =>
  import("@/components/growth/growth-sender-infrastructure-dashboard").then((module) => ({
    default: module.GrowthSenderInfrastructureDashboard,
  })),
)

const GrowthDeliverabilityDashboard = dynamicLiftedPanel("DNS verification", () =>
  import("@/components/growth/growth-deliverability-dashboard").then((module) => ({
    default: module.GrowthDeliverabilityDashboard,
  })),
)

const GrowthReputationProtectionDashboardView = dynamicLiftedPanel("sending limits", () =>
  import("@/components/growth/deliverability/deliverability-protection-console").then((module) => ({
    default: module.GrowthDeliverabilityProtectionConsole,
  })),
)

const GrowthSenderPoolsDashboardView = dynamicLiftedPanel("sender pools", () =>
  import("@/components/growth/growth-sender-pools-dashboard").then((module) => ({
    default: module.GrowthSenderPoolsDashboardView,
  })),
)

const GrowthRealtimeProvidersDashboard = dynamicLiftedPanel("calling providers", () =>
  import("@/components/growth/growth-realtime-providers-dashboard").then((module) => ({
    default: module.GrowthRealtimeProvidersDashboard,
  })),
)

const GrowthVoiceInfrastructureSettingsPanel = dynamicLiftedPanel("voice infrastructure", () =>
  import("@/components/growth/growth-voice-infrastructure-settings-panel").then((module) => ({
    default: module.GrowthVoiceInfrastructureSettingsPanel,
  })),
)

const GrowthNativeDialerSettingsPanel = dynamicLiftedPanel("dialer settings", () =>
  import("@/components/growth/growth-native-dialer-settings-panel").then((module) => ({
    default: module.GrowthNativeDialerSettingsPanel,
  })),
)

const GrowthGoogleCalendarSettingsPanel = dynamicLiftedPanel("calendar providers", () =>
  import("@/components/growth/growth-google-calendar-settings-panel").then((module) => ({
    default: module.GrowthGoogleCalendarSettingsPanel,
  })),
)

const GrowthBookingPagesPanel = dynamicLiftedPanel("booking pages", () =>
  import("@/components/growth/growth-booking-pages-panel").then((module) => ({
    default: module.GrowthBookingPagesPanel,
  })),
)

const GrowthMeetingLocationSettingsPanel = dynamicLiftedPanel("meeting preferences", () =>
  import("@/components/growth/growth-meeting-location-settings-panel").then((module) => ({
    default: module.GrowthMeetingLocationSettingsPanel,
  })),
)

const GrowthSettingsNotificationsPanel = dynamicLiftedPanel("notification preferences", () =>
  import("@/components/growth/settings/growth-settings-notifications-panel").then((module) => ({
    default: module.GrowthSettingsNotificationsPanel,
  })),
)

const GrowthComplianceDashboardPanel = dynamicLiftedPanel("compliance settings", () =>
  import("@/components/growth/growth-compliance-dashboard").then((module) => ({
    default: module.GrowthComplianceDashboardPanel,
  })),
)

const GrowthAiCopilotSettingsPanel = dynamicLiftedPanel("copilot preferences", () =>
  import("@/components/growth/growth-ai-copilot-settings").then((module) => ({
    default: module.GrowthAiCopilotSettingsPanel,
  })),
)

const GrowthSharePagesDashboard = dynamicLiftedPanel("share page branding", () =>
  import("@/components/growth/share-pages/growth-share-pages-admin-panel").then((module) => ({
    default: module.GrowthSharePagesDashboard,
  })),
)

const GrowthMediaLibraryPanel = dynamicLiftedPanel("media library", () =>
  import("@/components/growth/media-library/growth-media-library-panel").then((module) => ({
    default: module.GrowthMediaLibraryPanel,
  })),
)

const GrowthContentLibraryDashboardView = dynamicLiftedPanel("media defaults", () =>
  import("@/components/growth/growth-content-library-dashboard").then((module) => ({
    default: module.GrowthContentLibraryDashboardView,
  })),
)

const GrowthEmailSignaturesPanel = dynamicLiftedPanel("email signatures", () =>
  import("@/components/growth/signatures/growth-email-signatures-panel").then((module) => ({
    default: module.GrowthEmailSignaturesPanel,
  })),
)

function LiftedConnectedMailboxesPanel() {
  return (
    <GrowthAdminWidgetErrorBoundary
      label="Connected mailboxes"
      qaMarker={WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANEL_ERROR_BOUNDARY_QA_MARKER}
    >
      <Suspense fallback={<LiftedPanelFallback label="connected mailboxes" />}>
        <GrowthConnectedMailboxesDashboard
          oauthReturnTo={growthEngineCustomerSettingsHref("connected-mailboxes")}
        />
      </Suspense>
    </GrowthAdminWidgetErrorBoundary>
  )
}

const LiftedWarmupPanel = withLiftedPanelShell("Warmup", GrowthWarmupDashboardPanel, { suspense: true })
const LiftedSendingDomainsPanel = withLiftedPanelShell("Sending domains", GrowthSenderInfrastructureDashboard)
const LiftedDnsVerificationPanel = withLiftedPanelShell("DNS verification", GrowthDeliverabilityDashboard)
const LiftedSendingLimitsPanel = withLiftedPanelShell("Sending limits", GrowthReputationProtectionDashboardView)
const LiftedSenderPoolsPanel = withLiftedPanelShell("Sender pools", GrowthSenderPoolsDashboardView)

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANELS: Record<
  WorkspaceSettingsGrowthEngineLiftedSectionId,
  ComponentType
> = {
  "connected-mailboxes": LiftedConnectedMailboxesPanel,
  gmail: GrowthProvidersDashboard,
  "microsoft-365": GrowthProvidersDashboard,
  "inbox-routing": GrowthCommunicationSettingsPanel,
  "sending-domains": LiftedSendingDomainsPanel,
  "dns-verification": LiftedDnsVerificationPanel,
  warmup: LiftedWarmupPanel,
  "sending-limits": LiftedSendingLimitsPanel,
  "sender-pools": LiftedSenderPoolsPanel,
  "mailbox-health": LiftedDnsVerificationPanel,
  "calling-providers": GrowthRealtimeProvidersDashboard,
  "phone-numbers": GrowthVoiceInfrastructureSettingsPanel,
  "dialer-settings": GrowthNativeDialerSettingsPanel,
  "call-routing": GrowthVoiceInfrastructureSettingsPanel,
  voicemail: GrowthVoiceInfrastructureSettingsPanel,
  "calendar-providers": GrowthGoogleCalendarSettingsPanel,
  "booking-pages": GrowthBookingPagesPanel,
  "meeting-preferences": GrowthMeetingLocationSettingsPanel,
  "notification-preferences": GrowthSettingsNotificationsPanel,
  "unsubscribe-settings": GrowthComplianceDashboardPanel,
  "suppression-lists": GrowthComplianceDashboardPanel,
  "compliance-rules": GrowthComplianceDashboardPanel,
  openai: GrowthRealtimeProvidersDashboard,
  "copilot-preferences": GrowthAiCopilotSettingsPanel,
  "share-page-branding": GrowthSharePagesDashboard,
  "media-library": GrowthMediaLibraryPanel,
  "booking-branding": GrowthBookingPagesPanel,
  "media-defaults": GrowthContentLibraryDashboardView,
  "email-signatures": GrowthEmailSignaturesPanel,
}

export function getWorkspaceSettingsGrowthEngineLiftedPanel(
  sectionId: string,
): ComponentType | null {
  if (!(sectionId in WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANELS)) return null
  return WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANELS[
    sectionId as WorkspaceSettingsGrowthEngineLiftedSectionId
  ]
}
