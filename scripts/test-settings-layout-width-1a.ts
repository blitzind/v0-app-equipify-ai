/**
 * GS-GROWTH-SETTINGS-LAYOUT-1A — Workspace Settings full-width shell regression.
 * Run: pnpm test:settings-layout-width-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

function testSettingsMainInnerHasNoMaxWidth() {
  const tokens = readSource("lib/workspace/workspace-shell-tokens.ts")
  const settingsTokens = readSource("lib/settings/workspace-settings-shell-tokens.ts")

  assert.match(tokens, /WORKSPACE_SETTINGS_SHELL_MAIN_INNER/)
  const match = tokens.match(/WORKSPACE_SETTINGS_SHELL_MAIN_INNER\s*=\s*\n?\s*"([^"]+)"/)
  assert.ok(match, "WORKSPACE_SETTINGS_SHELL_MAIN_INNER constant expected")
  const classes = match[1]
  assert.ok(!/\bmax-w-/.test(classes), "settings main inner must not cap max-width")
  assert.match(classes, /\bflex-1\b|\bw-full\b/)
  assert.match(classes, /\bmin-w-0\b/)

  assert.match(settingsTokens, /WORKSPACE_SETTINGS_SHELL_MAIN_INNER/)
  assert.doesNotMatch(settingsTokens, /max-w-/)
}

function testPageShellUsesSettingsInner() {
  const pageShell = readSource("components/page-shell.tsx")
  assert.match(pageShell, /isWorkspaceSettingsPathname/)
  assert.match(pageShell, /WORKSPACE_SETTINGS_SHELL_MAIN_INNER/)
  assert.match(pageShell, /data-settings-full-width/)
  assert.match(pageShell, /isSettingsRoute \? WORKSPACE_SETTINGS_SHELL_MAIN_INNER : WORKSPACE_SHELL_MAIN_INNER/)
}

function testSettingsLayoutFullWidth() {
  const layout = readSource("app/(dashboard)/settings/layout.tsx")
  assert.match(layout, /WORKSPACE_SETTINGS_SHELL_ROOT/)
  assert.match(layout, /WORKSPACE_SETTINGS_SHELL_BODY/)
  assert.match(layout, /WORKSPACE_SETTINGS_SHELL_CONTENT/)
  assert.match(layout, /WORKSPACE_SETTINGS_SHELL_LAYOUT_QA_MARKER/)
  assert.doesNotMatch(layout, /max-w-/)
}

function testSettingsSidebarFixedWidth() {
  const nav = readSource("components/settings/workspace-settings-nav.tsx")
  assert.match(nav, /w-56/)
  assert.match(nav, /shrink-0/)
  assert.match(nav, /md:hidden/)
  assert.match(nav, /hidden md:flex/)
}

function testGrowthEngineSectionUnconstrained() {
  const sectionPage = readSource("components/settings/workspace-settings-growth-engine-section-page.tsx")
  assert.match(sectionPage, /max-w-none/)
  assert.match(sectionPage, /w-full/)
  assert.match(sectionPage, /min-w-0/)
}

function testNonSettingsRoutesRetainMaxWidth() {
  const tokens = readSource("lib/workspace/workspace-shell-tokens.ts")
  const match = tokens.match(/WORKSPACE_SHELL_MAIN_INNER\s*=\s*\n?\s*"([^"]+)"/)
  assert.ok(match)
  assert.match(match[1], /max-w-\[1440px\]/)
  assert.match(match[1], /mx-auto/)
}

function testMobileNavPreserved() {
  const nav = readSource("components/settings/workspace-settings-nav.tsx")
  assert.match(nav, /variant === "mobile"/)
  assert.match(nav, /md:hidden/)
  assert.match(nav, /sticky top-0/)
}

function testGrowthSettingsShellContentWidth() {
  const shell = readSource("components/growth/settings/growth-settings-shell.tsx")
  const tokens = readSource("lib/growth/settings/growth-workspace-settings-shell-tokens.ts")
  assert.match(shell, /GROWTH_WORKSPACE_SETTINGS_SHELL_CONTENT/)
  assert.match(shell, /data-growth-settings-full-width="true"/)
  assert.match(tokens, /max-w-none/)
  assert.doesNotMatch(shell, /max-w-\[1440px\]/)
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: "settings main inner has no max-width", fn: testSettingsMainInnerHasNoMaxWidth },
  { name: "PageShell switches inner for /settings", fn: testPageShellUsesSettingsInner },
  { name: "settings layout full width tokens", fn: testSettingsLayoutFullWidth },
  { name: "settings sidebar fixed width", fn: testSettingsSidebarFixedWidth },
  { name: "growth engine section unconstrained", fn: testGrowthEngineSectionUnconstrained },
  { name: "non-settings routes retain max-width", fn: testNonSettingsRoutesRetainMaxWidth },
  { name: "mobile settings nav preserved", fn: testMobileNavPreserved },
  { name: "growth settings shell content width", fn: testGrowthSettingsShellContentWidth },
]

let failed = 0
for (const t of tests) {
  try {
    t.fn()
    console.log(`ok\t${t.name}`)
  } catch (e) {
    failed += 1
    console.error(`fail\t${t.name}`)
    console.error(e)
  }
}

if (failed > 0) process.exit(1)
console.log(`\nAll ${tests.length} settings-layout-width-1a tests passed.`)
