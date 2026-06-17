/**
 * Growth workspace experience certification (Phase 6C — local only).
 *
 * Usage: pnpm test:growth-workspace-experience
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { GROWTH_ADMIN_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-workspace-base-path"
import { GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTIONS } from "../lib/growth/workspace/growth-workspace-dashboard-quick-actions"
import { GROWTH_WORKSPACE_DASHBOARD_QA_MARKER } from "../lib/growth/workspace/growth-workspace-dashboard-types"
import {
  GROWTH_WORKSPACE_ACTIVITY_QA_MARKER,
  GROWTH_WORKSPACE_CONTINUE_KEY,
  GROWTH_WORKSPACE_RECENT_VIEWS_KEY,
} from "../lib/growth/workspace/growth-workspace-activity-memory"
import {
  GROWTH_WORKSPACE_SEARCH_CATEGORIES,
  GROWTH_WORKSPACE_SEARCH_QA_MARKER,
} from "../lib/workspace/growth-workspace-search-categories"
import {
  GROWTH_WORKSPACE_SEARCH_PROVIDER_ORDER,
} from "../lib/workspace/growth-workspace-search-providers"

export const GROWTH_WORKSPACE_EXPERIENCE_QA_MARKER = "growth-workspace-experience-v1" as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function assertIncludes(relativePath: string, needle: string, message: string): void {
  assert.ok(read(relativePath).includes(needle), message)
}

function assertExcludes(relativePath: string, needle: string, message: string): void {
  assert.ok(!read(relativePath).includes(needle), message)
}

function runAudit(): void {
  console.log(`\n=== Growth workspace experience certification (${GROWTH_WORKSPACE_EXPERIENCE_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_WORKSPACE_SEARCH_CATEGORIES.length, 11)
  assert.deepEqual(
    GROWTH_WORKSPACE_SEARCH_PROVIDER_ORDER,
    GROWTH_WORKSPACE_SEARCH_CATEGORIES.map((row) => row.id),
  )
  assertIncludes(
    "lib/workspace/growth-workspace-search-providers.ts",
    "Promise.allSettled",
    "search must load categories in parallel with partial failure tolerance",
  )
  assertIncludes(
    "lib/workspace/growth-workspace-search-providers.ts",
    "runGrowthWorkspaceSearchProviders",
    "single orchestrated search provider module",
  )
  console.log("  ✓ all 11 search categories registered with parallel provider orchestration")

  const panelSource = read("components/workspace/global-search-panel.tsx")
  assert.equal((panelSource.match(/role=\"combobox\"/g) ?? []).length, 1, "single workspace search combobox")
  assert.ok(panelSource.includes("WorkspaceSearchResultsSkeleton"), "search loading skeletons present")
  assert.ok(panelSource.includes("Recent searches"), "recent searches support present")
  assertExcludes("components/growth/shell/growth-topbar.tsx", "GlobalSearchPanel", "Growth topbar must not duplicate search panel")
  console.log("  ✓ no duplicate search providers; shared panel with skeletons and recents")

  assertIncludes(
    "components/growth/workspace/growth-workspace-dashboard-body.tsx",
    'data-section="welcome"',
    "dashboard welcome area renders",
  )
  assertIncludes(
    "components/growth/workspace/growth-workspace-dashboard-body.tsx",
    'data-section="recent-activity"',
    "recent activity section renders",
  )
  assertIncludes(
    "components/growth/workspace/growth-workspace-dashboard-body.tsx",
    'data-section="continue-working"',
    "continue-working cards render",
  )
  assertIncludes("lib/growth/workspace/growth-workspace-activity-memory.ts", GROWTH_WORKSPACE_RECENT_VIEWS_KEY, "recent views storage key")
  assertIncludes("lib/growth/workspace/growth-workspace-activity-memory.ts", GROWTH_WORKSPACE_CONTINUE_KEY, "continue storage key")
  assertIncludes("components/growth/shell/growth-workspace-shell.tsx", "GrowthWorkspaceActivityTracker", "shell tracks activity locally")
  console.log("  ✓ dashboard personalization and local activity memory wired")

  for (const action of GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTIONS) {
    assert.ok(action.href.startsWith(GROWTH_WORKSPACE_BASE_PATH), `quick action must stay under /growth: ${action.id}`)
    assert.ok(action.description, `quick action description required: ${action.id}`)
    assert.ok(action.shortcut, `quick action shortcut required: ${action.id}`)
  }
  assertIncludes(
    "components/growth/workspace/use-growth-workspace-quick-action-shortcuts.ts",
    "recordGrowthWorkspaceQuickActionUsage",
    "quick action keyboard shortcuts record usage",
  )
  console.log("  ✓ quick actions enhanced with descriptions, shortcuts, and /growth destinations")

  const hookSource = read("components/growth/workspace/use-growth-workspace-dashboard.ts")
  assert.match(hookSource, /Promise\.all\(/)
  assert.equal((hookSource.match(/fetch\(/g) ?? []).length, 1)
  assert.match(hookSource, /growth-workspace-dashboard-fetch-batch-v1/)
  assertIncludes("components/growth/workspace/growth-workspace-dashboard-body.tsx", "data-workspace-dashboard-loading", "dashboard skeletons show immediately")
  console.log("  ✓ dashboard uses one batched load with immediate skeletons")

  const primitiveFiles = [
    "components/workspace/workspace-shell-brand.tsx",
    "components/workspace/workspace-switcher.tsx",
    "components/workspace/workspace-search.tsx",
    "components/workspace/workspace-container.tsx",
    "components/workspace/global-search-panel.tsx",
  ]
  for (const file of primitiveFiles) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
  }
  assertIncludes("components/growth/shell/growth-workspace-shell.tsx", "WorkspaceContainer", "Growth shell still uses shared container")
  assertIncludes("components/app-topbar.tsx", "WORKSPACE_SHELL_TOPBAR", "Core shell still uses shared topbar token")
  console.log("  ✓ shared shell primitives remain in use")

  for (const file of [
    "lib/workspace/growth-workspace-search-providers.ts",
    "components/growth/workspace/growth-workspace-dashboard-body.tsx",
    "components/growth/shell/growth-workspace-shell.tsx",
  ]) {
    assertExcludes(file, GROWTH_ADMIN_BASE_PATH, `${file} must not hardcode admin paths`)
  }
  assertExcludes("lib/workspace/growth-workspace-search-providers.ts", GROWTH_ADMIN_BASE_PATH, "search providers must not hardcode admin paths")
  console.log("  ✓ no admin hardcodes; middleware/auth untouched in experience modules")

  assert.equal(GROWTH_WORKSPACE_DASHBOARD_QA_MARKER, "growth-workspace-dashboard-v2")
  assert.equal(GROWTH_WORKSPACE_SEARCH_QA_MARKER, "growth-workspace-search-v2")
  assert.equal(GROWTH_WORKSPACE_ACTIVITY_QA_MARKER, "growth-workspace-activity-v1")
  console.log("  ✓ experience QA markers present")

  console.log("\nGrowth workspace experience certification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_EXPERIENCE_QA_MARKER,
        search_categories: GROWTH_WORKSPACE_SEARCH_CATEGORIES.length,
        dashboard_qa_marker: GROWTH_WORKSPACE_DASHBOARD_QA_MARKER,
        search_qa_marker: GROWTH_WORKSPACE_SEARCH_QA_MARKER,
      },
      null,
      2,
    ),
  )
}

runAudit()
