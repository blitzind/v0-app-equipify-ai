/**
 * Growth workspace Communications settings routes.
 * Canonical customer paths: `/growth/settings/communications/*`.
 */

import type { LucideIcon } from "lucide-react"
import { Flame, Globe, Mailbox, ShieldAlert, ShieldCheck, Users } from "lucide-react"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_COMMUNICATIONS_SETTINGS_QA_MARKER = "growth-communications-settings-8k-v2" as const

export const GROWTH_COMMUNICATIONS_SETTINGS_NAV_QA_MARKER = "growth-communications-settings-nav-1a-v1" as const

export type GrowthCommunicationsSettingsNavItemId =
  | "communications"
  | "mailboxes"
  | "sending-domains"
  | "deliverability"
  | "warmup"
  | "sender-pools"
  | "reputation"

export const GROWTH_COMMUNICATIONS_SETTINGS_PATH =
  `${GROWTH_WORKSPACE_BASE_PATH}/settings/communications` as const

export const GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH =
  `${GROWTH_COMMUNICATIONS_SETTINGS_PATH}/connected-mailboxes` as const

export const GROWTH_COMMUNICATIONS_MAILBOXES_ONBOARD_PATH =
  `${GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH}/onboard` as const

export const GROWTH_COMMUNICATIONS_SENDING_DOMAINS_PATH =
  `${GROWTH_COMMUNICATIONS_SETTINGS_PATH}/sending-domains` as const

export const GROWTH_COMMUNICATIONS_DNS_VERIFICATION_PATH =
  `${GROWTH_COMMUNICATIONS_SETTINGS_PATH}/dns-verification` as const

export const GROWTH_COMMUNICATIONS_WARMUP_PATH =
  `${GROWTH_COMMUNICATIONS_SETTINGS_PATH}/warmup` as const

export const GROWTH_COMMUNICATIONS_SENDER_POOLS_PATH =
  `${GROWTH_COMMUNICATIONS_SETTINGS_PATH}/sender-pools` as const

export const GROWTH_COMMUNICATIONS_SENDING_LIMITS_PATH =
  `${GROWTH_COMMUNICATIONS_SETTINGS_PATH}/sending-limits` as const

/** Legacy slug compatibility paths — redirect to canonical routes. */
export const GROWTH_COMMUNICATIONS_MAILBOXES_LEGACY_PATH =
  `${GROWTH_COMMUNICATIONS_SETTINGS_PATH}/mailboxes` as const

export const GROWTH_COMMUNICATIONS_DELIVERABILITY_LEGACY_PATH =
  `${GROWTH_COMMUNICATIONS_SETTINGS_PATH}/deliverability` as const

export const GROWTH_COMMUNICATIONS_REPUTATION_LEGACY_PATH =
  `${GROWTH_COMMUNICATIONS_SETTINGS_PATH}/reputation` as const

/** @deprecated Use GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH */
export const GROWTH_COMMUNICATIONS_MAILBOXES_PATH = GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH

/** @deprecated Use GROWTH_COMMUNICATIONS_DNS_VERIFICATION_PATH */
export const GROWTH_COMMUNICATIONS_DELIVERABILITY_PATH = GROWTH_COMMUNICATIONS_DNS_VERIFICATION_PATH

/** @deprecated Use GROWTH_COMMUNICATIONS_SENDING_LIMITS_PATH */
export const GROWTH_COMMUNICATIONS_REPUTATION_PATH = GROWTH_COMMUNICATIONS_SENDING_LIMITS_PATH

/** Canonical operator mailbox hub anchor. */
export const GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_ANCHOR = "#connected-mailboxes" as const

export const GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_HREF =
  `${GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH}${GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_ANCHOR}` as const

export type GrowthCommunicationsSettingsCard = {
  id: string
  title: string
  description: string
  href: string
  icon: LucideIcon
  adminFallbackHref?: string
}

