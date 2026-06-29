/**
 * GE-AVA-FRESH-SLATE-1C — APIs batched by useGrowthWorkspaceDashboard.
 */

export const GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER =
  "growth-workspace-dashboard-fetch-batch-v2" as const

export type GrowthHomeWorkspaceApiRoute = {
  id: string
  path: string
  label: string
}

/** Must stay in sync with components/growth/workspace/use-growth-workspace-dashboard.ts */
export const GROWTH_HOME_WORKSPACE_API_ROUTES: GrowthHomeWorkspaceApiRoute[] = [
  { id: "aiden_briefing", path: "/api/platform/growth/aiden/briefing", label: "Aiden daily briefing" },
  {
    id: "lead_inbox",
    path: "/api/platform/growth/lead-inbox?sort=priority",
    label: "Lead operator inbox sections",
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
