/**
 * Growth workspace/admin chrome architecture (Phase 4F.2).
 *
 * Enforces a strict separation between dashboard bodies and route chrome.
 *
 * Workspace page (under app/(growth)/growth):
 *   GrowthWorkspaceShell layout → GrowthWorkspacePageHeader → DashboardBody
 *
 * Admin page (under app/(admin)/admin/growth):
 *   PlatformAdminPageShell → admin hero → GrowthSectionLayout → DashboardBody
 *
 * Dashboard body (components/growth, *dashboard-body*.tsx):
 *   Dashboard logic only — no shells, nav, or page heroes.
 *
 * Future /growth/* migration guardrail:
 *   1. Extract FooDashboardBody (dashboard logic only)
 *   2. Workspace page: GrowthWorkspacePageHeader + FooDashboardBody
 *   3. Admin page: PlatformAdminPageShell + hero + GrowthSectionLayout + FooDashboardBody
 *
 * Do NOT create shared *-workspace.tsx wrappers that own both chrome and body.
 */

export const GROWTH_CHROME_ARCHITECTURE_QA_MARKER = "growth-chrome-architecture-v4" as const

/** Imports forbidden in dashboard body components. */
export const GROWTH_DASHBOARD_BODY_FORBIDDEN_IMPORTS = [
  "GrowthSectionLayout",
  "GrowthSectionSidebarNav",
  "PlatformAdminPageShell",
  "PlatformAdminTabNav",
  "GrowthWorkspaceShell",
  "GrowthWorkspacePageHeader",
] as const

/** Imports forbidden in workspace route pages. */
export const GROWTH_WORKSPACE_PAGE_FORBIDDEN_IMPORTS = [
  "GrowthSectionLayout",
  "GrowthSectionSidebarNav",
  "PlatformAdminPageShell",
  "PlatformAdminTabNav",
] as const

/** Patterns required in dual-route admin fallback pages using DashboardBody. */
export const GROWTH_ADMIN_DUAL_ROUTE_REQUIRED_PATTERNS = [
  "PlatformAdminPageShell",
  "GrowthSectionLayout",
] as const

/** Phase 4 certified dashboard body components (dual-route migrations). */
export const GROWTH_PHASE_4_DASHBOARD_BODY_COMPONENTS = [
  "components/growth/replies/growth-reply-workflow-dashboard-body.tsx",
  "components/growth/opportunities/growth-opportunities-readiness-dashboard-body.tsx",
  "components/growth/opportunities/growth-opportunities-pipeline-dashboard-body.tsx",
  "components/growth/opportunities/growth-opportunities-operator-dashboard-body.tsx",
  "components/growth/intelligence/growth-conversations-dashboard-body.tsx",
  "components/growth/intelligence/growth-relationships-dashboard-body.tsx",
] as const

export const GROWTH_PHASE_4_WORKSPACE_PAGES = [
  "app/(growth)/growth/opportunities/workspace/page.tsx",
  "app/(growth)/growth/conversations/page.tsx",
  "app/(growth)/growth/relationships/page.tsx",
] as const

/** Phase 7G — Inbox tab routes use GrowthInboxShell instead of page-level headers. */
export const GROWTH_INBOX_TAB_SHELL_PAGES = [
  "app/(growth)/growth/inbox/page.tsx",
  "app/(growth)/growth/inbox/workflow/page.tsx",
  "app/(growth)/growth/inbox/operations/page.tsx",
] as const

export const GROWTH_INBOX_TAB_SHELL_COMPONENT = "components/growth/inbox/growth-inbox-shell.tsx" as const

/** Phase 7E — Opportunities tab routes use GrowthOpportunitiesShell instead of page-level headers. */
export const GROWTH_OPPORTUNITIES_TAB_SHELL_PAGES = [
  "app/(growth)/growth/opportunities/page.tsx",
  "app/(growth)/growth/opportunities/pipeline/page.tsx",
  "app/(growth)/growth/opportunities/readiness/page.tsx",
] as const

export const GROWTH_OPPORTUNITIES_TAB_SHELL_COMPONENT =
  "components/growth/opportunities/growth-opportunities-shell.tsx" as const

/** Phase 6A workspace operator home dashboard body. */
export const GROWTH_PHASE_6A_WORKSPACE_DASHBOARD_BODY =
  "components/growth/workspace/growth-workspace-dashboard-body.tsx" as const

export const GROWTH_PHASE_6A_WORKSPACE_PAGE = "app/(growth)/growth/page.tsx" as const

/** All certified dashboard body components (Phase 4 dual-routes + Phase 6A operator home). */
export const GROWTH_CERTIFIED_DASHBOARD_BODY_COMPONENTS = [
  ...GROWTH_PHASE_4_DASHBOARD_BODY_COMPONENTS,
  GROWTH_PHASE_6A_WORKSPACE_DASHBOARD_BODY,
] as const

export const GROWTH_CERTIFIED_WORKSPACE_HEADER_BODY_PAGES = [
  ...GROWTH_PHASE_4_WORKSPACE_PAGES,
  GROWTH_PHASE_6A_WORKSPACE_PAGE,
] as const

export const GROWTH_PHASE_4_ADMIN_PAGES = [
  "app/(admin)/admin/growth/replies/workflow/page.tsx",
  "app/(admin)/admin/growth/opportunities/page.tsx",
  "app/(admin)/admin/growth/opportunities/pipeline/page.tsx",
  "app/(admin)/admin/growth/opportunities/workspace/page.tsx",
  "app/(admin)/admin/growth/conversations/page.tsx",
  "app/(admin)/admin/growth/relationships/page.tsx",
] as const

/** Mixed chrome wrappers removed in Phase 4F.1 — must not return. */
export const GROWTH_REMOVED_LEGACY_WORKSPACE_WRAPPERS = [
  "components/growth/replies/growth-reply-workflow-workspace.tsx",
  "components/growth/opportunities/growth-opportunities-readiness-workspace.tsx",
  "components/growth/opportunities/growth-opportunities-pipeline-workspace.tsx",
  "components/growth/opportunities/growth-opportunities-operator-workspace.tsx",
  "components/growth/intelligence/growth-conversations-workspace.tsx",
  "components/growth/intelligence/growth-relationships-workspace.tsx",
] as const

/**
 * Pre-4F.1 components that still mix optional admin hero (`showPageHeader`) with dashboard body.
 * Documented for future refactor — not part of the certified Phase 4 pattern.
 */
export const GROWTH_LEGACY_MIXED_CHROME_COMPONENTS = [
  "components/growth/leads/growth-leads-crm-workspace.tsx",
  "components/growth/growth-call-queue-workspace.tsx",
] as const

/** Shared layout files that must never branch on pathname for chrome decisions. */
export const GROWTH_CHROME_PATHNAME_BRANCH_FORBIDDEN_FILES = [
  "components/growth/growth-section-layout.tsx",
] as const

export const GROWTH_DASHBOARD_BODY_FILENAME_PATTERN = /dashboard-body/i
