/** Growth Engine navigation IA — shared destinations for sidebar + command palette (Prompt 33 + 35). */

import type { GrowthSidebarConsoleKey } from "@/hooks/use-growth-sidebar-console"
import type { GrowthCommandPaletteEntry } from "@/lib/growth/navigation/growth-navigation-ranking"

export const GROWTH_NAVIGATION_IA_QA_MARKER = "growth-navigation-ia-v2" as const

export type GrowthNavigationDestination = {
  id: string
  label: string
  href: string
  keywords?: string[]
  consoleKey?: GrowthSidebarConsoleKey
}

export type GrowthNavigationQuickAction = {
  id: string
  label: string
  href: string
  keywords?: string[]
  aliases?: string[]
  coreWorkflow?: boolean
}

export type GrowthNavItemDef = {
  id: string
  href: string
  label: string
  consoleKey?: GrowthSidebarConsoleKey
  shortcutKey?: string
  match: (path: string) => boolean
}

export type GrowthNavGroupDef = {
  id: string
  label: string
  items: GrowthNavItemDef[]
}

function prefixMatch(prefix: string, exclude: string[] = []) {
  return (path: string) => {
    if (!path.startsWith(prefix)) return false
    return !exclude.some((ex) => path.startsWith(ex))
  }
}

export const GROWTH_COMMAND_PALETTE_DESTINATIONS: GrowthNavigationDestination[] = [
  {
    id: "command",
    label: "Command Center",
    href: "/admin/growth/command",
    keywords: ["mission", "dashboard", "daily", "command"],
    consoleKey: "command",
  },
  {
    id: "inbox",
    label: "Revenue Inbox",
    href: "/admin/growth/leads",
    keywords: ["revenue", "inbox", "leads", "pipeline", "prospects"],
    consoleKey: "inbox",
  },
  {
    id: "search",
    label: "Prospect Search",
    href: "/admin/growth/search",
    keywords: ["discover", "prospect", "icp", "search", "companies", "apollo", "seamless"],
  },
  {
    id: "intent-pixel",
    label: "Intent Pixel",
    href: "/admin/growth/intent-pixel",
    keywords: ["intent", "visitor", "pixel", "tracking", "visitor tracking"],
    consoleKey: "intent_pixel",
  },
  {
    id: "unified-inbox",
    label: "Inbox",
    href: "/admin/growth/inbox",
    keywords: ["inbox", "reply", "thread", "unified inbox", "reply intelligence"],
  },
  {
    id: "provider-delivery",
    label: "Delivery",
    href: "/admin/growth/providers/delivery",
    keywords: ["delivery", "provider", "route", "transport", "send routing"],
  },
  {
    id: "lead-intelligence",
    label: "Lead Intelligence Inspector",
    href: "/admin/growth/leads/lead-engine",
    keywords: ["lead engine", "inspector", "pipeline", "lead intelligence", "pipeline inspector"],
  },
  {
    id: "call-workspace",
    label: "Call Workspace",
    href: "/admin/growth/calls/workspace",
    keywords: ["dial", "call", "live", "dialer", "phone", "live calls"],
    consoleKey: "calls_workspace",
  },
  {
    id: "calls-live",
    label: "Live Calls",
    href: "/admin/growth/calls/live",
    keywords: ["live calls", "active calls", "phone"],
    consoleKey: "calls_live",
  },
  {
    id: "call-queue",
    label: "Call Queue",
    href: "/admin/growth/leads/queue",
    keywords: ["queue", "calls due", "cadence"],
    consoleKey: "callQueue",
  },
  {
    id: "live-coaching",
    label: "Live Coaching",
    href: "/admin/growth/calls/live-coaching",
    keywords: ["coaching", "guidance", "objection", "transcript"],
    consoleKey: "calls_live_coaching",
  },
  {
    id: "call-providers",
    label: "Call Providers",
    href: "/admin/growth/calls/providers",
    keywords: ["call provider", "transcript provider", "retell", "elevenlabs"],
    consoleKey: "calls_providers",
  },
  {
    id: "providers",
    label: "Provider Diagnostics",
    href: "/admin/growth/providers",
    keywords: ["provider", "diagnostics", "api"],
    consoleKey: "providers",
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    href: "/admin/growth/infrastructure",
    keywords: ["sender", "infrastructure", "domain", "deliverability", "warmup"],
  },
  {
    id: "mailbox-connections",
    label: "Mailbox Connections",
    href: "/admin/growth/infrastructure/mailboxes",
    keywords: ["mailbox", "oauth", "google", "microsoft", "smtp", "token"],
  },
  {
    id: "deliverability",
    label: "Deliverability",
    href: "/admin/growth/infrastructure/deliverability",
    keywords: ["dns", "spf", "dkim", "dmarc", "deliverability", "mx"],
  },
  {
    id: "warmup",
    label: "Warmup",
    href: "/admin/growth/infrastructure/warmup",
    keywords: ["warmup", "ramp", "volume", "schedule", "sender"],
  },
  {
    id: "outreach-approval",
    label: "Outreach Approval",
    href: "/admin/growth/outreach/approval",
    keywords: ["approval", "queue"],
    consoleKey: "outreach_approval",
  },
  {
    id: "settings",
    label: "Growth Settings",
    href: "/admin/growth/settings",
    keywords: ["communication", "config"],
  },
]

