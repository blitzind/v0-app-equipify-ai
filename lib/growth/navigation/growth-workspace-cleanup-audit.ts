/**
 * Growth workspace cleanup audit manifest (Phase 7H).
 *
 * Documents canonical routes, demoted surfaces, admin-only boundaries, and
 * reachability classifications after Phases 7B–7G IA consolidation.
 */

import { GROWTH_ORPHAN_ROUTE_IDS } from "@/lib/growth/navigation/growth-route-catalog-data"
import {
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_WORKSPACE_BASE_PATH,
} from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_WORKSPACE_CLEANUP_QA_MARKER = "growth-workspace-cleanup-v1" as const

/** Stale workspace paths that must not exist as routes. */
export const GROWTH_FORBIDDEN_WORKSPACE_ORPHAN_PATHS = [
  `${GROWTH_WORKSPACE_BASE_PATH}/pipeline`,
  `${GROWTH_WORKSPACE_BASE_PATH}/templates`,
  `${GROWTH_WORKSPACE_BASE_PATH}/replies`,
] as const

/** Canonical workspace destinations for demoted / legacy admin aliases. */
export const GROWTH_WORKSPACE_CANONICAL_ALIASES = {
  inbox: `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
  pipeline: `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline`,
  opportunities: `${GROWTH_WORKSPACE_BASE_PATH}/opportunities`,
  readiness: `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/readiness`,
  sharePages: `${GROWTH_WORKSPACE_BASE_PATH}/share-pages`,
  templates: `${GROWTH_WORKSPACE_BASE_PATH}/share-pages/templates`,
  replyWorkflow: `${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow`,
  replyInboxAdmin: `${GROWTH_ADMIN_BASE_PATH}/replies`,
  replyWorkflowAdmin: `${GROWTH_ADMIN_BASE_PATH}/replies/workflow`,
  settings: `${GROWTH_WORKSPACE_BASE_PATH}/settings`,
  connectedMailboxes: `${GROWTH_WORKSPACE_BASE_PATH}/settings/connected-mailboxes`,
  engagement: `${GROWTH_WORKSPACE_BASE_PATH}/engagement`,
} as const

/** Legacy admin hrefs that Cmd+K rewrites to workspace when opened from /growth/*. */
export const GROWTH_LEGACY_ADMIN_ALIAS_HREFS = [
  { adminHref: `${GROWTH_ADMIN_BASE_PATH}/replies/workflow`, workspaceHref: GROWTH_WORKSPACE_CANONICAL_ALIASES.replyWorkflow },
  { adminHref: `${GROWTH_ADMIN_BASE_PATH}/opportunities/pipeline`, workspaceHref: GROWTH_WORKSPACE_CANONICAL_ALIASES.pipeline },
  { adminHref: `${GROWTH_ADMIN_BASE_PATH}/settings/growth`, workspaceHref: GROWTH_WORKSPACE_CANONICAL_ALIASES.settings },
  {
    adminHref: `${GROWTH_ADMIN_BASE_PATH}/settings/communications`,
    workspaceHref: GROWTH_WORKSPACE_CANONICAL_ALIASES.connectedMailboxes,
  },
] as const

/** Prefixes that must remain admin-only — no workspace equivalents. */
export const GROWTH_PERMANENT_ADMIN_ONLY_PREFIXES = [
  `${GROWTH_ADMIN_BASE_PATH}/providers`,
  `${GROWTH_ADMIN_BASE_PATH}/infrastructure`,
  `${GROWTH_ADMIN_BASE_PATH}/sequences/execution`,
  `${GROWTH_ADMIN_BASE_PATH}/revenue-execution`,
  `${GROWTH_ADMIN_BASE_PATH}/operations`,
  `${GROWTH_ADMIN_BASE_PATH}/deliverability`,
  `${GROWTH_ADMIN_BASE_PATH}/intent-pixel`,
  `${GROWTH_ADMIN_BASE_PATH}/experiments`,
] as const

export type GrowthRouteReachabilityClass =
  | "sidebar-primary"
  | "tab-shell"
  | "hub-drilldown"
  | "cmdk-only"
  | "direct-url-only"
  | "admin-only"
  | "admin-fallback-dual-route"
  | "hidden-system"

export type GrowthDemotedSurface = {
  id: string
  label: string
  workspaceHref: string | null
  adminHref: string
  reachability: GrowthRouteReachabilityClass[]
  notes: string
}

/** Demoted operator surfaces after Phase 7B — not in sidebar, still reachable. */
export const GROWTH_DEMOTED_OPERATOR_SURFACES: GrowthDemotedSurface[] = [
  {
    id: "pipeline",
    label: "Pipeline",
    workspaceHref: GROWTH_WORKSPACE_CANONICAL_ALIASES.pipeline,
    adminHref: `${GROWTH_ADMIN_BASE_PATH}/opportunities/pipeline`,
    reachability: ["tab-shell", "hub-drilldown", "cmdk-only", "direct-url-only", "admin-fallback-dual-route"],
    notes: "Opportunities Pipeline tab — not a sidebar item.",
  },
  {
    id: "templates",
    label: "Templates",
    workspaceHref: GROWTH_WORKSPACE_CANONICAL_ALIASES.templates,
    adminHref: `${GROWTH_ADMIN_BASE_PATH}/share-pages/templates`,
    reachability: ["hub-drilldown", "cmdk-only", "direct-url-only", "admin-fallback-dual-route"],
    notes: "Share Pages drill-down — not a sidebar item.",
  },
  {
    id: "engagement",
    label: "Engagement",
    workspaceHref: GROWTH_WORKSPACE_CANONICAL_ALIASES.engagement,
    adminHref: `${GROWTH_ADMIN_BASE_PATH}/engagement`,
    reachability: ["hub-drilldown", "cmdk-only", "direct-url-only", "admin-fallback-dual-route"],
    notes: "Share Pages hub drill-down — not a sidebar item.",
  },
  {
    id: "settings",
    label: "Settings",
    workspaceHref: GROWTH_WORKSPACE_CANONICAL_ALIASES.settings,
    adminHref: `${GROWTH_ADMIN_BASE_PATH}/settings/growth`,
    reachability: ["cmdk-only", "direct-url-only", "admin-fallback-dual-route"],
    notes: "Workspace settings shell — not in sidebar.",
  },
  {
    id: "reply-inbox",
    label: "Reply Inbox",
    workspaceHref: null,
    adminHref: GROWTH_WORKSPACE_CANONICAL_ALIASES.replyInboxAdmin,
    reachability: ["cmdk-only", "direct-url-only", "admin-only"],
    notes: "Admin Reply Inbox stays live until workspace parity fully validated.",
  },
  {
    id: "reply-workflow",
    label: "Reply Workflow",
    workspaceHref: GROWTH_WORKSPACE_CANONICAL_ALIASES.replyWorkflow,
    adminHref: GROWTH_WORKSPACE_CANONICAL_ALIASES.replyWorkflowAdmin,
    reachability: ["tab-shell", "cmdk-only", "direct-url-only", "admin-fallback-dual-route"],
    notes: "Canonical workspace path is Inbox → Workflow tab.",
  },
]

export const GROWTH_WORKSPACE_SIDEBAR_CANONICAL_IA = {
  groups: [
    {
      id: "workspace",
      label: "Workspace",
      items: ["dashboard", "leads", "campaigns", "inbox", "calls", "meetings"],
    },
    {
      id: "content",
      label: "Content",
      items: ["share-pages", "media-assets"],
    },
    {
      id: "automation",
      label: "Automation",
      items: ["automation-flows"],
    },
    {
      id: "intelligence",
      label: "Intelligence",
      items: ["opportunities", "conversations", "relationships"],
    },
  ],
} as const

/** Registry orphan route ids explicitly tracked in IA audits. */
export const GROWTH_TRACKED_ORPHAN_ROUTE_IDS = [...GROWTH_ORPHAN_ROUTE_IDS] as const

/** Components deferred for removal — still referenced or parity uncertain. */
export const GROWTH_DEFERRED_COMPONENT_CLEANUP = [
  "components/growth/growth-reply-inbox-dashboard.tsx — admin Reply Inbox parity surface",
  "lib/growth/aiden/operator-guide.ts — static admin hrefs; pathname-aware rewrite deferred",
  "lib/growth/command/command-center-navigation.ts — admin Command Center context",
  "lib/growth/reply-intelligence/reply-intelligence-notifications.ts — notification routing boundary",
  "lib/growth/notifications/growth-notification-center-utils.ts — notification routing boundary",
] as const
