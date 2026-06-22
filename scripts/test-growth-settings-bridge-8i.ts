/**
 * GS-GROWTH-SETTINGS-HOTFIX-8I — Core settings bridge pages (no cross-shell redirects).
 * Run: pnpm test:growth-settings-bridge-8i
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_COMMUNICATIONS_DELIVERABILITY_PATH,
  GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
  GROWTH_COMMUNICATIONS_REPUTATION_PATH,
  GROWTH_COMMUNICATIONS_SENDER_POOLS_PATH,
  GROWTH_COMMUNICATIONS_SENDING_DOMAINS_PATH,
  GROWTH_COMMUNICATIONS_WARMUP_PATH,
} from "../lib/growth/navigation/growth-communications-settings-navigation"
import { GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH } from "../lib/growth/navigation/growth-workspace-core-settings-links"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import {
  GROWTH_ENGINE_SETTINGS_BRIDGE_SECTION_IDS,
  GROWTH_WORKSPACE_SETTINGS_CANONICAL_QA_MARKER,
  isGrowthEngineSettingsBridgeSection,
  resolveGrowthEngineSettingsBridgeHref,
} from "../lib/growth/navigation/growth-workspace-settings-canonical"
import { resolveGrowthEngineSectionLiftKind } from "../lib/settings/workspace-settings-growth-engine-lift"

export const GROWTH_SETTINGS_BRIDGE_8I_QA_MARKER = "growth-settings-bridge-8i-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(GROWTH_SETTINGS_BRIDGE_8I_QA_MARKER, "growth-settings-bridge-8i-v1")
  assert.equal(GROWTH_WORKSPACE_SETTINGS_CANONICAL_QA_MARKER, "growth-workspace-settings-canonical-8i-v1")

  const growthEnginePage = readSource("app/(dashboard)/settings/growth-engine/[sectionId]/page.tsx")
  assert.doesNotMatch(growthEnginePage, /redirect\(/)
  assert.match(growthEnginePage, /WorkspaceSettingsGrowthEngineSectionPage/)

  const sectionPage = readSource("components/settings/workspace-settings-growth-engine-section-page.tsx")
  assert.match(sectionPage, /liftKind === "bridged"/)
  assert.match(sectionPage, /WorkspaceSettingsGrowthEngineBridgePanel/)
  assert.doesNotMatch(sectionPage, /WorkspaceSettingsCanonicalRoutePanel/)

  const bridgePanel = readSource("components/settings/workspace-settings-growth-engine-bridge-panel.tsx")
  assert.match(bridgePanel, /workspace-settings-growth-engine-bridge-8i-v1/)
  assert.match(bridgePanel, /Open Growth Settings/)
  assert.match(bridgePanel, /existingConfigLabel/)

  const growthSettingsNotificationsPath = `${GROWTH_WORKSPACE_BASE_PATH}/settings/notifications`
  const growthSettingsAiPreferencesPath = `${GROWTH_WORKSPACE_BASE_PATH}/settings/ai-preferences`

  const bridgeExpectations: Array<[string, string]> = [
    ["connected-mailboxes", GROWTH_COMMUNICATIONS_MAILBOXES_PATH],
    ["sending-domains", GROWTH_COMMUNICATIONS_SENDING_DOMAINS_PATH],
    ["dns-verification", GROWTH_COMMUNICATIONS_DELIVERABILITY_PATH],
    ["mailbox-health", GROWTH_COMMUNICATIONS_DELIVERABILITY_PATH],
    ["warmup", GROWTH_COMMUNICATIONS_WARMUP_PATH],
    ["sender-pools", GROWTH_COMMUNICATIONS_SENDER_POOLS_PATH],
    ["sending-limits", GROWTH_COMMUNICATIONS_REPUTATION_PATH],
    ["notification-preferences", growthSettingsNotificationsPath],
    ["copilot-preferences", growthSettingsAiPreferencesPath],
    ["unsubscribe-settings", GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH],
    ["suppression-lists", GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH],
    ["compliance-rules", GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH],
    ["gmail", GROWTH_COMMUNICATIONS_MAILBOXES_PATH],
    ["microsoft-365", GROWTH_COMMUNICATIONS_MAILBOXES_PATH],
  ]

  for (const [sectionId, expectedHref] of bridgeExpectations) {
    assert.ok(isGrowthEngineSettingsBridgeSection(sectionId), sectionId)
    assert.equal(resolveGrowthEngineSettingsBridgeHref(sectionId), expectedHref, sectionId)
    assert.equal(resolveGrowthEngineSectionLiftKind(sectionId), "bridged", sectionId)
  }

  assert.equal(GROWTH_ENGINE_SETTINGS_BRIDGE_SECTION_IDS.length, 15)

  assert.equal(resolveGrowthEngineSectionLiftKind("inbox-routing"), "lifted")
  assert.equal(resolveGrowthEngineSectionLiftKind("booking-pages"), "lifted")
  assert.equal(resolveGrowthEngineSectionLiftKind("share-page-branding"), "lifted")

  const deliveryRedirect = readSource("app/(growth)/growth/settings/delivery/page.tsx")
  assert.match(deliveryRedirect, /redirect/)
  assert.match(deliveryRedirect, /GROWTH_COMMUNICATIONS_MAILBOXES_PATH/)

  const connectedRedirect = readSource("app/(growth)/growth/settings/connected-mailboxes/page.tsx")
  assert.match(connectedRedirect, /redirect/)

  const workspaceNav = readSource("lib/settings/workspace-settings-navigation.ts")
  assert.match(workspaceNav, /existingConfigHref: GROWTH_COMMUNICATIONS_MAILBOXES_PATH/)

  console.log("growth-settings-bridge-8i: ok")
}

main()
