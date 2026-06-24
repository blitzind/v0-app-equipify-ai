/**
 * Workspace Settings navigation manifest (Phase GE-SET-2).
 *
 * Navigation and shell architecture only — no persistence, APIs, or auth changes.
 */

import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Archive,
  Bell,
  Bot,
  Building2,
  Calendar,
  Code2,
  CreditCard,
  Database,
  Eye,
  FileText,
  Globe,
  Image,
  Inbox,
  Layers,
  Lock,
  Mail,
  Mailbox,
  Megaphone,
  Mic,
  PanelLeft,
  Phone,
  Plug,
  ScrollText,
  Server,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  User,
  Users,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react"
import type { OrgPermissions } from "@/lib/permissions/model"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import { WORKSPACE_SETTINGS_GROWTH_OPERATOR_SECTIONS } from "@/lib/settings/workspace-settings-growth-operator"

export const WORKSPACE_SETTINGS_NAV_QA_MARKER = "workspace-settings-nav-ge-set-2-v1" as const

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_BASE = "/settings/growth-engine" as const
export const WORKSPACE_SETTINGS_DATA_ADMIN_BASE = "/settings/data-administration" as const

export type WorkspaceSettingsRootCategoryId =
  | "general"
  | "plan"
  | "growth_engine"
  | "data_administration"

export type WorkspaceSettingsNavContext = {
  permissions: OrgPermissions
  growthEngineNavVisible: boolean
  dataAdministrationNavVisible: boolean
}

export type WorkspaceSettingsNavItem = {
  id: string
  label: string
  description: string
  href: string
  icon: LucideIcon
  /** Omit or return true to show for every member who can see the parent category. */
  visible?: (ctx: WorkspaceSettingsNavContext) => boolean
  /** Deep link to the current canonical configuration surface (Phase 1 CTA). */
  existingConfigHref?: string
  existingConfigLabel?: string
}

export type WorkspaceSettingsNavGroup = {
  id: string
  label: string
  rootCategory: WorkspaceSettingsRootCategoryId
  items: WorkspaceSettingsNavItem[]
}

const GROWTH_SETTINGS = `${GROWTH_WORKSPACE_BASE_PATH}/settings`
const ADMIN_GROWTH = "/admin/growth"
const ADMIN_GROWTH_SETTINGS = `${ADMIN_GROWTH}/settings`
const ADMIN_GROWTH_INFRA = `${ADMIN_GROWTH}/infrastructure`
const ADMIN_GROWTH_PROVIDERS = `${ADMIN_GROWTH}/providers`

function growthEngineHref(segment: string): string {
  return `${WORKSPACE_SETTINGS_GROWTH_ENGINE_BASE}/${segment}`
}

function dataAdminHref(segment: string): string {
  return `${WORKSPACE_SETTINGS_DATA_ADMIN_BASE}/${segment}`
}

function growthSettingsHref(segment: string): string {
  return `${GROWTH_SETTINGS}/${segment}`
}

const GROWTH_CANONICAL_NOTIFICATIONS_PATH = growthEngineHref("notification-preferences")
const GROWTH_CANONICAL_AI_PREFERENCES_PATH = growthEngineHref("copilot-preferences")
const GROWTH_CANONICAL_CALENDAR_PREFERENCES_PATH = growthEngineHref("meeting-preferences")

