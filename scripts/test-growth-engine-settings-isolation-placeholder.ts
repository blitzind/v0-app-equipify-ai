/**
 * PROD-HOTFIX — certifies Growth Engine settings hard isolation + connected-mailboxes restore.
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
  const connectedSection = readSource(
    "components/settings/workspace-settings-growth-engine-connected-mailboxes-section.tsx",
  )
  const serverPage = readSource("app/(dashboard)/settings/growth-engine/[sectionId]/page.tsx")

  assert.match(sectionPage, /data-growth-engine-settings-hard-isolation="v1"/)
  assert.match(sectionPage, /growth-engine-settings-hard-isolation-v1/)
  assert.match(sectionPage, /SECTION PAGE RENDERED/)
  assert.match(sectionPage, /WORKSPACE_SETTINGS_GROWTH_ENGINE_CONNECTED_MAILBOXES_SECTION_ID/)
  assert.match(sectionPage, /WorkspaceSettingsGrowthEngineConnectedMailboxesSection/)
  assert.match(serverPage, /sectionId=\{sectionId\}/)

  assert.match(connectedSection, /GrowthConnectedMailboxesDashboard/)
  assert.match(connectedSection, /\[connected-mailboxes-mount\]/)
  assert.match(connectedSection, /\[connected-mailboxes-render\]/)
  assert.match(connectedSection, /\[connected-mailboxes-runtime\]/)
  assert.match(connectedSection, /Suspense/)
  assert.doesNotMatch(connectedSection, /WorkspaceSettingsGrowthEngineLiftedPanelHost/)
  assert.doesNotMatch(connectedSection, /getWorkspaceSettingsGrowthEngineLiftedPanel/)
  assert.doesNotMatch(connectedSection, /loadLiftedPanel/)

  assert.doesNotMatch(sectionPage, /WorkspaceSettingsGrowthEngineLiftedPanelHost/)
  assert.doesNotMatch(sectionPage, /WorkspaceSettingsGrowthEngineIsolationPlaceholder/)
  assert.doesNotMatch(sectionPage, /workspace-settings-growth-engine-lifted-panel-host/)

  console.log("growth-engine-settings-isolation-placeholder: ok")
}

main()
