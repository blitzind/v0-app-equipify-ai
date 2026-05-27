/** Growth command registry — Cmd+K foundation only (no palette UI wiring yet). */

export const GROWTH_COMMAND_REGISTRY_QA_MARKER = "growth-command-registry-v1" as const

/** Default Prospect Search entry — opens external discovery (alias: mode=discover). */
export const GROWTH_PROSPECT_SEARCH_DISCOVER_HREF = "/admin/growth/search?mode=discover" as const

/** Explicit internal index search — preserves Search internal workflow. */
export const GROWTH_PROSPECT_SEARCH_INTERNAL_HREF = "/admin/growth/search?mode=internal" as const

export type GrowthCommandRegistryEntry = {
  id: string
  label: string
  href: string
  keywords?: string[]
  aliases?: string[]
  coreWorkflow?: boolean
  /** Reserved for future keyboard palette (Cmd+K). */
  paletteEnabled?: boolean
}

export const GROWTH_COMMAND_REGISTRY: GrowthCommandRegistryEntry[] = [
  {
    id: "prospect-search",
    label: "Prospect Search",
    href: GROWTH_PROSPECT_SEARCH_DISCOVER_HREF,
    keywords: ["prospect", "search", "discover", "companies", "icp", "internal"],
    aliases: ["discover companies", "market discovery"],
    coreWorkflow: true,
    paletteEnabled: true,
  },
  {
    id: "open-inbox",
    label: "Open Inbox",
    href: "/admin/growth/inbox",
    keywords: ["inbox", "reply", "thread", "unified inbox"],
    aliases: ["unified inbox"],
    coreWorkflow: true,
    paletteEnabled: true,
  },
  {
    id: "run-lead-research",
    label: "Run Lead Research",
    href: "/admin/growth/leads/lead-engine",
    keywords: ["lead engine", "research", "inspector", "intelligence"],
    aliases: ["lead intelligence", "pipeline inspector"],
    coreWorkflow: true,
    paletteEnabled: true,
  },
  {
    id: "start-live-call",
    label: "Start Live Call",
    href: "/admin/growth/calls/workspace",
    keywords: ["call", "dial", "phone", "live call", "workspace"],
    aliases: ["dialer", "call workspace"],
    coreWorkflow: true,
    paletteEnabled: true,
  },
  {
    id: "create-sequence",
    label: "Create Sequence",
    href: "/admin/growth/sequences",
    keywords: ["sequence", "cadence", "outbound sequence"],
    coreWorkflow: true,
    paletteEnabled: true,
  },
  {
    id: "review-outreach",
    label: "Review Outreach",
    href: "/admin/growth/outreach/approval",
    keywords: ["outreach", "approval", "review", "pending"],
    coreWorkflow: true,
    paletteEnabled: true,
  },
  {
    id: "open-provider-delivery",
    label: "Open Provider Delivery",
    href: "/admin/growth/providers/delivery",
    keywords: ["delivery", "provider", "route", "transport"],
    aliases: ["provider delivery"],
    paletteEnabled: true,
  },
]