export const WORKSPACE_SETTINGS_GENERAL_GROUPS: WorkspaceSettingsNavGroup[] = [
  {
    id: "general-core",
    label: "General",
    rootCategory: "general",
    items: [
      {
        id: "general",
        label: "General",
        description: "Profile, timezone, and appearance preferences.",
        href: "/settings/general",
        icon: User,
        visible: (ctx) => ctx.permissions.canManageWorkspaceSettings,
      },
      {
        id: "notifications",
        label: "Notifications",
        description: "Workspace notification preferences and delivery channels.",
        href: "/settings/notifications",
        icon: Bell,
        visible: (ctx) => ctx.permissions.canManageWorkspaceSettings,
      },
      {
        id: "team",
        label: "Team",
        description: "Invite and manage workspace members.",
        href: "/settings/team",
        icon: Users,
        visible: (ctx) => ctx.permissions.canManageWorkspaceSettings,
      },
      {
        id: "permissions",
        label: "Permissions",
        description: "Role-based access for workspace features.",
        href: "/settings/permissions",
        icon: Lock,
        visible: (ctx) => ctx.permissions.canManageWorkspaceSettings,
      },
      {
        id: "security",
        label: "Security",
        description: "Authentication, sessions, and security policies.",
        href: "/settings/security",
        icon: Shield,
        visible: (ctx) => ctx.permissions.canManageSecuritySettings,
      },
      {
        id: "api-developers",
        label: "API / Developers",
        description: "API keys and developer integrations.",
        href: "/settings/api",
        icon: Code2,
        visible: (ctx) => ctx.permissions.canManageWorkspaceSettings || ctx.permissions.canManageApiKeys,
      },
      {
        id: "audit-log",
        label: "Audit Log",
        description: "Operational and security activity history.",
        href: "/settings/audit-log",
        icon: ScrollText,
        visible: (ctx) => ctx.permissions.canViewOperationalReports || ctx.permissions.canManageSecuritySettings,
      },
    ],
  },
  {
    id: "general-growth-operator",
    label: "Growth Operator",
    rootCategory: "general",
    items: WORKSPACE_SETTINGS_GROWTH_OPERATOR_SECTIONS.map((section) => ({
      id: section.id,
      label: section.label,
      description: section.description,
      href: section.href,
      icon: section.icon,
      visible: (ctx: WorkspaceSettingsNavContext) => ctx.growthEngineNavVisible,
    })),
  },
]

