/**
 * Phase 8B.1 — Growth workspace settings consumption audit.
 *
 * Usage: pnpm test:growth-workspace-settings-consumption
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_WORKSPACE_SETTINGS_CONSUMPTION_QA_MARKER,
  mergeGrowthWorkspaceDefaultViews,
  resolveGrowthCallsDefaultViewDestination,
  resolveGrowthCallsOperatingViewWithSavedDefault,
  resolveGrowthInboxQueueViewFromUrl,
  resolveGrowthOpportunitiesDefaultTabHref,
  shouldApplyGrowthCallsSavedDefault,
  shouldApplyGrowthInboxSavedDefaultFilter,
  shouldApplyGrowthOpportunitiesSavedDefaultTab,
} from "../lib/growth/settings/growth-workspace-settings-consumption"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import {
  GROWTH_SHELL_NAV_GROUPS,
} from "../lib/growth/navigation/growth-workspace-shell-navigation"
import {
  assertGrowthCommandPaletteRegistryParity,
} from "../lib/growth/navigation/growth-command-palette-derivation"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function runAudit(): void {
  console.log(`\n=== Growth workspace settings consumption audit (${GROWTH_WORKSPACE_SETTINGS_CONSUMPTION_QA_MARKER}) ===\n`)

  assert.equal(
    resolveGrowthInboxQueueViewFromUrl({ viewParam: null, savedDefaultFilter: "objections" }),
    "objections",
  )
  assert.equal(
    resolveGrowthInboxQueueViewFromUrl({ viewParam: "high_priority", savedDefaultFilter: "objections" }),
    "high_priority",
  )
  console.log("  ✓ inbox default filter applies only when no ?view=")

  assert.equal(shouldApplyGrowthInboxSavedDefaultFilter(null), true)
  assert.equal(shouldApplyGrowthInboxSavedDefaultFilter("needs_action"), false)
  console.log("  ✓ explicit ?view= wins over saved inbox default")

  const inboxSync = readSource("components/growth/inbox/growth-inbox-queue-url-sync.tsx")
  assert.match(inboxSync, /useGrowthWorkspaceDefaultViewsReadonly/)
  assert.match(inboxSync, /shouldApplyGrowthInboxSavedDefaultFilter/)
  console.log("  ✓ inbox URL sync loads saved default without blocking render")

  assert.equal(
    resolveGrowthCallsOperatingViewWithSavedDefault({
      pathname: `${GROWTH_WORKSPACE_BASE_PATH}/calls/workspace`,
      viewParam: null,
      savedCallsDefaultView: "overview",
    }),
    "overview",
  )
  assert.equal(
    resolveGrowthCallsOperatingViewWithSavedDefault({
      pathname: `${GROWTH_WORKSPACE_BASE_PATH}/calls/workspace`,
      viewParam: "operate",
      savedCallsDefaultView: "overview",
    }),
    "operate",
  )
  console.log("  ✓ calls explicit query/view wins over saved default")

  assert.equal(resolveGrowthCallsDefaultViewDestination("queue").kind, "navigate")
  assert.equal(
    resolveGrowthCallsDefaultViewDestination("queue").kind === "navigate"
      ? resolveGrowthCallsDefaultViewDestination("queue").href
      : null,
    `${GROWTH_WORKSPACE_BASE_PATH}/leads/queue`,
  )
  assert.equal(shouldApplyGrowthCallsSavedDefault({
    pathname: `${GROWTH_WORKSPACE_BASE_PATH}/calls/workspace`,
    viewParam: null,
  }), true)
  assert.equal(shouldApplyGrowthCallsSavedDefault({
    pathname: `${GROWTH_WORKSPACE_BASE_PATH}/calls/workspace`,
    viewParam: "overview",
  }), false)
  console.log("  ✓ calls saved default routes only without explicit view")

  assert.equal(
    resolveGrowthOpportunitiesDefaultTabHref("pipeline"),
    `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline`,
  )
  assert.equal(resolveGrowthOpportunitiesDefaultTabHref("overview"), null)
  assert.equal(
    shouldApplyGrowthOpportunitiesSavedDefaultTab(`${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline`),
    false,
  )
  assert.equal(
    shouldApplyGrowthOpportunitiesSavedDefaultTab(`${GROWTH_WORKSPACE_BASE_PATH}/opportunities`),
    true,
  )
  console.log("  ✓ opportunities explicit tab routes win")

  const readonlyClient = readSource("lib/growth/settings/growth-workspace-settings-readonly-client.ts")
  assert.match(readonlyClient, /catch/)
  assert.match(readonlyClient, /mergeGrowthWorkspaceDefaultViews/)
  assert.match(readonlyClient, /settingsBootstrapInflight/)
  assert.match(readonlyClient, /loadGrowthWorkspaceSettingsReadonlyBootstrap/)
  const merged = mergeGrowthWorkspaceDefaultViews(null)
  assert.equal(merged.inboxDefaultFilter, "all")
  console.log("  ✓ settings load failure fails open to built-in defaults")

  const shell = readSource("components/growth/shell/growth-workspace-shell.tsx")
  assert.match(shell, /GrowthWorkspaceShellPreferencesProvider/)
  assert.match(shell, /data-growth-compact/)
  assert.match(shell, /data-growth-reduced-motion/)
  const sidebar = readSource("components/growth/shell/growth-sidebar.tsx")
  assert.match(sidebar, /useGrowthWorkspaceShellPreferences/)
  console.log("  ✓ workspace shell consumes compact, reduced motion, and sidebar collapsed")

  const persistence = readSource("scripts/test-growth-workspace-settings-persistence.ts")
  const shellSource = readSource("components/growth/shell/growth-sidebar-nav-content.tsx")
  assert.doesNotMatch(shellSource, /favoriteDestinations/)
  console.log("  ✓ favorite destinations deferred (no safe sidebar slot)")

  const navItems = GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items)
  assert.equal(navItems.length, 12)
  assertGrowthCommandPaletteRegistryParity()
  console.log("  ✓ sidebar remains 12 items; Cmd+K parity unchanged")

  console.log("\nGrowth workspace settings consumption audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_SETTINGS_CONSUMPTION_QA_MARKER,
        sidebar_items: navItems.length,
      },
      null,
      2,
    ),
  )
}

runAudit()
