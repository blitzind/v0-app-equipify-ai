/** Growth Engine navigation IA — shared destinations for sidebar + command palette (IA v2). */

import type { GrowthSidebarConsoleKey } from "@/hooks/use-growth-sidebar-console"
import {
  GROWTH_COMMAND_REGISTRY,
  GROWTH_PROSPECT_SEARCH_DISCOVER_HREF,
} from "@/lib/growth/navigation/growth-command-registry"
import type { GrowthCommandPaletteEntry } from "@/lib/growth/navigation/growth-navigation-ranking"
import {
  GROWTH_CALLS_PRIMARY_HREF,
  GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER,
  GROWTH_WORKSPACE_GROUP_DESCRIPTION,
} from "@/lib/growth/navigation/growth-workspace-consolidation"

export { GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER, GROWTH_WORKSPACE_GROUP_DESCRIPTION }

export const GROWTH_NAVIGATION_IA_QA_MARKER = "growth-navigation-ia-v2" as const
export const GROWTH_DELIVERY_OPS_NAV_QA_MARKER = "growth-delivery-ops-nav-v1" as const
export const GROWTH_NAV_LEAD_INTELLIGENCE_SINGLE_HOME_QA_MARKER =
  "growth-nav-lead-intelligence-single-home-v1" as const

export const GROWTH_DELIVERY_OPS_NAV_SECTIONS = {
  configuration: "Configuration",
  sendingAssets: "Sending Assets",
  deliverability: "Deliverability",
  system: "System",
} as const

export const GROWTH_LEAD_INTELLIGENCE_INSPECTOR_HREF = "/admin/growth/leads/lead-engine" as const

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
  /** Optional subsection label for grouped flyout/mobile nav (e.g. Delivery Ops). */
  section?: string
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

function growthCallsNavMatch(path: string): boolean {
  if (path.startsWith("/admin/growth/calls/providers")) return false
  if (path.startsWith("/admin/growth/calls/voice-drops")) return false
  if (path.startsWith("/admin/growth/leads/queue")) return true
  if (path.startsWith("/admin/growth/calls")) return true
  return false
}

