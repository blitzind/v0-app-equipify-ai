/**
 * Growth workspace sidebar IA boundaries (Phase 5A, consolidated Phase 7B).
 *
 * The workspace shell sidebar surfaces daily operator routes only.
 * Config, control-plane, reporting, and admin routes stay in Platform Admin / Cmd+K.
 */

export const GROWTH_WORKSPACE_SIDEBAR_IA_QA_MARKER = "growth-workspace-sidebar-ia-v2" as const

/** Operator-facing nav ids visible in the Growth workspace sidebar. */
export const GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS = [
  "dashboard",
  "leads",
  "campaigns",
  "inbox",
  "calls",
  "meetings",
  "share-pages",
  "personalized-videos",
  "personalization",
  "videos",
  "media-assets",
  "automation-flows",
  "opportunities",
  "activity",
  "conversations",
  "relationships",
] as const

/** Nav ids removed from workspace sidebar — routes remain in registry, Cmd+K, and direct URLs. */
export const GROWTH_WORKSPACE_SIDEBAR_HIDDEN_NAV_IDS = [
  "approvals",
  "runtime",
  "analytics",
  "reports",
  "signals",
  "providers",
  "team",
  "compliance",
  "settings-home",
  "templates",
  "engagement",
  "opportunities-pipeline",
] as const

/** Workspace sidebar group ids after Phase 5A IA cleanup. */
export const GROWTH_WORKSPACE_SIDEBAR_GROUP_IDS = ["workspace", "content", "automation", "intelligence"] as const

/** Registry route ids that must never appear in the workspace sidebar manifest. */
export const GROWTH_WORKSPACE_SIDEBAR_FORBIDDEN_REGISTRY_ROUTE_IDS = [
  "admin-outreach-legacy-queue",
  "admin-revenue-intelligence",
  "admin-intent-pixel",
  "admin-providers",
  "admin-ownership",
  "admin-providers-compliance",
  "workspace-settings",
] as const

/** Migration statuses that must not appear in workspace sidebar unless workspaceRoute is true. */
export const GROWTH_WORKSPACE_SIDEBAR_FORBIDDEN_MIGRATION_STATUSES = ["admin-only", "hidden"] as const
