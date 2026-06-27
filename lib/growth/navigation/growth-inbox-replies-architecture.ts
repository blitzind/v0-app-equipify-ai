/**
 * Growth Inbox vs Replies architecture manifest (Phase 7F — discovery only).
 *
 * Documents the long-term operator IA for unified inbox vs separate replies surfaces.
 * No runtime behavior — audit scripts and future phases consume this manifest.
 *
 * Recommendation: Option A — one unified Inbox (`/growth/inbox`).
 * Reply Workflow is already an Inbox child route. Reply Inbox intelligence remains
 * admin-only until a low-risk workspace migration in Phase 7G.
 */

import { GROWTH_WORKSPACE_BASE_PATH, GROWTH_ADMIN_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_INBOX_REPLIES_ARCHITECTURE_QA_MARKER = "growth-inbox-replies-architecture-v2" as const

export type GrowthInboxRepliesArchitectureOption = "unified-inbox" | "separate-surfaces"

/** Phase 7F recommendation — prefer unified inbox unless implementation blocks it. */
export const GROWTH_INBOX_REPLIES_RECOMMENDED_OPTION: GrowthInboxRepliesArchitectureOption = "unified-inbox"

export type GrowthInboxRepliesRouteSurface = {
  id: string
  label: string
  workspacePath: string | null
  adminPath: string
  registryRouteId: string
  migrationStatus: "dual-route" | "admin-only" | "workspace-only"
  sidebarVisible: boolean
  cmdKLabel: string | null
  breadcrumbTrail: string[]
  purpose: string
}

export const GROWTH_INBOX_OPERATOR_ROUTES: GrowthInboxRepliesRouteSurface[] = [
  {
    id: "workspace-inbox",
    label: "Inbox",
    workspacePath: `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    adminPath: `${GROWTH_ADMIN_BASE_PATH}/inbox`,
    registryRouteId: "workspace-inbox",
    migrationStatus: "dual-route",
    sidebarVisible: true,
    cmdKLabel: "Inbox",
    breadcrumbTrail: ["AI OS", "Inbox"],
    purpose:
      "Primary unified operator inbox — thread queue, conversation column, action center, email/SMS channels, reply classification, and operator inbox aggregation.",
  },
  {
    id: "workspace-inbox-workflow",
    label: "Reply Workflow",
    workspacePath: `${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow`,
    adminPath: `${GROWTH_ADMIN_BASE_PATH}/replies/workflow`,
    registryRouteId: "workspace-inbox-workflow",
    migrationStatus: "dual-route",
    sidebarVisible: false,
    cmdKLabel: "Reply Workflow",
    breadcrumbTrail: ["AI OS", "Inbox", "Reply Workflow"],
    purpose:
      "Reply-generated workflow actions — mark interested, create call/follow-up tasks, opportunity drafts, sequence exits. Child of Inbox, not a separate sidebar destination.",
  },
  {
    id: "workspace-inbox-operations",
    label: "Inbox Operations",
    workspacePath: `${GROWTH_WORKSPACE_BASE_PATH}/inbox/operations`,
    adminPath: `${GROWTH_ADMIN_BASE_PATH}/inbox`,
    registryRouteId: "workspace-inbox-operations",
    migrationStatus: "workspace",
    sidebarVisible: false,
    cmdKLabel: "Inbox Operations",
    breadcrumbTrail: ["AI OS", "Inbox", "Operations"],
    purpose:
      "Campaign builder, agent orchestration, event bus, and inbox diagnostics — planning surfaces kept out of the operator queue.",
  },
]

export const GROWTH_REPLIES_OPERATOR_ROUTES: GrowthInboxRepliesRouteSurface[] = [
  {
    id: "admin-replies",
    label: "Reply Inbox",
    workspacePath: null,
    adminPath: `${GROWTH_ADMIN_BASE_PATH}/replies`,
    registryRouteId: "admin-replies",
    migrationStatus: "admin-only",
    sidebarVisible: false,
    cmdKLabel: "Reply Inbox",
    breadcrumbTrail: ["AI OS"],
    purpose:
      "Reply intelligence v2 dashboard — evidence-backed classification, sales execution views, copilot assist, conversation timeline. Admin-only; workspace breadcrumb resolver does not traverse admin paths.",
  },
  {
    id: "admin-replies-workflow",
    label: "Reply Workflow",
    workspacePath: `${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow`,
    adminPath: `${GROWTH_ADMIN_BASE_PATH}/replies/workflow`,
    registryRouteId: "admin-replies-workflow",
    migrationStatus: "dual-route",
    sidebarVisible: false,
    cmdKLabel: "Reply Workflow",
    breadcrumbTrail: ["AI OS", "Inbox", "Reply Workflow"],
    purpose: "Admin fallback for workflow actions — workspace canonical path is /growth/inbox/workflow.",
  },
  {
    id: "admin-copilot-reply-drafts",
    label: "Reply Drafts",
    workspacePath: null,
    adminPath: `${GROWTH_ADMIN_BASE_PATH}/copilot/reply-drafts`,
    registryRouteId: "admin-copilot-reply-drafts",
    migrationStatus: "admin-only",
    sidebarVisible: false,
    cmdKLabel: "Reply Drafts",
    breadcrumbTrail: ["AI OS", "Reply Drafts"],
    purpose: "Copilot reply draft review — admin-only content surface, reachable via Cmd+K.",
  },
]

/** Existing unified inbox queue views (v2 thread queue column). */
export const GROWTH_INBOX_EXISTING_QUEUE_VIEWS = [
  "all",
  "needs_action",
  "interested",
  "meeting_intent",
  "objections",
  "high_priority",
  "unassigned",
  "waiting",
  "archived",
  "call_follow_up",
  "callback_requested",
  "voicemail",
] as const

/** Reply Inbox intelligence views (admin GrowthReplyInboxDashboard). */
export const GROWTH_REPLY_INBOX_INTELLIGENCE_VIEWS = [
  "my_inbox",
  "needs_action",
  "unanswered",
  "meeting_intent",
  "objections",
  "high_priority",
  "competitor_mentions",
  "waiting_on_prospect",
] as const

/** Preferred future inbox filters — map to queue views, not separate routes. */
export const GROWTH_INBOX_TARGET_FILTER_VIEWS = [
  "all",
  "replies",
  "needs_action",
  "interested",
  "meetings",
  "objections",
] as const

export type GrowthReplyIntelligenceSurface = {
  id: string
  label: string
  primaryRoute: string
  components: string[]
  notes: string
}

export const GROWTH_REPLY_INTELLIGENCE_SURFACES: GrowthReplyIntelligenceSurface[] = [
  {
    id: "email-replies",
    label: "Email replies",
    primaryRoute: `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    components: [
      "components/growth/growth-unified-inbox-dashboard.tsx",
      "components/growth/inbox/growth-inbox-workspace-v2-panel.tsx",
      "components/growth/inbox/growth-inbox-conversation-column.tsx",
      "lib/growth/inbox/reply-classifier.ts",
    ],
    notes: "Thread queue + conversation column; deterministic classification on ingest.",
  },
  {
    id: "sms-replies",
    label: "SMS replies",
    primaryRoute: `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    components: [
      "lib/growth/inbox/inbox-channel-types.ts",
      "components/growth/inbox/growth-inbox-action-center-sms-draft-embed.tsx",
    ],
    notes: "SMS channel filter in v2 queue; SMS draft embed in action center.",
  },
  {
    id: "positive-interest",
    label: "Positive interest",
    primaryRoute: `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    components: ["lib/growth/inbox/inbox-thread-queue-filters.ts"],
    notes: "Queue view: interested (positive_interest + referral classifications).",
  },
  {
    id: "objections",
    label: "Objections",
    primaryRoute: `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    components: [
      "lib/growth/inbox/inbox-thread-queue-filters.ts",
      "components/growth/inbox/growth-inbox-reply-intelligence-panel.tsx",
    ],
    notes: "Queue view: objections (budget, timeline, competitor, not_interested). Reply intelligence panel shows objection-heavy counts.",
  },
  {
    id: "meeting-requests",
    label: "Meeting requests",
    primaryRoute: `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    components: ["lib/growth/inbox/inbox-thread-queue-filters.ts"],
    notes: "Queue view: meeting_intent. Reply Inbox also exposes meeting_intent view.",
  },
  {
    id: "human-intervention",
    label: "Human intervention required",
    primaryRoute: `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    components: [
      "components/growth/growth-human-interventions-panel.tsx",
      "components/growth/inbox/growth-inbox-action-center-reply-draft-embed.tsx",
    ],
    notes: "Embedded in inbox action center and workflow panel; also on command center.",
  },
  {
    id: "workflow-actions",
    label: "Follow-up / workflow actions",
    primaryRoute: `${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow`,
    components: [
      "components/growth/replies/growth-reply-workflow-dashboard-body.tsx",
      "components/growth/growth-reply-workflow-actions-panel.tsx",
    ],
    notes: "Canonical workspace path under Inbox. APIs under /api/platform/growth/replies/workflow-actions.",
  },
  {
    id: "operator-notifications",
    label: "Operator notifications",
    primaryRoute: `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    components: [
      "components/growth/growth-operator-inbox-panel.tsx",
      "lib/growth/reply-intelligence/reply-operator-notifications.ts",
    ],
    notes: "Unified Operator Inbox panel in v2 inbox + command center; aggregates signals, replies, approvals.",
  },
  {
    id: "call-outcomes",
    label: "Call outcomes",
    primaryRoute: `${GROWTH_WORKSPACE_BASE_PATH}/calls`,
    components: ["components/growth/growth-call-workspace-live-coaching-panel.tsx"],
    notes: "Not yet converged into inbox queue — remains on Calls workspace. Future 7G+ convergence candidate.",
  },
  {
    id: "conversation-intelligence",
    label: "Conversation intelligence (read-only)",
    primaryRoute: `${GROWTH_WORKSPACE_BASE_PATH}/conversations`,
    components: ["components/growth/intelligence/growth-conversations-dashboard-body.tsx"],
    notes: "Separate INTELLIGENCE sidebar item — analytical, not action queue. Complements inbox.",
  },
]

export type GrowthInboxRepliesArchitectureDecision = {
  recommendation: GrowthInboxRepliesArchitectureOption
  repliesStandalone: boolean
  repliesBecomesInboxTabOrFilter: "inbox-tab-or-filter" | "standalone-admin-only"
  rationale: string[]
  phase7gFocus: string[]
}

export const GROWTH_INBOX_REPLIES_ARCHITECTURE_DECISION: GrowthInboxRepliesArchitectureDecision = {
  recommendation: "unified-inbox",
  repliesStandalone: false,
  repliesBecomesInboxTabOrFilter: "inbox-tab-or-filter",
  rationale: [
    "Workspace already centers on /growth/inbox with v2 three-column operator shell.",
    "Reply Workflow migrated to /growth/inbox/workflow — breadcrumbs treat it as Inbox child.",
    "Inbox v2 thread queue already implements needs_action, interested, meeting_intent, and channel filters.",
    "Separate Reply Inbox (/admin/growth/replies) duplicates intelligence views not yet ported to workspace.",
    "Operators should not monitor Inbox + Reply Inbox + Conversations as parallel action queues.",
    "Cmd+K exposes Inbox in sidebar; Reply Inbox is admin Cmd+K only — correct demotion pattern.",
  ],
  phase7gFocus: [
    "Validate workspace reply intelligence parity against admin Reply Inbox.",
    "Normalize remaining admin-only deep links in operator guides and notification CTAs.",
    "Defer call-outcome convergence until Calls ↔ Inbox data contract is defined.",
  ],
}

export function listGrowthInboxRepliesAuditPaths(): string[] {
  return [
    ...GROWTH_INBOX_OPERATOR_ROUTES.map((route) => route.workspacePath).filter(Boolean),
    ...GROWTH_REPLIES_OPERATOR_ROUTES.map((route) => route.adminPath),
    ...GROWTH_REPLIES_OPERATOR_ROUTES.map((route) => route.workspacePath).filter(Boolean),
  ] as string[]
}