export const WORKSPACE_SETTINGS_PLAN_GROUPS: WorkspaceSettingsNavGroup[] = [
  {
    id: "plan-workspace",
    label: "Workspace",
    rootCategory: "plan",
    items: [
      {
        id: "workspace",
        label: "Workspace",
        description: "Company profile, branding, and workspace defaults.",
        href: "/settings/workspace",
        icon: Building2,
        visible: (ctx) => ctx.permissions.canManageWorkspaceSettings,
      },
      {
        id: "sample-data",
        label: "Sample data",
        description: "Load or remove demo data for evaluation.",
        href: "/settings/sample-data",
        icon: Database,
        visible: (ctx) => ctx.permissions.canManageWorkspaceSettings,
      },
      {
        id: "migration-center",
        label: "Migration center",
        description: "Historical imports and data migration jobs.",
        href: "/settings/imports",
        icon: Upload,
        visible: (ctx) => ctx.permissions.canManageHistoricalImports,
      },
      {
        id: "equipment-types",
        label: "Equipment Types",
        description: "Equipment taxonomy and field configuration.",
        href: "/settings/equipment-types",
        icon: Wrench,
        visible: (ctx) => ctx.permissions.canManageWorkspaceSettings,
      },
      {
        id: "archived",
        label: "Archived",
        description: "Archived records and restoration.",
        href: "/settings/archived",
        icon: Archive,
        visible: (ctx) => ctx.permissions.canArchiveRecords,
      },
    ],
  },
  {
    id: "plan-commercial",
    label: "Commercial",
    rootCategory: "plan",
    items: [
      {
        id: "billing",
        label: "Billing",
        description: "Subscription, invoices, and payment methods.",
        href: "/settings/billing",
        icon: CreditCard,
        visible: (ctx) => ctx.permissions.canViewBilling,
      },
      {
        id: "payments",
        label: "Payments",
        description: "Customer payment processing configuration.",
        href: "/settings/payments",
        icon: Wallet,
        visible: (ctx) => ctx.permissions.canViewBilling || ctx.permissions.canManageWorkspaceSettings,
      },
      {
        id: "ai-usage",
        label: "AI Usage",
        description: "AI consumption and usage insights.",
        href: "/settings/ai-usage",
        icon: Sparkles,
        visible: (ctx) => ctx.permissions.canViewInsights,
      },
      {
        id: "automations",
        label: "Automations",
        description: "Core workspace automation rules.",
        href: "/settings/automations",
        icon: Zap,
        visible: (ctx) => ctx.permissions.canManageAutomations,
      },
      {
        id: "customer-portal",
        label: "Customer Portal",
        description: "Customer-facing portal branding and access.",
        href: "/settings/portal",
        icon: Globe,
        visible: (ctx) => ctx.permissions.canManagePortalSettings,
      },
      {
        id: "integrations",
        label: "Integrations",
        description: "Third-party integrations for core operations.",
        href: "/settings/integrations",
        icon: Plug,
        visible: (ctx) => ctx.permissions.canManageIntegrations,
      },
    ],
  },
]

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_GROUPS: WorkspaceSettingsNavGroup[] = [
  {
    id: "growth-communications",
    label: "Communications",
    rootCategory: "growth_engine",
    items: [
      {
        id: "connected-mailboxes",
        label: "Connected Mailboxes",
        description: "Mailbox connections used for outbound and reply workflows.",
        href: growthEngineHref("connected-mailboxes"),
        icon: Mailbox,
        existingConfigHref: growthEngineHref("connected-mailboxes"),
        existingConfigLabel: "Open connected mailboxes",
      },
      {
        id: "gmail",
        label: "Gmail",
        description: "Google mailbox OAuth and send permissions for operator outreach.",
        href: growthEngineHref("gmail"),
        icon: Mail,
        existingConfigHref: growthEngineHref("connected-mailboxes"),
        existingConfigLabel: "Open connected mailboxes",
      },
      {
        id: "microsoft-365",
        label: "Microsoft 365",
        description: "Microsoft mailbox and calendar connection preferences.",
        href: growthEngineHref("microsoft-365"),
        icon: Mail,
        existingConfigHref: growthEngineHref("connected-mailboxes"),
        existingConfigLabel: "Open connected mailboxes",
      },
      {
        id: "email-signatures",
        label: "Email Signatures",
        description: "Email signatures and sender identity used in operator outreach.",
        href: growthEngineHref("email-signatures"),
        icon: FileText,
        existingConfigHref: growthSettingsHref("signatures"),
        existingConfigLabel: "Open existing configuration",
      },
      {
        id: "inbox-routing",
        label: "Inbox Routing",
        description: "Default inbox queues, routing rules, and assignment behavior.",
        href: growthEngineHref("inbox-routing"),
        icon: Inbox,
        existingConfigHref: `${ADMIN_GROWTH_SETTINGS}/communications`,
        existingConfigLabel: "Open existing configuration",
      },
    ],
  },
  {
    id: "growth-deliverability",
    label: "Deliverability",
    rootCategory: "growth_engine",
    items: [
      {
        id: "sending-domains",
        label: "Sending Domains",
        description: "Outbound domains, SPF alignment, and sender identity.",
        href: growthEngineHref("sending-domains"),
        icon: Globe,
        existingConfigHref: growthEngineHref("sending-domains"),
        existingConfigLabel: "Open sending domains",
      },
      {
        id: "dns-verification",
        label: "DNS Verification",
        description: "DNS records, verification status, and deliverability checklist.",
        href: growthEngineHref("dns-verification"),
        icon: ShieldCheck,
        existingConfigHref: growthEngineHref("dns-verification"),
        existingConfigLabel: "Open deliverability & DNS",
      },
      {
        id: "warmup",
        label: "Warmup",
        description: "Mailbox warmup schedules and ramp curves.",
        href: growthEngineHref("warmup"),
        icon: Activity,
        existingConfigHref: growthEngineHref("warmup"),
        existingConfigLabel: "Open warmup settings",
      },
      {
        id: "sending-limits",
        label: "Sending Limits",
        description: "Throttle limits, reputation protection, and send caps.",
        href: growthEngineHref("sending-limits"),
        icon: SlidersHorizontal,
        existingConfigHref: growthEngineHref("sending-limits"),
        existingConfigLabel: "Open reputation settings",
      },
      {
        id: "sender-pools",
        label: "Sender Pools",
        description: "Sender pool rotation and capacity allocation.",
        href: growthEngineHref("sender-pools"),
        icon: Layers,
        existingConfigHref: growthEngineHref("sender-pools"),
        existingConfigLabel: "Open sender pools",
      },
      {
        id: "mailbox-health",
        label: "Mailbox Health",
        description: "Mailbox reputation, bounce rates, and health signals.",
        href: growthEngineHref("mailbox-health"),
        icon: Activity,
        existingConfigHref: growthEngineHref("dns-verification"),
        existingConfigLabel: "Open deliverability & DNS",
      },
    ],
  },
  {
    id: "growth-voice",
    label: "Voice & Calling",
    rootCategory: "growth_engine",
    items: [
      {
        id: "calling-providers",
        label: "Calling Providers",
        description: "Twilio, Telnyx, and telephony provider connections.",
        href: growthEngineHref("calling-providers"),
        icon: Phone,
        existingConfigHref: `${ADMIN_GROWTH_SETTINGS}/communications`,
        existingConfigLabel: "Open existing configuration",
      },
      {
        id: "phone-numbers",
        label: "Phone Numbers",
        description: "Provisioned numbers, caller ID, and number inventory.",
        href: growthEngineHref("phone-numbers"),
        icon: Phone,
        existingConfigHref: `${ADMIN_GROWTH_SETTINGS}/communications`,
        existingConfigLabel: "Open existing configuration",
      },
      {
        id: "dialer-settings",
        label: "Dialer Settings",
        description: "Native dialer defaults, disposition behavior, and call controls.",
        href: growthEngineHref("dialer-settings"),
        icon: Phone,
        existingConfigHref: `${ADMIN_GROWTH_SETTINGS}/communications`,
        existingConfigLabel: "Open existing configuration",
      },
      {
        id: "call-routing",
        label: "Call Routing",
        description: "Inbound and outbound call routing rules.",
        href: growthEngineHref("call-routing"),
        icon: Phone,
        existingConfigHref: `${ADMIN_GROWTH_SETTINGS}/communications`,
        existingConfigLabel: "Open existing configuration",
      },
      {
        id: "voicemail",
        label: "Voicemail",
        description: "Voicemail boxes, greetings, and transcription settings.",
        href: growthEngineHref("voicemail"),
        icon: Mic,
        existingConfigHref: `${ADMIN_GROWTH_SETTINGS}/communications`,
        existingConfigLabel: "Open existing configuration",
      },
    ],
  },
  {
    id: "growth-meetings",
    label: "Meetings",
    rootCategory: "growth_engine",
    items: [
      {
        id: "calendar-providers",
        label: "Calendar Providers",
        description: "Google Calendar and external calendar integrations.",
        href: growthEngineHref("calendar-providers"),
        icon: Calendar,
        existingConfigHref: `${ADMIN_GROWTH_SETTINGS}/communications`,
        existingConfigLabel: "Open existing configuration",
      },
      {
        id: "booking-pages",
        label: "Booking Pages",
        description: "Public booking pages, availability, and scheduling links.",
        href: growthEngineHref("booking-pages"),
        icon: Calendar,
        existingConfigHref: `${ADMIN_GROWTH_SETTINGS}/communications`,
        existingConfigLabel: "Open existing configuration",
      },
      {
        id: "meeting-preferences",
        label: "Meeting Preferences",
        description: "Meeting booking defaults, availability, and calendar routing.",
        href: growthEngineHref("meeting-preferences"),
        icon: Calendar,
        existingConfigHref: GROWTH_CANONICAL_CALENDAR_PREFERENCES_PATH,
        existingConfigLabel: "Open calendar preferences",
      },
    ],
  },
  {
    id: "growth-ai",
    label: "AI",
    rootCategory: "growth_engine",
    items: [
      {
        id: "openai",
        label: "OpenAI",
        description: "OpenAI realtime transcript and copilot provider settings.",
        href: growthEngineHref("openai"),
        icon: Bot,
        existingConfigHref: `${ADMIN_GROWTH}/calls/providers`,
        existingConfigLabel: "Open existing configuration",
      },
      {
        id: "elevenlabs",
        label: "ElevenLabs",
        description: "ElevenLabs voice synthesis for media and outreach assets.",
        href: growthEngineHref("elevenlabs"),
        icon: Mic,
        existingConfigHref: `${GROWTH_WORKSPACE_BASE_PATH}/media`,
        existingConfigLabel: "Open existing configuration",
      },
      {
        id: "retell",
        label: "Retell",
        description: "Retell conversational agent configuration.",
        href: growthEngineHref("retell"),
        icon: Bot,
        existingConfigHref: `${GROWTH_WORKSPACE_BASE_PATH}/media`,
        existingConfigLabel: "Open existing configuration",
      },
      {
        id: "copilot-preferences",
        label: "Copilot Preferences",
        description: "Aiden guidance, copilot tone, and AI assist defaults.",
        href: growthEngineHref("copilot-preferences"),
        icon: Sparkles,
        existingConfigHref: GROWTH_CANONICAL_AI_PREFERENCES_PATH,
        existingConfigLabel: "Open AI preferences",
      },
      {
        id: "media-ai-providers",
        label: "Media AI Providers",
        description: "AI providers for media generation and asset workflows.",
        href: growthEngineHref("media-ai-providers"),
        icon: Sparkles,
        existingConfigHref: `${GROWTH_WORKSPACE_BASE_PATH}/media`,
        existingConfigLabel: "Open existing configuration",
      },
    ],
  },
  {
    id: "growth-marketing",
    label: "Marketing Assets",
    rootCategory: "growth_engine",
    items: [
      {
        id: "share-page-branding",
        label: "Share Page Branding",
        description: "Share page templates, branding, and public presentation.",
        href: growthEngineHref("share-page-branding"),
        icon: Megaphone,
        existingConfigHref: `${GROWTH_WORKSPACE_BASE_PATH}/share-pages`,
        existingConfigLabel: "Open existing configuration",
      },
      {
        id: "media-library",
        label: "Media Library",
        description: "Reusable logos and images for signatures, booking pages, and share pages.",
        href: growthEngineHref("media-library"),
        icon: Image,
      },
      {
        id: "booking-branding",
        label: "Booking Branding",
        description: "Booking page appearance and brand presentation.",
        href: growthEngineHref("booking-branding"),
        icon: Megaphone,
        existingConfigHref: `${ADMIN_GROWTH_SETTINGS}/communications`,
        existingConfigLabel: "Open existing configuration",
      },
      {
        id: "media-defaults",
        label: "Media Defaults",
        description: "Default media templates and generation preferences.",
        href: growthEngineHref("media-defaults"),
        icon: Layers,
        existingConfigHref: `${GROWTH_WORKSPACE_BASE_PATH}/media`,
        existingConfigLabel: "Open existing configuration",
      },
    ],
  },
  {
    id: "growth-notifications-automation",
    label: "Notifications & Automation",
    rootCategory: "growth_engine",
    items: [
      {
        id: "notification-preferences",
        label: "Notification Preferences",
        description: "Growth operator notification delivery and alert preferences.",
        href: growthEngineHref("notification-preferences"),
        icon: Bell,
        existingConfigHref: GROWTH_CANONICAL_NOTIFICATIONS_PATH,
        existingConfigLabel: "Open Growth notifications",
      },
      {
        id: "automation-defaults",
        label: "Automation Defaults",
        description: "Default automation posture, safeguards, and sequence defaults.",
        href: growthEngineHref("automation-defaults"),
        icon: Zap,
        existingConfigHref: `${ADMIN_GROWTH_SETTINGS}/growth`,
        existingConfigLabel: "Open existing configuration",
      },
      {
        id: "command-center-preferences",
        label: "Command Center Preferences",
        description: "Cmd+K shortcuts, pinned destinations, and command palette ordering.",
        href: growthEngineHref("command-center-preferences"),
        icon: SlidersHorizontal,
        existingConfigHref: growthSettingsHref("command-center-preferences"),
        existingConfigLabel: "Open existing configuration",
      },
    ],
  },
  {
    id: "growth-compliance",
    label: "Compliance",
    rootCategory: "growth_engine",
    items: [
      {
        id: "unsubscribe-settings",
        label: "Unsubscribe Settings",
        description: "Unsubscribe links, footers, and compliance copy.",
        href: growthEngineHref("unsubscribe-settings"),
        icon: ShieldCheck,
        existingConfigHref: growthEngineHref("unsubscribe-settings"),
        existingConfigLabel: "Open compliance settings",
      },
      {
        id: "suppression-lists",
        label: "Suppression Lists",
        description: "Global and workspace suppression list management.",
        href: growthEngineHref("suppression-lists"),
        icon: Shield,
        existingConfigHref: growthEngineHref("unsubscribe-settings"),
        existingConfigLabel: "Open compliance settings",
      },
      {
        id: "compliance-rules",
        label: "Compliance Rules",
        description: "CAN-SPAM, consent, and outreach compliance policies.",
        href: growthEngineHref("compliance-rules"),
        icon: ShieldCheck,
        existingConfigHref: growthEngineHref("unsubscribe-settings"),
        existingConfigLabel: "Open compliance settings",
      },
    ],
  },
]

