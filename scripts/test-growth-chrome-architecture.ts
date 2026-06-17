/**
 * Growth chrome architecture audit (Phase 4F.2 — local only).
 *
 * Usage: pnpm test:growth-chrome-architecture
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_ADMIN_DUAL_ROUTE_REQUIRED_PATTERNS,
  GROWTH_CERTIFIED_DASHBOARD_BODY_COMPONENTS,
  GROWTH_CERTIFIED_WORKSPACE_HEADER_BODY_PAGES,
  GROWTH_CHROME_ARCHITECTURE_QA_MARKER,
  GROWTH_CHROME_PATHNAME_BRANCH_FORBIDDEN_FILES,
  GROWTH_INBOX_TAB_SHELL_COMPONENT,
  GROWTH_INBOX_TAB_SHELL_PAGES,
  GROWTH_OPPORTUNITIES_TAB_SHELL_COMPONENT,
  GROWTH_OPPORTUNITIES_TAB_SHELL_PAGES,
  GROWTH_DASHBOARD_BODY_FILENAME_PATTERN,
  GROWTH_DASHBOARD_BODY_FORBIDDEN_IMPORTS,
  GROWTH_LEGACY_MIXED_CHROME_COMPONENTS,
  GROWTH_PHASE_4_ADMIN_PAGES,
  GROWTH_PHASE_4_DASHBOARD_BODY_COMPONENTS,
  GROWTH_REMOVED_LEGACY_WORKSPACE_WRAPPERS,
  GROWTH_WORKSPACE_PAGE_FORBIDDEN_IMPORTS,
} from "../lib/growth/navigation/growth-chrome-architecture"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function collectPageFiles(baseDir: string, prefix: string): string[] {
  if (!fs.existsSync(baseDir)) return []
  const results: string[] = []

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === "page.tsx") {
        results.push(path.join(prefix, path.relative(baseDir, full)).split(path.sep).join("/"))
      }
    }
  }

  walk(baseDir)
  return results.sort()
}

function collectDashboardBodyFiles(): string[] {
  const results: string[] = []

  function walk(dir: string, prefix: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full, `${prefix}/${entry.name}`)
      else if (entry.name.endsWith(".tsx") && GROWTH_DASHBOARD_BODY_FILENAME_PATTERN.test(entry.name)) {
        results.push(`${prefix}/${entry.name}`.replace(/^\/+/, ""))
      }
    }
  }

  walk(path.join(ROOT, "components/growth"), "components/growth")
  return results.sort()
}

function assertForbiddenImports(source: string, forbidden: readonly string[], file: string): void {
  for (const token of forbidden) {
    assert.doesNotMatch(source, new RegExp(token), `${file} must not import or reference ${token}`)
  }
}

function assertNoPathnameChromeBranching(source: string, file: string): void {
  assert.doesNotMatch(source, /\busePathname\b/, `${file} must not use pathname for chrome decisions`)
  assert.doesNotMatch(source, /isGrowthWorkspaceShellPath/, `${file} must not branch workspace/admin chrome by path`)
  assert.doesNotMatch(source, /pathname\.startsWith\(\s*[`"']\/growth/, `${file} must not branch on /growth pathname`)
}

function runAudit(): void {
  console.log(`\n=== Growth chrome architecture audit (${GROWTH_CHROME_ARCHITECTURE_QA_MARKER}) ===\n`)

  const workspacePages = collectPageFiles(path.join(ROOT, "app/(growth)/growth"), "app/(growth)/growth")
  assert.ok(workspacePages.length > 0, "expected workspace pages on disk")
  for (const file of workspacePages) {
    const source = readSource(file)
    assertForbiddenImports(source, GROWTH_WORKSPACE_PAGE_FORBIDDEN_IMPORTS, file)
  }
  console.log(`  ✓ all workspace pages (${workspacePages.length}) exclude admin chrome imports`)

  const dashboardBodyFiles = collectDashboardBodyFiles()
  assert.deepEqual(
    dashboardBodyFiles,
    [...GROWTH_CERTIFIED_DASHBOARD_BODY_COMPONENTS].sort(),
    "dashboard body files on disk must match certified set",
  )
  for (const file of dashboardBodyFiles) {
    const source = readSource(file)
    assertForbiddenImports(source, GROWTH_DASHBOARD_BODY_FORBIDDEN_IMPORTS, file)
    assertNoPathnameChromeBranching(source, file)
    assert.match(source, /DashboardBody/, `${file} must export a DashboardBody component`)
  }
  console.log(`  ✓ dashboard body components (${dashboardBodyFiles.length}) are chrome-free`)

  for (const file of GROWTH_CHROME_PATHNAME_BRANCH_FORBIDDEN_FILES) {
    assertNoPathnameChromeBranching(readSource(file), file)
  }
  console.log("  ✓ shared layout components have no pathname-based chrome branching")

  for (const file of GROWTH_CERTIFIED_WORKSPACE_HEADER_BODY_PAGES) {
    const source = readSource(file)
    assert.match(source, /GrowthWorkspacePageHeader/, `${file} must compose GrowthWorkspacePageHeader`)
    assert.match(source, /DashboardBody/, `${file} must compose a DashboardBody component`)
  }
  console.log("  ✓ certified workspace pages follow header + DashboardBody pattern")

  for (const file of GROWTH_OPPORTUNITIES_TAB_SHELL_PAGES) {
    const source = readSource(file)
    assert.doesNotMatch(source, /GrowthWorkspacePageHeader/, `${file} must defer header to GrowthOpportunitiesShell`)
    assert.doesNotMatch(source, /PlatformAdminPageShell/, `${file} must remain workspace-only`)
  }
  const opportunitiesShellSource = readSource(GROWTH_OPPORTUNITIES_TAB_SHELL_COMPONENT)
  assert.match(opportunitiesShellSource, /GROWTH_OPPORTUNITIES_WORKSPACE_TABS/)
  console.log("  ✓ opportunities tab shell pages defer chrome to GrowthOpportunitiesShell")

  for (const file of GROWTH_INBOX_TAB_SHELL_PAGES) {
    const source = readSource(file)
    assert.doesNotMatch(source, /GrowthWorkspacePageHeader/, `${file} must defer header to GrowthInboxShell`)
  }
  const inboxShellSource = readSource(GROWTH_INBOX_TAB_SHELL_COMPONENT)
  assert.match(inboxShellSource, /GROWTH_INBOX_WORKSPACE_TABS/)
  console.log("  ✓ inbox tab shell pages defer chrome to GrowthInboxShell")

  for (const file of GROWTH_PHASE_4_ADMIN_PAGES) {
    const source = readSource(file)
    for (const pattern of GROWTH_ADMIN_DUAL_ROUTE_REQUIRED_PATTERNS) {
      assert.match(source, new RegExp(pattern), `${file} must retain ${pattern}`)
    }
    assert.match(source, /DashboardBody/, `${file} must compose a DashboardBody component`)
  }
  console.log("  ✓ Phase 4 certified admin pages follow PlatformAdmin + GrowthSectionLayout + DashboardBody")

  for (const file of GROWTH_REMOVED_LEGACY_WORKSPACE_WRAPPERS) {
    assert.ok(!fs.existsSync(path.join(ROOT, file)), `legacy mixed wrapper must stay deleted: ${file}`)
  }
  console.log("  ✓ legacy mixed *-workspace wrappers remain deleted")

  for (const file of GROWTH_LEGACY_MIXED_CHROME_COMPONENTS) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `documented legacy mixed component missing: ${file}`)
    const source = readSource(file)
    assert.match(source, /showPageHeader/, `${file} should remain documented legacy mixed chrome via showPageHeader`)
    assert.doesNotMatch(source, /GrowthSectionLayout/, `${file} must not embed GrowthSectionLayout`)
  }
  console.log(`  ✓ ${GROWTH_LEGACY_MIXED_CHROME_COMPONENTS.length} legacy mixed components documented (future refactor)`)

  console.log("\nGrowth chrome architecture audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_CHROME_ARCHITECTURE_QA_MARKER,
        workspace_pages_checked: workspacePages.length,
        dashboard_body_components_checked: dashboardBodyFiles.length,
        phase_4_certified_routes: GROWTH_PHASE_4_DASHBOARD_BODY_COMPONENTS.length,
        certified_dashboard_bodies: GROWTH_CERTIFIED_DASHBOARD_BODY_COMPONENTS.length,
        certified_workspace_pages: GROWTH_CERTIFIED_WORKSPACE_HEADER_BODY_PAGES.length,
        legacy_mixed_components: GROWTH_LEGACY_MIXED_CHROME_COMPONENTS,
        removed_legacy_wrappers: GROWTH_REMOVED_LEGACY_WORKSPACE_WRAPPERS.length,
      },
      null,
      2,
    ),
  )
}

runAudit()
