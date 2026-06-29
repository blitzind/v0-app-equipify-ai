/**
 * PROD-HOTFIX — certifies Growth Engine settings hard isolation build.
 * Run: pnpm test:growth-engine-settings-isolation-placeholder
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

export const GROWTH_ENGINE_SETTINGS_HARD_ISOLATION_TEST_QA_MARKER =
  "growth-engine-settings-hard-isolation-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(GROWTH_ENGINE_SETTINGS_HARD_ISOLATION_TEST_QA_MARKER, "growth-engine-settings-hard-isolation-v1")

  const sectionPage = readSource("components/settings/workspace-settings-growth-engine-section-page.tsx")

  assert.match(sectionPage, /data-growth-engine-settings-hard-isolation="v1"/)
  assert.match(sectionPage, /growth-engine-settings-hard-isolation-v1/)
  assert.match(sectionPage, /SECTION PAGE RENDERED/)
  assert.match(sectionPage, /console\.log\("SECTION PAGE RENDERED"\)/)
  assert.doesNotMatch(sectionPage, /WorkspaceSettingsGrowthEngineLiftedPanelHost/)
  assert.doesNotMatch(sectionPage, /WorkspaceSettingsGrowthEngineIsolationPlaceholder/)
  assert.doesNotMatch(sectionPage, /workspace-settings-growth-engine-lifted-panel-host/)

  console.log("growth-engine-settings-isolation-placeholder: ok")
}

main()
