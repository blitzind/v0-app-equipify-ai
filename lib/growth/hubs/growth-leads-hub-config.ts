import type { LucideIcon } from "lucide-react"
import {
  ClipboardList,
  Download,
  FileUp,
  Import,
  ListOrdered,
  Search,
  Upload,
  UserPlus,
} from "lucide-react"
import {
  GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF,
  GROWTH_LEADS_HUB_RESEARCH_HREF,
} from "@/lib/growth/hubs/growth-workspace-hub-paths"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"

export const GROWTH_LEADS_HUB_UX_QA_MARKER = "growth-leads-hub-operator-home-v5" as const

const BASE = GROWTH_WORKSPACE_BASE_PATH

export type GrowthLeadsHubPipelineMetric = {
  id: string
  label: string
  href: string
  metricKey: keyof Pick<
    import("@/lib/growth/hubs/growth-leads-hub-metrics-client").GrowthLeadsHubMetricsSnapshot,
    "leadsAwaitingResearch" | "readyToCall" | "meetingsScheduled" | "followUpsOverdue"
  >
}

export type GrowthLeadsHubCreateAction = {
  id: string
  label: string
  href: string
}

export type GrowthLeadsHubRevenueQueueCard = {
  id: string
  label: string
  description: string
  href: string
  metricKey: keyof Pick<
    import("@/lib/growth/hubs/growth-leads-hub-metrics-client").GrowthLeadsHubMetricsSnapshot,
    "accountsAwaitingResearch" | "readyToCall" | "needFollowUp"
  >
}

export type GrowthLeadsHubKpiCard = {
  id: string
  label: string
  helper: string
  href: string
  metricKey: keyof import("@/lib/growth/hubs/growth-leads-hub-metrics-client").GrowthLeadsHubMetricsSnapshot
}

export const GROWTH_LEADS_HUB_PIPELINE_METRICS: GrowthLeadsHubPipelineMetric[] = [
  {
    id: "awaiting-research",
    label: "Leads Awaiting Research",
    href: GROWTH_LEADS_HUB_RESEARCH_HREF,
    metricKey: "leadsAwaitingResearch",
  },
  {
    id: "ready-to-call",
    label: "Ready To Call",
    href: `${BASE}/leads/queue`,
    metricKey: "readyToCall",
  },
  {
    id: "meetings-scheduled",
    label: "Meetings Scheduled",
    href: `${BASE}/meetings`,
    metricKey: "meetingsScheduled",
  },
  {
    id: "follow-ups-overdue",
    label: "Follow-Ups Overdue",
    href: `${BASE}/leads/queue`,
    metricKey: "followUpsOverdue",
  },
]

export const GROWTH_LEADS_HUB_REVENUE_QUEUE_CARDS: GrowthLeadsHubRevenueQueueCard[] = [
  {
    id: "awaiting-research",
    label: "Accounts Awaiting Research",
    description: "Accounts that still need enrichment or review.",
    href: GROWTH_LEADS_HUB_RESEARCH_HREF,
    metricKey: "accountsAwaitingResearch",
  },
  {
    id: "ready-to-call",
    label: "Ready To Call",
    description: "Leads queued and ready for outbound calls.",
    href: `${BASE}/leads/queue`,
    metricKey: "readyToCall",
  },
  {
    id: "need-follow-up",
    label: "Need Follow-Up",
    description: "High-priority leads requiring operator attention.",
    href: GROWTH_LEADS_HUB_RESEARCH_HREF,
    metricKey: "needFollowUp",
  },
]

export const GROWTH_LEADS_HUB_KEYBOARD_HINTS = [
  { id: "search", keys: "⌘K", label: "Search" },
  { id: "new", keys: "N", label: "New" },
  { id: "prospect-search", keys: "G", label: "Prospect Search" },
] as const

export const GROWTH_LEADS_HUB_CREATE_ACTIONS: GrowthLeadsHubCreateAction[] = [
  { id: "prospect-search", label: "Prospect Search", href: GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF },
  { id: "import-leads", label: "Import Leads", href: `${BASE}/leads/captured` },
  { id: "add-lead", label: "Add Lead", href: `${BASE}/leads/crm` },
  { id: "start-research-run", label: "Research Run", href: `${BASE}/leads/lead-engine` },
]

