/**
 * Growth Engine customer settings canonical routes.
 *
 * Canonical customer settings shell: `/growth/settings/*`.
 * Legacy `/settings/growth-engine/*` routes redirect here.
 */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import {
  GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH,
  GROWTH_COMMUNICATIONS_DNS_VERIFICATION_PATH,
  GROWTH_COMMUNICATIONS_SENDER_POOLS_PATH,
  GROWTH_COMMUNICATIONS_SENDING_DOMAINS_PATH,
  GROWTH_COMMUNICATIONS_SENDING_LIMITS_PATH,
  GROWTH_COMMUNICATIONS_WARMUP_PATH,
} from "@/lib/growth/navigation/growth-communications-settings-navigation"
import { GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH } from "@/lib/growth/navigation/growth-workspace-core-settings-links"

export const GROWTH_WORKSPACE_SETTINGS_CANONICAL_QA_MARKER =
  "growth-workspace-settings-canonical-9a-v1" as const

/** Legacy Workspace Settings entry point — redirects to Growth settings. */
export const GROWTH_ENGINE_CUSTOMER_SETTINGS_BASE = "/settings/growth-engine" as const

const GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE =
  `${GROWTH_WORKSPACE_BASE_PATH}/settings/communications` as const
const GROWTH_SETTINGS_NOTIFICATIONS_PATH = `${GROWTH_WORKSPACE_BASE_PATH}/settings/notifications` as const
const GROWTH_SETTINGS_AI_PREFERENCES_PATH = `${GROWTH_WORKSPACE_BASE_PATH}/settings/ai-preferences` as const
const GROWTH_SETTINGS_CALENDAR_PREFERENCES_PATH =
  `${GROWTH_WORKSPACE_BASE_PATH}/settings/calendar-preferences` as const
const GROWTH_SETTINGS_COMMAND_CENTER_PREFERENCES_PATH =
  `${GROWTH_WORKSPACE_BASE_PATH}/settings/command-center-preferences` as const
const GROWTH_SETTINGS_HUB_PATH = `${GROWTH_WORKSPACE_BASE_PATH}/settings` as const

/** Lifted customer settings sections rendered in Growth workspace settings. */
export const GROWTH_ENGINE_CUSTOMER_SETTINGS_SECTION_IDS = [
  "connected-mailboxes",
  "sending-domains",
  "dns-verification",
  "warmup",
  "sending-limits",
  "sender-pools",
  "mailbox-health",
  "notification-preferences",
  "copilot-preferences",
  "unsubscribe-settings",
  "suppression-lists",
  "compliance-rules",
  "meeting-preferences",
  "gmail",
  "microsoft-365",
  "email-signatures",
] as const

export type GrowthEngineCustomerSettingsSectionId =
  (typeof GROWTH_ENGINE_CUSTOMER_SETTINGS_SECTION_IDS)[number]

/** Canonical Growth workspace settings hrefs keyed by growth-engine section id. */
export const GROWTH_ENGINE_GROWTH_SETTINGS_HREFS: Record<string, string> = {
  "connected-mailboxes": GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH,
  "sending-domains": GROWTH_COMMUNICATIONS_SENDING_DOMAINS_PATH,
  "dns-verification": GROWTH_COMMUNICATIONS_DNS_VERIFICATION_PATH,
  warmup: GROWTH_COMMUNICATIONS_WARMUP_PATH,
  "sending-limits": GROWTH_COMMUNICATIONS_SENDING_LIMITS_PATH,
  "sender-pools": GROWTH_COMMUNICATIONS_SENDER_POOLS_PATH,
  "mailbox-health": GROWTH_COMMUNICATIONS_DNS_VERIFICATION_PATH,
  gmail: GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH,
  "microsoft-365": GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH,
  "email-signatures": `${GROWTH_WORKSPACE_BASE_PATH}/settings/signatures`,
  "inbox-routing": GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE,
  "notification-preferences": GROWTH_SETTINGS_NOTIFICATIONS_PATH,
  "copilot-preferences": GROWTH_SETTINGS_AI_PREFERENCES_PATH,
  "meeting-preferences": GROWTH_SETTINGS_CALENDAR_PREFERENCES_PATH,
  "unsubscribe-settings": GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH,
  "suppression-lists": GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH,
  "compliance-rules": GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH,
  "calling-providers": `${GROWTH_WORKSPACE_BASE_PATH}/settings/calling-preferences`,
  "phone-numbers": `${GROWTH_WORKSPACE_BASE_PATH}/settings/calling-preferences`,
  "dialer-settings": `${GROWTH_WORKSPACE_BASE_PATH}/settings/calling-preferences`,
  "call-routing": `${GROWTH_WORKSPACE_BASE_PATH}/settings/calling-preferences`,
  voicemail: `${GROWTH_WORKSPACE_BASE_PATH}/settings/calling-preferences`,
  "calendar-providers": `${GROWTH_WORKSPACE_BASE_PATH}/settings/calendar`,
  "booking-pages": `${GROWTH_WORKSPACE_BASE_PATH}/settings/calendar`,
  openai: `${GROWTH_WORKSPACE_BASE_PATH}/settings/ai-preferences`,
  "share-page-branding": GROWTH_SETTINGS_HUB_PATH,
  "media-library": GROWTH_SETTINGS_HUB_PATH,
  "booking-branding": `${GROWTH_WORKSPACE_BASE_PATH}/settings/calendar`,
  "media-defaults": GROWTH_SETTINGS_HUB_PATH,
  "automation-defaults": `${GROWTH_WORKSPACE_BASE_PATH}/settings/autonomy`,
  "command-center-preferences": GROWTH_SETTINGS_COMMAND_CENTER_PREFERENCES_PATH,
  elevenlabs: `${GROWTH_WORKSPACE_BASE_PATH}/settings/ai-preferences`,
  retell: `${GROWTH_WORKSPACE_BASE_PATH}/settings/ai-preferences`,
  "media-ai-providers": `${GROWTH_WORKSPACE_BASE_PATH}/settings/ai-preferences`,
}