export const WORKSPACE_SETTINGS_DATA_ADMIN_GROUPS: WorkspaceSettingsNavGroup[] = [
  {
    id: "data-admin-diagnostics",
    label: "Diagnostics",
    rootCategory: "data_administration",
    items: [
      {
        id: "governance-exports",
        label: "Governance & Exports",
        description: "Enterprise governance exports and audit artifacts.",
        href: dataAdminHref("governance-exports"),
        icon: ScrollText,
        existingConfigHref: `${ADMIN_GROWTH_SETTINGS}/governance`,
        existingConfigLabel: "Open existing configuration",
      },
      {
        id: "provider-health",
        label: "Provider Health",
        description: "Third-party provider health probes and capability status.",
        href: dataAdminHref("provider-health"),
        icon: Activity,
        existingConfigHref: `${ADMIN_GROWTH_SETTINGS}/provider-health`,
        existingConfigLabel: "Open existing configuration",
      },
      {
        id: "deliverability-operations",
        label: "Deliverability Operations",
        description: "Monitor deliverability diagnostics, sender health, and support workflows for Growth Engine.",
        href: dataAdminHref("deliverability-operations"),
        icon: Server,
        existingConfigHref: `${ADMIN_GROWTH_PROVIDERS}/deliverability-ops`,
        existingConfigLabel: "Open existing configuration",
      },
      {
        id: "growth-diagnostics",
        label: "Growth Diagnostics",
        description: "Internal Growth Engine diagnostics and certification surfaces.",
        href: dataAdminHref("growth-diagnostics"),
        icon: Activity,
        existingConfigHref: `${ADMIN_GROWTH_SETTINGS}/provider-health`,
        existingConfigLabel: "Open existing configuration",
      },
      {
        id: "system-logs",
        label: "System Logs",
        description: "Workspace audit and system activity logs.",
        href: dataAdminHref("system-logs"),
        icon: ScrollText,
        existingConfigHref: "/settings/audit-log",
        existingConfigLabel: "Open existing configuration",
      },
    ],
  },
]

