/**
 * Growth workspace/admin chrome boundary audit (Phase 4F.1 — local only).
 *
 * Usage: pnpm test:growth-workspace-chrome-boundaries
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_CERTIFIED_DASHBOARD_BODY_COMPONENTS,
  GROWTH_CERTIFIED_WORKSPACE_HEADER_BODY_PAGES,
  GROWTH_CHROME_ARCHITECTURE_QA_MARKER,
  GROWTH_PHASE_4_ADMIN_PAGES,
  GROWTH_REMOVED_LEGACY_WORKSPACE_WRAPPERS,
} from "../lib/growth/navigation/growth-chrome-architecture"

export const GROWTH_WORKSPACE_CHROME_BOUNDARIES_QA_MARKER = "growth-workspace-chrome-boundaries-v2" as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(): void {
  console.log(`\n=== Growth workspace chrome boundaries (${GROWTH_WORKSPACE_CHROME_BOUNDARIES_QA_MARKER}) ===\n`)
  console.log(`  architecture qa marker: ${GROWTH_CHROME_ARCHITECTURE_QA_MARKER}`)

  const sectionLayoutSource = readSource("components/growth/growth-section-layout.tsx")
  assert.doesNotMatch(sectionLayoutSource, /usePathname/)
  assert.doesNotMatch(sectionLayoutSource, /isGrowthWorkspaceShellPath/)
  assert.doesNotMatch(sectionLayoutSource, /GROWTH_WORKSPACE_BASE_PATH/)
  assert.match(sectionLayoutSource, /GrowthSectionSidebarNav/)
  console.log("  ✓ GrowthSectionLayout is admin-only chrome with no pathname branching")

  for (const file of GROWTH_CERTIFIED_WORKSPACE_HEADER_BODY_PAGES) {
    const source = readSource(file)
    assert.doesNotMatch(source, /GrowthSectionLayout/, `${file} must not import GrowthSectionLayout`)
    assert.doesNotMatch(source, /GrowthSectionSidebarNav/, `${file} must not import embedded admin nav`)
    assert.match(source, /GrowthWorkspacePageHeader/, `${file} must use workspace page header`)
    assert.match(source, /DashboardBody/, `${file} must compose a dashboard body component`)
  }
  console.log("  ✓ certified workspace pages are header + body only")

  for (const file of GROWTH_PHASE_4_ADMIN_PAGES) {
    const source = readSource(file)
    assert.match(source, /PlatformAdminPageShell/, `${file} must retain Platform Admin shell`)
    assert.match(source, /GrowthSectionLayout/, `${file} must retain admin section layout`)
    assert.match(source, /DashboardBody/, `${file} must compose a dashboard body component`)
  }
  console.log("  ✓ Phase 4 admin fallbacks retain Platform Admin + GrowthSectionLayout")

  for (const file of GROWTH_CERTIFIED_DASHBOARD_BODY_COMPONENTS) {
    const source = readSource(file)
    assert.doesNotMatch(source, /GrowthSectionLayout/, `${file} must be body-only`)
    assert.doesNotMatch(source, /GrowthSectionSidebarNav/, `${file} must not embed admin nav`)
    assert.doesNotMatch(source, /PlatformAdminPageShell/, `${file} must not embed admin shell`)
    assert.doesNotMatch(source, /GrowthWorkspacePageHeader/, `${file} must not embed workspace header`)
  }
  console.log("  ✓ dashboard body components are chrome-free")

  for (const file of GROWTH_REMOVED_LEGACY_WORKSPACE_WRAPPERS) {
    assert.ok(!fs.existsSync(path.join(ROOT, file)), `legacy mixed wrapper still present: ${file}`)
  }
  console.log("  ✓ legacy mixed workspace wrappers removed")

  console.log("\nGrowth workspace chrome boundaries audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_CHROME_BOUNDARIES_QA_MARKER,
        architecture_qa_marker: GROWTH_CHROME_ARCHITECTURE_QA_MARKER,
        workspace_pages_checked: GROWTH_CERTIFIED_WORKSPACE_HEADER_BODY_PAGES.length,
        admin_pages_checked: GROWTH_PHASE_4_ADMIN_PAGES.length,
        dashboard_body_components_checked: GROWTH_CERTIFIED_DASHBOARD_BODY_COMPONENTS.length,
      },
      null,
      2,
    ),
  )
}

runAudit()
