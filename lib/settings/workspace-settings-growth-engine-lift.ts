/**
 * Workspace Settings — Growth Engine section lift classification (Phase GE-SET-5, hotfix 8K).
 *
 * Client-safe manifest — no panel component imports.
 */

import {
  growthEngineCustomerSettingsHref,
  GROWTH_ENGINE_CUSTOMER_SETTINGS_BASE,
} from "@/lib/growth/navigation/growth-workspace-settings-canonical"

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFT_QA_MARKER =
  "workspace-settings-growth-engine-lift-8k-v1" as const

export type GrowthEngineSectionLiftKind =
  | "lifted"
  | "bridged"
  | "canonical"
  | "placeholder"
  | "admin_only"
  | "operational_only"
  | "missing"

export type GrowthEngineSectionClassification = {
  kind: GrowthEngineSectionLiftKind
  reason: string
}

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_CANONICAL_SECTION_ID = "notification-preferences" as const

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_CANONICAL_HREFS: Record<string, string> = {
  [WORKSPACE_SETTINGS_GROWTH_ENGINE_CANONICAL_SECTION_ID]:
    growthEngineCustomerSettingsHref("notification-preferences"),
  "copilot-preferences": growthEngineCustomerSettingsHref("copilot-preferences"),
  "unsubscribe-settings": growthEngineCustomerSettingsHref("unsubscribe-settings"),
  "suppression-lists": growthEngineCustomerSettingsHref("suppression-lists"),
  "compliance-rules": growthEngineCustomerSettingsHref("compliance-rules"),
}

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_SECTION_IDS = [
  "connected-mailboxes",
  "gmail",
  "microsoft-365",
  "inbox-routing",
  "sending-domains",
  "dns-verification",
  "warmup",
  "sending-limits",
  "sender-pools",
  "mailbox-health",
  "calling-providers",
  "phone-numbers",
  "dialer-settings",
  "call-routing",
  "voicemail",
  "calendar-providers",
  "booking-pages",
  "meeting-preferences",
  "notification-preferences",
  "unsubscribe-settings",
  "suppression-lists",
  "compliance-rules",
  "openai",
  "copilot-preferences",
  "share-page-branding",
  "booking-branding",
  "media-defaults",
  "email-signatures",
] as const

export type WorkspaceSettingsGrowthEngineLiftedSectionId =
  (typeof WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_SECTION_IDS)[number]

/** Maps lifted section IDs to panel component export names (audit-safe, no imports). */
export const WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANEL_EXPORTS: Record<
  WorkspaceSettingsGrowthEngineLiftedSectionId,
  string
> = {
  "connected-mailboxes": "LiftedConnectedMailboxesPanel",
  gmail: "GrowthProvidersDashboard",
  "microsoft-365": "GrowthProvidersDashboard",
  "inbox-routing": "GrowthCommunicationSettingsPanel",
  "sending-domains": "GrowthSenderInfrastructureDashboard",
  "dns-verification": "GrowthDeliverabilityDashboard",
  warmup: "LiftedWarmupPanel",
  "sending-limits": "GrowthReputationProtectionDashboardView",
  "sender-pools": "GrowthSenderPoolsDashboardView",
  "mailbox-health": "GrowthDeliverabilityDashboard",
  "calling-providers": "GrowthRealtimeProvidersDashboard",
  "phone-numbers": "GrowthVoiceInfrastructureSettingsPanel",
  "dialer-settings": "GrowthNativeDialerSettingsPanel",
  "call-routing": "GrowthVoiceInfrastructureSettingsPanel",
  voicemail: "GrowthVoiceInfrastructureSettingsPanel",
  "calendar-providers": "GrowthGoogleCalendarSettingsPanel",
  "booking-pages": "GrowthBookingPagesPanel",
  "meeting-preferences": "GrowthMeetingLocationSettingsPanel",
  "unsubscribe-settings": "GrowthComplianceDashboardPanel",
  "suppression-lists": "GrowthComplianceDashboardPanel",
  "compliance-rules": "GrowthComplianceDashboardPanel",
  openai: "GrowthRealtimeProvidersDashboard",
  "copilot-preferences": "GrowthAiCopilotSettingsPanel",
  "share-page-branding": "GrowthSharePagesDashboard",
  "booking-branding": "GrowthBookingPagesPanel",
  "media-defaults": "GrowthContentLibraryDashboardView",
  "email-signatures": "GrowthEmailSignaturesPanel",
  "notification-preferences": "GrowthSettingsNotificationsPanel",
}

