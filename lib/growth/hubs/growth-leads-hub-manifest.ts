import { Search, Target } from "lucide-react"
import {
  GROWTH_LEADS_HUB_KPI_CARDS,
  GROWTH_LEADS_HUB_LAUNCHER_GROUPS,
  GROWTH_LEADS_HUB_RECENT_WORK_EMPTY,
  GROWTH_LEADS_HUB_SAVED_SEARCHES_EMPTY,
} from "@/lib/growth/hubs/growth-leads-hub-config"
import {
  GROWTH_LEADS_HUB_PROSPECT_SEARCH_DISCOVER_HREF,
  GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF,
  GROWTH_LEADS_HUB_RESEARCH_HREF,
} from "@/lib/growth/hubs/growth-workspace-hub-paths"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthWorkspaceHubManifest } from "@/lib/growth/hubs/growth-workspace-hub-types"

const BASE = GROWTH_WORKSPACE_BASE_PATH

const launcherActions = GROWTH_LEADS_HUB_LAUNCHER_GROUPS.flatMap((group) => group.actions)

export const GROWTH_LEADS_HUB_MANIFEST: GrowthWorkspaceHubManifest = {
  id: "leads",
  title: "Leads",
  description:
    "Daily lead operations — triage the revenue queue, research accounts, and jump into CRM or capture workflows.",
  icon: Target,
  iconClassName: "bg-emerald-50 text-emerald-600",
  overview: GROWTH_LEADS_HUB_KPI_CARDS.map((card) => ({
    id: card.id,
    label: card.label,
    hint: card.helper,
    emptyValue: card.emptyValue,
  })),
  quickActions: launcherActions
    .filter((action) => action.icon)
    .map((action) => ({
      id: action.id,
      label: action.label,
      description: action.description ?? "",
      href: action.href,
      icon: action.icon!,
    })),
  sections: [
    {
      id: "saved-searches",
      title: "Saved Searches",
      description: "Reusable ICP filters and discovery presets.",
      drilldowns: [
        {
          id: "prospect-search",
          label: "Prospect Search",
          description: "Open prospect search workspace",
          href: GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF,
        },
        {
          id: "discover-companies",
          label: "Discover Companies",
          description: "External company discovery mode",
          href: GROWTH_LEADS_HUB_PROSPECT_SEARCH_DISCOVER_HREF,
        },
      ],
      emptyHint: GROWTH_LEADS_HUB_SAVED_SEARCHES_EMPTY,
    },
    {
      id: "recent-work",
      title: "Recent Work",
      description: "Recently viewed companies, leads, and searches.",
      emptyHint: GROWTH_LEADS_HUB_RECENT_WORK_EMPTY,
    },
  ],
}

/** Secondary destinations surfaced in audit inventory — not rendered as duplicate hub cards. */
export const GROWTH_LEADS_HUB_SECONDARY_DESTINATIONS = [
  { action: "Lead Pipeline", href: `${BASE}/leads/lead-engine` },
  { action: "CRM Leads", href: `${BASE}/leads/crm` },
  { action: "Open CRM Leads", href: `${BASE}/leads/crm` },
  { action: "Recently Captured", href: `${BASE}/leads/captured` },
  { action: "Revenue Queue", href: GROWTH_LEADS_HUB_RESEARCH_HREF },
  { action: "Prospect Search", href: GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF },
  { action: "Discover Companies", href: GROWTH_LEADS_HUB_PROSPECT_SEARCH_DISCOVER_HREF },
] as const

/** @deprecated Use GROWTH_LEADS_HUB_UX_QA_MARKER — kept for hub audit compatibility. */
export const GROWTH_LEADS_HUB_LEGACY_SEARCH_ICON = Search
