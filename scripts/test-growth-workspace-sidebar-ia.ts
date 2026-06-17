/**
 * Growth workspace sidebar IA audit (Phase 5A — local only).
 *
 * Usage: pnpm test:growth-workspace-sidebar-ia
 */
import assert from "node:assert/strict"
import {
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_WORKSPACE_BASE_PATH,
} from "../lib/growth/navigation/growth-route-metadata-types"
import { getGrowthRouteMetadataById } from "../lib/growth/navigation/growth-route-metadata"
import {
  GROWTH_SHELL_NAV_GROUPS,
  GROWTH_WORKSPACE_SHELL_NAV_MANIFEST,
  GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER,
  isGrowthShellNavItemActive,
} from "../lib/growth/navigation/growth-workspace-shell-navigation"
import {
  GROWTH_WORKSPACE_SIDEBAR_FORBIDDEN_MIGRATION_STATUSES,
  GROWTH_WORKSPACE_SIDEBAR_FORBIDDEN_REGISTRY_ROUTE_IDS,
  GROWTH_WORKSPACE_SIDEBAR_GROUP_IDS,
  GROWTH_WORKSPACE_SIDEBAR_HIDDEN_NAV_IDS,
  GROWTH_WORKSPACE_SIDEBAR_IA_QA_MARKER,
  GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS,
} from "../lib/growth/navigation/growth-workspace-sidebar-ia"
import {
  assertGrowthCommandPaletteRegistryParity,
  resolveGrowthCommandPaletteHref,
} from "../lib/growth/navigation/growth-command-palette-derivation"
import { growthFeaturePath } from "../lib/growth/navigation/growth-workspace-base-path"

const SIDEBAR_ACTIVE_STATE_CASES: Array<{ pathname: string; activeNavId: string }> = [
  { pathname: "/growth", activeNavId: "dashboard" },
  { pathname: "/growth/leads", activeNavId: "leads" },
  { pathname: "/growth/campaigns", activeNavId: "campaigns" },
  { pathname: "/growth/inbox", activeNavId: "inbox" },
  { pathname: "/growth/calls", activeNavId: "calls" },
  { pathname: "/growth/meetings", activeNavId: "meetings" },
  { pathname: "/growth/share-pages", activeNavId: "share-pages" },
  { pathname: "/growth/media", activeNavId: "media-assets" },
  { pathname: "/growth/share-pages/templates", activeNavId: "templates" },
  { pathname: "/growth/automation", activeNavId: "automation-flows" },
  { pathname: "/growth/engagement", activeNavId: "engagement" },
  { pathname: "/growth/opportunities", activeNavId: "opportunities" },
  { pathname: "/growth/opportunities/pipeline", activeNavId: "opportunities-pipeline" },
  { pathname: "/growth/conversations", activeNavId: "conversations" },
  { pathname: "/growth/relationships", activeNavId: "relationships" },
]

const CMD_K_ADMIN_ONLY_STAYS_ADMIN = [
  "/admin/growth/providers",
  "/admin/growth/ownership",
  "/admin/growth/providers/compliance",
  "/admin/growth/settings/growth",
  "/admin/growth/revenue-intelligence",
  "/admin/growth/intent-pixel",
  "/admin/growth/outreach",
  "/admin/growth/sequences/execution",
] as const

const CMD_K_MIGRATED_REWRITES = [
  { adminHref: "/admin/growth/engagement", workspaceSegment: "engagement" },
  { adminHref: "/admin/growth/opportunities", workspaceSegment: "opportunities" },
  { adminHref: "/admin/growth/conversations", workspaceSegment: "conversations" },
] as const