export const GROWTH_COMMUNICATIONS_SETTINGS_CARDS: GrowthCommunicationsSettingsCard[] = [
  {
    id: "mailboxes",
    title: "Mailboxes",
    description: "Connect Gmail or Microsoft mailboxes for outbound and inbox tracking.",
    href: GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH,
    icon: Mailbox,
    adminFallbackHref: "/admin/growth/infrastructure/mailboxes",
  },
  {
    id: "sending-domains",
    title: "Sending Domains",
    description: "Add domains used for outbound email.",
    href: GROWTH_COMMUNICATIONS_SENDING_DOMAINS_PATH,
    icon: Globe,
    adminFallbackHref: "/admin/growth/infrastructure",
  },
  {
    id: "deliverability",
    title: "Deliverability & DNS",
    description: "Verify SPF, DKIM, DMARC, MX, and domain health.",
    href: GROWTH_COMMUNICATIONS_DNS_VERIFICATION_PATH,
    icon: ShieldCheck,
    adminFallbackHref: "/admin/growth/infrastructure/deliverability",
  },
  {
    id: "warmup",
    title: "Warmup",
    description:
      "Ramp sending safely using native sequence sends, caps, pre-send guards, and reputation tracking.",
    href: GROWTH_COMMUNICATIONS_WARMUP_PATH,
    icon: Flame,
    adminFallbackHref: "/admin/growth/infrastructure/warmup",
  },
  {
    id: "sender-pools",
    title: "Sender Pools",
    description: "Group senders for campaign rotation and limits.",
    href: GROWTH_COMMUNICATIONS_SENDER_POOLS_PATH,
    icon: Users,
    adminFallbackHref: "/admin/growth/providers/sender-pools",
  },
  {
    id: "reputation",
    title: "Reputation",
    description: "Monitor bounce rate, reply rate, complaints, warmup score, and sender/domain risk.",
    href: GROWTH_COMMUNICATIONS_SENDING_LIMITS_PATH,
    icon: ShieldAlert,
    adminFallbackHref: "/admin/growth/deliverability",
  },
]

export function isGrowthCommunicationsSettingsPath(pathname: string): boolean {
  return pathname === GROWTH_COMMUNICATIONS_SETTINGS_PATH || pathname.startsWith(`${GROWTH_COMMUNICATIONS_SETTINGS_PATH}/`)
}

function normalizeGrowthCommunicationsSettingsPathname(pathname: string): string {
  return pathname.split("?")[0]?.split("#")[0] ?? ""
}

const GROWTH_COMMUNICATIONS_SETTINGS_NAV_PATHS: Record<
  Exclude<GrowthCommunicationsSettingsNavItemId, "communications">,
  readonly string[]
> = {
  mailboxes: [GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH, GROWTH_COMMUNICATIONS_MAILBOXES_LEGACY_PATH],
  "sending-domains": [GROWTH_COMMUNICATIONS_SENDING_DOMAINS_PATH],
  deliverability: [GROWTH_COMMUNICATIONS_DNS_VERIFICATION_PATH, GROWTH_COMMUNICATIONS_DELIVERABILITY_LEGACY_PATH],
  warmup: [GROWTH_COMMUNICATIONS_WARMUP_PATH],
  "sender-pools": [GROWTH_COMMUNICATIONS_SENDER_POOLS_PATH],
  reputation: [GROWTH_COMMUNICATIONS_SENDING_LIMITS_PATH, GROWTH_COMMUNICATIONS_REPUTATION_LEGACY_PATH],
}

export function resolveGrowthCommunicationsSettingsActiveNavItemId(
  pathname: string,
): GrowthCommunicationsSettingsNavItemId | null {
  const normalized = normalizeGrowthCommunicationsSettingsPathname(pathname)
  if (!isGrowthCommunicationsSettingsPath(normalized)) return null
  if (normalized === GROWTH_COMMUNICATIONS_SETTINGS_PATH) return "communications"

  for (const [itemId, prefixes] of Object.entries(GROWTH_COMMUNICATIONS_SETTINGS_NAV_PATHS) as Array<
    [Exclude<GrowthCommunicationsSettingsNavItemId, "communications">, readonly string[]]
  >) {
    for (const prefix of prefixes) {
      if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
        return itemId
      }
    }
  }

  return null
}

export function isGrowthCommunicationsSettingsNavItemActive(pathname: string, itemId: string): boolean {
  return resolveGrowthCommunicationsSettingsActiveNavItemId(pathname) === itemId
}

export function growthCommunicationsWarmupHref(senderId?: string): string {
  if (!senderId) return GROWTH_COMMUNICATIONS_WARMUP_PATH
  return `${GROWTH_COMMUNICATIONS_WARMUP_PATH}?sender=${encodeURIComponent(senderId)}`
}

export function resolveGrowthCommunicationsLegacyRedirect(pathname: string): string | null {
  const normalized = pathname.split("?")[0]?.split("#")[0] ?? ""
  if (normalized === GROWTH_COMMUNICATIONS_MAILBOXES_LEGACY_PATH || normalized.startsWith(`${GROWTH_COMMUNICATIONS_MAILBOXES_LEGACY_PATH}/`)) {
    return normalized.replace(GROWTH_COMMUNICATIONS_MAILBOXES_LEGACY_PATH, GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH)
  }
  if (normalized === GROWTH_COMMUNICATIONS_DELIVERABILITY_LEGACY_PATH) {
    return GROWTH_COMMUNICATIONS_DNS_VERIFICATION_PATH
  }
  if (normalized === GROWTH_COMMUNICATIONS_REPUTATION_LEGACY_PATH) {
    return GROWTH_COMMUNICATIONS_SENDING_LIMITS_PATH
  }
  return null
}