export function growthEngineCustomerSettingsHref(sectionId: string): string {
  return GROWTH_ENGINE_GROWTH_SETTINGS_HREFS[sectionId] ?? GROWTH_SETTINGS_HUB_PATH
}

export function isGrowthEngineCustomerSettingsSection(sectionId: string): boolean {
  return (GROWTH_ENGINE_CUSTOMER_SETTINGS_SECTION_IDS as readonly string[]).includes(sectionId)
}

/** @deprecated Use growthEngineCustomerSettingsHref */
export const GROWTH_ENGINE_LEGACY_GROWTH_WORKSPACE_HREFS = GROWTH_ENGINE_GROWTH_SETTINGS_HREFS

/** @deprecated */
export const GROWTH_ENGINE_SECTION_BRIDGE_HREFS = GROWTH_ENGINE_GROWTH_SETTINGS_HREFS

/** @deprecated */
export const GROWTH_ENGINE_SECTION_CANONICAL_REDIRECTS = GROWTH_ENGINE_GROWTH_SETTINGS_HREFS

/** @deprecated */
export const GROWTH_ENGINE_SETTINGS_BRIDGE_SECTION_IDS = [...GROWTH_ENGINE_CUSTOMER_SETTINGS_SECTION_IDS]

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

/** Growth workspace compatibility path → growth-engine section id. */
export const GROWTH_SETTINGS_PATH_TO_BRIDGE_SECTION_ID: Record<string, string> = {
  [GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH]: "connected-mailboxes",
  [`${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/mailboxes`]: "connected-mailboxes",
  [`${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/sending-domains`]: "sending-domains",
  [GROWTH_COMMUNICATIONS_DNS_VERIFICATION_PATH]: "dns-verification",
  [`${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/deliverability`]: "dns-verification",
  [GROWTH_COMMUNICATIONS_WARMUP_PATH]: "warmup",
  [GROWTH_COMMUNICATIONS_SENDER_POOLS_PATH]: "sender-pools",
  [GROWTH_COMMUNICATIONS_SENDING_LIMITS_PATH]: "sending-limits",
  [`${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/reputation`]: "sending-limits",
  [GROWTH_SETTINGS_NOTIFICATIONS_PATH]: "notification-preferences",
  [GROWTH_SETTINGS_AI_PREFERENCES_PATH]: "copilot-preferences",
  [GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH]: "compliance-rules",
  [GROWTH_SETTINGS_CALENDAR_PREFERENCES_PATH]: "meeting-preferences",
}

/** @deprecated 8K — bridged sections render in Growth workspace settings. */
export function isGrowthEngineSettingsBridgeSection(sectionId: string): boolean {
  return false
}

/** @deprecated Use growthEngineCustomerSettingsHref */
export function resolveGrowthEngineSettingsBridgeHref(sectionId: string): string | null {
  return isGrowthEngineCustomerSettingsSection(sectionId)
    ? growthEngineCustomerSettingsHref(sectionId)
    : null
}

/** @deprecated */
export function resolveGrowthEngineSettingsCanonicalRedirect(sectionId: string): string | null {
  return GROWTH_ENGINE_GROWTH_SETTINGS_HREFS[sectionId] ?? null
}

export function getGrowthEngineSettingsAdminFallbackHref(sectionId: string): string | null {
  return GROWTH_ENGINE_SECTION_ADMIN_FALLBACK_HREFS[sectionId] ?? null
}

export function resolveWorkspaceSettingsBridgeHrefFromGrowthPath(pathname: string): string {
  return GROWTH_SETTINGS_HUB_PATH
}
