/**
 * Growth workspace settings bridge targets (GS-GROWTH-SETTINGS-8F, hotfix 8I).
 * Maps legacy /settings/growth-engine/* section IDs to /growth/settings/* paths.
 * Core Workspace Settings renders bridge pages — no automatic cross-shell redirects.
 */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import {
  GROWTH_COMMUNICATIONS_DELIVERABILITY_PATH,
  GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
  GROWTH_COMMUNICATIONS_REPUTATION_PATH,
  GROWTH_COMMUNICATIONS_SENDER_POOLS_PATH,
  GROWTH_COMMUNICATIONS_SENDING_DOMAINS_PATH,
  GROWTH_COMMUNICATIONS_WARMUP_PATH,
} from "@/lib/growth/navigation/growth-communications-settings-navigation"
import { GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH } from "@/lib/growth/navigation/growth-workspace-core-settings-links"

export const GROWTH_WORKSPACE_SETTINGS_CANONICAL_QA_MARKER =
  "growth-workspace-settings-canonical-8i-v1" as const

const GROWTH_SETTINGS_NOTIFICATIONS_PATH = `${GROWTH_WORKSPACE_BASE_PATH}/settings/notifications` as const
const GROWTH_SETTINGS_AI_PREFERENCES_PATH = `${GROWTH_WORKSPACE_BASE_PATH}/settings/ai-preferences` as const
const GROWTH_SETTINGS_CALENDAR_PREFERENCES_PATH =
  `${GROWTH_WORKSPACE_BASE_PATH}/settings/calendar-preferences` as const

/** Growth Engine section ID → canonical Growth workspace settings path (bridge button target). */
export const GROWTH_ENGINE_SECTION_BRIDGE_HREFS: Record<string, string> = {
  "connected-mailboxes": GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
  "sending-domains": GROWTH_COMMUNICATIONS_SENDING_DOMAINS_PATH,
  "dns-verification": GROWTH_COMMUNICATIONS_DELIVERABILITY_PATH,
  warmup: GROWTH_COMMUNICATIONS_WARMUP_PATH,
  "sending-limits": GROWTH_COMMUNICATIONS_REPUTATION_PATH,
  "sender-pools": GROWTH_COMMUNICATIONS_SENDER_POOLS_PATH,
  "mailbox-health": GROWTH_COMMUNICATIONS_DELIVERABILITY_PATH,
  "notification-preferences": GROWTH_SETTINGS_NOTIFICATIONS_PATH,
  "copilot-preferences": GROWTH_SETTINGS_AI_PREFERENCES_PATH,
  "unsubscribe-settings": GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH,
  "suppression-lists": GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH,
  "compliance-rules": GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH,
  "meeting-preferences": GROWTH_SETTINGS_CALENDAR_PREFERENCES_PATH,
  gmail: GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
  "microsoft-365": GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
}

/** @deprecated Use GROWTH_ENGINE_SECTION_BRIDGE_HREFS */
export const GROWTH_ENGINE_SECTION_CANONICAL_REDIRECTS = GROWTH_ENGINE_SECTION_BRIDGE_HREFS

export const GROWTH_ENGINE_SETTINGS_BRIDGE_SECTION_IDS = Object.keys(
  GROWTH_ENGINE_SECTION_BRIDGE_HREFS,
) as (keyof typeof GROWTH_ENGINE_SECTION_BRIDGE_HREFS)[]

