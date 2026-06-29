"use client"

import { Suspense, type ComponentType } from "react"
import dynamic from "next/dynamic"
import { GrowthAdminWidgetErrorBoundary } from "@/components/growth/growth-admin-widget-error-boundary"
import { growthEngineCustomerSettingsHref } from "@/lib/growth/navigation/growth-workspace-settings-canonical"
import {
  createWorkspaceSettingsGrowthEnginePanelFallback,
  logWorkspaceSettingsGrowthEnginePanelDiagnostic,
  resolveWorkspaceSettingsGrowthEngineDynamicExport,
  WORKSPACE_SETTINGS_GROWTH_ENGINE_DYNAMIC_PANEL_QA_MARKER,
  type WorkspaceSettingsGrowthEngineDynamicPanelModule,
} from "@/lib/settings/workspace-settings-growth-engine-dynamic-panel"
import {
  traceWorkspaceSettingsGrowthEnginePanel,
  wrapWorkspaceSettingsGrowthEnginePanelForRenderTrace,
} from "@/lib/settings/workspace-settings-growth-engine-panel-trace"
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

function loadLiftedPanel(
  sectionId: WorkspaceSettingsGrowthEngineLiftedSectionId,
  label: string,
  exportName: string,
  loader: () => Promise<WorkspaceSettingsGrowthEngineDynamicPanelModule>,
  options?: { ssr?: boolean },
): ComponentType {
  return dynamic(
    async () => {
      traceWorkspaceSettingsGrowthEnginePanel("loadLiftedPanel_dynamic_import_start", {
        sectionId,
        exportName,
        label,
      })
      try {
        const module = await loader()
        traceWorkspaceSettingsGrowthEnginePanel("loadLiftedPanel_dynamic_import_resolved", {
          sectionId,
          exportName,
          moduleKeys: Object.keys(module ?? {}),
          defaultType: typeof module?.default,
          namedExportType: typeof module?.[exportName],
        })

        const resolved =
          resolveWorkspaceSettingsGrowthEngineDynamicExport(sectionId, exportName, module) ??
          createWorkspaceSettingsGrowthEnginePanelFallback(label, sectionId)

        const chosenExport =
          typeof module?.default === "function"
            ? "default"
            : typeof module?.[exportName] === "function"
              ? exportName
              : "fallback"

        traceWorkspaceSettingsGrowthEnginePanel("loadLiftedPanel_chosen_export", {
          sectionId,
          exportName,
          chosenExport,
          resolvedName: resolved.displayName ?? resolved.name ?? "anonymous",
        })

        const traced = wrapWorkspaceSettingsGrowthEnginePanelForRenderTrace(sectionId, exportName, resolved)

        traceWorkspaceSettingsGrowthEnginePanel("loadLiftedPanel_returning_component", {
          sectionId,
          exportName,
          tracedName: traced.displayName ?? traced.name ?? "anonymous",
        })

        return { default: traced }
      } catch (error) {
        logWorkspaceSettingsGrowthEnginePanelDiagnostic(sectionId, {
          event: "dynamic_import_failed",
          exportName,
          errorName: error instanceof Error ? error.name : "unknown",
          errorMessage: error instanceof Error ? error.message : String(error),
        })
        traceWorkspaceSettingsGrowthEnginePanel("loadLiftedPanel_dynamic_import_failed", {
          sectionId,
          exportName,
          errorName: error instanceof Error ? error.name : "unknown",
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : null,
        })
        return {
          default: createWorkspaceSettingsGrowthEnginePanelFallback(
            label,
            sectionId,
            error instanceof Error ? error.message : "Panel chunk failed to load.",
          ),
        }
      }
    },
    {
      loading: () => <LiftedPanelFallback label={label} />,
      ssr: options?.ssr ?? false,
    },
  )
}

function withLiftedPanelSuspense(label: string, Panel: ComponentType, suspense = false): ComponentType {
  if (!suspense) return Panel

  function LiftedPanelWithSuspense() {
    traceWorkspaceSettingsGrowthEnginePanel("lifted_panel_suspense_before_render", { label })
    return (
      <Suspense fallback={<LiftedPanelFallback label={label} />}>
        <Panel />
      </Suspense>
    )
  }

  return LiftedPanelWithSuspense
}

const GrowthConnectedMailboxesDashboard = loadLiftedPanel(
  "connected-mailboxes",
  "Connected mailboxes",
  "GrowthConnectedMailboxesDashboard",
  () => import("@/components/growth/mailboxes/growth-connected-mailboxes-dashboard"),
  { ssr: false },
)

const GrowthWarmupDashboardPanel = loadLiftedPanel(
  "warmup",
  "Warmup",
  "GrowthWarmupDashboardPanel",
  () => import("@/components/growth/growth-warmup-dashboard"),
  { ssr: false },
)

const GrowthProvidersDashboard = loadLiftedPanel(
  "gmail",
  "Provider connections",
  "GrowthProvidersDashboard",
  () => import("@/components/growth/growth-providers-dashboard"),
)

const GrowthCommunicationSettingsPanel = loadLiftedPanel(
  "inbox-routing",
  "Communication preferences",
  "GrowthCommunicationSettingsPanel",
  () => import("@/components/growth/growth-communication-settings"),
)

