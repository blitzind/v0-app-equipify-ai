/**
 * Workspace vs Admin Reply Inbox parity matrix (Phase 7I).
 *
 * Documentation-only — consumed by audit scripts.
 */

export const GROWTH_INBOX_WORKSPACE_PARITY_QA_MARKER = "growth-inbox-workspace-parity-v1" as const

export type GrowthInboxParityStatus = "available" | "partial" | "deferred" | "admin-only"

export type GrowthInboxParityRow = {
  id: string
  label: string
  admin: boolean
  workspace: boolean
  status: GrowthInboxParityStatus
  notes: string
}

export const GROWTH_INBOX_WORKSPACE_PARITY_MATRIX: GrowthInboxParityRow[] = [
  {
    id: "reply-classifications",
    label: "Reply classifications",
    admin: true,
    workspace: true,
    status: "available",
    notes: "Per-thread classification in GrowthInboxReplyIntelligencePanel; queue filters use thread classifier.",
  },
  {
    id: "timeline-intelligence",
    label: "Timeline intelligence",
    admin: true,
    workspace: true,
    status: "available",
    notes: "/api/platform/growth/replies/timeline per selected lead.",
  },
  {
    id: "copilot-recommendations",
    label: "Copilot recommendations",
    admin: true,
    workspace: true,
    status: "available",
    notes: "/api/platform/growth/replies/copilot per selected lead.",
  },
  {
    id: "suggested-actions",
    label: "Suggested actions",
    admin: true,
    workspace: true,
    status: "available",
    notes: "Action center + workflow tab; copilot suggestedNextStep in workspace panel.",
  },
  {
    id: "objection-workflows",
    label: "Objection workflows",
    admin: true,
    workspace: true,
    status: "available",
    notes: "Admin objections view; workspace objections queue filter + objectionHeavy metric.",
  },
  {
    id: "meeting-workflows",
    label: "Meeting workflows",
    admin: true,
    workspace: true,
    status: "available",
    notes: "Admin meeting_intent view; workspace meeting_intent filter + meetingRequestCount metric.",
  },
  {
    id: "overview-metrics",
    label: "Overview live metrics",
    admin: true,
    workspace: true,
    status: "available",
    notes: "GrowthInboxOverviewMetricsPanel — thread queue + shared replies/dashboard API.",
  },
  {
    id: "sales-execution-filters",
    label: "Sales execution filter chips",
    admin: true,
    workspace: false,
    status: "deferred",
    notes: "Admin GrowthReplyInboxDashboard sales execution views — not ported to workspace queue UI.",
  },
  {
    id: "full-reply-feed",
    label: "Full reply inbox feed list",
    admin: true,
    workspace: false,
    status: "partial",
    notes: "Workspace uses unified thread queue; admin uses outbound_replies feed.",
  },
  {
    id: "campaign-learning",
    label: "Campaign learning rates",
    admin: true,
    workspace: false,
    status: "deferred",
    notes: "positiveReplyRate / objectionRate tiles remain admin-only for now.",
  },
  {
    id: "competitor-mentions-view",
    label: "Competitor mentions view",
    admin: true,
    workspace: false,
    status: "deferred",
    notes: "Admin dedicated view; workspace thread classifier includes competitor classification only.",
  },
  {
    id: "admin-reply-inbox-surface",
    label: "Admin Reply Inbox page",
    admin: true,
    workspace: false,
    status: "admin-only",
    notes: "/admin/growth/replies retained for parity validation.",
  },
]

export function listGrowthInboxParityGaps(): GrowthInboxParityRow[] {
  return GROWTH_INBOX_WORKSPACE_PARITY_MATRIX.filter(
    (row) => row.status === "deferred" || row.status === "partial" || row.status === "admin-only",
  )
}
