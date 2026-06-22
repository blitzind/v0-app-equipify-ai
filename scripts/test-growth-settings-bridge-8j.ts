/**
 * GS-GROWTH-SETTINGS-HOTFIX-8J — Explicit cross-shell bridge copy (superseded by 8K).
 * Run: pnpm test:growth-settings-bridge-8j
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { growthEngineCustomerSettingsHref } from "../lib/growth/navigation/growth-workspace-settings-canonical"
import { resolveGrowthEngineSectionLiftKind } from "../lib/settings/workspace-settings-growth-engine-lift"

export const GROWTH_SETTINGS_BRIDGE_8J_QA_MARKER = "growth-settings-bridge-8j-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(GROWTH_SETTINGS_BRIDGE_8J_QA_MARKER, "growth-settings-bridge-8j-v1")

  const sectionPage = readSource("components/settings/workspace-settings-growth-engine-section-page.tsx")
  assert.doesNotMatch(sectionPage, /WorkspaceSettingsGrowthEngineBridgePanel/)
  assert.equal(resolveGrowthEngineSectionLiftKind("warmup"), "lifted")

  assert.equal(growthEngineCustomerSettingsHref("warmup"), "/settings/growth-engine/warmup")

  console.log("growth-settings-bridge-8j: ok")
}

main()