export type GrowthLeadsHubPrimaryAction = {
  id: string
  label: string
  description: string
  href: string
  icon: LucideIcon
}

export type GrowthLeadsHubLauncherAction = {
  id: string
  label: string
  description?: string
  href: string
  icon?: LucideIcon
  badge?: string | null
}

export type GrowthLeadsHubLauncherGroup = {
  id: string
  title: string
  actions: GrowthLeadsHubLauncherAction[]
}

export const GROWTH_LEADS_HUB_PRIMARY_ACTIONS: GrowthLeadsHubPrimaryAction[] = [
  {
    id: "prospect-search",
    label: "Prospect Search",
    description: "Discover companies and decision makers.",
    href: GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF,
    icon: Search,
  },
  {
    id: "import-leads",
    label: "Import Leads",
    description: "Import CSVs and captured prospects.",
    href: `${BASE}/leads/captured`,
    icon: Upload,
  },
]

export const GROWTH_LEADS_HUB_KPI_CARDS: GrowthLeadsHubKpiCard[] = [
  {
    id: "queue-depth",
    label: "Queue Depth",
    helper: "Accounts awaiting research",
    href: GROWTH_LEADS_HUB_RESEARCH_HREF,
    metricKey: "queueDepth",
  },
  {
    id: "captured-today",
    label: "Captured Today",
    helper: "New prospects imported",
    href: `${BASE}/leads/captured`,
    metricKey: "capturedToday",
  },
  {
    id: "ready-to-call",
    label: "Ready to Call",
    helper: "Leads requiring follow-up",
    href: `${BASE}/leads/queue`,
    metricKey: "readyToCall",
  },
  {
    id: "research-runs",
    label: "Research Runs",
    helper: "Enrichment jobs completed",
    href: `${BASE}/leads/lead-engine`,
    metricKey: "researchRuns",
  },
]

export const GROWTH_LEADS_HUB_LAUNCHER_GROUPS: GrowthLeadsHubLauncherGroup[] = [
  {
    id: "find-accounts",
    title: "Find New Accounts",
    actions: [
      {
        id: "prospect-search",
        label: "Prospect Search",
        href: GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF,
        icon: Search,
      },
      {
        id: "saved-searches",
        label: "Saved Searches",
        href: `${BASE}/leads#saved-searches`,
        icon: Search,
      },
      {
        id: "research-runs",
        label: "Research Runs",
        href: `${BASE}/leads/lead-engine`,
        icon: ClipboardList,
      },
    ],
  },
  {
    id: "work-pipeline",
    title: "Work Pipeline",
    actions: [
      {
        id: "revenue-queue",
        label: "Revenue Queue",
        href: GROWTH_LEADS_HUB_RESEARCH_HREF,
        icon: ListOrdered,
      },
      {
        id: "ready-to-call",
        label: "Ready to Call",
        href: `${BASE}/leads/queue`,
        icon: Import,
      },
      {
        id: "recently-captured",
        label: "Recently Captured",
        href: `${BASE}/leads/captured`,
        icon: Upload,
      },
    ],
  },
  {
    id: "manage-records",
    title: "Manage Records",
    actions: [
      {
        id: "leads",
        label: "Leads",
        href: `${BASE}/leads/crm`,
        icon: UserPlus,
      },
      {
        id: "accounts",
        label: "Accounts",
        href: GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF,
        icon: Search,
      },
      {
        id: "imports",
        label: "Imports",
        href: `${BASE}/leads/captured`,
        icon: FileUp,
      },
      {
        id: "exports",
        label: "Exports",
        href: `${BASE}/leads/crm`,
        icon: Download,
      },
    ],
  },
]

export const GROWTH_LEADS_HUB_SEARCH_PLACEHOLDER = "Search companies, contacts, leads, campaigns…"

export const GROWTH_LEADS_HUB_SEARCH_EMPTY_HINT =
  "Try a company, contact, lead, campaign, meeting, call, saved search, share page, or video."

export const GROWTH_LEADS_HUB_RECENT_WORK_EMPTY =
  "No recent activity yet.\nYour recent searches and lead activity will appear here."

export const GROWTH_LEADS_HUB_SAVED_SEARCHES_EMPTY =
  "No favorite saved searches yet. Star a search in Prospect Search to pin it here."

