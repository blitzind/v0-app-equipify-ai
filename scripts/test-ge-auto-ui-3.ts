/**
 * GE-AUTO-UI-3 — Growth settings full-width layout regression cert.
 * Run: pnpm test:ge-auto-ui-3
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { isGrowthWorkspaceSettingsPathname } from "../lib/growth/navigation/growth-workspace-settings-paths"
import {
  assertGrowthWorkspaceSettingsMainInnerHasNoMaxWidth,
  GROWTH_WORKSPACE_SETTINGS_SHELL_CONTENT,
  GROWTH_WORKSPACE_SETTINGS_SHELL_LAYOUT_QA_MARKER,
  GROWTH_WORKSPACE_SETTINGS_SHELL_MAIN_INNER,
} from "../lib/growth/settings/growth-workspace-settings-shell-tokens"
import {
  GROWTH_WORKSPACE_SHELL_MAIN_INNER,
  WORKSPACE_SETTINGS_SHELL_MAIN_INNER,
} from "../lib/workspace/workspace-shell-tokens"

export const GE_AUTO_UI_3_QA_MARKER = "ge-auto-ui-3-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GE-AUTO-UI-3 ===\n")
  assert.equal(GE_AUTO_UI_3_QA_MARKER, "ge-auto-ui-3-v1")
  console.log("  ✓ QA marker")

  assert.equal(GROWTH_WORKSPACE_SETTINGS_SHELL_MAIN_INNER, WORKSPACE_SETTINGS_SHELL_MAIN_INNER)
  assertGrowthWorkspaceSettingsMainInnerHasNoMaxWidth(GROWTH_WORKSPACE_SETTINGS_SHELL_MAIN_INNER)
  assert.doesNotMatch(GROWTH_WORKSPACE_SETTINGS_SHELL_MAIN_INNER, /mx-auto/)
  console.log("  ✓ Growth settings main inner matches Core settings (no max-w, no mx-auto)")

  assert.match(GROWTH_WORKSPACE_SHELL_MAIN_INNER, /max-w-\[1440px\]/)
  assert.match(GROWTH_WORKSPACE_SHELL_MAIN_INNER, /mx-auto/)
  console.log("  ✓ Non-settings Growth routes retain max-width cap")

  assert.equal(isGrowthWorkspaceSettingsPathname("/growth/settings/autonomy"), true)
  assert.equal(isGrowthWorkspaceSettingsPathname("/growth/settings/autonomy/"), true)
  assert.equal(isGrowthWorkspaceSettingsPathname("/growth/settings/profile"), true)
  assert.equal(isGrowthWorkspaceSettingsPathname("/growth/objectives"), false)
  console.log("  ✓ Settings pathname helper includes trailing-slash variants")

  const growthShell = readSource("components/growth/shell/growth-workspace-shell.tsx")
  assert.match(growthShell, /isGrowthWorkspaceSettingsPathname/)
  assert.match(growthShell, /GROWTH_WORKSPACE_SETTINGS_SHELL_MAIN_INNER/)
  assert.match(growthShell, /max-w-none mx-0/)
  assert.match(growthShell, /min-w-0 w-full flex-1/)
  console.log("  ✓ GrowthWorkspaceShell applies full-width inner + override classes on settings routes")

  const settingsShell = readSource("components/growth/settings/growth-settings-shell.tsx")
  assert.match(settingsShell, /GROWTH_WORKSPACE_SETTINGS_SHELL_ROOT/)
  assert.match(settingsShell, /GROWTH_WORKSPACE_SETTINGS_SHELL_BODY/)
  assert.match(settingsShell, /GROWTH_WORKSPACE_SETTINGS_SHELL_CONTENT/)
  assert.match(settingsShell, /data-growth-settings-full-width="true"/)
  assert.doesNotMatch(settingsShell, /max-w-\[1440px\]/)
  assert.doesNotMatch(settingsShell, /mx-auto/)
  console.log("  ✓ GrowthSettingsShell uses full-width settings shell tokens")

  assert.match(GROWTH_WORKSPACE_SETTINGS_SHELL_CONTENT, /max-w-none/)
  assert.match(GROWTH_WORKSPACE_SETTINGS_SHELL_CONTENT, /flex-1/)
  console.log("  ✓ Settings content column expands (flex-1, max-w-none)")

  console.log("\nGE-AUTO-UI-3 passed.\n")
}

main()
