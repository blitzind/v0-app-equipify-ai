/**
 * Growth workspace settings navigation manifest (GS-GROWTH-SETTINGS-8F canonical IA).
 */

import type { LucideIcon } from "lucide-react"
import {
  Bell,
  Bot,
  Chrome,
  Command,
  Eye,
  Flame,
  Gauge,
  Globe,
  LayoutTemplate,
  Mail,
  Mailbox,
  PanelLeft,
  Phone,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Signature,
  SlidersHorizontal,
  Sparkles,
  Truck,
  User,
  Users,
} from "lucide-react"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import {
  GROWTH_COMMUNICATIONS_SETTINGS_PATH,
  isGrowthCommunicationsSettingsPath,
} from "@/lib/growth/navigation/growth-communications-settings-navigation"
import {
  growthEngineCustomerSettingsHref,
  GROWTH_ENGINE_CUSTOMER_SETTINGS_BASE,
} from "@/lib/growth/navigation/growth-workspace-settings-canonical"
import {
  GROWTH_WORKSPACE_SETTINGS_ADVANCED_PATH,
  GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH,
} from "@/lib/growth/navigation/growth-workspace-core-settings-links"

export const GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER = "growth-workspace-settings-nav-1a-v1" as const

export const GROWTH_WORKSPACE_SETTINGS_DEFAULT_SECTION_ID = "profile" as const

export type GrowthSettingsNavItem = {
  id: string
  label: string
  description: string
  href: string
  icon: LucideIcon
  adminFallbackHref?: string
  adminFallbackLabel?: string
}

export type GrowthSettingsNavGroup = {
  id: string
  label: string
  items: GrowthSettingsNavItem[]
}

type GrowthSettingsNavManifestEntry = {
  id: string
  label: string
  description: string
  segment: string
  icon: LucideIcon
  adminFallbackSuffix?: string
  adminFallbackLabel?: string
  href?: string
}

type GrowthSettingsNavManifestGroup = {
  id: string
  label: string
  items: GrowthSettingsNavManifestEntry[]
}

const ADMIN_GROWTH_SETTINGS = "/admin/growth/settings"

