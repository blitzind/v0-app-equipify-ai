/**
 * Growth Engine customer settings canonical routes (GS-GROWTH-SETTINGS-8K).
 *
 * Canonical customer settings shell: `/settings/growth-engine/*` (Workspace Settings).
 * Compatibility routes under `/growth/settings/*` remain for deep links and Growth workspace shell.
 */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import { GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH } from "@/lib/growth/navigation/growth-workspace-core-settings-links"

export const GROWTH_WORKSPACE_SETTINGS_CANONICAL_QA_MARKER =
  "growth-workspace-settings-canonical-8k-v1" as const

/** Canonical customer Growth Engine settings base (Workspace Settings shell). */
export const GROWTH_ENGINE_CUSTOMER_SETTINGS_BASE = "/settings/growth-engine" as const

const GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE =
  `${GROWTH_WORKSPACE_BASE_PATH}/settings/communications` as const
const GROWTH_SETTINGS_NOTIFICATIONS_PATH = `${GROWTH_WORKSPACE_BASE_PATH}/settings/notifications` as const
const GROWTH_SETTINGS_AI_PREFERENCES_PATH = `${GROWTH_WORKSPACE_BASE_PATH}/settings/ai-preferences` as const
const GROWTH_SETTINGS_CALENDAR_PREFERENCES_PATH =
  `${GROWTH_WORKSPACE_BASE_PATH}/settings/calendar-preferences` as const

/** Lifted customer settings sections rendered in Workspace Settings (not bridge). */
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

export function growthEngineCustomerSettingsHref(sectionId: string): string {
  return `${GROWTH_ENGINE_CUSTOMER_SETTINGS_BASE}/${sectionId}`
}

export function isGrowthEngineCustomerSettingsSection(sectionId: string): boolean {
  return (GROWTH_ENGINE_CUSTOMER_SETTINGS_SECTION_IDS as readonly string[]).includes(sectionId)
}

/** Compatibility — Growth workspace shell paths (Option A: keep working, do not prefer in new nav). */
export const GROWTH_ENGINE_LEGACY_GROWTH_WORKSPACE_HREFS: Record<string, string> = {
  "connected-mailboxes": `${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/mailboxes`,
  "sending-domains": `${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/sending-domains`,
  "dns-verification": `${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/deliverability`,
  warmup: `${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/warmup`,
  "sending-limits": `${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/reputation`,
  "sender-pools": `${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/sender-pools`,
  "mailbox-health": `${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/deliverability`,
  "notification-preferences": GROWTH_SETTINGS_NOTIFICATIONS_PATH,
  "copilot-preferences": GROWTH_SETTINGS_AI_PREFERENCES_PATH,
  "unsubscribe-settings": GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH,
  "suppression-lists": GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH,
  "compliance-rules": GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH,
  "meeting-preferences": GROWTH_SETTINGS_CALENDAR_PREFERENCES_PATH,
  gmail: `${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/mailboxes`,
  "microsoft-365": `${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/mailboxes`,
  "email-signatures": `${GROWTH_WORKSPACE_BASE_PATH}/settings/signatures`,
}

/** @deprecated 8K — customer canonical is `/settings/growth-engine/*`. */
export const GROWTH_ENGINE_SECTION_BRIDGE_HREFS = GROWTH_ENGINE_LEGACY_GROWTH_WORKSPACE_HREFS

/** @deprecated */
export const GROWTH_ENGINE_SECTION_CANONICAL_REDIRECTS = GROWTH_ENGINE_LEGACY_GROWTH_WORKSPACE_HREFS

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

/** Growth workspace compatibility path → Workspace Settings growth-engine section. */
export const GROWTH_SETTINGS_PATH_TO_BRIDGE_SECTION_ID: Record<string, string> = {
  [`${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/mailboxes`]: "connected-mailboxes",
  [`${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/sending-domains`]: "sending-domains",
  [`${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/deliverability`]: "dns-verification",
  [`${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/warmup`]: "warmup",
  [`${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/sender-pools`]: "sender-pools",
  [`${GROWTH_SETTINGS_LEGACY_COMMUNICATIONS_BASE}/reputation`]: "sending-limits",
  [GROWTH_SETTINGS_NOTIFICATIONS_PATH]: "notification-preferences",
  [GROWTH_SETTINGS_AI_PREFERENCES_PATH]: "copilot-preferences",
  [GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH]: "compliance-rules",
  [GROWTH_SETTINGS_CALENDAR_PREFERENCES_PATH]: "meeting-preferences",
}

/** @deprecated 8K — bridged sections render lifted panels in Workspace Settings. */
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
  return GROWTH_ENGINE_LEGACY_GROWTH_WORKSPACE_HREFS[sectionId] ?? null
}

export function getGrowthEngineSettingsAdminFallbackHref(sectionId: string): string | null {
  return GROWTH_ENGINE_SECTION_ADMIN_FALLBACK_HREFS[sectionId] ?? null
}

export function resolveWorkspaceSettingsBridgeHrefFromGrowthPath(pathname: string): string {
  const normalized = pathname.split("?")[0]?.split("#")[0] ?? ""
  for (const [growthPath, sectionId] of Object.entries(GROWTH_SETTINGS_PATH_TO_BRIDGE_SECTION_ID)) {
    if (normalized === growthPath || normalized.startsWith(`${growthPath}/`)) {
      return growthEngineCustomerSettingsHref(sectionId)
    }
  }
  return GROWTH_ENGINE_CUSTOMER_SETTINGS_BASE
}
