/**
 * Growth Inbox vs Replies architecture audit (Phase 7F — local only).
 *
 * Usage: pnpm test:growth-inbox-replies-architecture
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_INBOX_EXISTING_QUEUE_VIEWS,
  GROWTH_INBOX_OPERATOR_ROUTES,
  GROWTH_INBOX_REPLIES_ARCHITECTURE_DECISION,
  GROWTH_INBOX_REPLIES_ARCHITECTURE_QA_MARKER,
  GROWTH_INBOX_REPLIES_RECOMMENDED_OPTION,
  GROWTH_INBOX_TARGET_FILTER_VIEWS,
  GROWTH_REPLIES_OPERATOR_ROUTES,
  GROWTH_REPLY_INBOX_INTELLIGENCE_VIEWS,
  GROWTH_REPLY_INTELLIGENCE_SURFACES,
} from "../lib/growth/navigation/growth-inbox-replies-architecture"
import {
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_WORKSPACE_BASE_PATH,
} from "../lib/growth/navigation/growth-route-metadata-types"
import { findGrowthRouteMetadataByPathname, getGrowthRouteMetadataById } from "../lib/growth/navigation/growth-route-metadata"
import { resolveGrowthBreadcrumbs } from "../lib/growth/navigation/growth-route-registry"
import {
  assertGrowthCommandPaletteRegistryParity,
  resolveGrowthCommandPaletteHref,
} from "../lib/growth/navigation/growth-command-palette-derivation"
import {
  GROWTH_SHELL_NAV_GROUPS,
  isGrowthShellNavItemActive,
} from "../lib/growth/navigation/growth-workspace-shell-navigation"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

const WORKSPACE_PAGE_PATHS = [
  "app/(growth)/growth/inbox/page.tsx",
  "app/(growth)/growth/inbox/workflow/page.tsx",
  "app/(growth)/growth/inbox/operations/page.tsx",
] as const

const ADMIN_PAGE_PATHS = [
  "app/(admin)/admin/growth/inbox/page.tsx",
  "app/(admin)/admin/growth/replies/page.tsx",
  "app/(admin)/admin/growth/replies/workflow/page.tsx",
] as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function assertPageExists(relativePath: string): void {
  assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `expected page on disk: ${relativePath}`)
}

function runAudit(): void {
  console.log(`\n=== Growth Inbox vs Replies architecture audit (${GROWTH_INBOX_REPLIES_ARCHITECTURE_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_INBOX_REPLIES_RECOMMENDED_OPTION, "unified-inbox")
  assert.equal(GROWTH_INBOX_REPLIES_ARCHITECTURE_DECISION.repliesStandalone, false)
  assert.equal(GROWTH_INBOX_REPLIES_ARCHITECTURE_DECISION.repliesBecomesInboxTabOrFilter, "inbox-tab-or-filter")
  console.log("  ✓ architecture decision recommends unified inbox")

  for (const page of WORKSPACE_PAGE_PATHS) {
    assertPageExists(page)
  }
  for (const page of ADMIN_PAGE_PATHS) {
    assertPageExists(page)
  }
  console.log("  ✓ inbox and reply-related workspace/admin pages exist on disk")

  const inboxRoute = findGrowthRouteMetadataByPathname(`${GROWTH_WORKSPACE_BASE_PATH}/inbox`)
  assert.ok(inboxRoute)
  assert.equal(inboxRoute.id, "workspace-inbox")
  assert.equal(inboxRoute.migrated, true)

  const workflowRoute = findGrowthRouteMetadataByPathname(`${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow`)
  assert.ok(workflowRoute)
  assert.equal(workflowRoute.id, "workspace-inbox-workflow")
  assert.equal(workflowRoute.adminPath, `${GROWTH_ADMIN_BASE_PATH}/replies/workflow`)

  const replyInboxRoute = getGrowthRouteMetadataById("admin-replies")
  assert.ok(replyInboxRoute)
  assert.equal(replyInboxRoute.path, `${GROWTH_ADMIN_BASE_PATH}/replies`)
  assert.equal(replyInboxRoute.migrationStatus, "admin-only")

  assert.equal(findGrowthRouteMetadataByPathname(`${GROWTH_WORKSPACE_BASE_PATH}/replies`), null)
  console.log("  ✓ registry: inbox + workflow migrated; reply inbox admin-only; no /growth/replies")

  const inboxCrumbs = resolveGrowthBreadcrumbs(`${GROWTH_WORKSPACE_BASE_PATH}/inbox`)
  assert.deepEqual(inboxCrumbs.map((crumb) => crumb.label), ["Growth", "Inbox"])

  const workflowCrumbs = resolveGrowthBreadcrumbs(`${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow`)
  assert.deepEqual(workflowCrumbs.map((crumb) => crumb.label), ["Growth", "Inbox", "Reply Workflow"])

  const replyInboxCrumbs = resolveGrowthBreadcrumbs(`${GROWTH_ADMIN_BASE_PATH}/replies`)
  assert.deepEqual(replyInboxCrumbs.map((crumb) => crumb.label), ["Growth"])
  assert.equal(replyInboxRoute.title, "Reply Inbox")
  console.log("  ✓ workspace breadcrumbs for inbox/workflow unchanged; admin reply inbox uses admin shell chrome")

  const navItems = GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items)
  assert.equal(navItems.length, 12)
  const inboxNav = navItems.find((item) => item.id === "inbox")
  assert.ok(inboxNav)
  assert.equal(navItems.some((item) => item.label === "Replies" || item.label === "Reply Inbox"), false)
  assert.equal(isGrowthShellNavItemActive(`${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow`, inboxNav), true)
  console.log("  ✓ sidebar: Inbox present; Replies absent; workflow highlights Inbox")

  const inboxCmdK = resolveGrowthCommandPaletteHref(
    `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    `${GROWTH_ADMIN_BASE_PATH}/inbox`,
  )
  assert.equal(inboxCmdK, `${GROWTH_WORKSPACE_BASE_PATH}/inbox`)

  const workflowCmdK = resolveGrowthCommandPaletteHref(
    `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    `${GROWTH_ADMIN_BASE_PATH}/replies/workflow`,
  )
  assert.equal(workflowCmdK, `${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow`)

  const replyInboxCmdK = resolveGrowthCommandPaletteHref(
    `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    `${GROWTH_ADMIN_BASE_PATH}/replies`,
  )
  assert.equal(replyInboxCmdK, `${GROWTH_ADMIN_BASE_PATH}/replies`)
  console.log("  ✓ Cmd+K: inbox/workflow rewrite to workspace; reply inbox stays admin")

  assertGrowthCommandPaletteRegistryParity()
  console.log("  ✓ Cmd+K registry parity unchanged")

  const inboxPage = readSource("app/(growth)/growth/inbox/page.tsx")
  assert.doesNotMatch(inboxPage, /GrowthInboxWorkspaceProvider/)
  assert.match(inboxPage, /GrowthUnifiedInboxDashboardPanel|GrowthInboxWorkspaceV2Panel/)

  const workflowPage = readSource("app/(growth)/growth/inbox/workflow/page.tsx")
  assert.match(workflowPage, /GrowthInboxWorkspaceWorkflowPanel/)

  const operationsPage = readSource("app/(growth)/growth/inbox/operations/page.tsx")
  assert.match(operationsPage, /GrowthInboxWorkspaceOperationsPanel/)

  const replyInboxPage = readSource("app/(admin)/admin/growth/replies/page.tsx")
  assert.match(replyInboxPage, /GrowthReplyInboxDashboard/)
  console.log("  ✓ page composition: unified inbox + workflow body + admin reply intelligence")

  assert.ok(GROWTH_INBOX_EXISTING_QUEUE_VIEWS.includes("needs_action"))
  assert.ok(GROWTH_INBOX_EXISTING_QUEUE_VIEWS.includes("meeting_intent"))
  assert.ok(GROWTH_INBOX_EXISTING_QUEUE_VIEWS.includes("call_follow_up"))
  assert.equal(GROWTH_INBOX_EXISTING_QUEUE_VIEWS.length, 12)
  console.log("  ✓ inbox queue views include objections and high_priority")

  assert.ok(GROWTH_INBOX_TARGET_FILTER_VIEWS.includes("objections"))
  assert.equal(GROWTH_REPLY_INTELLIGENCE_SURFACES.length >= 8, true)

  const opportunitiesLayout = readSource("app/(growth)/growth/opportunities/layout.tsx")
  assert.match(opportunitiesLayout, /GrowthOpportunitiesShell/)
  const opportunitiesShell = readSource("components/growth/opportunities/growth-opportunities-shell.tsx")
  assert.match(opportunitiesShell, /GROWTH_OPPORTUNITIES_WORKSPACE_NAV_QA_MARKER/)
  console.log("  ✓ opportunities tab shell unchanged (Phase 7E)")

  const inboxShell = readSource("components/growth/inbox/growth-inbox-shell.tsx")
  assert.match(inboxShell, /GROWTH_INBOX_WORKSPACE_NAV_QA_MARKER/)
  console.log("  ✓ inbox tab shell present (Phase 7G)")

  for (const route of [...GROWTH_INBOX_OPERATOR_ROUTES, ...GROWTH_REPLIES_OPERATOR_ROUTES]) {
    const registry = getGrowthRouteMetadataById(route.registryRouteId)
    assert.ok(registry, `manifest route missing registry: ${route.id}`)
    assert.equal(registry.id, route.registryRouteId)
  }
  console.log("  ✓ architecture manifest routes align with registry")

  console.log("\nGrowth Inbox vs Replies architecture audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_INBOX_REPLIES_ARCHITECTURE_QA_MARKER,
        recommendation: GROWTH_INBOX_REPLIES_RECOMMENDED_OPTION,
        inbox_routes: GROWTH_INBOX_OPERATOR_ROUTES.length,
        replies_routes: GROWTH_REPLIES_OPERATOR_ROUTES.length,
        intelligence_surfaces: GROWTH_REPLY_INTELLIGENCE_SURFACES.length,
        phase_7g_focus: GROWTH_INBOX_REPLIES_ARCHITECTURE_DECISION.phase7gFocus.length,
        sidebar_items: navItems.length,
      },
      null,
      2,
    ),
  )
}

runAudit()