export const GROWTH_LEADS_HUB_FAVORITE_SAVED_SEARCHES_LIMIT = 3 as const

export function growthLeadsHubSavedSearchIsScheduled(
  saved: import("@/lib/growth/prospect-search/saved-search-workflows").GrowthProspectSearchSavedSearchWithWorkflow,
): boolean {
  const meta = saved.metadata ?? {}
  return (
    meta.scheduled === true ||
    meta.is_scheduled === true ||
    typeof meta.next_refresh_at === "string" ||
    typeof meta.refresh_schedule === "string"
  )
}

export function growthLeadsHubSavedSearchScheduleLabel(
  saved: import("@/lib/growth/prospect-search/saved-search-workflows").GrowthProspectSearchSavedSearchWithWorkflow,
): string | null {
  const meta = saved.metadata ?? {}
  if (typeof meta.refresh_schedule === "string") return meta.refresh_schedule
  if (meta.scheduled === true || meta.is_scheduled === true) return "Scheduled Daily"
  return null
}

export function growthLeadsHubSavedSearchResultDeltaLabel(
  saved: import("@/lib/growth/prospect-search/saved-search-workflows").GrowthProspectSearchSavedSearchWithWorkflow,
): string | null {
  const delta = saved.workflow.countDelta
  if (delta == null || delta <= 0) return null
  return `${delta.toLocaleString()} new since yesterday`
}

export type GrowthLeadsHubRevenueQueueCardDetail = {
  primary: string
  secondary: string
  tertiary: string
}

export function growthLeadsHubRevenueQueueCardDetails(
  cardId: string,
  metrics: import("@/lib/growth/hubs/growth-leads-hub-metrics-client").GrowthLeadsHubMetricsSnapshot,
): GrowthLeadsHubRevenueQueueCardDetail {
  switch (cardId) {
    case "awaiting-research":
      return {
        primary: `${(metrics.accountsAwaitingResearch ?? 0).toLocaleString()} accounts`,
        secondary: `${(metrics.needsReviewCount ?? 0).toLocaleString()} need review`,
        tertiary: `${(metrics.enrichmentNeededCount ?? 0).toLocaleString()} need enrichment`,
      }
    case "ready-to-call":
      return {
        primary: `${(metrics.readyToCall ?? 0).toLocaleString()} accounts`,
        secondary: `${(metrics.highPriorityCount ?? 0).toLocaleString()} high priority`,
        tertiary: `${(metrics.followUpsOverdue ?? 0).toLocaleString()} overdue`,
      }
    case "need-follow-up":
      return {
        primary: `${(metrics.needFollowUp ?? 0).toLocaleString()} accounts`,
        secondary: `${(metrics.highPriorityCount ?? 0).toLocaleString()} high priority`,
        tertiary: `${(metrics.needsReviewCount ?? 0).toLocaleString()} awaiting review`,
      }
    default:
      return { primary: "— accounts", secondary: "— high priority", tertiary: "— overdue" }
  }
}

export function growthLeadsHubSavedSearchRunHref(savedSearchId: string): string {
  const params = new URLSearchParams({ savedSearchId })
  return `${GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF}?${params.toString()}`
}

const HOT_SAVED_SEARCH_RESULT_THRESHOLD = 25

export function growthLeadsHubSavedSearchBadges(
  saved: import("@/lib/growth/prospect-search/saved-search-workflows").GrowthProspectSearchSavedSearchWithWorkflow,
  favorite: boolean,
): string[] {
  const badges: string[] = []
  if (favorite) badges.push("⭐ Favorite")
  if ((saved.workflow.resultCount ?? 0) >= HOT_SAVED_SEARCH_RESULT_THRESHOLD) badges.push("🔥 Hot")
  const meta = saved.metadata ?? {}
  if (
    meta.scheduled === true ||
    meta.is_scheduled === true ||
    typeof meta.next_refresh_at === "string" ||
    typeof meta.refresh_schedule === "string"
  ) {
    badges.push("⏰ Scheduled")
  }
  return badges
}

/** @deprecated Quick Create removed in UX-AUDIT-3 — use primary actions + launcher. */
export const GROWTH_LEADS_HUB_QUICK_CREATE_ACTIONS = [] as const
