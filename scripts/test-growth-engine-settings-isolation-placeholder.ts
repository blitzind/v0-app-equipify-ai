/**
 * PROD-HOTFIX — certifies Growth Engine settings isolation placeholder build.
 * Run: pnpm test:growth-engine-settings-isolation-placeholder
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_ENGINE_SETTINGS_ISOLATION_PLACEHOLDER_ACTIVE,
  GROWTH_ENGINE_SETTINGS_ISOLATION_PLACEHOLDER_QA_MARKER,
} from "../lib/settings/workspace-settings-growth-engine-isolation-placeholder"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(
    GROWTH_ENGINE_SETTINGS_ISOLATION_PLACEHOLDER_QA_MARKER,
    "growth-engine-settings-isolation-placeholder-v1",
  )
  assert.equal(GROWTH_ENGINE_SETTINGS_ISOLATION_PLACEHOLDER_ACTIVE, true)

  const isolation = readSource("lib/settings/workspace-settings-growth-engine-isolation-placeholder.tsx")
  const sectionPage = readSource("components/settings/workspace-settings-growth-engine-section-page.tsx")

  assert.match(isolation, /data-growth-engine-settings-safe-placeholder/)
  assert.match(isolation, /growth-engine-settings-isolation-placeholder-v1/)

  assert.match(sectionPage, /GROWTH_ENGINE_SETTINGS_ISOLATION_PLACEHOLDER_ACTIVE/)
  assert.match(sectionPage, /WorkspaceSettingsGrowthEngineIsolationPlaceholder/)
  assert.match(sectionPage, /GROWTH_ENGINE_SETTINGS_ISOLATION_PLACEHOLDER_ACTIVE\)/)

  console.log("growth-engine-settings-isolation-placeholder: ok")
}

main()
