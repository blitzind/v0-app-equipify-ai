/**
 * GROWTH-WORKSPACE-OPERATOR-SIMPLIFICATION-1E — Operator UX simplification certification.
 *
 * Run: pnpm test:growth-workspace-operator-simplification-1e
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AUTOMATION_INSPECTOR_TAB_PUBLISH,
  GROWTH_AUTOMATION_FLOW_STATUS_LABELS,
} from "../lib/growth/automation/growth-automation-operator-copy"
import {
  GROWTH_OPERATOR_SIMPLIFICATION_1E_SURFACES,
  GROWTH_OPERATOR_SIMPLIFICATION_FORBIDDEN_AUTOMATION_LABELS,
  GROWTH_OPERATOR_SIMPLIFICATION_FORBIDDEN_INFRA_LABELS,
  GROWTH_OPPORTUNITIES_IMPORT_PROSPECTS_CTA,
  GROWTH_OPPORTUNITIES_PIPELINE_HEALTH_TITLE,
  GROWTH_OPPORTUNITIES_QUALIFY_LEADS_CTA,
  GROWTH_SHARE_PAGES_NO_PROSPECT_MESSAGE,
  GROWTH_VIDEOS_FIRST_RUN_TITLE,
  GROWTH_WORKSPACE_OPERATOR_SIMPLIFICATION_1E_QA_MARKER,
  growthOpportunitiesRecommendsTitle,
} from "../lib/growth/workspace/growth-workspace-operator-simplification-1e"
import { defaultTeammatePresentation } from "../lib/workspace/ai-teammate-voice"
import { growthAvaRecommendedActionsTitle } from "../lib/growth/workspace/growth-workspace-ava-identity"

export { GROWTH_WORKSPACE_OPERATOR_SIMPLIFICATION_1E_QA_MARKER }

const ROOT = process.cwd()

const AUTOMATION_SURFACES = GROWTH_OPERATOR_SIMPLIFICATION_1E_SURFACES.filter((file) =>
  file.includes("/automation/"),
)

const INFRA_SURFACES = [
  "app/(growth)/growth/share-pages/workspace/page.tsx",
  "components/growth/share-pages/growth-share-pages-workspace-prospect-gate.tsx",
  "components/growth/growth-call-workspace.tsx",
  "components/growth/growth-call-workspace-live-transcript-panel.tsx",
  "components/growth/growth-call-workspace-intelligence-rail.tsx",
  "components/growth/growth-call-workspace-center-panel.tsx",
  "lib/growth/native-dialer/call-workspace-coaching-types.ts",
] as const

const SCAN_EXCLUDES = new Set([
  "lib/growth/workspace/growth-workspace-operator-simplification-1e.ts",
])

function read(relativePath: string): string {
  const abs = path.join(ROOT, relativePath)
  assert.ok(fs.existsSync(abs), `${relativePath} must exist for operator simplification certification`)
  return fs.readFileSync(abs, "utf8")
}

function stripImportsAndComments(source: string): string {
  return source
    .replace(/^import .+$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
}

function main(): void {
  console.log(
    `\n=== GROWTH-WORKSPACE-OPERATOR-SIMPLIFICATION-1E (${GROWTH_WORKSPACE_OPERATOR_SIMPLIFICATION_1E_QA_MARKER}) ===\n`,
  )

  assert.equal(GROWTH_WORKSPACE_OPERATOR_SIMPLIFICATION_1E_QA_MARKER, "growth-workspace-operator-simplification-1e-v1")
  assert.equal(GROWTH_AUTOMATION_INSPECTOR_TAB_PUBLISH, "Publish")
  assert.equal(GROWTH_VIDEOS_FIRST_RUN_TITLE, "Record your first video")
  assert.equal(GROWTH_AUTOMATION_FLOW_STATUS_LABELS.runtime_active, "Active")
  console.log("  ✓ Simplification marker and automation operator labels")

  for (const file of AUTOMATION_SURFACES) {
    if (SCAN_EXCLUDES.has(file)) continue
    const visible = stripImportsAndComments(read(file))
    for (const pattern of GROWTH_OPERATOR_SIMPLIFICATION_FORBIDDEN_AUTOMATION_LABELS) {
      assert.doesNotMatch(visible, pattern, `${file} must not expose engineering automation jargon (${pattern})`)
    }
  }
  console.log("  ✓ Automation surfaces free of engineering terminology")

  for (const file of INFRA_SURFACES) {
    const visible = stripImportsAndComments(read(file))
    for (const pattern of GROWTH_OPERATOR_SIMPLIFICATION_FORBIDDEN_INFRA_LABELS) {
      assert.doesNotMatch(visible, pattern, `${file} must not expose infrastructure/route jargon (${pattern})`)
    }
  }
  console.log("  ✓ Calls and Share Pages surfaces free of infrastructure wording")

  const videoFirstRun = read("components/growth/videos/growth-video-library-first-run.tsx")
  assert.match(videoFirstRun, /GROWTH_VIDEOS_FIRST_RUN_TITLE/)
  assert.match(videoFirstRun, /GROWTH_VIDEOS_FIRST_RUN_RECORD_CTA/)
  assert.match(read("components/growth/videos/growth-video-library-panel.tsx"), /GrowthVideoLibraryFirstRun/)

  const shareGate = read("components/growth/share-pages/growth-share-pages-workspace-prospect-gate.tsx")
  assert.match(shareGate, /GROWTH_SHARE_PAGES_NO_PROSPECT_MESSAGE/)
  assert.match(shareGate, /GrowthSharePageRecipientPicker/)
  assert.match(read("app/(growth)/growth/share-pages/workspace/page.tsx"), /GrowthSharePagesWorkspaceProspectGate/)
  console.log("  ✓ Share Pages workspace ships guided prospect selection")
  console.log("  ✓ Videos library ships guided first-run experience")

  const pipeline = read("components/growth/growth-opportunity-pipeline-dashboard.tsx")
  assert.match(pipeline, /GROWTH_OPPORTUNITIES_PIPELINE_HEALTH_TITLE/)
  assert.match(pipeline, /growthOpportunitiesRecommendsTitle/)
  assert.match(pipeline, /GROWTH_OPPORTUNITIES_IMPORT_PROSPECTS_CTA/)
  assert.match(pipeline, /GROWTH_OPPORTUNITIES_QUALIFY_LEADS_CTA/)
  assert.equal(GROWTH_OPPORTUNITIES_PIPELINE_HEALTH_TITLE, "Pipeline health")
  assert.equal(growthOpportunitiesRecommendsTitle(defaultTeammatePresentation()), "Ava recommends")
  console.log("  ✓ Opportunities pipeline leads with actionable workflow")

  const opportunities = read("components/growth/growth-opportunity-pipeline-dashboard.tsx")
  assert.doesNotMatch(stripImportsAndComments(opportunities), /Execution Readiness/)

  const avaIdentity = read("lib/growth/workspace/growth-workspace-ava-identity.ts")
  assert.match(avaIdentity, /growthAvaRecommendedActionsTitle/)
  assert.equal(growthAvaRecommendedActionsTitle(defaultTeammatePresentation()), "Ava recommends")
  console.log("  ✓ Ava terminology preserved")

  assert.ok(!fs.existsSync(path.join(ROOT, ".env.local")), ".env.local must not be present")
  console.log("  ✓ No .env.local in workspace")

  console.log("\n  Running GROWTH-WORKSPACE-AVA-IDENTITY-1D regression…\n")
  execSync("pnpm test:growth-workspace-ava-identity-1d", { cwd: ROOT, stdio: "inherit" })

  console.log("\nGROWTH-WORKSPACE-OPERATOR-SIMPLIFICATION-1E verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_OPERATOR_SIMPLIFICATION_1E_QA_MARKER,
        surfaces: GROWTH_OPERATOR_SIMPLIFICATION_1E_SURFACES.length,
        automation_surfaces: AUTOMATION_SURFACES.length,
      },
      null,
      2,
    ),
  )
}

main()
