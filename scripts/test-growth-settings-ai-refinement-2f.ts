/**
 * GROWTH-SETTINGS-AI-REFINEMENT-2F — AI section UX polish certification.
 *
 * Run: pnpm test:growth-settings-ai-refinement-2f
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SETTINGS_AI_REFINEMENT_2F_QA_MARKER,
  GROWTH_SETTINGS_SECTION_GAP,
} from "../components/growth/growth-settings-ui"
import {
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
  listGrowthWorkspaceSettingsSectionIds,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"

export { GROWTH_SETTINGS_AI_REFINEMENT_2F_QA_MARKER }

const ROOT = process.cwd()

const AI_NAV_IDS = ["ai-teammate", "ai-preferences", "autonomy", "command-center-preferences"] as const

const OPERATOR_AI_FILES = [
  "components/growth/settings/growth-ai-teammate-settings-panel.tsx",
  "components/growth/settings/growth-settings-ai-preferences-page.tsx",
  "components/growth/settings/growth-settings-autonomy-page.tsx",
  "components/growth/settings/growth-settings-command-center-preferences-page.tsx",
  "components/growth/settings/growth-ai-settings-readiness-summary.tsx",
  "components/growth/growth-ai-copilot-settings.tsx",
  "components/growth/autonomy/growth-autonomy-control-center.tsx",
  "components/growth/settings/growth-settings-sidebar-preferences-panel.tsx",
] as const

const FORBIDDEN_OPERATOR_COPY = [
  /Coming soon/i,
  /Coming in Phase/i,
  /\bPhase 7/i,
  /\bTODO\b/,
  /not yet implemented/i,
  /Not available yet/i,
  /\bLLM\b/,
  /\borchestrator\b/i,
  /\bpipeline\b/i,
  /\bruntime\b/i,
  /Provider healthy/i,
  /Provider unavailable/i,
  /Aiden guidance/i,
] as const

const VISIBLE_QA_MARKER_IN_UI = />\s*\{[A-Z0-9_]+QA_[A-Z0-9_]+\}/

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function aiNavGroup() {
  return GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((group) => group.id === "ai")!
}

function main(): void {
  console.log(`\n=== GROWTH-SETTINGS-AI-REFINEMENT-2F (${GROWTH_SETTINGS_AI_REFINEMENT_2F_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_SETTINGS_AI_REFINEMENT_2F_QA_MARKER, "growth-settings-ai-refinement-2f-v1")
  console.log("  ✓ AI refinement QA marker")

  const aiGroup = aiNavGroup()
  assert.deepEqual(
    aiGroup.items.map((item) => item.id),
    [...AI_NAV_IDS],
    "AI nav must remain unchanged",
  )
  console.log("  ✓ AI navigation unchanged")

  const allSectionIds = listGrowthWorkspaceSettingsSectionIds()
  assert.equal(allSectionIds.length, new Set(allSectionIds).size)
  console.log("  ✓ No duplicate navigation entries")

  for (const segment of AI_NAV_IDS.map((id) =>
    id === "command-center-preferences" ? "command-center-preferences" : id,
  )) {
    const pagePath = path.join(ROOT, "app/(growth)/growth/settings", segment, "page.tsx")
    assert.ok(fs.existsSync(pagePath), `Missing AI route: /growth/settings/${segment}`)
    const pageSrc = read(`app/(growth)/growth/settings/${segment}/page.tsx`)
    assert.doesNotMatch(pageSrc, /GrowthSettingsSectionPlaceholder/)
  }
  console.log("  ✓ AI routes render wired pages")

  const aiTeammate = read("components/growth/settings/growth-ai-teammate-settings-panel.tsx")
  assert.match(aiTeammate, /GrowthAiSettingsReadinessSummary scope="teammate"/)
  assert.match(aiTeammate, /title="Personality"/)
  assert.match(aiTeammate, /title="Communication style"/)
  assert.match(aiTeammate, /title="Guidance"/)
  assert.match(aiTeammate, /Currently unavailable/)
  assert.match(
    aiTeammate,
    /data-growth-settings-ai-refinement=\{GROWTH_SETTINGS_AI_REFINEMENT_2F_QA_MARKER\}/,
  )
  console.log("  ✓ AI Teammate grouped with readiness and personality sections")

  const aiPreferencesPage = read("components/growth/settings/growth-settings-ai-preferences-page.tsx")
  assert.match(aiPreferencesPage, /GrowthAiSettingsReadinessSummary scope="preferences"/)
  assert.match(aiPreferencesPage, /GrowthAiCopilotSettingsPanel variant="operator"/)
  console.log("  ✓ AI Preferences page with readiness and operator copilot panel")

  const aiPreferencesRoute = read("app/(growth)/growth/settings/ai-preferences/page.tsx")
  assert.match(aiPreferencesRoute, /GrowthSettingsAiPreferencesPage/)
  console.log("  ✓ AI Preferences route uses page shell")

  const autonomyPage = read("components/growth/settings/growth-settings-autonomy-page.tsx")
  assert.match(autonomyPage, /GrowthAiSettingsReadinessSummary scope="autonomy"/)
  assert.match(autonomyPage, /GrowthAutonomyControlCenter variant="operator"/)
  console.log("  ✓ Growth Autonomy page with readiness and operator control center")

  const autonomyRoute = read("app/(growth)/growth/settings/autonomy/page.tsx")
  assert.match(autonomyRoute, /GrowthSettingsAutonomyPage/)
  console.log("  ✓ Growth Autonomy route uses page shell")

  const commandCenterPage = read("components/growth/settings/growth-settings-command-center-preferences-page.tsx")
  assert.match(commandCenterPage, /GrowthAiSettingsReadinessSummary scope="command-center"/)
  assert.match(commandCenterPage, /variant="command-center" embedded/)
  console.log("  ✓ Command Center Preferences with readiness and embedded panel")

  const readiness = read("components/growth/settings/growth-ai-settings-readiness-summary.tsx")
  assert.match(readiness, /AI ready/)
  assert.match(readiness, /Autonomy/)
  assert.match(readiness, /\/api\/platform\/growth\/copilot\/settings/)
  assert.match(readiness, /\/api\/growth\/workspace\/settings\/autonomy/)
  console.log("  ✓ AI readiness summary uses existing endpoints")

  const copilot = read("components/growth/growth-ai-copilot-settings.tsx")
  assert.match(copilot, /variant\?: "default" \| "operator"/)
  assert.match(copilot, /Response style/)
  assert.match(copilot, /Human approval required/)
  assert.match(copilot, /Guidance rules/)
  assert.match(copilot, /\/api\/platform\/growth\/copilot\/settings/)
  console.log("  ✓ AI copilot operator variant with grouped preferences")

  const autonomyControl = read("components/growth/autonomy/growth-autonomy-control-center.tsx")
  assert.match(autonomyControl, /variant\?: "default" \| "operator"/)
  assert.match(autonomyControl, /HumanApprovalSummaryCard/)
  assert.match(autonomyControl, /Runs automatically/)
  assert.match(autonomyControl, /Needs your approval/)
  assert.match(autonomyControl, /Never automatic/)
  assert.match(autonomyControl, /!isOperator \? <GrowthAutonomyAiOsIntegrationPanel/)
  assert.match(autonomyControl, /\/api\/growth\/workspace\/settings\/autonomy/)
  console.log("  ✓ Autonomy human approval visual and AI OS integration hidden for operators")

  for (const file of OPERATOR_AI_FILES) {
    const src = read(file)
    assert.doesNotMatch(src, VISIBLE_QA_MARKER_IN_UI, `${file} must not render QA markers in visible UI`)
    if (
      file.includes("growth-ai-teammate") ||
      file.includes("growth-settings-ai-preferences") ||
      file.includes("growth-settings-autonomy-page") ||
      file.includes("growth-settings-command-center") ||
      file.includes("growth-ai-settings-readiness") ||
      (file.includes("growth-ai-copilot") && src.includes("isOperator")) ||
      (file.includes("growth-autonomy-control-center") && src.includes("isOperator")) ||
      (file.includes("sidebar-preferences") && src.includes("command-center"))
    ) {
      for (const pattern of FORBIDDEN_OPERATOR_COPY) {
        if (file.includes("growth-autonomy-control-center") && pattern.source.includes("Provider")) continue
        if (file.includes("growth-ai-copilot") && pattern.source.includes("Provider")) continue
        assert.doesNotMatch(src, pattern, `${file} must not expose infrastructure copy (${pattern})`)
      }
    }
  }
  console.log("  ✓ Operator AI surfaces use production copy")

  assert.equal(GROWTH_SETTINGS_SECTION_GAP, "space-y-4")
  console.log("  ✓ Shared section spacing token unchanged")

  console.log("\nGROWTH-SETTINGS-AI-REFINEMENT-2F verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_SETTINGS_AI_REFINEMENT_2F_QA_MARKER,
        ai_nav_items: AI_NAV_IDS.length,
        panels_checked: OPERATOR_AI_FILES.length,
      },
      null,
      2,
    ),
  )
}

main()
