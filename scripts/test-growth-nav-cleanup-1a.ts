/**
 * GS-NAV-CLEANUP-1A — Growth settings nav must not duplicate Core workspace settings.
 * Run: pnpm test:growth-nav-cleanup-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
  GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER,
  listGrowthWorkspaceSettingsSectionIds,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"

export const GROWTH_NAV_CLEANUP_1A_QA_MARKER = "growth-nav-cleanup-1a-v1" as const

const REMOVED_GROWTH_HREFS = [
  "/growth/settings/workspace",
  "/growth/settings/workspace/team",
  "/growth/settings/workspace/organization",
  "/growth/settings/workspace/billing",
  "/growth/settings/workspace/integrations",
] as const

const REMOVED_NAV_IDS = ["workspace", "team", "organization", "billing", "integrations"] as const

const CORE_WORKSPACE_PATHS = [
  "/settings/workspace",
  "/settings/team",
  "/settings/billing",
  "/settings/integrations",
] as const

function readSource(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

function allNavHrefs(): string[] {
  return GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href))
}

function main(): void {
  console.log(`\n=== GS-NAV-CLEANUP-1A (${GROWTH_NAV_CLEANUP_1A_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER, "growth-workspace-settings-nav-ux-polish-1a-v1")
  console.log("  ✓ Nav QA marker updated for 1A")

  assert.equal(
    GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((group) => group.id === "workspace"),
    undefined,
    "Workspace settings group must be removed from Growth settings nav",
  )
  console.log("  ✓ Workspace nav group removed")

  const sectionIds = listGrowthWorkspaceSettingsSectionIds()
  for (const id of REMOVED_NAV_IDS) {
    assert.ok(!sectionIds.includes(id), `removed nav id still present: ${id}`)
  }
  console.log("  ✓ Removed section ids absent from manifest")

  const hrefs = allNavHrefs()
  for (const removed of REMOVED_GROWTH_HREFS) {
    assert.ok(!hrefs.includes(removed), `Growth nav still links to ${removed}`)
  }
  console.log("  ✓ No Growth nav hrefs point to duplicate workspace settings routes")

  const navSource = readSource("lib/growth/navigation/growth-workspace-settings-navigation.ts")
  for (const removed of REMOVED_GROWTH_HREFS) {
    assert.doesNotMatch(navSource, new RegExp(removed.replace(/\//g, "\\/")))
  }
  console.log("  ✓ Navigation source has no removed workspace route strings")

  const shellSource = readSource("components/growth/settings/growth-settings-shell.tsx")
  for (const removed of REMOVED_GROWTH_HREFS) {
    assert.doesNotMatch(shellSource, new RegExp(removed.replace(/\//g, "\\/")))
  }
  console.log("  ✓ Growth settings shell has no hardcoded removed workspace links")

  const coreNav = readSource("lib/settings/workspace-settings-navigation.ts")
  for (const corePath of CORE_WORKSPACE_PATHS) {
    assert.match(coreNav, new RegExp(corePath.replace(/\//g, "\\/")))
  }
  console.log("  ✓ Core workspace settings navigation retains canonical paths")

  assert.equal(GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.length, 5)
  assert.equal(sectionIds.length, 16)
  console.log("  ✓ Growth settings nav has 5 groups and 16 sections after cleanup")

  console.log("\nGS-NAV-CLEANUP-1A passed.\n")
}

main()
