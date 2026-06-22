/**
 * GS-GROWTH-SETTINGS-HOTFIX-8J — Explicit cross-shell bridge copy and return links.
 * Run: pnpm test:growth-settings-bridge-8j
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_COMMUNICATIONS_DELIVERABILITY_PATH,
  GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
  GROWTH_COMMUNICATIONS_WARMUP_PATH,
} from "../lib/growth/navigation/growth-communications-settings-navigation"
import {
  getGrowthEngineSettingsBridgeSwitchLabel,
  GROWTH_WORKSPACE_SETTINGS_CANONICAL_QA_MARKER,
  resolveWorkspaceSettingsBridgeHrefFromGrowthPath,
} from "../lib/growth/navigation/growth-workspace-settings-canonical"

export const GROWTH_SETTINGS_BRIDGE_8J_QA_MARKER = "growth-settings-bridge-8j-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(GROWTH_SETTINGS_BRIDGE_8J_QA_MARKER, "growth-settings-bridge-8j-v1")
  assert.equal(GROWTH_WORKSPACE_SETTINGS_CANONICAL_QA_MARKER, "growth-workspace-settings-canonical-8j-v1")

  const growthEnginePage = readSource("app/(dashboard)/settings/growth-engine/[sectionId]/page.tsx")
  assert.doesNotMatch(growthEnginePage, /redirect\(/)

  const bridgePanel = readSource("components/settings/workspace-settings-growth-engine-bridge-panel.tsx")
  assert.match(bridgePanel, /workspace-settings-growth-engine-bridge-8j-v1/)
  assert.match(bridgePanel, /getGrowthEngineSettingsBridgeSwitchLabel/)
  assert.match(bridgePanel, /This setting now lives in the Growth Engine workspace/)
  assert.match(bridgePanel, /Equipify Scale workspace settings/)
  const canonical = readSource("lib/growth/navigation/growth-workspace-settings-canonical.ts")
  assert.match(canonical, /Switch to Growth Engine Mailboxes/)
  assert.match(canonical, /getGrowthEngineSettingsBridgeSwitchLabel/)

  assert.equal(getGrowthEngineSettingsBridgeSwitchLabel("connected-mailboxes"), "Switch to Growth Engine Mailboxes")
  assert.equal(getGrowthEngineSettingsBridgeSwitchLabel("warmup"), "Switch to Growth Engine Warmup")
  assert.equal(
    getGrowthEngineSettingsBridgeSwitchLabel("dns-verification"),
    "Switch to Growth Engine Deliverability",
  )

  assert.equal(
    resolveWorkspaceSettingsBridgeHrefFromGrowthPath(GROWTH_COMMUNICATIONS_MAILBOXES_PATH),
    "/settings/growth-engine/connected-mailboxes",
  )
  assert.equal(
    resolveWorkspaceSettingsBridgeHrefFromGrowthPath(`${GROWTH_COMMUNICATIONS_MAILBOXES_PATH}/onboard`),
    "/settings/growth-engine/connected-mailboxes",
  )
  assert.equal(
    resolveWorkspaceSettingsBridgeHrefFromGrowthPath(GROWTH_COMMUNICATIONS_WARMUP_PATH),
    "/settings/growth-engine/warmup",
  )
  assert.equal(resolveWorkspaceSettingsBridgeHrefFromGrowthPath("/growth/settings/communications"), "/settings/growth-engine")

  const communicationsSection = readSource("components/growth/settings/growth-communications-settings-section.tsx")
  assert.match(communicationsSection, /Back to Workspace Settings/)
  assert.match(communicationsSection, /resolveWorkspaceSettingsBridgeHrefFromGrowthPath/)

  const communicationsHub = readSource("components/growth/settings/growth-communications-settings-hub.tsx")
  assert.match(communicationsHub, /Back to Workspace Settings/)

  const mailboxesPage = readSource("app/(growth)/growth/settings/communications/mailboxes/page.tsx")
  assert.match(mailboxesPage, /GrowthCommunicationsSettingsSection/)
  assert.doesNotMatch(mailboxesPage, /redirect\(/)

  console.log("growth-settings-bridge-8j: ok")
}

main()
