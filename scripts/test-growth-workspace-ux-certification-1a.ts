/**
 * GROWTH-WORKSPACE-UX-CERTIFICATION-1A — Full Growth Workspace UX certification.
 *
 * Run: pnpm test:growth-workspace-ux-certification-1a
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SETTINGS_SECTION_GAP,
  GROWTH_SETTINGS_AI_REFINEMENT_2F_QA_MARKER,
  GROWTH_SETTINGS_COMPLIANCE_REFINEMENT_2G_QA_MARKER,
  GROWTH_SETTINGS_COMMUNICATIONS_REFINEMENT_2C_QA_MARKER,
  GROWTH_SETTINGS_GENERAL_REFINEMENT_2B_QA_MARKER,
  GROWTH_SETTINGS_MEETINGS_REFINEMENT_2E_QA_MARKER,
  GROWTH_SETTINGS_VOICE_CALLING_REFINEMENT_2D_QA_MARKER,
} from "../components/growth/growth-settings-ui"
import { GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA } from "../lib/growth/navigation/growth-route-metadata"
import { listGrowthWorkspaceSettingsSectionIds } from "../lib/growth/navigation/growth-workspace-settings-navigation"
import { listGrowthWorkspaceShellNavHrefs } from "../lib/growth/navigation/growth-workspace-shell-navigation"
import {
  GROWTH_WORKSPACE_UX_CERTIFICATION_1A_QA_MARKER,
  GROWTH_WORKSPACE_UX_CERTIFICATION_MODULES,
} from "../lib/growth/workspace/growth-workspace-ux-certification"

export { GROWTH_WORKSPACE_UX_CERTIFICATION_1A_QA_MARKER }

const ROOT = process.cwd()
const GROWTH_PAGES_ROOT = path.join(ROOT, "app/(growth)/growth")

const MODULE_ROUTE_ANCHORS: Record<(typeof GROWTH_WORKSPACE_UX_CERTIFICATION_MODULES)[number], string> = {
  dashboard: "app/(growth)/growth/page.tsx",
  "prospect-search": "app/(growth)/growth/leads/prospect-search/page.tsx",
  leads: "app/(growth)/growth/leads/page.tsx",
  inbox: "app/(growth)/growth/inbox/page.tsx",
  conversations: "app/(growth)/growth/conversations/page.tsx",
  calls: "app/(growth)/growth/calls/page.tsx",
  meetings: "app/(growth)/growth/meetings/page.tsx",
  opportunities: "app/(growth)/growth/opportunities/page.tsx",
  automation: "app/(growth)/growth/automation/page.tsx",
  videos: "app/(growth)/growth/videos/page.tsx",
  "share-pages": "app/(growth)/growth/share-pages/page.tsx",
  relationships: "app/(growth)/growth/relationships/page.tsx",
  settings: "app/(growth)/growth/settings/profile/page.tsx",
}

const OPERATOR_UX_SURFACES = [
  "components/growth/hubs/growth-workspace-hub-page.tsx",
  "components/growth/shell/growth-placeholder-page.tsx",
  "components/growth/settings/growth-settings-compliance-page.tsx",
  "components/growth/settings/growth-compliance-readiness-summary.tsx",
  "components/growth/engagement/growth-engagement-command-center-header.tsx",
  "components/growth/engagement/growth-engagement-dashboard.tsx",
  "components/growth/notifications/growth-notification-center.tsx",
  "app/(growth)/growth/automation/page.tsx",
  "components/growth/videos/growth-video-library-shell.tsx",
  "lib/growth/hubs/growth-videos-hub-manifest.ts",
] as const

const FORBIDDEN_OPERATOR_COPY = [
  /Coming [Ss]oon/,
  /Coming in Phase/i,
  /\bPhase \d/,
  /\bS5-[A-Z]\b/,
  /\bSR-3\b/,
  /later phase/i,
  /foundation shell only/i,
  /scaffolded —/i,
  /AI OS navigation plan/i,
  /\bTODO\b/,
  /not yet implemented/i,
  /policy engine/i,
  /compliance runtime/i,
  /audit pipeline/i,
] as const

const VISIBLE_QA_MARKER_IN_UI = />\s*\{[A-Z0-9_]+QA_[A-Z0-9_]+\}/

const SETTINGS_REFINEMENT_MARKERS = [
  GROWTH_SETTINGS_GENERAL_REFINEMENT_2B_QA_MARKER,
  GROWTH_SETTINGS_COMMUNICATIONS_REFINEMENT_2C_QA_MARKER,
  GROWTH_SETTINGS_VOICE_CALLING_REFINEMENT_2D_QA_MARKER,
  GROWTH_SETTINGS_MEETINGS_REFINEMENT_2E_QA_MARKER,
  GROWTH_SETTINGS_AI_REFINEMENT_2F_QA_MARKER,
  GROWTH_SETTINGS_COMPLIANCE_REFINEMENT_2G_QA_MARKER,
] as const

const SETTINGS_REGRESSION_SCRIPTS = [
  "test:growth-settings-wiring-1a",
  "test:growth-settings-information-architecture-1b",
  "test:growth-settings-ux-polish-1a",
  "test:growth-settings-general-refinement-2b",
  "test:growth-settings-communications-refinement-2c",
  "test:growth-settings-voice-calling-refinement-2d",
  "test:growth-settings-meetings-refinement-2e",
  "test:growth-settings-ai-refinement-2f",
  "test:growth-settings-compliance-refinement-2g",
] as const

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function listGrowthPageFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) results.push(...listGrowthPageFiles(full))
    else if (entry.name === "page.tsx") results.push(full)
  }
  return results
}

function relativeFromRoot(absPath: string): string {
  return path.relative(ROOT, absPath).split(path.sep).join("/")
}

function runSettingsRegression(script: string): void {
  execSync(`pnpm ${script}`, { cwd: ROOT, stdio: "inherit" })
}

function main(): void {
  console.log(
    `\n=== GROWTH-WORKSPACE-UX-CERTIFICATION-1A (${GROWTH_WORKSPACE_UX_CERTIFICATION_1A_QA_MARKER}) ===\n`,
  )

  assert.equal(GROWTH_WORKSPACE_UX_CERTIFICATION_1A_QA_MARKER, "growth-workspace-ux-certification-1a-v1")
  assert.equal(GROWTH_WORKSPACE_UX_CERTIFICATION_MODULES.length, 13)
  console.log("  ✓ Workspace UX certification marker and module scope")

  const pageFiles = listGrowthPageFiles(GROWTH_PAGES_ROOT)
  assert.ok(pageFiles.length >= 100, `Expected 100+ Growth page routes, found ${pageFiles.length}`)
  console.log(`  ✓ ${pageFiles.length} operator-facing Growth routes discovered`)

  for (const pageFile of pageFiles) {
    const rel = relativeFromRoot(pageFile)
    const src = read(rel)
    assert.doesNotMatch(src, /GrowthPlaceholderPage/, `${rel} must not render placeholder page`)
    assert.doesNotMatch(src, /GrowthSettingsSectionPlaceholder/, `${rel} must not render settings placeholder`)
  }
  console.log("  ✓ No placeholder page components in Growth routes")

  for (const [module, anchor] of Object.entries(MODULE_ROUTE_ANCHORS)) {
    assert.ok(fs.existsSync(path.join(ROOT, anchor)), `Missing anchor route for ${module}: ${anchor}`)
  }
  console.log("  ✓ All certification module anchor routes exist")

  const shellHrefs = listGrowthWorkspaceShellNavHrefs()
  assert.equal(shellHrefs.length, new Set(shellHrefs).size, "Duplicate shell nav hrefs")
  console.log("  ✓ Shell navigation has no duplicate hrefs")

  const settingsIds = listGrowthWorkspaceSettingsSectionIds()
  assert.equal(settingsIds.length, new Set(settingsIds).size, "Duplicate settings nav ids")
  console.log("  ✓ Settings navigation has no duplicate entries")

  const migratedWorkspaceRoutes = GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.filter(
    (entry) => !entry.placeholder && !entry.deprecated,
  )
  assert.ok(migratedWorkspaceRoutes.length >= 40)
  console.log(`  ✓ ${migratedWorkspaceRoutes.length} migrated workspace routes in catalog`)

  const compliancePage = read("components/growth/settings/growth-settings-compliance-page.tsx")
  assert.match(compliancePage, /GrowthComplianceReadinessSummary/)
  assert.match(compliancePage, /data-growth-settings-compliance-refinement=\{GROWTH_SETTINGS_COMPLIANCE_REFINEMENT_2G_QA_MARKER\}/)
  console.log("  ✓ Settings compliance refinement remains wired")

  for (const marker of SETTINGS_REFINEMENT_MARKERS) {
    const hits = [
      read("components/growth/growth-settings-ui.tsx"),
      ...fs
        .globSync("components/growth/settings/**/*.tsx", { cwd: ROOT })
        .map((file) => read(file)),
    ].some((src) => src.includes(marker))
    assert.ok(hits, `Settings refinement marker missing from workspace: ${marker}`)
  }
  console.log("  ✓ Growth Settings refinement markers 2B–2G preserved")

  for (const file of OPERATOR_UX_SURFACES) {
    const src = read(file)
    assert.doesNotMatch(src, VISIBLE_QA_MARKER_IN_UI, `${file} must not render QA markers in visible UI`)
    for (const pattern of FORBIDDEN_OPERATOR_COPY) {
      if (file.includes("growth-automation-flow-library") && pattern.source.includes("SR-3")) continue
      if (file.includes("automation/page") && pattern.source.includes("S5")) continue
      assert.doesNotMatch(src, pattern, `${file} must not expose launch-blocking copy (${pattern})`)
    }
  }
  console.log("  ✓ Operator UX surfaces free of placeholder and developer copy")

  const hubPage = read("components/growth/hubs/growth-workspace-hub-page.tsx")
  assert.match(hubPage, /GrowthWorkspacePageHeader/)
  assert.match(hubPage, /Overview metrics populate/)
  console.log("  ✓ Hub pages use standard header and production overview copy")

  const pageHeaderComponent = read("components/growth/shell/growth-workspace-page-header.tsx")
  assert.match(pageHeaderComponent, /GROWTH_SETTINGS_PAGE_HEADER_ICON/)
  console.log("  ✓ Shared page header component available workspace-wide")

  assert.equal(GROWTH_SETTINGS_SECTION_GAP, "space-y-4")
  console.log("  ✓ Shared section spacing token consistent")

  console.log("\n  Running Growth Settings regression suites…\n")
  for (const script of SETTINGS_REGRESSION_SCRIPTS) {
    runSettingsRegression(script)
  }
  console.log("\n  ✓ All Growth Settings certification suites passed")

  console.log("\nGROWTH-WORKSPACE-UX-CERTIFICATION-1A verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_UX_CERTIFICATION_1A_QA_MARKER,
        growth_routes: pageFiles.length,
        modules_certified: GROWTH_WORKSPACE_UX_CERTIFICATION_MODULES.length,
        settings_regression_scripts: SETTINGS_REGRESSION_SCRIPTS.length,
      },
      null,
      2,
    ),
  )
}

main()