export const GROWTH_NAV_QUICK_ACTIONS: GrowthNavigationQuickAction[] = [
  {
    id: "discover-companies",
    label: "Discover Companies",
    href: "/admin/growth/search?mode=discover",
    keywords: ["prospect", "search", "discover"],
    aliases: ["discover", "companies"],
    coreWorkflow: true,
  },
  {
    id: "process-intent",
    label: "Process Intent",
    href: "/admin/growth/intent-pixel",
    keywords: ["pixel", "visitor", "intent"],
    coreWorkflow: true,
  },
  {
    id: "open-inbox",
    label: "Open Lead Inbox",
    href: "/admin/growth/leads",
    keywords: ["revenue", "inbox", "lead inbox"],
    aliases: ["revenue", "pipeline", "prospects"],
    coreWorkflow: true,
  },
  {
    id: "run-lead-intelligence",
    label: "Run Lead Intelligence",
    href: "/admin/growth/leads/lead-engine",
    keywords: ["inspector", "pipeline", "lead engine", "lead intelligence"],
    aliases: ["pipeline inspector"],
  },
  {
    id: "start-live-call",
    label: "Start Live Call",
    href: "/admin/growth/calls/workspace",
    keywords: ["call", "dial", "phone"],
    aliases: ["dialer", "live calls"],
    coreWorkflow: true,
  },
  {
    id: "review-outreach-approval",
    label: "Review Outreach Approval",
    href: "/admin/growth/outreach/approval",
    keywords: ["approval", "outreach"],
  },
]

export const GROWTH_NAV_QUICK_ACTIONS_SECONDARY: GrowthNavigationQuickAction[] = [
  {
    id: "import-leads",
    label: "Import Leads",
    href: "/admin/growth/imports",
    keywords: ["csv", "upload", "imports"],
  },
]

export const GROWTH_COMMAND_PALETTE_ENTRIES: GrowthCommandPaletteEntry[] = [
  ...GROWTH_NAV_QUICK_ACTIONS.map((action) => ({
    id: action.id,
    label: action.label,
    href: action.href,
    keywords: action.keywords,
    aliases: action.aliases,
    coreWorkflow: action.coreWorkflow,
    group: "quick" as const,
  })),
  ...GROWTH_COMMAND_PALETTE_DESTINATIONS.map((dest) => ({
    id: dest.id,
    label: dest.label,
    href: dest.href,
    keywords: dest.keywords,
    aliases: dest.keywords,
    coreWorkflow: ["command", "inbox", "search", "intent-pixel", "call-workspace"].includes(dest.id),
    group: "navigate" as const,
  })),
  ...GROWTH_NAV_QUICK_ACTIONS_SECONDARY.map((action) => ({
    id: action.id,
    label: action.label,
    href: action.href,
    keywords: action.keywords,
    aliases: action.aliases,
    group: "more" as const,
  })),
]