function exactMatch(route: string) {
  return (path: string) => path === route
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
    href: GROWTH_PROSPECT_SEARCH_DISCOVER_HREF,
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
    id: "internal-outbound-operations",
    label: "Send Infrastructure",
    href: "/admin/growth/infrastructure/outbound-operations",
    keywords: ["mailboxes", "sender pools", "transport", "internal outbound", "advanced"],
  },
  {
    id: "outbound-operations",
    label: "Outbound Console",
    href: "/admin/growth/operations/outbound",
    keywords: ["operations", "cron", "queue", "telemetry", "outbound ops", "recovery", "approvals"],
  },
  {
    id: "provider-setup",
    label: "Provider Connections",
    href: "/admin/growth/providers/setup",
    keywords: ["provider connections", "provider setup", "oauth", "google", "microsoft", "smtp", "ses", "resend", "credentials"],
  },
  {
    id: "provider-delivery",
    label: "Send Routing",
    href: "/admin/growth/providers/delivery",
    keywords: ["send routing", "delivery", "provider", "route", "transport"],
  },
  {
    id: "sender-pools",
    label: "Sender Pools",
    href: "/admin/growth/providers/sender-pools",
    keywords: ["sender pool", "rotation", "round robin", "deliverability", "sender fatigue"],
  },
  {
    id: "deliverability-protection",
    label: "Protection",
    href: "/admin/growth/deliverability",
    keywords: [
      "deliverability",
      "reputation",
      "mailbox health",
      "throttle",
      "warmup",
      "bounce",
      "complaint",
      "sender reputation",
    ],
  },
  {
    id: "deliverability-ops",
    label: "Deliverability Ops",
    href: "/admin/growth/providers/deliverability-ops",
    keywords: [
      "deliverability operations",
      "telemetry",
      "queue health",
      "provider operations",
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
    href: GROWTH_LEAD_INTELLIGENCE_INSPECTOR_HREF,
    keywords: ["lead engine", "inspector", "pipeline", "lead intelligence", "pipeline inspector"],
  },
  {
    id: "calls",
    label: "Calls",
    href: GROWTH_CALLS_PRIMARY_HREF,
    keywords: ["call", "dial", "phone", "live call", "workspace", "copilot", "coaching"],
    consoleKey: "calls_workspace",
  },
  {
    id: "calls-live",
    label: "Calls — Live monitor",
    href: "/admin/growth/calls/live",
    keywords: ["live calls", "active calls", "phone", "live monitor"],
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
    label: "Diagnostics",
    href: "/admin/growth/providers",
    keywords: ["diagnostics", "provider", "api", "debug"],
    consoleKey: "providers",
  },
  {
    id: "infrastructure",
    label: "Sender Management",
    href: "/admin/growth/infrastructure",
    keywords: ["sender management", "sender", "infrastructure", "domain", "warmup"],
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
    keywords: ["deliverability", "dns", "spf", "dkim", "dmarc", "mailbox setup", "mx", "domain authentication"],
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
    id: "ai-personalization",
    label: "AI Personalization",
    href: "/admin/growth/copilot/personalization",
    keywords: [
      "ai personalization",
      "personalization",
      "evidence",
      "outbound copy",
      "prospect personalization",
      "approval queue",
    ],
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
    label: "Growth",
    href: "/admin/growth/settings/growth",
    keywords: ["growth", "defaults", "safeguards", "automation", "workspace rules"],
  },
  {
    id: "communications-settings",
    label: "Communications",
    href: "/admin/growth/settings/communications",
    keywords: ["communication", "calendar", "email", "voice", "dialer", "booking"],
  },
  {
    id: "governance",
    label: "Governance",
    href: "/admin/growth/settings/governance",
    keywords: [
      "governance",
      "enterprise governance",
      "policy",
      "audit",
      "retention",
      "export",
      "compliance export",
      "approval audit",
    ],
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
    coreWorkflow: ["command", "inbox", "search", "intent-pixel", "calls", "unified-inbox"].includes(dest.id),
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
    label: "Workspace",
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
        href: GROWTH_CALLS_PRIMARY_HREF,
        label: "Calls",
        consoleKey: "calls_workspace",
        shortcutKey: "c",
        match: growthCallsNavMatch,
      },
      {
        id: "meetings",
        href: "/admin/growth/meetings",
        label: "Meetings",
        match: prefixMatch("/admin/growth/meetings"),
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
    id: "lead-engine",
    label: "Lead Engine",
    items: [
      {
        id: "prospect-search",
        href: GROWTH_PROSPECT_SEARCH_DISCOVER_HREF,
        label: "Prospect Search",
        match: prefixMatch("/admin/growth/search"),
      },
      {
        id: "crm-leads",
        href: "/admin/growth/leads/crm",
        label: "CRM Leads",
        match: prefixMatch("/admin/growth/leads/crm"),
      },
      {
        id: "lead-engine-inspector",
        href: GROWTH_LEAD_INTELLIGENCE_INSPECTOR_HREF,
        label: "Lead Intelligence Inspector",
        match: prefixMatch(GROWTH_LEAD_INTELLIGENCE_INSPECTOR_HREF),
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
        shortcutKey: "r",
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
    ],
  },
  {
    id: "execution",
    label: "Execution",
    items: [
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
        id: "human-execution",
        href: "/admin/growth/execution",
        label: "Human Execution",
        match: prefixMatch("/admin/growth/execution"),
      },
    ],
  },
  {
    id: "providers-nav",
    label: "Delivery Ops",
    items: [
      {
        id: "outbound-operations",
        href: "/admin/growth/operations/outbound",
        label: "Outbound Console",
        match: prefixMatch("/admin/growth/operations/outbound"),
      },
      {
        id: "provider-setup",
        href: "/admin/growth/providers/setup",
        label: "Provider Connections",
        section: GROWTH_DELIVERY_OPS_NAV_SECTIONS.configuration,
        match: prefixMatch("/admin/growth/providers/setup"),
      },
      {
        id: "deliverability-ops",
        href: "/admin/growth/providers/deliverability-ops",
        label: "Outbound Readiness",
        section: GROWTH_DELIVERY_OPS_NAV_SECTIONS.configuration,
        match: prefixMatch("/admin/growth/providers/deliverability-ops"),
      },
      {
        id: "provider-delivery",
        href: "/admin/growth/providers/delivery",
        label: "Send Routing",
        section: GROWTH_DELIVERY_OPS_NAV_SECTIONS.configuration,
        match: prefixMatch("/admin/growth/providers/delivery"),
      },
      {
        id: "infrastructure",
        href: "/admin/growth/infrastructure",
        label: "Sender Management",
        section: GROWTH_DELIVERY_OPS_NAV_SECTIONS.sendingAssets,
        match: (path) =>
          path.startsWith("/admin/growth/infrastructure") &&
          !path.startsWith("/admin/growth/infrastructure/mailboxes") &&
          !path.startsWith("/admin/growth/infrastructure/deliverability") &&
          !path.startsWith("/admin/growth/infrastructure/warmup") &&
          !path.startsWith("/admin/growth/infrastructure/outbound-operations"),
      },
      {
        id: "sender-pools",
        href: "/admin/growth/providers/sender-pools",
        label: "Sender Pools",
        section: GROWTH_DELIVERY_OPS_NAV_SECTIONS.sendingAssets,
        match: prefixMatch("/admin/growth/providers/sender-pools"),
      },
      {
        id: "mailbox-connections",
        href: "/admin/growth/infrastructure/mailboxes",
        label: "Mailbox Connections",
        section: GROWTH_DELIVERY_OPS_NAV_SECTIONS.sendingAssets,
        match: prefixMatch("/admin/growth/infrastructure/mailboxes"),
      },
      {
        id: "internal-outbound-operations",
        href: "/admin/growth/infrastructure/outbound-operations",
        label: "Send Infrastructure",
        section: GROWTH_DELIVERY_OPS_NAV_SECTIONS.sendingAssets,
        match: prefixMatch("/admin/growth/infrastructure/outbound-operations"),
      },
      {
        id: "deliverability",
        href: "/admin/growth/infrastructure/deliverability",
        label: "Deliverability",
        section: GROWTH_DELIVERY_OPS_NAV_SECTIONS.deliverability,
        match: prefixMatch("/admin/growth/infrastructure/deliverability"),
      },
      {
        id: "warmup",
        href: "/admin/growth/infrastructure/warmup",
        label: "Warmup",
        section: GROWTH_DELIVERY_OPS_NAV_SECTIONS.deliverability,
        match: prefixMatch("/admin/growth/infrastructure/warmup"),
      },
      {
        id: "deliverability-protection",
        href: "/admin/growth/deliverability",
        label: "Protection",
        section: GROWTH_DELIVERY_OPS_NAV_SECTIONS.deliverability,
        match: prefixMatch("/admin/growth/deliverability"),
      },
      {
        id: "provider-compliance",
        href: "/admin/growth/providers/compliance",
        label: "Compliance",
        section: GROWTH_DELIVERY_OPS_NAV_SECTIONS.deliverability,
        match: prefixMatch("/admin/growth/providers/compliance"),
      },
      {
        id: "provider-webhooks",
        href: "/admin/growth/providers/webhooks",
        label: "Webhooks",
        section: GROWTH_DELIVERY_OPS_NAV_SECTIONS.system,
        match: prefixMatch("/admin/growth/providers/webhooks"),
      },
      {
        id: "providers",
        href: "/admin/growth/providers",
        label: "Diagnostics",
        consoleKey: "providers",
        section: GROWTH_DELIVERY_OPS_NAV_SECTIONS.system,
        match: (path) =>
          path.startsWith("/admin/growth/providers") &&
          !path.startsWith("/admin/growth/providers/delivery") &&
          !path.startsWith("/admin/growth/providers/setup") &&
          !path.startsWith("/admin/growth/providers/compliance") &&
          !path.startsWith("/admin/growth/providers/webhooks") &&
          !path.startsWith("/admin/growth/providers/deliverability-ops") &&
          !path.startsWith("/admin/growth/providers/sender-pools"),
      },
    ],
  },
  {
    id: "ai",
    label: "Copilot",
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
        id: "ai-personalization",
        href: "/admin/growth/copilot/personalization",
        label: "Personalization",
        consoleKey: "ai-personalization",
        match: prefixMatch("/admin/growth/copilot/personalization"),
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      {
        id: "growth-settings",
        href: "/admin/growth/settings/growth",
        label: "Growth",
        match: (path) => path === "/admin/growth/settings/growth" || path === "/admin/growth/settings",
      },
      {
        id: "communication-settings",
        href: "/admin/growth/settings/communications",
        label: "Communications",
        match: exactMatch("/admin/growth/settings/communications"),
      },
      {
        id: "provider-settings",
        href: "/admin/growth/calls/providers",
        label: "Providers",
        match: prefixMatch("/admin/growth/calls/providers"),
      },
      {
        id: "provider-health",
        href: "/admin/growth/settings/provider-health",
        label: "Provider Health",
        match: exactMatch("/admin/growth/settings/provider-health"),
      },
      {
        id: "governance",
        href: "/admin/growth/settings/governance",
        label: "Governance",
        match: exactMatch("/admin/growth/settings/governance"),
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
    if (normalized.startsWith(GROWTH_LEAD_INTELLIGENCE_INSPECTOR_HREF)) {
      const leadEngineGroup = GROWTH_NAV_GROUP_DEFS.find((group) => group.id === "lead-engine")
      const inspector = leadEngineGroup?.items.find((item) => item.id === "lead-engine-inspector")
      if (inspector) {
        return {
          id: inspector.id,
          label: inspector.label,
          href: normalized.startsWith(GROWTH_LEAD_INTELLIGENCE_INSPECTOR_HREF)
            ? normalized
            : inspector.href,
        }
      }
    }

    for (const group of GROWTH_NAV_GROUP_DEFS) {
      for (const item of group.items) {
        if (item.futurePlaceholder) continue
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
