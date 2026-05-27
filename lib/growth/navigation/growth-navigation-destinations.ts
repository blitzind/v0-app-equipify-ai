/** Growth Engine navigation IA — shared destinations for sidebar + command palette (IA v2). */

import type { GrowthSidebarConsoleKey } from "@/hooks/use-growth-sidebar-console"
import { GROWTH_COMMAND_REGISTRY } from "@/lib/growth/navigation/growth-command-registry"
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
  /** Reserved entries for upcoming surfaces — same routes, muted in sidebar. */
  futurePlaceholder?: boolean
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
    label: "Intent Signals",
    href: "/admin/growth/intent-pixel",
    keywords: ["intent", "visitor", "pixel", "tracking", "visitor tracking", "intent signals"],
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
    id: "sender-pools",
    label: "Sender Pools",
    href: "/admin/growth/providers/sender-pools",
    keywords: ["sender pool", "rotation", "round robin", "deliverability", "sender fatigue"],
  },
  {
    id: "deliverability-ops",
    label: "Deliverability Ops",
    href: "/admin/growth/providers/deliverability-ops",
    keywords: [
      "deliverability ops",
      "reputation",
      "spf",
      "dkim",
      "dmarc",
      "bounce",
      "complaint",
      "remediation",
      "risk alerts",
    ],
  },
  {
    id: "provider-compliance",
    label: "Compliance",
    href: "/admin/growth/providers/compliance",
    keywords: ["compliance", "bounce", "unsubscribe", "complaint", "suppression", "reputation"],
  },
  {
    id: "provider-webhooks",
    label: "Webhooks",
    href: "/admin/growth/providers/webhooks",
    keywords: ["webhook", "provider event", "delivery event", "bounce webhook", "signature"],
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
    id: "experiments",
    label: "Experiments",
    href: "/admin/growth/experiments",
    keywords: ["experiment", "ab test", "variant", "sequence test", "winner", "intelligence"],
  },
  {
    id: "content-library",
    label: "Content Library",
    href: "/admin/growth/copilot/content-library",
    keywords: ["content library", "template", "snippet", "merge field", "copy", "message block"],
  },
  {
    id: "revenue-intelligence",
    label: "Revenue Intelligence",
    href: "/admin/growth/revenue-intelligence",
    keywords: ["revenue intelligence", "sequence performance", "attribution", "analytics", "funnel"],
  },
  {
    id: "opportunity-intelligence",
    label: "Opportunity Intelligence",
    href: "/admin/growth/opportunity-intelligence",
    keywords: ["opportunity intelligence", "crm intelligence", "buying signals", "committee", "sequence pause"],
  },
  {
    id: "relationship-memory",
    label: "Relationship Memory",
    href: "/admin/growth/intelligence/relationship-memory",
    keywords: [
      "relationship memory",
      "lead memory",
      "objection memory",
      "preference memory",
      "committee context",
      "relationship timeline",
    ],
  },
  {
    id: "booking-intelligence",
    label: "Booking Intelligence",
    href: "/admin/growth/booking-intelligence",
    keywords: ["booking intelligence", "meeting intent", "calendar routing", "meeting conversion"],
  },
  {
    id: "multichannel",
    label: "Multi-Channel",
    href: "/admin/growth/multichannel",
    keywords: ["multichannel", "channel tasks", "manual call", "linkedin manual", "sequence orchestration"],
  },
  {
    id: "settings",
    label: "Growth Settings",
    href: "/admin/growth/settings",
    keywords: ["communication", "config"],
  },
]

/** @deprecated Sidebar quick actions removed — use GROWTH_COMMAND_REGISTRY for palette foundation. */
export const GROWTH_NAV_QUICK_ACTIONS: GrowthNavigationQuickAction[] = GROWTH_COMMAND_REGISTRY.map((entry) => ({
  id: entry.id,
  label: entry.label,
  href: entry.href,
  keywords: entry.keywords,
  aliases: entry.aliases,
  coreWorkflow: entry.coreWorkflow,
}))

export const GROWTH_NAV_QUICK_ACTIONS_SECONDARY: GrowthNavigationQuickAction[] = [
  {
    id: "import-leads",
    label: "Import Leads",
    href: "/admin/growth/imports",
    keywords: ["csv", "upload", "imports"],
  },
]