export function filterWorkspaceSettingsNavItem(
  item: WorkspaceSettingsNavItem,
  ctx: WorkspaceSettingsNavContext,
): boolean {
  return !item.visible || item.visible(ctx)
}

export function filterWorkspaceSettingsGroup(
  group: WorkspaceSettingsNavGroup,
  ctx: WorkspaceSettingsNavContext,
): WorkspaceSettingsNavGroup | null {
  const items = group.items.filter((item) => filterWorkspaceSettingsNavItem(item, ctx))
  if (items.length === 0) return null
  return { ...group, items }
}

export type WorkspaceSettingsRootCategory = {
  id: WorkspaceSettingsRootCategoryId
  label: string
  groups: WorkspaceSettingsNavGroup[]
}

export function buildWorkspaceSettingsRootCategories(args: {
  planCategoryLabel: string
  ctx: WorkspaceSettingsNavContext
}): WorkspaceSettingsRootCategory[] {
  const categories: WorkspaceSettingsRootCategory[] = [
    {
      id: "general",
      label: "General",
      groups: WORKSPACE_SETTINGS_GENERAL_GROUPS.map((group) => filterWorkspaceSettingsGroup(group, args.ctx))
        .filter((group): group is WorkspaceSettingsNavGroup => group !== null),
    },
    {
      id: "plan",
      label: args.planCategoryLabel,
      groups: WORKSPACE_SETTINGS_PLAN_GROUPS.map((group) => filterWorkspaceSettingsGroup(group, args.ctx))
        .filter((group): group is WorkspaceSettingsNavGroup => group !== null),
    },
  ]

  if (args.ctx.growthEngineNavVisible) {
    categories.push({
      id: "growth_engine",
      label: "Growth Engine",
      groups: WORKSPACE_SETTINGS_GROWTH_ENGINE_GROUPS.map((group) =>
        filterWorkspaceSettingsGroup(group, args.ctx),
      ).filter((group): group is WorkspaceSettingsNavGroup => group !== null),
    })
  }

  if (args.ctx.dataAdministrationNavVisible) {
    categories.push({
      id: "data_administration",
      label: "Data & Administration",
      groups: WORKSPACE_SETTINGS_DATA_ADMIN_GROUPS.map((group) =>
        filterWorkspaceSettingsGroup(group, args.ctx),
      ).filter((group): group is WorkspaceSettingsNavGroup => group !== null),
    })
  }

  return categories.filter((category) => category.groups.length > 0)
}

