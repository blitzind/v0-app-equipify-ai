import {
  ClipboardList,
  Import,
  ListOrdered,
  Search,
  Target,
  Upload,
  UserPlus,
} from "lucide-react"
import { GROWTH_PROSPECT_SEARCH_DISCOVER_HREF } from "@/lib/growth/navigation/growth-command-registry"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import { GROWTH_LEADS_HUB_RESEARCH_HREF } from "@/lib/growth/hubs/growth-workspace-hub-paths"
import type { GrowthWorkspaceHubManifest } from "@/lib/growth/hubs/growth-workspace-hub-types"

const BASE = GROWTH_WORKSPACE_BASE_PATH

export const GROWTH_LEADS_HUB_MANIFEST: GrowthWorkspaceHubManifest = {
  id: "leads",
  title: "Leads",
  description:
    "Daily lead operations — triage the revenue queue, research accounts, and jump into CRM or capture workflows.",
  icon: Target,
  iconClassName: "bg-emerald-50 text-emerald-600",
  overview: [
    { id: "queue-depth", label: "Queue depth", hint: "Open research queue" },
    { id: "new-this-week", label: "New this week", hint: "Review captured leads" },
    { id: "ready-to-call", label: "Ready to call", hint: "Open call queue" },
    { id: "research-runs", label: "Research runs", hint: "Open lead pipeline" },
  ],
  quickActions: [
    {
      id: "open-research-queue",
      label: "Revenue queue",
      description: "Prioritized accounts needing operator review or enrichment.",
      href: GROWTH_LEADS_HUB_RESEARCH_HREF,
      icon: ListOrdered,
    },
    {
      id: "prospect-search",
      label: "Prospect search",
      description: "Discover companies and source new accounts.",
      href: GROWTH_PROSPECT_SEARCH_DISCOVER_HREF,
      icon: Search,
    },
    {
      id: "lead-pipeline",
      label: "Lead pipeline",
      description: "Run qualification, enrichment, and research workflows.",
      href: `${BASE}/leads/lead-engine`,
      icon: ClipboardList,
    },
    {
      id: "captured-leads",
      label: "Captured leads",
      description: "Review recently captured prospects.",
      href: `${BASE}/leads/captured`,
      icon: Upload,
    },
    {
      id: "crm-leads",
      label: "CRM leads",
      description: "Browse legacy CRM lead records.",
      href: `${BASE}/leads/crm`,
      icon: UserPlus,
    },
    {
      id: "call-queue",
      label: "Call queue",
      description: "Ranked leads worth calling next.",
      href: `${BASE}/leads/queue`,
      icon: Import,
      variant: "outline",
    },
  ],
  sections: [
    {
      id: "overview",
      title: "Overview",
      description: "Start here for queue health and where to focus next.",
      emptyHint: "Open the revenue queue or call queue to populate daily lead work.",
    },
    {
      id: "quick-actions",
      title: "Quick Actions",
      description: "Common lead workflows without leaving the hub mental model.",
    },
    {
      id: "recent-leads",
      title: "Recent Leads",
      description: "Recently viewed lead records from this browser session.",
      drilldowns: [
        {
          id: "crm",
          label: "Open CRM leads",
          description: "Search and open lead records in the CRM workspace.",
          href: `${BASE}/leads/crm`,
        },
        {
          id: "captured",
          label: "Recently captured",
          description: "Leads captured from intake flows and extensions.",
          href: `${BASE}/leads/captured`,
        },
      ],
      emptyHint: "Lead detail views will appear here after you open records from CRM or the queue.",
    },
    {
      id: "saved-searches",
      title: "Saved Searches",
      description: "Saved prospect searches and discovery presets.",
      drilldowns: [
        {
          id: "prospect-search",
          label: "Prospect search",
          description: "Discover companies and run ICP searches.",
          href: GROWTH_PROSPECT_SEARCH_DISCOVER_HREF,
        },
        {
          id: "lead-engine",
          label: "Lead pipeline",
          description: "Saved-search workflow launch links live in the pipeline inspector.",
          href: `${BASE}/leads/lead-engine`,
        },
      ],
      emptyHint: "Saved search shortcuts surface from Prospect Search and Lead Pipeline.",
    },
    {
      id: "prospect-search",
      title: "Prospect Search",
      description: "External discovery and internal index search entry points.",
      drilldowns: [
        {
          id: "discover",
          label: "Discover companies",
          description: "External company discovery mode.",
          href: GROWTH_PROSPECT_SEARCH_DISCOVER_HREF,
        },
      ],
    },
    {
      id: "research-queue",
      title: "Research Queue",
      description: "Revenue queue — prioritized operator triage and enrichment.",
      drilldowns: [
        {
          id: "revenue-queue",
          label: "Open revenue queue",
          description: "Full prioritized inbox for lead review and pipeline action.",
          href: GROWTH_LEADS_HUB_RESEARCH_HREF,
        },
        {
          id: "lead-engine",
          label: "Lead pipeline",
          description: "Inspector and research runs for active accounts.",
          href: `${BASE}/leads/lead-engine`,
        },
      ],
    },
    {
      id: "recent-activity",
      title: "Recent Activity",
      description: "Recent Growth workspace views related to lead work.",
      emptyHint: "Activity appears after you visit lead destinations in this browser.",
    },
  ],
}