function runAudit(): void {
  console.log(`\n=== Growth workspace sidebar IA audit (${GROWTH_WORKSPACE_SIDEBAR_IA_QA_MARKER}) ===\n`)
  console.log(`  shell nav qa marker: ${GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER}`)

  assert.equal(GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER, "growth-workspace-shell-nav-v4")

  assert.deepEqual(
    GROWTH_SHELL_NAV_GROUPS.map((group) => group.id),
    [...GROWTH_WORKSPACE_SIDEBAR_GROUP_IDS],
  )
  console.log("  ✓ workspace sidebar groups are operator-only (no Settings group)")

  const manifestNavIds = GROWTH_WORKSPACE_SHELL_NAV_MANIFEST.flatMap((group) => group.items.map((item) => item.id))
  assert.deepEqual(manifestNavIds, [...GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS])
  console.log("  ✓ manifest matches Phase 5A operator nav ids")

  for (const hiddenId of GROWTH_WORKSPACE_SIDEBAR_HIDDEN_NAV_IDS) {
    assert.ok(!manifestNavIds.includes(hiddenId), `hidden nav id still in manifest: ${hiddenId}`)
  }
  console.log("  ✓ config/admin/control-plane items hidden from workspace sidebar")

  for (const group of GROWTH_WORKSPACE_SHELL_NAV_MANIFEST) {
    for (const item of group.items) {
      assert.ok(item.workspaceRoute, `${item.id} must be a workspace route in sidebar`)
      assert.ok(
        !GROWTH_WORKSPACE_SIDEBAR_FORBIDDEN_REGISTRY_ROUTE_IDS.includes(
          item.registryRouteId as (typeof GROWTH_WORKSPACE_SIDEBAR_FORBIDDEN_REGISTRY_ROUTE_IDS)[number],
        ),
        `${item.id} uses forbidden registry route: ${item.registryRouteId}`,
      )

      const route = getGrowthRouteMetadataById(item.registryRouteId)
      assert.ok(route, `${item.id} missing registry route: ${item.registryRouteId}`)
      assert.ok(
        !GROWTH_WORKSPACE_SIDEBAR_FORBIDDEN_MIGRATION_STATUSES.includes(
          route.migrationStatus as (typeof GROWTH_WORKSPACE_SIDEBAR_FORBIDDEN_MIGRATION_STATUSES)[number],
        ),
        `${item.id} surfaces forbidden migration status: ${route.migrationStatus}`,
      )
      assert.ok(
        route.path.startsWith(GROWTH_WORKSPACE_BASE_PATH),
        `${item.id} must resolve to /growth workspace path, got ${route.path}`,
      )
    }
  }
  console.log("  ✓ sidebar items are workspace routes only (no admin-only registry entries)")

  for (const item of GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items)) {
    assert.ok(
      item.href.startsWith(GROWTH_WORKSPACE_BASE_PATH),
      `workspace sidebar href must stay under /growth: ${item.id} -> ${item.href}`,
    )
    assert.ok(
      !item.href.startsWith(GROWTH_ADMIN_BASE_PATH),
      `workspace sidebar must not link to admin chrome: ${item.id} -> ${item.href}`,
    )
  }
  console.log("  ✓ workspace sidebar hrefs stay under /growth/*")

  for (const { pathname, activeNavId } of SIDEBAR_ACTIVE_STATE_CASES) {
    const navItems = GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items)
    const activeItems = navItems.filter((item) => isGrowthShellNavItemActive(pathname, item))
    assert.ok(
      activeItems.some((item) => item.id === activeNavId),
      `expected ${activeNavId} active for ${pathname}, got ${activeItems.map((item) => item.id).join(", ") || "(none)"}`,
    )
  }
  console.log("  ✓ operator route active states still work after IA cleanup")

  for (const adminHref of CMD_K_ADMIN_ONLY_STAYS_ADMIN) {
    const resolved = resolveGrowthCommandPaletteHref("/growth/inbox", adminHref)
    assert.equal(resolved, adminHref, `admin-only Cmd+K route should not rewrite: ${adminHref}`)
  }
  console.log("  ✓ admin-only routes remain reachable through Cmd+K without rewrite")

  for (const { adminHref, workspaceSegment } of CMD_K_MIGRATED_REWRITES) {
    const resolved = resolveGrowthCommandPaletteHref("/growth/inbox", adminHref)
    assert.equal(resolved.split("?")[0], growthFeaturePath("/growth/inbox", workspaceSegment))
  }
  console.log("  ✓ Cmd+K still rewrites migrated operator routes to /growth/*")

  assertGrowthCommandPaletteRegistryParity()
  console.log("  ✓ Cmd+K registry parity unchanged")

  console.log("\nGrowth workspace sidebar IA audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_SIDEBAR_IA_QA_MARKER,
        shell_nav_qa_marker: GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER,
        operator_nav_items: GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS.length,
        hidden_nav_items: GROWTH_WORKSPACE_SIDEBAR_HIDDEN_NAV_IDS.length,
        sidebar_groups: GROWTH_WORKSPACE_SIDEBAR_GROUP_IDS.length,
      },
      null,
      2,
    ),
  )
}

runAudit()