export function listWorkspaceSettingsGrowthEngineSectionIds(): string[] {
  return WORKSPACE_SETTINGS_GROWTH_ENGINE_GROUPS.flatMap((group) => group.items.map((item) => item.id))
}

export function listWorkspaceSettingsDataAdminSectionIds(): string[] {
  return WORKSPACE_SETTINGS_DATA_ADMIN_GROUPS.flatMap((group) => group.items.map((item) => item.id))
}

export function getWorkspaceSettingsGrowthEngineSection(sectionId: string): WorkspaceSettingsNavItem | null {
  for (const group of WORKSPACE_SETTINGS_GROWTH_ENGINE_GROUPS) {
    const item = group.items.find((entry) => entry.id === sectionId)
    if (item) return item
  }
  return null
}

export function getWorkspaceSettingsDataAdminSection(sectionId: string): WorkspaceSettingsNavItem | null {
  for (const group of WORKSPACE_SETTINGS_DATA_ADMIN_GROUPS) {
    const item = group.items.find((entry) => entry.id === sectionId)
    if (item) return item
  }
  return null
}

export function isWorkspaceSettingsNavItemActive(pathname: string, item: WorkspaceSettingsNavItem): boolean {
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export const WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFAULT_SECTION_ID = "connected-mailboxes" as const
export const WORKSPACE_SETTINGS_DATA_ADMIN_DEFAULT_SECTION_ID = "governance-exports" as const