/** Deferred sections — remain Phase 3 placeholders with CTA where applicable. */
export const WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFERRED_SECTION_IDS = [
  "elevenlabs",
  "retell",
  "media-ai-providers",
  "automation-defaults",
  "command-center-preferences",
] as const

export type WorkspaceSettingsGrowthEngineDeferredSectionId =
  (typeof WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFERRED_SECTION_IDS)[number]

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_SECTION_CLASSIFICATION: Record<
  string,
  GrowthEngineSectionClassification
> = {
  "connected-mailboxes": {
    kind: "lifted",
    reason: "Connected mailboxes dashboard in Workspace Settings (8K canonical).",
  },
  gmail: {
    kind: "lifted",
    reason: "Provider connections dashboard in Workspace Settings.",
  },
  "microsoft-365": {
    kind: "lifted",
    reason: "Provider connections dashboard in Workspace Settings.",
  },
  "inbox-routing": {
    kind: "lifted",
    reason: "Communication preferences panel lifted in GE-SET-4.",
  },
  "sending-domains": {
    kind: "lifted",
    reason: "Sender infrastructure dashboard in Workspace Settings (8K canonical).",
  },
  "dns-verification": {
    kind: "lifted",
    reason: "Deliverability DNS dashboard in Workspace Settings (8K canonical).",
  },
  warmup: {
    kind: "lifted",
    reason: "Warmup dashboard in Workspace Settings (8K canonical).",
  },
  "sending-limits": {
    kind: "lifted",
    reason: "Reputation protection console in Workspace Settings (8K canonical).",
  },
  "sender-pools": {
    kind: "lifted",
    reason: "Sender pools dashboard in Workspace Settings (8K canonical).",
  },
  "mailbox-health": {
    kind: "lifted",
    reason: "Deliverability dashboard in Workspace Settings (8K canonical).",
  },
  "calling-providers": {
    kind: "lifted",
    reason: "Realtime providers dashboard lifted in GE-SET-4.",
  },
  "phone-numbers": {
    kind: "lifted",
    reason: "Voice infrastructure panel lifted in GE-SET-4.",
  },
  "dialer-settings": {
    kind: "lifted",
    reason: "Native dialer settings panel lifted in GE-SET-4.",
  },
  "call-routing": {
    kind: "lifted",
    reason: "Voice infrastructure panel lifted in GE-SET-4.",
  },
  voicemail: {
    kind: "lifted",
    reason: "Voice infrastructure panel lifted in GE-SET-4.",
  },
  "calendar-providers": {
    kind: "lifted",
    reason: "Google calendar settings panel lifted in GE-SET-4.",
  },
  "booking-pages": {
    kind: "lifted",
    reason: "Booking pages panel lifted in GE-SET-4.",
  },
  "meeting-preferences": {
    kind: "lifted",
    reason: "Meeting location settings in Workspace Settings (8K canonical).",
  },
  "notification-preferences": {
    kind: "lifted",
    reason: "Growth operator notifications panel in Workspace Settings (8K canonical).",
  },
  "unsubscribe-settings": {
    kind: "lifted",
    reason: "GrowthComplianceDashboardPanel in Workspace Settings (8K canonical).",
  },
  "suppression-lists": {
    kind: "lifted",
    reason: "GrowthComplianceDashboardPanel in Workspace Settings (8K canonical).",
  },
  "compliance-rules": {
    kind: "lifted",
    reason: "GrowthComplianceDashboardPanel in Workspace Settings (8K canonical).",
  },
  openai: {
    kind: "lifted",
    reason: "GrowthRealtimeProvidersDashboard is the existing OpenAI realtime provider panel.",
  },
  "copilot-preferences": {
    kind: "lifted",
    reason: "GrowthAiCopilotSettingsPanel in Workspace Settings (8K canonical).",
  },
  "share-page-branding": {
    kind: "lifted",
    reason: "GrowthSharePagesDashboard is the admin share page configuration console.",
  },
  "booking-branding": {
    kind: "lifted",
    reason: "GrowthBookingPagesPanel includes booking page branding fields.",
  },
  "media-defaults": {
    kind: "lifted",
    reason: "GrowthContentLibraryDashboardView is the existing media/content defaults console.",
  },
  "email-signatures": {
    kind: "lifted",
    reason: "GrowthEmailSignaturesPanel — sender profiles and signature templates (GS-GROWTH-SIGNATURES-1A).",
  },
  elevenlabs: {
    kind: "operational_only",
    reason:
      "GrowthMediaAiVoicePanel is embedded in share-page template editors and requires parent context — not a standalone settings panel.",
  },
  retell: {
    kind: "operational_only",
    reason:
      "GrowthMediaConversationalAgentPanel is an in-media scaffold — no org-scoped Retell settings surface.",
  },
  "media-ai-providers": {
    kind: "operational_only",
    reason: "Media AI provider selection runs inside /growth/media operational workflows — no dedicated settings panel.",
  },
  "automation-defaults": {
    kind: "placeholder",
    reason: "GrowthEngineSettingsPanel is coming-soon preview only — no persisted automation defaults.",
  },
  "command-center-preferences": {
    kind: "missing",
    reason: "/growth/settings/command-center-preferences is placeholder — no persistence wired.",
  },
}