const GrowthSenderInfrastructureDashboard = loadLiftedPanel(
  "sending-domains",
  "Sending domains",
  "GrowthSenderInfrastructureDashboard",
  () => import("@/components/growth/growth-sender-infrastructure-dashboard"),
)

const GrowthDeliverabilityDashboard = loadLiftedPanel(
  "dns-verification",
  "DNS verification",
  "GrowthDeliverabilityDashboard",
  () => import("@/components/growth/growth-deliverability-dashboard"),
)

const GrowthReputationProtectionDashboardView = loadLiftedPanel(
  "sending-limits",
  "Sending limits",
  "GrowthDeliverabilityProtectionConsole",
  () => import("@/components/growth/deliverability/deliverability-protection-console"),
)

const GrowthSenderPoolsDashboardView = loadLiftedPanel(
  "sender-pools",
  "Sender pools",
  "GrowthSenderPoolsDashboardView",
  () => import("@/components/growth/growth-sender-pools-dashboard"),
)

const GrowthRealtimeProvidersDashboard = loadLiftedPanel(
  "calling-providers",
  "Calling providers",
  "GrowthRealtimeProvidersDashboard",
  () => import("@/components/growth/growth-realtime-providers-dashboard"),
)

const GrowthVoiceInfrastructureSettingsPanel = loadLiftedPanel(
  "phone-numbers",
  "Voice infrastructure",
  "GrowthVoiceInfrastructureSettingsPanel",
  () => import("@/components/growth/growth-voice-infrastructure-settings-panel"),
)

const GrowthNativeDialerSettingsPanel = loadLiftedPanel(
  "dialer-settings",
  "Dialer settings",
  "GrowthNativeDialerSettingsPanel",
  () => import("@/components/growth/growth-native-dialer-settings-panel"),
)

const GrowthGoogleCalendarSettingsPanel = loadLiftedPanel(
  "calendar-providers",
  "Calendar providers",
  "GrowthGoogleCalendarSettingsPanel",
  () => import("@/components/growth/growth-google-calendar-settings-panel"),
)

const GrowthBookingPagesPanel = loadLiftedPanel(
  "booking-pages",
  "Booking pages",
  "GrowthBookingPagesPanel",
  () => import("@/components/growth/growth-booking-pages-panel"),
)

const GrowthMeetingLocationSettingsPanel = loadLiftedPanel(
  "meeting-preferences",
  "Meeting preferences",
  "GrowthMeetingLocationSettingsPanel",
  () => import("@/components/growth/growth-meeting-location-settings-panel"),
)

const GrowthSettingsNotificationsPanel = loadLiftedPanel(
  "notification-preferences",
  "Notification preferences",
  "GrowthSettingsNotificationsPanel",
  () => import("@/components/growth/settings/growth-settings-notifications-panel"),
)

const GrowthComplianceDashboardPanel = loadLiftedPanel(
  "unsubscribe-settings",
  "Compliance settings",
  "GrowthComplianceDashboardPanel",
  () => import("@/components/growth/growth-compliance-dashboard"),
)

const GrowthAiCopilotSettingsPanel = loadLiftedPanel(
  "copilot-preferences",
  "Copilot preferences",
  "GrowthAiCopilotSettingsPanel",
  () => import("@/components/growth/growth-ai-copilot-settings"),
)

const GrowthSharePagesDashboard = loadLiftedPanel(
  "share-page-branding",
  "Share page branding",
  "GrowthSharePagesDashboard",
  () => import("@/components/growth/share-pages/growth-share-pages-admin-panel"),
)

const GrowthMediaLibraryPanel = loadLiftedPanel(
  "media-library",
  "Media library",
  "GrowthMediaLibraryPanel",
  () => import("@/components/growth/media-library/growth-media-library-panel"),
)

const GrowthContentLibraryDashboardView = loadLiftedPanel(
  "media-defaults",
  "Media defaults",
  "GrowthContentLibraryDashboardView",
  () => import("@/components/growth/growth-content-library-dashboard"),
)

const GrowthEmailSignaturesPanel = loadLiftedPanel(
  "email-signatures",
  "Email signatures",
  "GrowthEmailSignaturesPanel",
  () => import("@/components/growth/signatures/growth-email-signatures-panel"),
)

function LiftedConnectedMailboxesPanel() {
  traceWorkspaceSettingsGrowthEnginePanel("LiftedConnectedMailboxesPanel_before_render", {
    sectionId: "connected-mailboxes",
  })
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

const LiftedWarmupPanel = withLiftedPanelSuspense("Warmup", GrowthWarmupDashboardPanel, true)
const LiftedSendingDomainsPanel = GrowthSenderInfrastructureDashboard
const LiftedDnsVerificationPanel = GrowthDeliverabilityDashboard
const LiftedSendingLimitsPanel = GrowthReputationProtectionDashboardView
const LiftedSenderPoolsPanel = GrowthSenderPoolsDashboardView

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

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANELS_BUILD_MARKER =
  WORKSPACE_SETTINGS_GROWTH_ENGINE_DYNAMIC_PANEL_QA_MARKER
