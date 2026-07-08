/**
 * GE-AVA-FRESH-SLATE-1C — Home workspace API contract.
 * GE-SIMPLIFY-1B — Primary read model is workspace-summary (single request).
 */

export const GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER =
  "growth-workspace-dashboard-fetch-batch-v3" as const

export const GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH =
  "/api/platform/growth/home/workspace-summary" as const

export type GrowthHomeWorkspaceApiRoute = {
  id: string
  path: string
  label: string
}

/** @deprecated Individual routes — Home dashboard loads GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH instead. */
export const GROWTH_HOME_WORKSPACE_API_ROUTES: GrowthHomeWorkspaceApiRoute[] = [
  { id: "aiden_briefing", path: "/api/platform/growth/aiden/briefing", label: "Aiden daily briefing" },
  {
    id: "revenue_queue",
    path: "/api/platform/growth/lead-inbox?sort=priority",
    label: "Revenue Queue sections",
  },
  {
    id: "cadence_command_summary",
    path: "/api/platform/growth/cadence/command-summary",
    label: "Cadence call-ready tasks",
  },
  {
    id: "opportunities_pipeline",
    path: "/api/platform/growth/opportunities/pipeline?view=all_pipeline&limit=1",
    label: "Opportunity pipeline dashboard",
  },
  {
    id: "opportunities_dashboard",
    path: "/api/platform/growth/opportunities/dashboard",
    label: "Opportunity readiness dashboard",
  },
  {
    id: "sequences_dashboard",
    path: "/api/platform/growth/sequences/dashboard",
    label: "Sequence foundation dashboard",
  },
  {
    id: "sequence_execution_dashboard",
    path: "/api/platform/growth/sequences/execution/dashboard",
    label: "Sequence execution / approval queue",
  },
  {
    id: "engagement_command_center",
    path: "/api/platform/growth/engagement-dashboard/command-center?dateRange=last_7_days&limit=1",
    label: "Engagement command center",
  },
  {
    id: "conversations_dashboard",
    path: "/api/platform/growth/conversations/dashboard",
    label: "Conversation risk dashboard",
  },
  {
    id: "relationships_dashboard",
    path: "/api/platform/growth/relationships/dashboard",
    label: "Relationship intelligence dashboard",
  },
  { id: "calls_dashboard", path: "/api/platform/growth/calls/dashboard", label: "Calls workspace dashboard" },
  {
    id: "daily_revenue_work_queue",
    path: "/api/platform/growth/daily-revenue-work-queue",
    label: "Canonical daily revenue work queue",
  },
]

export const GROWTH_HOME_DEBUG_SOURCE_API_PATH = "/api/platform/growth/home/debug-source" as const

export const GROWTH_HOME_NO_STORE_CACHE_CONTROL = "private, no-store, no-cache, must-revalidate" as const
