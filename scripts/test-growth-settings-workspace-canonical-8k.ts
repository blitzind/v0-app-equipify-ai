/**
 * GS-GROWTH-SETTINGS-HOTFIX-8K — Workspace Settings canonical Growth Engine customer routes.
 * Run: pnpm test:growth-settings-workspace-canonical-8k
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_ENGINE_CUSTOMER_SETTINGS_BASE,
  GROWTH_WORKSPACE_SETTINGS_CANONICAL_QA_MARKER,
  growthEngineCustomerSettingsHref,
  isGrowthEngineCustomerSettingsSection,
  isGrowthEngineSettingsBridgeSection,
} from "../lib/growth/navigation/growth-workspace-settings-canonical"
import {
  GROWTH_WORKSPACE_MAILBOXES_PATH,
  GROWTH_WORKSPACE_WARMUP_PATH,
} from "../lib/growth/navigation/growth-delivery-settings-navigation"
import { resolveGrowthEngineSectionLiftKind } from "../lib/settings/workspace-settings-growth-engine-lift"

export const GROWTH_SETTINGS_WORKSPACE_CANONICAL_8K_QA_MARKER = "growth-settings-workspace-canonical-8k-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(GROWTH_SETTINGS_WORKSPACE_CANONICAL_8K_QA_MARKER, "growth-settings-workspace-canonical-8k-v1")
  assert.equal(GROWTH_WORKSPACE_SETTINGS_CANONICAL_QA_MARKER, "growth-workspace-settings-canonical-8k-v1")
  assert.equal(GROWTH_ENGINE_CUSTOMER_SETTINGS_BASE, "/settings/growth-engine")

  const sectionPage = readSource("components/settings/workspace-settings-growth-engine-section-page.tsx")
  assert.match(sectionPage, /liftKind === "lifted"/)
  assert.match(sectionPage, /WorkspaceSettingsGrowthEngineLiftedPanelHost/)
  assert.doesNotMatch(sectionPage, /WorkspaceSettingsGrowthEngineBridgePanel/)
  assert.match(sectionPage, /max-w-none/)

  const liftedPanels = readSource("components/settings/workspace-settings-growth-engine-lifted-panels.tsx")
  assert.match(liftedPanels, /GrowthConnectedMailboxesDashboard/)
  assert.match(liftedPanels, /GrowthSettingsNotificationsPanel/)
  assert.match(liftedPanels, /GrowthComplianceDashboardPanel/)
  assert.match(liftedPanels, /GrowthAiCopilotSettingsPanel/)

  const growthEnginePage = readSource("app/(dashboard)/settings/growth-engine/[sectionId]/page.tsx")
  assert.doesNotMatch(growthEnginePage, /redirect\(/)

  assert.equal(false, isGrowthEngineSettingsBridgeSection("connected-mailboxes"))
  assert.ok(isGrowthEngineCustomerSettingsSection("connected-mailboxes"))
  assert.equal(resolveGrowthEngineSectionLiftKind("connected-mailboxes"), "lifted")
  assert.equal(resolveGrowthEngineSectionLiftKind("warmup"), "lifted")
  assert.equal(resolveGrowthEngineSectionLiftKind("notification-preferences"), "lifted")
  assert.equal(resolveGrowthEngineSectionLiftKind("copilot-preferences"), "lifted")
  assert.equal(resolveGrowthEngineSectionLiftKind("compliance-rules"), "lifted")

  assert.equal(growthEngineCustomerSettingsHref("connected-mailboxes"), "/settings/growth-engine/connected-mailboxes")
  assert.equal(growthEngineCustomerSettingsHref("warmup"), "/settings/growth-engine/warmup")
  assert.equal(GROWTH_WORKSPACE_MAILBOXES_PATH, "/settings/growth-engine/connected-mailboxes")
  assert.equal(GROWTH_WORKSPACE_WARMUP_PATH, "/settings/growth-engine/warmup")

  const mailboxesPage = readSource("app/(growth)/growth/settings/communications/mailboxes/page.tsx")
  assert.match(mailboxesPage, /GrowthCommunicationsSettingsSection/)
  assert.doesNotMatch(mailboxesPage, /redirect\(/)

  const workspaceNav = readSource("lib/settings/workspace-settings-navigation.ts")
  assert.match(workspaceNav, /growthEngineHref\("connected-mailboxes"\)/)
  assert.doesNotMatch(workspaceNav, /GROWTH_COMMUNICATIONS_MAILBOXES_PATH/)

  const connectedDashboard = readSource("components/growth/mailboxes/growth-connected-mailboxes-dashboard.tsx")
  assert.match(connectedDashboard, /\/settings\/growth-engine/)

  console.log("growth-settings-workspace-canonical-8k: ok")
}

main()
