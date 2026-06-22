/** GS-AI-PLAYBOOK-5B/5C — Activity center workspace constants (client-safe). */

import type { GrowthActivityFilterId } from "@/lib/growth/activity/growth-activity-workspace-types"

export const GROWTH_ACTIVITY_WORKSPACE_QA_MARKER = "growth-activity-workspace-gs-ai-playbook-5c-v1" as const
export const GROWTH_ACTIVITY_UNIFIED_FEED_QA_MARKER = "growth-activity-unified-feed-gs-ai-playbook-5c-v1" as const
export const GROWTH_CONTENT_WORKSPACE_IA_QA_MARKER = "growth-content-workspace-ia-gs-ai-playbook-5b-v1" as const
export const GROWTH_PERSONALIZATION_WORKSPACE_UX_QA_MARKER =
  "growth-personalization-workspace-ux-gs-ai-playbook-5b-v1" as const
export const GROWTH_PERSONALIZED_VIDEOS_DASHBOARD_UX_QA_MARKER =
  "growth-personalized-videos-dashboard-ux-gs-ai-playbook-5b-v1" as const

export const GROWTH_ACTIVITY_WORKSPACE_PATH = "/growth/activity" as const
export const GROWTH_ACTIVITY_UNIFIED_API_PATH = "/api/platform/growth/activity/unified" as const

export const GROWTH_ACTIVITY_CATEGORY_FILTER_OPTIONS: Array<{ id: GrowthActivityFilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "communication", label: "Communication" },
  { id: "personalization", label: "Personalization" },
  { id: "sales", label: "Sales" },
  { id: "intelligence", label: "Intelligence" },
  { id: "content", label: "Content" },
]

export const GROWTH_ACTIVITY_QUICK_FILTER_OPTIONS: Array<{ id: GrowthActivityFilterId; label: string }> = [
  { id: "needs-attention", label: "Needs Attention" },
  { id: "high-intent", label: "High Intent" },
  { id: "today", label: "Today" },
  { id: "unread", label: "Unread" },
  { id: "my-leads", label: "My Leads" },
]

/** Combined sidebar filters — category + quick. */
export const GROWTH_ACTIVITY_FILTER_OPTIONS: Array<{ id: GrowthActivityFilterId; label: string }> = [
  ...GROWTH_ACTIVITY_CATEGORY_FILTER_OPTIONS,
  ...GROWTH_ACTIVITY_QUICK_FILTER_OPTIONS,
]

export const GROWTH_ACTIVITY_SOURCE_LABELS: Record<string, string> = {
  personalized_video: "Personalized Video",
  share_page: "Share Page",
  engagement_timeline: "Engagement",
  signal_feed: "Signal Intelligence",
  lead_timeline: "Lead Timeline",
  personalization: "Personalization",
  attention: "Attention Queue",
}

export const GROWTH_ACTIVITY_RAIL_QUEUE_LABELS = {
  "needs-attention": "Needs Attention",
  "hot-prospects": "Hot Prospects",
  "meetings-ready": "Meetings Ready",
  "stalled-opportunities": "Stalled Opportunities",
} as const
