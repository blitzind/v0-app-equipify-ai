/**
 * GE-AI-UX-1B — AI OS branding & workspace architecture certification (static).
 * Run: pnpm test:ge-ai-ux-1b-ai-os-branding-workspace-architecture
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  AI_OS_ADVANCED_NAV_GROUP_LABEL,
  AI_OS_BREADCRUMB_ROOT_LABEL,
  AI_OS_DEPRECATED_OPERATOR_LABELS,
  AI_OS_HOME_NAV_LABEL,
  AI_OS_SIDEBAR_WORKSPACE_INDICATOR_LABEL,
  AI_OS_WORKSPACE_LABEL,
  GE_AI_UX_1B_QA_MARKER,
  getSubscriptionPlanShortDisplay,
} from "../lib/workspace/ai-os-workspace-branding"
import {
  GROWTH_SHELL_NAV_GROUPS,
  GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER,
} from "../lib/growth/navigation/growth-workspace-shell-navigation"
import { resolveGrowthBreadcrumbs } from "../lib/growth/navigation/growth-route-registry"
import { WORKSPACE_SIDEBAR_GROWTH_ENGINE_LABEL } from "../lib/workspace/workspace-shell-tokens"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function assertIncludes(relativePath: string, needle: string, message: string): void {
  assert.ok(readSource(relativePath).includes(needle), message)
}

function assertExcludes(relativePath: string, needle: string, message: string): void {
  assert.ok(!readSource(relativePath).includes(needle), message)
}

function collectOperatorChromeSources(): string[] {
  const dirs = [
    "components/growth/shell",
    "components/workspace",
    "components/growth/growth-section-sidebar-nav.tsx",
    "app/(growth)/growth/page.tsx",
    "app/(growth)/growth/os/page.tsx",
  ]
  const files: string[] = []
  for (const entry of dirs) {
    const full = path.join(ROOT, entry)
    if (!fs.existsSync(full)) continue
    if (full.endsWith(".tsx") || full.endsWith(".ts")) {
      files.push(full)
      continue
    }
    const walk = (dir: string) => {
      for (const child of fs.readdirSync(dir, { withFileTypes: true })) {
        const childPath = path.join(dir, child.name)
        if (child.isDirectory()) walk(childPath)
        else if (/\.(tsx?|jsx?)$/.test(child.name)) files.push(childPath)
      }
    }
    walk(full)
  }
  return files
}

console.log(`[GE-AI-UX-1B] AI OS branding & workspace architecture certification`)

assert.equal(GE_AI_UX_1B_QA_MARKER, "ge-ai-ux-1b-ai-os-branding-workspace-architecture-v1")
assert.equal(AI_OS_WORKSPACE_LABEL, "AI OS")
assert.equal(AI_OS_HOME_NAV_LABEL, "Home")
assert.equal(AI_OS_BREADCRUMB_ROOT_LABEL, "AI OS")
assert.equal(AI_OS_SIDEBAR_WORKSPACE_INDICATOR_LABEL, "Workspace")
assert.equal(AI_OS_ADVANCED_NAV_GROUP_LABEL, "Advanced")
console.log("  ✓ branding constants exported")

assert.equal(WORKSPACE_SIDEBAR_GROWTH_ENGINE_LABEL, "AI OS")
console.log("  ✓ sidebar workspace label token is AI OS (internal name unchanged)")

const planShort = getSubscriptionPlanShortDisplay({ planId: "scale" })
assert.equal(planShort, "Scale", "plan switcher must strip Equipify prefix")
console.log("  ✓ subscription plan short display uses existing resolution")

const switcher = readSource("components/workspace/workspace-switcher.tsx")
assert.ok(switcher.includes("getSubscriptionPlanShortDisplay"))
assert.ok(switcher.includes("AI_OS_WORKSPACE_LABEL"))
assert.equal(switcher.includes("Equipify Scale"), false, "switcher must not hardcode Equipify Scale")
assert.equal(switcher.includes("Growth Engine"), false, "switcher must not reference Growth Engine")
console.log("  ✓ workspace switcher: Plan | AI OS")

assert.equal(GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER, "growth-workspace-shell-nav-v9")
const homeNav = GROWTH_SHELL_NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === "dashboard")
assert.equal(homeNav?.label, "Home")
const advancedGroup = GROWTH_SHELL_NAV_GROUPS.find((g) => g.id === "advanced")
assert.equal(advancedGroup?.label, "Advanced")
assert.ok(advancedGroup?.items.some((i) => i.id === "ai-operations" && i.label === "AI Operations"))
console.log("  ✓ sidebar nav: Home landing + AI Operations under Advanced")

const homeCrumbs = resolveGrowthBreadcrumbs("/growth")
assert.deepEqual(homeCrumbs.map((c) => c.label), ["AI OS"])
const leadsCrumbs = resolveGrowthBreadcrumbs("/growth/leads")
assert.equal(leadsCrumbs[0]?.label, "AI OS")
assert.equal(leadsCrumbs[1]?.label, "Leads")
console.log("  ✓ breadcrumbs root: AI OS")

const shellSources = collectOperatorChromeSources()
for (const file of shellSources) {
  const source = fs.readFileSync(file, "utf8")
  const relative = path.relative(ROOT, file)
  for (const deprecated of AI_OS_DEPRECATED_OPERATOR_LABELS) {
    assert.equal(
      source.includes(deprecated),
      false,
      `${relative} must not contain deprecated operator label "${deprecated}"`,
    )
  }
}
console.log(`  ✓ ${shellSources.length} operator chrome files free of deprecated labels`)

const growthPage = readSource("app/(growth)/growth/page.tsx")
assert.ok(growthPage.includes("AI_OS_HOME_NAV_LABEL"))
console.log("  ✓ /growth page title is Home (AI OS landing)")

const osPage = readSource("app/(growth)/growth/os/page.tsx")
assert.equal(osPage.includes("Growth Engine"), false)
console.log("  ✓ /growth/os remains AI Operations (advanced diagnostics surface)")

const requiredBrandingFiles = [
  "lib/workspace/ai-os-workspace-branding.ts",
  "components/growth/shell/growth-brand.ts",
  "components/workspace/workspace-switcher.tsx",
  "components/growth/shell/growth-sidebar-nav-content.tsx",
  "lib/growth/navigation/growth-workspace-shell-navigation.ts",
  "lib/growth/navigation/growth-route-registry.ts",
]
for (const file of requiredBrandingFiles) {
  assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
}
console.log(`  ✓ ${requiredBrandingFiles.length} core branding files present`)

assertIncludes("components/growth/shell/growth-sidebar-nav-content.tsx", "AI_OS_SIDEBAR_WORKSPACE_INDICATOR_LABEL", "sidebar footer uses Workspace indicator")
assertIncludes("components/app-sidebar.tsx", "AI_OS_SIDEBAR_WORKSPACE_INDICATOR_LABEL", "core sidebar footer uses Workspace indicator")

console.log(`[GE-AI-UX-1B] PASS — ${GE_AI_UX_1B_QA_MARKER}`)
