/**
 * GE-AIOS-UX-1A Phase 1 — workspace-first navigation certification.
 * Run: pnpm test:ge-aios-ux-1a-workspace-first-navigation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_WORKSPACE_FIRST_UX_1A_FEATURE_FLAG,
  GROWTH_WORKSPACE_FIRST_UX_1A_PUBLIC_FEATURE_FLAG,
  GROWTH_WORKSPACE_FIRST_UX_1A_QA_MARKER,
  isGrowthWorkspaceFirstUx1aEnabled,
} from "../lib/growth/navigation/growth-workspace-first-ux-1a-feature"
import {
  GROWTH_WORKSPACE_FIRST_UX_1A_FORBIDDEN_NAV_LABELS,
  GROWTH_WORKSPACE_FIRST_UX_1A_GROUP_IDS,
  GROWTH_WORKSPACE_FIRST_UX_1A_NAV_MANIFEST,
  GROWTH_WORKSPACE_FIRST_UX_1A_OPERATOR_NAV_IDS,
} from "../lib/growth/navigation/growth-workspace-first-ux-1a-navigation"
import { GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS } from "../lib/growth/navigation/growth-workspace-first-ux-1a-labels"
import {
  GROWTH_WORKSPACE_FIRST_UX_1A_SHELL_NAV_MANIFEST,
  GROWTH_WORKSPACE_SHELL_NAV_MANIFEST,
  GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER,
  GROWTH_WORKSPACE_SHELL_NAV_UX_1A_QA_MARKER,
  buildGrowthWorkspaceShellNavGroups,
  isGrowthShellNavItemActive,
  isGrowthWorkspaceFirstUx1aShellNavActive,
  resolveGrowthWorkspaceShellNavManifest,
  validateGrowthWorkspaceShellNavRegistryParity,
} from "../lib/growth/navigation/growth-workspace-shell-navigation"
import { GROWTH_REVIEW_PAGE_HREF } from "../lib/growth/workspace/ux-1a/review/growth-review-routes"

const PHASE = "GE-AIOS-UX-1A-WORKSPACE-FIRST-NAVIGATION" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function withUx1aEnv<T>(fn: () => T): T {
  const prior = process.env[GROWTH_WORKSPACE_FIRST_UX_1A_FEATURE_FLAG]
  process.env[GROWTH_WORKSPACE_FIRST_UX_1A_FEATURE_FLAG] = "true"
  try {
    return fn()
  } finally {
    if (prior === undefined) delete process.env[GROWTH_WORKSPACE_FIRST_UX_1A_FEATURE_FLAG]
    else process.env[GROWTH_WORKSPACE_FIRST_UX_1A_FEATURE_FLAG] = prior
  }
}

function main(): void {
  console.log(`[${PHASE}] Workspace-first navigation Phase 1 certification`)

  assert.equal(GROWTH_WORKSPACE_FIRST_UX_1A_QA_MARKER, "ge-aios-ux-1a-workspace-first-operator-navigation-v1")
  assert.equal(GROWTH_WORKSPACE_FIRST_UX_1A_FEATURE_FLAG, "GROWTH_WORKSPACE_FIRST_UX_1A_ENABLED")
  assert.equal(
    GROWTH_WORKSPACE_FIRST_UX_1A_PUBLIC_FEATURE_FLAG,
    "NEXT_PUBLIC_GROWTH_WORKSPACE_FIRST_UX_1A_ENABLED",
  )
  assert.equal(isGrowthWorkspaceFirstUx1aEnabled({}), false)
  assert.equal(isGrowthWorkspaceFirstUx1aEnabled({ [GROWTH_WORKSPACE_FIRST_UX_1A_FEATURE_FLAG]: "true" }), true)

  const primaryLabels = GROWTH_WORKSPACE_FIRST_UX_1A_NAV_MANIFEST.flatMap((group) =>
    group.items.map((item) => item.label),
  )
  assert.deepEqual(
    GROWTH_WORKSPACE_FIRST_UX_1A_NAV_MANIFEST.map((group) => group.id),
    [...GROWTH_WORKSPACE_FIRST_UX_1A_GROUP_IDS],
  )
  assert.deepEqual(
    GROWTH_WORKSPACE_FIRST_UX_1A_NAV_MANIFEST.flatMap((group) => group.items.map((item) => item.id)),
    [...GROWTH_WORKSPACE_FIRST_UX_1A_OPERATOR_NAV_IDS],
  )

  assert.equal(primaryLabels[0], GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS.workspace)
  assert.equal(primaryLabels[1], GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS.review)
  assert.equal(primaryLabels[4], GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS.pipeline)
  assert.equal(GROWTH_WORKSPACE_FIRST_UX_1A_NAV_MANIFEST[1]?.label, GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS.tools)

  for (const forbidden of GROWTH_WORKSPACE_FIRST_UX_1A_FORBIDDEN_NAV_LABELS) {
    assert.ok(!primaryLabels.includes(forbidden), `forbidden label in UX-1A nav: ${forbidden}`)
  }

  const ux1aParity = validateGrowthWorkspaceShellNavRegistryParity(GROWTH_WORKSPACE_FIRST_UX_1A_SHELL_NAV_MANIFEST)
  assert.equal(ux1aParity.length, 0, ux1aParity.map((issue) => issue.message).join("; "))

  withUx1aEnv(() => {
    assert.equal(isGrowthWorkspaceFirstUx1aShellNavActive(), true)
    assert.equal(resolveGrowthWorkspaceShellNavManifest(), GROWTH_WORKSPACE_FIRST_UX_1A_SHELL_NAV_MANIFEST)
    assert.equal(resolveGrowthWorkspaceShellNavManifest(), GROWTH_WORKSPACE_FIRST_UX_1A_SHELL_NAV_MANIFEST)

    const groups = buildGrowthWorkspaceShellNavGroups()
    assert.deepEqual(
      groups.map((group) => group.id),
      ["operator-primary", "tools"],
    )
    assert.deepEqual(
      groups.flatMap((group) => group.items.map((item) => item.label)),
      [
        "Workspace",
        "Review",
        "Inbox",
        "Meetings",
        "Pipeline",
        "Find Companies",
        "Leads",
        "Training",
        "About",
        "Settings",
      ],
    )

    const workspace = groups[0]?.items[0]
    const review = groups[0]?.items[1]
    const pipeline = groups[0]?.items[4]
    assert.ok(workspace)
    assert.ok(review)
    assert.ok(pipeline)

    assert.equal(isGrowthShellNavItemActive("/growth", workspace), true)
    assert.equal(review?.href, GROWTH_REVIEW_PAGE_HREF)
    assert.equal(isGrowthShellNavItemActive("/growth/review", review), true)
    assert.equal(isGrowthShellNavItemActive("/growth/os/approvals", review), true)
    assert.equal(isGrowthShellNavItemActive("/growth/opportunities/pipeline", pipeline), true)
    assert.equal(GROWTH_WORKSPACE_SHELL_NAV_UX_1A_QA_MARKER, "growth-workspace-shell-nav-v12")
  })

  assert.equal(isGrowthWorkspaceFirstUx1aShellNavActive(), false)
  assert.equal(resolveGrowthWorkspaceShellNavManifest(), GROWTH_WORKSPACE_SHELL_NAV_MANIFEST)
  assert.equal(GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER, "growth-workspace-shell-nav-v11")

  const sidebarNav = readSource("components/growth/shell/growth-sidebar-nav-content.tsx")
  assert.match(sidebarNav, /buildGrowthWorkspaceShellNavGroups/)
  assert.match(sidebarNav, /data-growth-workspace-first-ux-1a/)
  assert.match(sidebarNav, /showGroupHeader/)

  const shell = readSource("components/growth/shell/growth-workspace-shell.tsx")
  assert.match(shell, /data-growth-workspace-first-ux-1a/)

  console.log(`[${PHASE}] passed`)
}

main()
