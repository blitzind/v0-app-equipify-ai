/**
 * Workspace Settings — Growth Engine section lift classification (Phase GE-SET-5).
 *
 * Client-safe manifest — no panel component imports.
 */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import { GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH } from "@/lib/growth/navigation/growth-workspace-core-settings-links"

const GROWTH_SETTINGS_NOTIFICATIONS_PATH = `${GROWTH_WORKSPACE_BASE_PATH}/settings/notifications` as const
const GROWTH_SETTINGS_AI_PREFERENCES_PATH = `${GROWTH_WORKSPACE_BASE_PATH}/settings/ai-preferences` as const

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFT_QA_MARKER =
  "workspace-settings-growth-engine-lift-ge-set-5-v1" as const

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
  [WORKSPACE_SETTINGS_GROWTH_ENGINE_CANONICAL_SECTION_ID]: GROWTH_SETTINGS_NOTIFICATIONS_PATH,
  "copilot-preferences": GROWTH_SETTINGS_AI_PREFERENCES_PATH,
  "unsubscribe-settings": GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH,
  "suppression-lists": GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH,
  "compliance-rules": GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH,
}

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFTED_SECTION_IDS = [
  "inbox-routing",
  "calling-providers",
  "phone-numbers",
  "dialer-settings",
  "call-routing",
  "voicemail",
  "calendar-providers",
  "booking-pages",
  "openai",
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
  "inbox-routing": "GrowthCommunicationSettingsPanel",
  "calling-providers": "GrowthRealtimeProvidersDashboard",
  "phone-numbers": "GrowthVoiceInfrastructureSettingsPanel",
  "dialer-settings": "GrowthNativeDialerSettingsPanel",
  "call-routing": "GrowthVoiceInfrastructureSettingsPanel",
  voicemail: "GrowthVoiceInfrastructureSettingsPanel",
  "calendar-providers": "GrowthGoogleCalendarSettingsPanel",
  "booking-pages": "GrowthBookingPagesPanel",
  openai: "GrowthRealtimeProvidersDashboard",
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
    kind: "bridged",
    reason: "Canonical editor lives in Growth workspace Communications → Mailboxes (8I bridge).",
  },
  gmail: {
    kind: "bridged",
    reason: "Mailbox provider connections canonical in Growth workspace Communications (8I bridge).",
  },
  "microsoft-365": {
    kind: "bridged",
    reason: "Mailbox provider connections canonical in Growth workspace Communications (8I bridge).",
  },
  "inbox-routing": {
    kind: "lifted",
    reason: "Communication preferences panel lifted in GE-SET-4.",
  },
  "sending-domains": {
    kind: "bridged",
    reason: "Sender infrastructure canonical in Growth workspace Communications (8I bridge).",
  },
  "dns-verification": {
    kind: "bridged",
    reason: "Deliverability DNS canonical in Growth workspace Communications (8I bridge).",
  },
  warmup: {
    kind: "bridged",
    reason: "Warmup dashboard canonical in Growth workspace Communications (8I bridge).",
  },
  "sending-limits": {
    kind: "bridged",
    reason: "Reputation protection canonical in Growth workspace Communications (8I bridge).",
  },
  "sender-pools": {
    kind: "bridged",
    reason: "Sender pools canonical in Growth workspace Communications (8I bridge).",
  },
  "mailbox-health": {
    kind: "bridged",
    reason: "Mailbox health canonical in Growth workspace Communications (8I bridge).",
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
    kind: "bridged",
    reason: "Meeting preferences canonical in Growth workspace settings (8I bridge).",
  },
  "notification-preferences": {
    kind: "bridged",
    reason: "Editor lives at /growth/settings/notifications — bridge from Core settings shell (8I).",
  },
  "unsubscribe-settings": {
    kind: "bridged",
    reason: "Compliance editor canonical in Growth workspace settings (8I bridge).",
  },
  "suppression-lists": {
    kind: "bridged",
    reason: "Compliance editor canonical in Growth workspace settings (8I bridge).",
  },
  "compliance-rules": {
    kind: "bridged",
    reason: "Compliance editor canonical in Growth workspace settings (8I bridge).",
  },
  openai: {
    kind: "lifted",
    reason: "GrowthRealtimeProvidersDashboard is the existing OpenAI realtime provider panel.",
  },
  "copilot-preferences": {
    kind: "bridged",
    reason: "AI copilot preferences canonical in Growth workspace settings (8I bridge).",
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