export const GROWTH_NAV_GROUP_DEFS: GrowthNavGroupDef[] = [
  {
    id: "core",
    label: "Core",
    items: [
      {
        id: "command",
        href: "/admin/growth/command",
        label: "Command Center",
        consoleKey: "command",
        shortcutKey: "m",
        match: prefixMatch("/admin/growth/command"),
      },
      {
        id: "revenue-inbox",
        href: "/admin/growth/leads",
        label: "Revenue Inbox",
        consoleKey: "inbox",
        shortcutKey: "i",
        match: (path) => {
          if (!path.startsWith("/admin/growth/leads")) return false
          if (path.startsWith("/admin/growth/leads/lead-engine")) return false
          if (path.startsWith("/admin/growth/leads/crm")) return false
          if (path.startsWith("/admin/growth/leads/queue")) return false
          return path === "/admin/growth/leads" || /^\/admin\/growth\/leads\/[0-9a-f-]{36}$/i.test(path)
        },
      },
      {
        id: "prospect-search",
        href: "/admin/growth/search",
        label: "Prospect Search",
        match: prefixMatch("/admin/growth/search"),
      },
      {
        id: "intent-pixel",
        href: "/admin/growth/intent-pixel",
        label: "Intent Pixel",
        consoleKey: "intent_pixel",
        match: prefixMatch("/admin/growth/intent-pixel"),
      },
      {
        id: "unified-inbox",
        href: "/admin/growth/inbox",
        label: "Inbox",
        match: prefixMatch("/admin/growth/inbox"),
      },
    ],
  },
  {
    id: "workflow",
    label: "Workflow",
    items: [
      {
        id: "outreach",
        href: "/admin/growth/outreach",
        label: "Outreach",
        consoleKey: "outreach",
        match: (path) => path === "/admin/growth/outreach",
      },
      {
        id: "outreach-approval",
        href: "/admin/growth/outreach/approval",
        label: "Outreach Approval",
        consoleKey: "outreach_approval",
        match: prefixMatch("/admin/growth/outreach/approval"),
      },
      {
        id: "sequences",
        href: "/admin/growth/sequences",
        label: "Sequences",
        consoleKey: "sequences",
        match: (path) => path === "/admin/growth/sequences",
      },
      {
        id: "call-workspace",
        href: "/admin/growth/calls/workspace",
        label: "Call Workspace",
        consoleKey: "calls_workspace",
        match: prefixMatch("/admin/growth/calls/workspace"),
      },
      {
        id: "sequence-execution",
        href: "/admin/growth/sequences/execution",
        label: "Sequence Execution",
        consoleKey: "sequence_execution",
        match: prefixMatch("/admin/growth/sequences/execution"),
      },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      {
        id: "engagement",
        href: "/admin/growth/engagement",
        label: "Engagement",
        consoleKey: "engagement",
        match: prefixMatch("/admin/growth/engagement"),
      },
      {
        id: "conversations",
        href: "/admin/growth/conversations",
        label: "Conversations",
        consoleKey: "conversations",
        match: prefixMatch("/admin/growth/conversations"),
      },
      {
        id: "pipeline",
        href: "/admin/growth/opportunities/pipeline",
        label: "Pipeline",
        consoleKey: "opportunities",
        match: prefixMatch("/admin/growth/opportunities/pipeline"),
      },
      {
        id: "opportunities",
        href: "/admin/growth/opportunities",
        label: "Opportunities",
        consoleKey: "opportunities",
        match: (path) => path === "/admin/growth/opportunities",
      },
      {
        id: "revenue-operating",
        href: "/admin/growth/revenue-operating",
        label: "Revenue Operating",
        consoleKey: "revenue",
        match: prefixMatch("/admin/growth/revenue-operating"),
      },
      {
        id: "revenue",
        href: "/admin/growth/revenue",
        label: "Revenue",
        consoleKey: "revenue",
        shortcutKey: "r",
        match: (path) => path === "/admin/growth/revenue",
      },
      {
        id: "executive",
        href: "/admin/growth/executive",
        label: "Executive",
        consoleKey: "executive",
        shortcutKey: "e",
        match: prefixMatch("/admin/growth/executive"),
      },
      {
        id: "capacity",
        href: "/admin/growth/capacity",
        label: "Capacity",
        consoleKey: "capacity",
        match: prefixMatch("/admin/growth/capacity"),
      },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    items: [
      {
        id: "calls",
        href: "/admin/growth/calls",
        label: "Calls",
        consoleKey: "calls",
        match: (path) => path === "/admin/growth/calls",
      },
      {
        id: "calls-live",
        href: "/admin/growth/calls/live",
        label: "Live Calls",
        consoleKey: "calls_live",
        match: (path) =>
          path.startsWith("/admin/growth/calls/live") &&
          !path.startsWith("/admin/growth/calls/live-coaching"),
      },
      {
        id: "call-queue",
        href: "/admin/growth/leads/queue",
        label: "Call Queue",
        consoleKey: "callQueue",
        shortcutKey: "c",
        match: prefixMatch("/admin/growth/leads/queue"),
      },
      {
        id: "meetings",
        href: "/admin/growth/meetings",
        label: "Meetings",
        match: prefixMatch("/admin/growth/meetings"),
      },
      {
        id: "reply-inbox",
        href: "/admin/growth/replies",
        label: "Reply Inbox",
        consoleKey: "conversations",
        match: prefixMatch("/admin/growth/replies"),
      },
    ],
  },
  {
    id: "coaching",
    label: "Coaching",
    items: [
      {
        id: "live-coaching",
        href: "/admin/growth/calls/live-coaching",
        label: "Live Coaching",
        consoleKey: "calls_live_coaching",
        match: prefixMatch("/admin/growth/calls/live-coaching"),
      },
      {
        id: "call-providers",
        href: "/admin/growth/calls/providers",
        label: "Call Providers",
        consoleKey: "calls_providers",
        match: prefixMatch("/admin/growth/calls/providers"),
      },
    ],
  },
  {
    id: "providers-nav",
    label: "Providers",
    items: [
      {
        id: "providers",
        href: "/admin/growth/providers",
        label: "Provider Diagnostics",
        consoleKey: "providers",
        match: (path) =>
          path.startsWith("/admin/growth/providers") && !path.startsWith("/admin/growth/providers/delivery"),
      },
      {
        id: "provider-delivery",
        href: "/admin/growth/providers/delivery",
        label: "Delivery",
        match: prefixMatch("/admin/growth/providers/delivery"),
      },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      {
        id: "lead-intelligence",
        href: "/admin/growth/leads/lead-engine",
        label: "Lead Intelligence Inspector",
        match: prefixMatch("/admin/growth/leads/lead-engine"),
      },
      {
        id: "crm-leads",
        href: "/admin/growth/leads/crm",
        label: "CRM Leads",
        match: prefixMatch("/admin/growth/leads/crm"),
      },
      {
        id: "imports",
        href: "/admin/growth/imports",
        label: "Imports",
        consoleKey: "imports",
        match: prefixMatch("/admin/growth/imports"),
      },
      {
        id: "infrastructure",
        href: "/admin/growth/infrastructure",
        label: "Infrastructure",
        match: (path) =>
          path.startsWith("/admin/growth/infrastructure") &&
          !path.startsWith("/admin/growth/infrastructure/mailboxes") &&
          !path.startsWith("/admin/growth/infrastructure/deliverability") &&
          !path.startsWith("/admin/growth/infrastructure/warmup"),
      },
      {
        id: "mailbox-connections",
        href: "/admin/growth/infrastructure/mailboxes",
        label: "Mailbox Connections",
        match: prefixMatch("/admin/growth/infrastructure/mailboxes"),
      },
      {
        id: "deliverability",
        href: "/admin/growth/infrastructure/deliverability",
        label: "Deliverability",
        match: prefixMatch("/admin/growth/infrastructure/deliverability"),
      },
      {
        id: "warmup",
        href: "/admin/growth/infrastructure/warmup",
        label: "Warmup",
        match: prefixMatch("/admin/growth/infrastructure/warmup"),
      },
      {
        id: "copilot",
        href: "/admin/growth/copilot",
        label: "Copilot",
        consoleKey: "copilot",
        match: (path) => path === "/admin/growth/copilot",
      },
      {
        id: "playbooks",
        href: "/admin/growth/copilot/playbooks",
        label: "Playbooks",
        consoleKey: "playbooks",
        match: prefixMatch("/admin/growth/copilot/playbooks"),
      },
      {
        id: "relationships",
        href: "/admin/growth/relationships",
        label: "Relationships",
        consoleKey: "relationships",
        match: prefixMatch("/admin/growth/relationships"),
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      {
        id: "growth-settings",
        href: "/admin/growth/settings",
        label: "Growth Settings",
        match: prefixMatch("/admin/growth/settings"),
      },
      {
        id: "communication-settings",
        href: "/admin/growth/settings",
        label: "Communication Settings",
        match: prefixMatch("/admin/growth/settings"),
      },
      {
        id: "provider-settings",
        href: "/admin/growth/calls/providers",
        label: "Provider Settings",
        match: prefixMatch("/admin/growth/calls/providers"),
      },
    ],
  },
]

export function growthNavigationShortcutLabel(): string {
  if (typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform)) {
    return "⌘K"
  }
  return "Ctrl+K"
}

export function resolveGrowthNavigationEntryFromPathname(
  pathname: string,
): Pick<GrowthCommandPaletteEntry, "id" | "label" | "href"> | null {
  for (const group of GROWTH_NAV_GROUP_DEFS) {
    for (const item of group.items) {
      if (item.match(pathname)) {
        return { id: item.id, label: item.label, href: pathname.startsWith(item.href) ? pathname : item.href }
      }
    }
  }
  return null
}

export function listGrowthNavigationPaletteHrefs(): string[] {
  const hrefs = new Set<string>()
  for (const entry of GROWTH_COMMAND_PALETTE_ENTRIES) {
    hrefs.add(entry.href.split("?")[0] ?? entry.href)
  }
  for (const group of GROWTH_NAV_GROUP_DEFS) {
    for (const item of group.items) {
      hrefs.add(item.href.split("?")[0] ?? item.href)
    }
  }
  return [...hrefs]
}