export function listWorkspaceSettingsGrowthEngineLiftedSectionIds(): WorkspaceSettingsGrowthEngineLiftedSectionId[] {
  return [...WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_SECTION_IDS]
}

export function getGrowthEngineSectionClassification(
  sectionId: string,
): GrowthEngineSectionClassification | null {
  return WORKSPACE_SETTINGS_GROWTH_ENGINE_SECTION_CLASSIFICATION[sectionId] ?? null
}

export function resolveGrowthEngineSectionLiftKind(sectionId: string): GrowthEngineSectionLiftKind {
  return getGrowthEngineSectionClassification(sectionId)?.kind ?? "placeholder"
}

export function getWorkspaceSettingsGrowthEngineCanonicalHref(sectionId: string): string | null {
  return WORKSPACE_SETTINGS_GROWTH_ENGINE_CANONICAL_HREFS[sectionId] ?? null
}

export function isWorkspaceSettingsGrowthEngineDeferredSection(
  sectionId: string,
): sectionId is WorkspaceSettingsGrowthEngineDeferredSectionId {
  return (WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFERRED_SECTION_IDS as readonly string[]).includes(sectionId)
}

/** @deprecated Use WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFERRED_SECTION_IDS */
export const WORKSPACE_SETTINGS_GROWTH_ENGINE_PLACEHOLDER_SECTION_IDS =
  WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFERRED_SECTION_IDS

/** @deprecated Use isWorkspaceSettingsGrowthEngineDeferredSection */
export function isWorkspaceSettingsGrowthEnginePlaceholderSection(
  sectionId: string,
): sectionId is WorkspaceSettingsGrowthEngineDeferredSectionId {
  return isWorkspaceSettingsGrowthEngineDeferredSection(sectionId)
}

export function rendersGrowthEnginePhasePlaceholder(kind: GrowthEngineSectionLiftKind): boolean {
  return (
    kind === "placeholder" ||
    kind === "admin_only" ||
    kind === "operational_only" ||
    kind === "missing"
  )
}

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_CUSTOMER_SETTINGS_BASE = GROWTH_ENGINE_CUSTOMER_SETTINGS_BASE
