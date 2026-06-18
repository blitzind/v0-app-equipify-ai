/**
 * Workspace Settings — Growth Engine section lift classification (Phase GE-SET-5).
 *
 * Client-safe manifest — no panel component imports.
 */

import { WORKSPACE_SETTINGS_GROWTH_OPERATOR_BASE } from "@/lib/settings/workspace-settings-growth-operator"

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFT_QA_MARKER =
  "workspace-settings-growth-engine-lift-ge-set-5-v1" as const

export type GrowthEngineSectionLiftKind =
  | "lifted"
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
  [WORKSPACE_SETTINGS_GROWTH_ENGINE_CANONICAL_SECTION_ID]: `${WORKSPACE_SETTINGS_GROWTH_OPERATOR_BASE}/notifications`,
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
  "unsubscribe-settings",
  "suppression-lists",
  "compliance-rules",
  "openai",
  "copilot-preferences",
  "share-page-branding",
  "booking-branding",
  "media-defaults",
] as const

export type WorkspaceSettingsGrowthEngineLiftedSectionId =
  (typeof WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_SECTION_IDS)[number]

/** Maps lifted section IDs to panel component export names (audit-safe, no imports). */
export const WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_PANEL_EXPORTS: Record<
  WorkspaceSettingsGrowthEngineLiftedSectionId,
  string
> = {
  "connected-mailboxes": "GrowthMailboxConnectionsDashboard",
  gmail: "GrowthProvidersDashboard",
  "microsoft-365": "GrowthProvidersDashboard",
  "inbox-routing": "GrowthCommunicationSettingsPanel",
  "sending-domains": "GrowthSenderInfrastructureDashboard",
  "dns-verification": "GrowthDeliverabilityDashboard",
  warmup: "GrowthWarmupDashboardPanel",
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
}

/** Deferred sections — remain Phase 3 placeholders with CTA where applicable. */
export const WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFERRED_SECTION_IDS = [
  "email-signatures",
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
    reason: "Admin mailbox connections dashboard lifted in GE-SET-4.",
  },
  gmail: {
    kind: "lifted",
    reason: "Provider connections dashboard lifted in GE-SET-4.",
  },
  "microsoft-365": {
    kind: "lifted",
    reason: "Provider connections dashboard lifted in GE-SET-4.",
  },
  "inbox-routing": {
    kind: "lifted",
    reason: "Communication preferences panel lifted in GE-SET-4.",
  },
  "sending-domains": {
    kind: "lifted",
    reason: "Sender infrastructure dashboard lifted in GE-SET-4.",
  },
  "dns-verification": {
    kind: "lifted",
    reason: "Deliverability DNS dashboard lifted in GE-SET-4.",
  },
  warmup: {
    kind: "lifted",
    reason: "Warmup dashboard panel lifted in GE-SET-4.",
  },
  "sending-limits": {
    kind: "lifted",
    reason: "Reputation protection console lifted in GE-SET-4.",
  },
  "sender-pools": {
    kind: "lifted",
    reason: "Sender pools dashboard lifted in GE-SET-4.",
  },
  "mailbox-health": {
    kind: "lifted",
    reason: "Deliverability dashboard lifted in GE-SET-4.",
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
    reason: "Meeting location settings panel lifted in GE-SET-4.",
  },
  "notification-preferences": {
    kind: "canonical",
    reason: "Editor lives at /settings/growth-operator/notifications — single canonical surface.",
  },
  "unsubscribe-settings": {
    kind: "lifted",
    reason: "GrowthComplianceDashboardPanel includes unsubscribe workflows and APIs.",
  },
  "suppression-lists": {
    kind: "lifted",
    reason: "GrowthComplianceDashboardPanel includes suppression table and APIs.",
  },
  "compliance-rules": {
    kind: "lifted",
    reason: "GrowthComplianceDashboardPanel is the compliance rules console.",
  },
  openai: {
    kind: "lifted",
    reason: "GrowthRealtimeProvidersDashboard is the existing OpenAI realtime provider panel.",
  },
  "copilot-preferences": {
    kind: "lifted",
    reason: "GrowthAiCopilotSettingsPanel is persisted in admin communications settings.",
  },
  "share-page-branding": {
    kind: "lifted",
    reason: "GrowthSharePagesDashboard is the admin share page configuration console.",
  },
  "booking-branding": {
    kind: "lifted",
    reason: "GrowthBookingPagesPanel includes booking page branding fields (brandName, colors, assets).",
  },
  "media-defaults": {
    kind: "lifted",
    reason: "GrowthContentLibraryDashboardView is the existing media/content defaults console.",
  },
  "email-signatures": {
    kind: "missing",
    reason: "No signature editor exists — /growth/settings/signatures is placeholder only.",
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
