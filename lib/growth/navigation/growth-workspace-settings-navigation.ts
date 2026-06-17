/**
 * Growth workspace settings navigation manifest (Phase 7C shell, Phase 8B persistence foundation).
 *
 * Five foundation sections persist via Supabase; remaining sections stay placeholder until migrated.
 */

import type { LucideIcon } from "lucide-react"
import {
  Bell,
  Bot,
  Calendar,
  Chrome,
  Command,
  Eye,
  LayoutTemplate,
  Mail,
  Mailbox,
  PanelLeft,
  Phone,
  Settings2,
  Signature,
  SlidersHorizontal,
  Sparkles,
  User,
} from "lucide-react"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER = "growth-workspace-settings-nav-v2" as const

export const GROWTH_WORKSPACE_SETTINGS_DEFAULT_SECTION_ID = "profile" as const

export type GrowthSettingsNavItem = {
  id: string
  label: string
  description: string
  href: string
  icon: LucideIcon
  /** Platform Admin fallback while workspace persistence is not wired yet. */
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
        description: "In-app and delivery preferences for Growth operator alerts.",
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
    ],
  },
  {
    id: "communications",
    label: "Communications",
    items: [
      {
        id: "connected-mailboxes",
        label: "Connected Mailboxes",
        description: "Mailbox connections used for outbound and reply workflows.",
        segment: "connected-mailboxes",
        icon: Mailbox,
        adminFallbackSuffix: "communications",
        adminFallbackLabel: "Communications settings (admin)",
      },
      {
        id: "calling-preferences",
        label: "Calling Preferences",
        description: "Dialer defaults, call disposition behavior, and live-call preferences.",
        segment: "calling-preferences",
        icon: Phone,
        adminFallbackSuffix: "communications",
        adminFallbackLabel: "Communications settings (admin)",
      },
      {
        id: "signatures",
        label: "Signatures",
        description: "Email signatures and sender identity used in operator outreach.",
        segment: "signatures",
        icon: Signature,
        adminFallbackSuffix: "communications",
        adminFallbackLabel: "Communications settings (admin)",
      },
      {
        id: "calendar-preferences",
        label: "Calendar Preferences",
        description: "Meeting booking defaults, availability, and calendar routing rules.",
        segment: "calendar-preferences",
        icon: Calendar,
        adminFallbackSuffix: "communications",
        adminFallbackLabel: "Communications settings (admin)",
      },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    items: [
      {
        id: "sidebar-preferences",
        label: "Sidebar Preferences",
        description: "Collapse behavior and section defaults for the Growth sidebar.",
        segment: "sidebar-preferences",
        icon: PanelLeft,
      },
      {
        id: "command-center-preferences",
        label: "Command Center Preferences",
        description: "Cmd+K shortcuts, pinned destinations, and command palette ordering.",
        segment: "command-center-preferences",
        icon: Command,
      },
      {
        id: "ai-preferences",
        label: "AI Preferences",
        description: "Aiden guidance, copilot tone, and AI assist defaults for operators.",
        segment: "ai-preferences",
        icon: Bot,
        adminFallbackSuffix: "growth",
        adminFallbackLabel: "Growth settings (admin)",
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
    id: "integrations",
    label: "Integrations",
    items: [
      {
        id: "gmail",
        label: "Gmail",
        description: "Google mailbox OAuth and send permissions for operator outreach.",
        segment: "gmail",
        icon: Mail,
        adminFallbackSuffix: "communications",
        adminFallbackLabel: "Communications settings (admin)",
      },
      {
        id: "microsoft-365",
        label: "Microsoft 365",
        description: "Microsoft mailbox and calendar connection preferences.",
        segment: "microsoft-365",
        icon: Mail,
        adminFallbackSuffix: "communications",
        adminFallbackLabel: "Communications settings (admin)",
      },
      {
        id: "calendar",
        label: "Calendar",
        description: "External calendar integrations and booking sync preferences.",
        segment: "calendar",
        icon: Calendar,
        adminFallbackSuffix: "communications",
        adminFallbackLabel: "Communications settings (admin)",
      },
      {
        id: "browser-notifications",
        label: "Browser Notifications",
        description: "Desktop notification permissions for live operator signals.",
        segment: "browser-notifications",
        icon: Chrome,
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
      href: resolveSettingsHref(item.segment),
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
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

/** Settings shell header icon — shared across section placeholders. */
export const GROWTH_WORKSPACE_SETTINGS_SHELL_ICON = Settings2

/** Content section icon for template-driven placeholders. */
export const GROWTH_WORKSPACE_SETTINGS_CONTENT_ICON = LayoutTemplate

export const GROWTH_WORKSPACE_SETTINGS_AI_ICON = Sparkles