const GROWTH_WORKSPACE_SETTINGS_NAV_MANIFEST: GrowthSettingsNavManifestGroup[] = [
  {
    id: "general",
    label: "General",
    items: [
      {
        id: "profile",
        label: "Profile",
        description: "Operator identity and display preferences for the Growth workspace.",
        segment: "profile",
        icon: User,
      },
      {
        id: "notifications",
        label: "Notifications",
        description: "Outreach, inbox, campaign, and operator activity alerts.",
        segment: "notifications",
        icon: Bell,
      },
      {
        id: "personal-preferences",
        label: "Personal Preferences",
        description: "Personal defaults that follow you across Growth workspaces.",
        segment: "personal-preferences",
        icon: SlidersHorizontal,
        adminFallbackSuffix: "growth",
        adminFallbackLabel: "Growth settings (admin)",
      },
      {
        id: "sidebar-preferences",
        label: "Sidebar Preferences",
        description: "Collapse behavior and section defaults for the Growth sidebar.",
        segment: "sidebar-preferences",
        icon: PanelLeft,
      },
      {
        id: "default-views",
        label: "Default Views",
        description: "Landing views and default filters when opening Growth destinations.",
        segment: "default-views",
        icon: Eye,
      },
    ],
  },
  {
    id: "communications",
    label: "Communications",
    items: [
      {
        id: "communications",
        label: "Communications",
        description: "Overview of mailboxes, DNS, warmup, pools, and reputation settings.",
        segment: "communications",
        icon: Truck,
        href: growthEngineCustomerSettingsHref("connected-mailboxes"),
      },
      {
        id: "mailboxes",
        label: "Mailboxes",
        description: "Connect Gmail or Microsoft mailboxes for outbound and inbox tracking.",
        segment: "communications/mailboxes",
        icon: Mailbox,
        href: growthEngineCustomerSettingsHref("connected-mailboxes"),
        adminFallbackSuffix: "communications",
        adminFallbackLabel: "Communications settings (admin)",
      },
      {
        id: "sending-domains",
        label: "Sending Domains",
        description: "Add domains used for outbound email.",
        segment: "communications/sending-domains",
        icon: Globe,
        href: growthEngineCustomerSettingsHref("sending-domains"),
      },
      {
        id: "deliverability",
        label: "Deliverability & DNS",
        description: "Verify SPF, DKIM, DMARC, MX, and domain health.",
        segment: "communications/deliverability",
        icon: ShieldCheck,
        href: growthEngineCustomerSettingsHref("dns-verification"),
      },
      {
        id: "warmup",
        label: "Warmup",
        description: "Ramp sending safely using native sequence sends, caps, and reputation tracking.",
        segment: "communications/warmup",
        icon: Flame,
        href: growthEngineCustomerSettingsHref("warmup"),
      },
      {
        id: "sender-pools",
        label: "Sender Pools",
        description: "Group senders for campaign rotation and limits.",
        segment: "communications/sender-pools",
        icon: Users,
        href: growthEngineCustomerSettingsHref("sender-pools"),
      },
      {
        id: "reputation",
        label: "Reputation",
        description: "Monitor bounce rate, reply rate, complaints, and sender/domain risk.",
        segment: "communications/reputation",
        icon: ShieldAlert,
        href: growthEngineCustomerSettingsHref("sending-limits"),
      },
    ],
  },
  {
    id: "ai",
    label: "AI",
    items: [
      {
        id: "ai-teammate",
        label: "AI Teammate",
        description: "Name and identity for your AI Revenue Operator inside AI OS.",
        segment: "ai-teammate",
        icon: Sparkles,
      },
      {
        id: "ai-preferences",
        label: "AI Preferences",
        description: "Aiden guidance, copilot tone, and AI assist defaults for operators.",
        segment: "ai-preferences",
        icon: Bot,
        adminFallbackSuffix: "communications",
        adminFallbackLabel: "Communications settings (admin)",
      },
      {
        id: "autonomy",
        label: "Growth Autonomy",
        description: "Graduated autonomy levels, capability toggles, budgets, and kill switches.",
        segment: "autonomy",
        icon: Gauge,
      },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    items: [
      {
        id: "compliance",
        label: "Compliance",
        description: "Unsubscribe settings, suppression lists, and outreach compliance rules.",
        segment: "compliance",
        icon: Shield,
        href: GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH,
        adminFallbackSuffix: "communications",
        adminFallbackLabel: "Communications settings (admin)",
      },
    ],
  },
  {
    id: "advanced",
    label: "Advanced",
    items: [
      {
        id: "advanced",
        label: "Advanced",
        description: "Command center, browser notifications, and settings still migrating into Growth.",
        segment: "advanced",
        icon: Command,
        href: GROWTH_WORKSPACE_SETTINGS_ADVANCED_PATH,
      },
    ],
  },
]

function resolveSettingsHref(segment: string): string {
  return `${GROWTH_WORKSPACE_BASE_PATH}/settings/${segment}`
}

function resolveAdminFallbackHref(suffix?: string): string | undefined {
  if (!suffix) return undefined
  return `${ADMIN_GROWTH_SETTINGS}/${suffix}`
}

export function buildGrowthWorkspaceSettingsNavGroups(): GrowthSettingsNavGroup[] {
  return GROWTH_WORKSPACE_SETTINGS_NAV_MANIFEST.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.items.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      href: item.href ?? resolveSettingsHref(item.segment),
      icon: item.icon,
      adminFallbackHref: resolveAdminFallbackHref(item.adminFallbackSuffix),
      adminFallbackLabel: item.adminFallbackLabel,
    })),
  }))
}

export const GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS: GrowthSettingsNavGroup[] =
  buildGrowthWorkspaceSettingsNavGroups()

export function listGrowthWorkspaceSettingsSectionIds(): string[] {
  return GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.id))
}

export function getGrowthWorkspaceSettingsSectionById(id: string): GrowthSettingsNavItem | null {
  for (const group of GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS) {
    const item = group.items.find((entry) => entry.id === id)
    if (item) return item
  }
  return null
}

export function isGrowthWorkspaceSettingsNavItemActive(pathname: string, item: GrowthSettingsNavItem): boolean {
  if (item.id === "communications") {
    return pathname === growthEngineCustomerSettingsHref("connected-mailboxes")
  }
  if (item.id === "mailboxes") {
    const mailboxesHref = growthEngineCustomerSettingsHref("connected-mailboxes")
    return pathname === mailboxesHref || pathname.startsWith(`${mailboxesHref}/`) || isGrowthCommunicationsSettingsPath(pathname)
  }
  if (item.id === "advanced") {
    return pathname === GROWTH_WORKSPACE_SETTINGS_ADVANCED_PATH
  }
  if (item.id === "compliance") {
    return pathname === GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH
  }
  if (item.href.startsWith(GROWTH_ENGINE_CUSTOMER_SETTINGS_BASE)) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  }
  if (isGrowthCommunicationsSettingsPath(pathname) && item.href.startsWith(GROWTH_COMMUNICATIONS_SETTINGS_PATH)) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export const GROWTH_WORKSPACE_SETTINGS_SHELL_ICON = Settings2
export const GROWTH_WORKSPACE_SETTINGS_CONTENT_ICON = LayoutTemplate
export const GROWTH_WORKSPACE_SETTINGS_AI_ICON = Sparkles
