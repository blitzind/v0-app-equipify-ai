/**
 * Canonical Growth workspace settings redirects (GS-GROWTH-SETTINGS-8F).
 * Maps legacy /settings/growth-engine/* section IDs to /growth/settings/* paths.
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
  "growth-workspace-settings-canonical-8f-v1" as const

const GROWTH_SETTINGS_NOTIFICATIONS_PATH = `${GROWTH_WORKSPACE_BASE_PATH}/settings/notifications` as const
const GROWTH_SETTINGS_AI_PREFERENCES_PATH = `${GROWTH_WORKSPACE_BASE_PATH}/settings/ai-preferences` as const
const GROWTH_SETTINGS_CALENDAR_PREFERENCES_PATH =
  `${GROWTH_WORKSPACE_BASE_PATH}/settings/calendar-preferences` as const

/** Growth Engine section ID → canonical Growth workspace settings path. */
export const GROWTH_ENGINE_SECTION_CANONICAL_REDIRECTS: Record<string, string> = {
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

export function resolveGrowthEngineSettingsCanonicalRedirect(sectionId: string): string | null {
  return GROWTH_ENGINE_SECTION_CANONICAL_REDIRECTS[sectionId] ?? null
}
