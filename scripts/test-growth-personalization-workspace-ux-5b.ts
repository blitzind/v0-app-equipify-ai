/**
 * GS-AI-PLAYBOOK-5B — Personalization workspace UX certification.
 * Run: pnpm test:growth-personalization-workspace-ux-5b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_PERSONALIZATION_WORKSPACE_UX_QA_MARKER } from "../lib/growth/activity/growth-activity-workspace-constants"
import { formatPersonalizationDraftBodyParagraphsForDisplay } from "../lib/growth/personalization/growth-personalization-draft-formatting"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-AI-PLAYBOOK-5B Personalization Workspace UX Certification ===\n")
  assert.ok(GROWTH_PERSONALIZATION_WORKSPACE_UX_QA_MARKER)

  const pageClient = readSource("components/growth/personalization/growth-personalization-page-client.tsx")
  assert.match(pageClient, /GrowthPersonalizationWorkspace/)
  assert.doesNotMatch(pageClient, /GrowthAiPersonalizationDashboardView/)
  assert.doesNotMatch(pageClient, /growth-ai-personalization-dashboard/)
  console.log("  ✓ personalization page wired to workspace component")

  const draftEditor = readSource("components/growth/personalization/growth-personalization-draft-editor.tsx")
  assert.match(draftEditor, /GrowthPersonalizationDraftBodyPreview/)
  assert.match(draftEditor, /AI Draft Preview/)
  assert.match(draftEditor, /Editable Subject/)
  assert.match(draftEditor, /My Edits/)
  console.log("  ✓ draft preview + editable subject/body")

  const nicoleBody =
    "Hi Nicole, many biomedical equipment service organizations often find that PM due dates for patient-connected devices are tracked in spreadsheets that are disconnected from work orders. We noticed that you are the President and Founder of Sterling Biomedical. Equipify helps teams centralize regulated PM scheduling through Maintenance Plans + Equipment. Is service visibility a bottleneck for you right now?"
  assert.equal(formatPersonalizationDraftBodyParagraphsForDisplay(nicoleBody).length, 4)
  console.log("  ✓ outreach body formats into readable paragraphs")

  const diagnostics = readSource("components/growth/personalization/growth-personalization-diagnostics-panel.tsx")
  assert.match(diagnostics, /title="Intelligence"/)
  assert.match(diagnostics, /title="Reasoning"/)
  assert.match(diagnostics, /title="Sequence"/)
  assert.match(diagnostics, /title="Quality"/)
  assert.match(diagnostics, /max-h-\[min\(240px,32vh\)\]/)
  assert.match(diagnostics, /summary=/)
  console.log("  ✓ diagnostics collapsible cards with independent scroll")

  const summary = readSource("components/growth/personalization/growth-personalization-version-history-summary.tsx")
  assert.match(summary, /Version History/)
  assert.match(summary, /View History/)

  const drawer = readSource("components/growth/personalization/growth-personalization-version-history-drawer.tsx")
  assert.match(drawer, /Search versions/)
  assert.match(drawer, /Compare/)
  assert.match(drawer, /Use This Version/)
  console.log("  ✓ compact version summary + drawer history")

  const workspace = readSource("components/growth/personalization/growth-personalization-workspace.tsx")
  assert.match(workspace, /GrowthPersonalizationVersionHistorySummary/)
  assert.match(workspace, /GrowthPersonalizationVersionHistoryDrawer/)
  assert.match(workspace, /GrowthPersonalizationDraftEditor/)
  assert.match(workspace, /GrowthPersonalizationDiagnosticsPanel/)
  assert.doesNotMatch(workspace, /GrowthPersonalizationGenerationsPanel/)
  assert.match(workspace, /initialGenerationId/)
  console.log("  ✓ workspace draft-first layout + drawer version history")

  console.log("\nPersonalization workspace UX 5B certification passed.\n")
}

main()
