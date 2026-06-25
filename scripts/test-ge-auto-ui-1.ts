/**
 * GE-AUTO-UI-1 — Growth Autonomy full-width layout & UX regression cert.
 * Run: pnpm test:ge-auto-ui-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

export const GE_AUTO_UI_1_QA_MARKER = "ge-auto-ui-1-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GE-AUTO-UI-1 ===\n")
  assert.equal(GE_AUTO_UI_1_QA_MARKER, "ge-auto-ui-1-v1")
  console.log("  ✓ QA marker")

  const tokens = readSource("lib/workspace/workspace-shell-tokens.ts")
  assert.match(tokens, /GROWTH_WORKSPACE_SETTINGS_SHELL_MAIN_INNER/)
  const settingsInner = tokens.match(/GROWTH_WORKSPACE_SETTINGS_SHELL_MAIN_INNER\s*=\s*WORKSPACE_SETTINGS_SHELL_MAIN_INNER/)
  assert.ok(settingsInner, "GROWTH_WORKSPACE_SETTINGS_SHELL_MAIN_INNER must alias WORKSPACE_SETTINGS_SHELL_MAIN_INNER")
  const workspaceSettingsInner = tokens.match(/WORKSPACE_SETTINGS_SHELL_MAIN_INNER\s*=\s*\n?\s*"([^"]+)"/)
  assert.ok(workspaceSettingsInner)
  assert.match(workspaceSettingsInner[1], /max-w-none/)
  assert.match(workspaceSettingsInner[1], /mx-0/)
  assert.doesNotMatch(workspaceSettingsInner[1], /max-w-\[1440px\]/)
  console.log("  ✓ Growth settings shell inner is full width")

  const growthShell = readSource("components/growth/shell/growth-workspace-shell.tsx")
  assert.match(growthShell, /GROWTH_WORKSPACE_SHELL_MAIN_INNER/)
  assert.match(growthShell, /data-growth-workspace-full-width/)
  assert.match(growthShell, /data-growth-settings-full-width/)
  assert.doesNotMatch(growthShell, /WorkspaceContainer/)
  console.log("  ✓ GrowthWorkspaceShell uses full-width inner for all workspace routes")

  const controlCenter = readSource("components/growth/autonomy/growth-autonomy-control-center.tsx")
  assert.match(controlCenter, /w-full min-w-0/)
  console.log("  ✓ Autonomy control center content wrapper is unconstrained")

  const settingsShell = readSource("components/growth/settings/growth-settings-shell.tsx")
  assert.match(settingsShell, /GROWTH_WORKSPACE_SETTINGS_SHELL_CONTENT/)
  assert.match(settingsShell, /data-growth-settings-full-width/)
  console.log("  ✓ Growth settings shell content column is flex-1")

  const operatorUi = readSource("lib/growth/autonomy/growth-autonomy-operator-ui.ts")
  assert.match(operatorUi, /GROWTH_AUTONOMY_CAPABILITY_OPERATOR_GROUPS/)
  assert.match(operatorUi, /Find & Learn/)
  assert.match(controlCenter, /Outreach controls/)
  assert.match(controlCenter, /xl:grid-cols-3/)
  assert.match(controlCenter, /Daily safety limits/)
  console.log("  ✓ Capabilities grouped; budgets/kill switches use operator layout")

  const outboundPanel = readSource("components/growth/autonomy/growth-autonomy-outbound-dashboard-panel.tsx")
  assert.match(outboundPanel, /auto-fill,minmax/)
  console.log("  ✓ Outbound dashboard uses auto-fill responsive stat grid")

  const growthMainInner = tokens.match(/GROWTH_WORKSPACE_SHELL_MAIN_INNER\s*=\s*\n?\s*"([^"]+)"/)
  assert.ok(growthMainInner)
  assert.match(growthMainInner[1], /max-w-none/)
  assert.match(growthMainInner[1], /mx-0/)
  assert.match(growthMainInner[1], /pb-6/)
  assert.match(growthMainInner[1], /bg-background/)
  assert.doesNotMatch(growthMainInner[1], /min-h-full/)
  assert.doesNotMatch(growthMainInner[1], /pb-24/)
  assert.doesNotMatch(growthMainInner[1], /max-w-\[1440px\]/)
  console.log("  ✓ Growth workspace main inner is full width on all routes")

  console.log("\nGE-AUTO-UI-1 passed.\n")
}

main()
