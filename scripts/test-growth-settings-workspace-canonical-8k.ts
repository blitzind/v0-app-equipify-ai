/**
 * Growth workspace settings canonical routes certification.
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

export const GROWTH_SETTINGS_WORKSPACE_CANONICAL_9A_QA_MARKER =
  "growth-settings-workspace-canonical-9a-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(GROWTH_SETTINGS_WORKSPACE_CANONICAL_9A_QA_MARKER, "growth-settings-workspace-canonical-9a-v1")
  assert.equal(GROWTH_WORKSPACE_SETTINGS_CANONICAL_QA_MARKER, "growth-workspace-settings-canonical-9a-v1")
  assert.equal(GROWTH_ENGINE_CUSTOMER_SETTINGS_BASE, "/settings/growth-engine")

  const growthEnginePage = readSource("app/(dashboard)/settings/growth-engine/[sectionId]/page.tsx")
  assert.match(growthEnginePage, /redirect\(/)
  assert.match(growthEnginePage, /growthEngineCustomerSettingsHref/)

  assert.equal(false, isGrowthEngineSettingsBridgeSection("connected-mailboxes"))
  assert.ok(isGrowthEngineCustomerSettingsSection("connected-mailboxes"))
  assert.equal(resolveGrowthEngineSectionLiftKind("connected-mailboxes"), "canonical")
  assert.equal(resolveGrowthEngineSectionLiftKind("warmup"), "canonical")
  assert.equal(resolveGrowthEngineSectionLiftKind("notification-preferences"), "lifted")

  assert.equal(
    growthEngineCustomerSettingsHref("connected-mailboxes"),
    "/growth/settings/communications/connected-mailboxes",
  )
  assert.equal(growthEngineCustomerSettingsHref("warmup"), "/growth/settings/communications/warmup")
  assert.equal(GROWTH_WORKSPACE_MAILBOXES_PATH, "/growth/settings/communications/connected-mailboxes")
  assert.equal(GROWTH_WORKSPACE_WARMUP_PATH, "/growth/settings/communications/warmup")

  const connectedMailboxesPage = readSource(
    "app/(growth)/growth/settings/communications/connected-mailboxes/page.tsx",
  )
  assert.match(connectedMailboxesPage, /GrowthCommunicationsSettingsSection/)
  assert.match(connectedMailboxesPage, /GrowthConnectedMailboxesDashboard/)

  const legacyMailboxesPage = readSource("app/(growth)/growth/settings/communications/mailboxes/page.tsx")
  assert.match(legacyMailboxesPage, /redirect\(/)

  const workspaceNav = readSource("lib/settings/workspace-settings-navigation.ts")
  assert.match(workspaceNav, /growthEngineCustomerSettingsHref/)

  const connectedDashboard = readSource("components/growth/mailboxes/growth-connected-mailboxes-dashboard.tsx")
  assert.match(connectedDashboard, /isGrowthCommunicationsSettingsPath/)

  console.log("growth-settings-workspace-canonical-8k: ok")
}

main()