const GROWTH_ENGINE_SECTION_BRIDGE_DESCRIPTIONS: Record<string, string> = {
  "connected-mailboxes":
    "Connected mailboxes are now managed in Growth Engine Settings under Communications. Use that workspace to connect Gmail or Microsoft mailboxes, validate OAuth health, start warmup, and monitor sender readiness.",
  gmail:
    "Gmail mailbox connections are managed in Growth Engine Settings under Communications. Connect OAuth, validate health, and monitor sender readiness from that workspace.",
  "microsoft-365":
    "Microsoft 365 mailbox connections are managed in Growth Engine Settings under Communications. Connect OAuth, validate health, and monitor sender readiness from that workspace.",
  "sending-domains":
    "Sending domains are managed in Growth Engine Settings under Communications. Register outbound domains and sender accounts from that workspace.",
  "dns-verification":
    "DNS verification and deliverability checks live in Growth Engine Settings under Communications. Review SPF, DKIM, DMARC, and MX health from that workspace.",
  "mailbox-health":
    "Mailbox health and DNS deliverability signals are tracked in Growth Engine Settings under Communications.",
  warmup:
    "Mailbox warmup schedules, caps, and progression live in Growth Engine Settings under Communications.",
  "sending-limits":
    "Sending limits, reputation protection, and throttle rules are managed in Growth Engine Settings under Communications.",
  "sender-pools":
    "Sender pool rotation and capacity allocation are configured in Growth Engine Settings under Communications.",
  "notification-preferences":
    "Growth operator notification preferences are managed in Growth Engine Settings. Configure outreach, inbox, and activity alerts from that workspace.",
  "copilot-preferences":
    "AI copilot and Aiden guidance preferences are managed in Growth Engine Settings under AI.",
  "unsubscribe-settings":
    "Unsubscribe settings and compliance copy are managed in Growth Engine Settings under Compliance.",
  "suppression-lists":
    "Suppression lists are managed in Growth Engine Settings under Compliance.",
  "compliance-rules":
    "Outreach compliance rules are managed in Growth Engine Settings under Compliance.",
  "meeting-preferences":
    "Meeting and calendar preferences are managed in Growth Engine Settings.",
}

const GROWTH_ENGINE_SECTION_ADMIN_FALLBACK_HREFS: Record<string, string> = {
  "connected-mailboxes": "/admin/growth/infrastructure/mailboxes",
  gmail: "/admin/growth/infrastructure/mailboxes",
  "microsoft-365": "/admin/growth/infrastructure/mailboxes",
  "sending-domains": "/admin/growth/infrastructure",
  "dns-verification": "/admin/growth/infrastructure/deliverability",
  "mailbox-health": "/admin/growth/infrastructure/deliverability",
  warmup: "/admin/growth/infrastructure/warmup",
  "sending-limits": "/admin/growth/deliverability",
  "sender-pools": "/admin/growth/providers/sender-pools",
  "notification-preferences": "/admin/growth/settings/communications",
  "copilot-preferences": "/admin/growth/settings/communications",
  "unsubscribe-settings": "/admin/growth/providers/compliance",
  "suppression-lists": "/admin/growth/providers/compliance",
  "compliance-rules": "/admin/growth/providers/compliance",
  "meeting-preferences": "/admin/growth/settings/communications",
}

export function isGrowthEngineSettingsBridgeSection(sectionId: string): boolean {
  return sectionId in GROWTH_ENGINE_SECTION_BRIDGE_HREFS
}

export function resolveGrowthEngineSettingsBridgeHref(sectionId: string): string | null {
  return GROWTH_ENGINE_SECTION_BRIDGE_HREFS[sectionId] ?? null
}

/** @deprecated Use resolveGrowthEngineSettingsBridgeHref — redirects removed in 8I. */
export function resolveGrowthEngineSettingsCanonicalRedirect(sectionId: string): string | null {
  return resolveGrowthEngineSettingsBridgeHref(sectionId)
}

export function getGrowthEngineSettingsBridgeDescription(sectionId: string, sectionLabel: string): string {
  return (
    GROWTH_ENGINE_SECTION_BRIDGE_DESCRIPTIONS[sectionId] ??
    `${sectionLabel} are now managed in Growth Engine Settings. Open the Growth workspace to configure this surface without leaving your current session unexpectedly.`
  )
}

export function getGrowthEngineSettingsAdminFallbackHref(sectionId: string): string | null {
  return GROWTH_ENGINE_SECTION_ADMIN_FALLBACK_HREFS[sectionId] ?? null
}