export const GROWTH_COMMAND_PALETTE_ENTRIES: GrowthCommandPaletteEntry[] = [
  ...GROWTH_COMMAND_REGISTRY.map((entry) => ({
    id: entry.id,
    label: entry.label,
    href: entry.href,
    keywords: entry.keywords,
    aliases: entry.aliases,
    coreWorkflow: entry.coreWorkflow,
    group: "command" as const,
  })),
  ...GROWTH_COMMAND_PALETTE_DESTINATIONS.map((dest) => ({
    id: dest.id,
    label: dest.label,
    href: dest.href,
    keywords: dest.keywords,
    aliases: dest.keywords,
    coreWorkflow: ["command", "inbox", "search", "intent-pixel", "call-workspace", "unified-inbox"].includes(dest.id),
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
        id: "prospect-search",
        href: "/admin/growth/search",
        label: "Prospect Search",
        match: prefixMatch("/admin/growth/search"),
      },
      {
        id: "unified-inbox",
        href: "/admin/growth/inbox",
        label: "Inbox",
        match: prefixMatch("/admin/growth/inbox"),
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
        id: "calls",
        href: "/admin/growth/calls",
        label: "Calls",
        consoleKey: "calls",
        shortcutKey: "c",
        match: (path) => {
          if (path.startsWith("/admin/growth/calls/workspace")) return false
          if (path.startsWith("/admin/growth/calls/providers")) return false
          if (path.startsWith("/admin/growth/calls/live-coaching")) return false
          if (path.startsWith("/admin/growth/leads/queue")) return true
          if (path === "/admin/growth/calls") return true
          if (path.startsWith("/admin/growth/calls/live")) return true
          return false
        },
      },
      {
        id: "meetings",
        href: "/admin/growth/meetings",
        label: "Meetings",
        match: prefixMatch("/admin/growth/meetings"),
      },
      {
        id: "outreach",
        href: "/admin/growth/outreach",
        label: "Outreach",
        consoleKey: "outreach",
        match: (path) => path === "/admin/growth/outreach",
      },
      {
        id: "sequences",
        href: "/admin/growth/sequences",
        label: "Sequences",
        consoleKey: "sequences",
        match: (path) =>
          path.startsWith("/admin/growth/sequences") && !path.startsWith("/admin/growth/sequences/execution"),
      },
      {
        id: "pipeline",
        href: "/admin/growth/opportunities/pipeline",
        label: "Pipeline",
        consoleKey: "opportunities",
        match: prefixMatch("/admin/growth/opportunities/pipeline"),
      },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      {
        id: "intent-pixel",
        href: "/admin/growth/intent-pixel",
        label: "Intent Signals",
        consoleKey: "intent_pixel",
        match: prefixMatch("/admin/growth/intent-pixel"),
      },
      {
        id: "lead-intelligence",
        href: "/admin/growth/leads/lead-engine",
        label: "Lead Intelligence",
        match: prefixMatch("/admin/growth/leads/lead-engine"),
      },
      {
        id: "conversations",
        href: "/admin/growth/conversations",
        label: "Conversations",
        consoleKey: "conversations",
        match: prefixMatch("/admin/growth/conversations"),
      },
      {
        id: "reply-inbox",
        href: "/admin/growth/replies",
        label: "Reply Inbox",
        consoleKey: "conversations",
        match: prefixMatch("/admin/growth/replies"),
      },
      {
        id: "relationships",
        href: "/admin/growth/relationships",
        label: "Relationships",
        consoleKey: "relationships",
        match: prefixMatch("/admin/growth/relationships"),
      },
      {
        id: "relationship-memory",
        href: "/admin/growth/intelligence/relationship-memory",
        label: "Relationship Memory",
        match: prefixMatch("/admin/growth/intelligence/relationship-memory"),
      },
      {
        id: "engagement",
        href: "/admin/growth/engagement",
        label: "Engagement",
        consoleKey: "engagement",
        match: prefixMatch("/admin/growth/engagement"),
      },
      {
        id: "experiments",
        href: "/admin/growth/experiments",
        label: "Experiments",
        match: prefixMatch("/admin/growth/experiments"),
      },
      {
        id: "revenue-intelligence",
        href: "/admin/growth/revenue-intelligence",
        label: "Revenue Intelligence",
        match: prefixMatch("/admin/growth/revenue-intelligence"),
      },
      {
        id: "opportunity-intelligence",
        href: "/admin/growth/opportunity-intelligence",
        label: "Opportunity Intelligence",
        match: prefixMatch("/admin/growth/opportunity-intelligence"),
      },
      {
        id: "revenue-operating",
        href: "/admin/growth/revenue-operating",
        label: "Revenue Forecast",
        consoleKey: "revenue",
        match: prefixMatch("/admin/growth/revenue-operating"),
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
      {
        id: "market-graph",
        href: "/admin/growth/search",
        label: "Market Graph",
        futurePlaceholder: true,
        match: (path) => path === "/admin/growth/search" && path.includes("market-graph"),
      },
      {
        id: "territory-intelligence",
        href: "/admin/growth/search",
        label: "Territory Intelligence",
        futurePlaceholder: true,
        match: (path) => path === "/admin/growth/search" && path.includes("territory"),
      },
      {
        id: "company-signals",
        href: "/admin/growth/search",
        label: "Company Signals",
        futurePlaceholder: true,
        match: (path) => path === "/admin/growth/search" && path.includes("company-signals"),
      },
      {
        id: "growth-signals",
        href: "/admin/growth/search",
        label: "Growth Signals",
        futurePlaceholder: true,
        match: (path) => path === "/admin/growth/search" && path.includes("growth-signals"),
      },
      {
        id: "committee-intelligence",
        href: "/admin/growth/search",
        label: "Committee Intelligence",
        futurePlaceholder: true,
        match: (path) => path === "/admin/growth/search" && path.includes("committee"),
      },
      {
        id: "opportunities",
        href: "/admin/growth/opportunities",
        label: "Opportunities",
        consoleKey: "opportunities",
        match: (path) => path === "/admin/growth/opportunities",
      },
      {
        id: "revenue",
        href: "/admin/growth/revenue",
        label: "Revenue Forecast",
        consoleKey: "revenue",
        shortcutKey: "r",
        match: (path) => path === "/admin/growth/revenue",
      },
    ],
  },
  {
    id: "execution",
    label: "Execution",
    items: [
      {
        id: "call-workspace",
        href: "/admin/growth/calls/workspace",
        label: "Call Workspace",
        consoleKey: "calls_workspace",
        match: prefixMatch("/admin/growth/calls/workspace"),
      },
      {
        id: "outreach-approval",
        href: "/admin/growth/outreach/approval",
        label: "Outreach Approval",
        consoleKey: "outreach_approval",
        match: prefixMatch("/admin/growth/outreach/approval"),
      },
      {
        id: "sequence-execution",
        href: "/admin/growth/sequences/execution",
        label: "Sequence Execution",
        consoleKey: "sequence_execution",
        match: prefixMatch("/admin/growth/sequences/execution"),
      },
      {
        id: "booking-intelligence",
        href: "/admin/growth/booking-intelligence",
        label: "Booking Intelligence",
        match: prefixMatch("/admin/growth/booking-intelligence"),
      },
      {
        id: "multichannel",
        href: "/admin/growth/multichannel",
        label: "Multi-Channel",
        match: prefixMatch("/admin/growth/multichannel"),
      },
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
      {
        id: "human-execution",
        href: "/admin/growth/execution",
        label: "Human Execution",
        match: prefixMatch("/admin/growth/execution"),
      },
    ],
  },
  {
    id: "lead-engine",
    label: "Lead Engine",
    items: [
      {
        id: "discover-companies",
        href: "/admin/growth/search?mode=discover",
        label: "Discover Companies",
        match: (path) => path.startsWith("/admin/growth/search"),
      },
      {
        id: "crm-leads",
        href: "/admin/growth/leads/crm",
        label: "CRM Leads",
        match: prefixMatch("/admin/growth/leads/crm"),
      },
      {
        id: "lead-engine-inspector",
        href: "/admin/growth/leads/lead-engine",
        label: "Lead Intelligence Inspector",
        match: prefixMatch("/admin/growth/leads/lead-engine"),
      },
      {
        id: "imports",
        href: "/admin/growth/imports",
        label: "Imports",
        consoleKey: "imports",
        match: prefixMatch("/admin/growth/imports"),
      },
      {
        id: "committee-mapping",
        href: "/admin/growth/search",
        label: "Committee Mapping",
        futurePlaceholder: true,
        match: (path) => path === "/admin/growth/search" && path.includes("committee-mapping"),
      },
      {
        id: "market-discovery",
        href: "/admin/growth/search?mode=discover",
        label: "Market Discovery",
        futurePlaceholder: true,
        match: (path) => path.startsWith("/admin/growth/search") && path.includes("market-discovery"),
      },
      {
        id: "territories",
        href: "/admin/growth/search",
        label: "Territories",
        futurePlaceholder: true,
        match: (path) => path === "/admin/growth/search" && path.includes("territories"),
      },
    ],
  },
  {
    id: "providers-nav",
    label: "Providers",
    items: [
      {
        id: "provider-delivery",
        href: "/admin/growth/providers/delivery",
        label: "Delivery",
        match: prefixMatch("/admin/growth/providers/delivery"),
      },
      {
        id: "sender-pools",
        href: "/admin/growth/providers/sender-pools",
        label: "Sender Pools",
        match: prefixMatch("/admin/growth/providers/sender-pools"),
      },
      {
        id: "deliverability-ops",
        href: "/admin/growth/providers/deliverability-ops",
        label: "Deliverability Ops",
        match: prefixMatch("/admin/growth/providers/deliverability-ops"),
      },
      {
        id: "provider-compliance",
        href: "/admin/growth/providers/compliance",
        label: "Compliance",
        match: prefixMatch("/admin/growth/providers/compliance"),
      },
      {
        id: "provider-webhooks",
        href: "/admin/growth/providers/webhooks",
        label: "Webhooks",
        match: prefixMatch("/admin/growth/providers/webhooks"),
      },
      {
        id: "mailbox-connections",
        href: "/admin/growth/infrastructure/mailboxes",
        label: "Mailbox Connections",
        match: prefixMatch("/admin/growth/infrastructure/mailboxes"),
      },
      {
        id: "infrastructure",
        href: "/admin/growth/infrastructure",
        label: "Sender Infrastructure",
        match: (path) =>
          path.startsWith("/admin/growth/infrastructure") &&
          !path.startsWith("/admin/growth/infrastructure/mailboxes") &&
          !path.startsWith("/admin/growth/infrastructure/deliverability") &&
          !path.startsWith("/admin/growth/infrastructure/warmup"),
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
        id: "providers",
        href: "/admin/growth/providers",
        label: "Provider Diagnostics",
        consoleKey: "providers",
        match: (path) =>
          path.startsWith("/admin/growth/providers") &&
          !path.startsWith("/admin/growth/providers/delivery") &&
          !path.startsWith("/admin/growth/providers/compliance") &&
          !path.startsWith("/admin/growth/providers/webhooks"),
      },
    ],
  },
  {
    id: "ai",
    label: "AI",
    items: [
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
        id: "content-library",
        href: "/admin/growth/copilot/content-library",
        label: "Content Library",
        consoleKey: "content-library",
        match: prefixMatch("/admin/growth/copilot/content-library"),
      },
      {
        id: "reply-drafts",
        href: "/admin/growth/copilot/reply-drafts",
        label: "Reply Drafts",
        consoleKey: "reply-drafts",
        match: prefixMatch("/admin/growth/copilot/reply-drafts"),
      },
      {
        id: "ai-research",
        href: "/admin/growth/leads/lead-engine",
        label: "AI Research",
        match: prefixMatch("/admin/growth/leads/lead-engine"),
      },
      {
        id: "ai-generations",
        href: "/admin/growth/copilot",
        label: "AI Generations",
        match: (path) => path === "/admin/growth/copilot",
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

/** Coerce pathname for nav matching — usePathname() may be null during hydration. */
export function normalizeGrowthPathname(pathname: string | null | undefined): string {
  return typeof pathname === "string" ? pathname : ""
}

export function safeMatchGrowthNavItem(item: GrowthNavItemDef, pathname: string | null | undefined): boolean {
  const normalized = normalizeGrowthPathname(pathname)
  if (!normalized) return false
  try {
    return item.match(normalized)
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.warn("[GrowthNavigation] GrowthNavigationResolution failed", { id: item.id })
    }
    return false
  }
}

export function resolveGrowthNavigationEntryFromPathname(
  pathname: string | null | undefined,
): Pick<GrowthCommandPaletteEntry, "id" | "label" | "href"> | null {
  const normalized = normalizeGrowthPathname(pathname)
  if (!normalized) return null

  try {
    for (const group of GROWTH_NAV_GROUP_DEFS) {
      for (const item of group.items) {
        if (safeMatchGrowthNavItem(item, normalized)) {
          const baseHref = item.href.split("?")[0] ?? item.href
          return {
            id: item.id,
            label: item.label,
            href: normalized.startsWith(baseHref) ? normalized : item.href,
          }
        }
      }
    }
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.warn("[GrowthNavigation] GrowthNavigationResolution failed")
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
