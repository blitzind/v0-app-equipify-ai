/**
 * Growth workspace Communications settings routes (GS-GROWTH-SETTINGS-8C).
 * Client-safe path constants — no server-only imports.
 */

import type { LucideIcon } from "lucide-react"
import { Flame, Globe, Mailbox, ShieldAlert, ShieldCheck, Users } from "lucide-react"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_COMMUNICATIONS_SETTINGS_QA_MARKER = "growth-communications-settings-8d-v1" as const

export const GROWTH_COMMUNICATIONS_SETTINGS_PATH =
  `${GROWTH_WORKSPACE_BASE_PATH}/settings/communications` as const

export const GROWTH_COMMUNICATIONS_MAILBOXES_PATH =
  `${GROWTH_COMMUNICATIONS_SETTINGS_PATH}/mailboxes` as const

export const GROWTH_COMMUNICATIONS_MAILBOXES_ONBOARD_PATH =
  `${GROWTH_COMMUNICATIONS_MAILBOXES_PATH}/onboard` as const

export const GROWTH_COMMUNICATIONS_SENDING_DOMAINS_PATH =
  `${GROWTH_COMMUNICATIONS_SETTINGS_PATH}/sending-domains` as const

export const GROWTH_COMMUNICATIONS_DELIVERABILITY_PATH =
  `${GROWTH_COMMUNICATIONS_SETTINGS_PATH}/deliverability` as const

export const GROWTH_COMMUNICATIONS_WARMUP_PATH =
  `${GROWTH_COMMUNICATIONS_SETTINGS_PATH}/warmup` as const

export const GROWTH_COMMUNICATIONS_SENDER_POOLS_PATH =
  `${GROWTH_COMMUNICATIONS_SETTINGS_PATH}/sender-pools` as const

export const GROWTH_COMMUNICATIONS_REPUTATION_PATH =
  `${GROWTH_COMMUNICATIONS_SETTINGS_PATH}/reputation` as const

/** Canonical operator mailbox hub (replaces legacy delivery anchor). */
export const GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_ANCHOR = "#connected-mailboxes" as const

export const GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_HREF =
  `${GROWTH_COMMUNICATIONS_MAILBOXES_PATH}${GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_ANCHOR}` as const

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
    href: GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
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
    href: GROWTH_COMMUNICATIONS_DELIVERABILITY_PATH,
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
    href: GROWTH_COMMUNICATIONS_REPUTATION_PATH,
    icon: ShieldAlert,
    adminFallbackHref: "/admin/growth/deliverability",
  },
]

export function isGrowthCommunicationsSettingsPath(pathname: string): boolean {
  return pathname === GROWTH_COMMUNICATIONS_SETTINGS_PATH || pathname.startsWith(`${GROWTH_COMMUNICATIONS_SETTINGS_PATH}/`)
}

export function growthCommunicationsWarmupHref(senderId?: string): string {
  if (!senderId) return GROWTH_COMMUNICATIONS_WARMUP_PATH
  return `${GROWTH_COMMUNICATIONS_WARMUP_PATH}?sender=${encodeURIComponent(senderId)}`
}
