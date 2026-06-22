/**
 * GS-GROWTH-SETTINGS-8F — Settings canonicalization & reuse certification.
 * Run: pnpm test:growth-settings-canonicalization-8f
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
import {
  GROWTH_CORE_SETTINGS_BILLING_PATH,
  GROWTH_CORE_SETTINGS_TEAM_PATH,
  GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH,
  GROWTH_WORKSPACE_SETTINGS_WORKSPACE_PATH,
} from "../lib/growth/navigation/growth-workspace-core-settings-links"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import {
  GROWTH_ENGINE_SECTION_BRIDGE_HREFS,
  GROWTH_WORKSPACE_SETTINGS_CANONICAL_QA_MARKER,
  resolveGrowthEngineSettingsBridgeHref,
} from "../lib/growth/navigation/growth-workspace-settings-canonical"
import {
  GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER,
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"
import { resolveGrowthEngineSectionLiftKind } from "../lib/settings/workspace-settings-growth-engine-lift"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(GROWTH_WORKSPACE_SETTINGS_CANONICAL_QA_MARKER, "growth-workspace-settings-canonical-8j-v1")
  assert.equal(GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER, "growth-workspace-settings-nav-8f-v1")

  const workspaceGroup = GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((group) => group.id === "workspace")
  assert.ok(workspaceGroup)
  assert.ok(workspaceGroup!.items.some((item) => item.id === "team"))
  assert.ok(workspaceGroup!.items.some((item) => item.id === "billing"))

  const complianceGroup = GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((group) => group.id === "compliance")
  assert.ok(complianceGroup?.items.some((item) => item.id === "compliance"))

  const advancedGroup = GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((group) => group.id === "advanced")
  assert.ok(advancedGroup?.items.some((item) => item.id === "advanced"))

  const workspaceRoutes = [
    "app/(growth)/growth/settings/workspace/page.tsx",
    "app/(growth)/growth/settings/workspace/team/page.tsx",
    "app/(growth)/growth/settings/workspace/organization/page.tsx",
    "app/(growth)/growth/settings/workspace/billing/page.tsx",
    "app/(growth)/growth/settings/workspace/integrations/page.tsx",
    "app/(growth)/growth/settings/compliance/page.tsx",
    "app/(growth)/growth/settings/advanced/page.tsx",
  ]
  for (const route of workspaceRoutes) {
    assert.ok(fs.existsSync(route), `missing route ${route}`)
  }

  const teamPage = readSource("app/(growth)/growth/settings/workspace/team/page.tsx")
  assert.match(teamPage, /GROWTH_CORE_SETTINGS_TEAM_PATH/)
  assert.match(teamPage, /GrowthSettingsCoreLinkPage/)
  assert.doesNotMatch(teamPage, /createBrowserSupabaseClient|loadStripe/)

  const billingPage = readSource("app/(growth)/growth/settings/workspace/billing/page.tsx")
  assert.match(billingPage, /GROWTH_CORE_SETTINGS_BILLING_PATH/)

  const growthEnginePage = readSource("app/(dashboard)/settings/growth-engine/[sectionId]/page.tsx")
  assert.doesNotMatch(growthEnginePage, /redirect\(/)
  assert.match(growthEnginePage, /WorkspaceSettingsGrowthEngineSectionPage/)

  const sectionPage = readSource("components/settings/workspace-settings-growth-engine-section-page.tsx")
  assert.match(sectionPage, /WorkspaceSettingsGrowthEngineBridgePanel/)
  assert.match(sectionPage, /liftKind === "bridged"/)

  assert.equal(
    resolveGrowthEngineSettingsBridgeHref("connected-mailboxes"),
    GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
  )
  assert.ok(GROWTH_ENGINE_SECTION_BRIDGE_HREFS["connected-mailboxes"])
  assert.equal(resolveGrowthEngineSectionLiftKind("connected-mailboxes"), "bridged")

  const growthSettingsNotificationsPath = `${GROWTH_WORKSPACE_BASE_PATH}/settings/notifications`
  const growthSettingsAiPreferencesPath = `${GROWTH_WORKSPACE_BASE_PATH}/settings/ai-preferences`
  const growthSettingsCalendarPreferencesPath = `${GROWTH_WORKSPACE_BASE_PATH}/settings/calendar-preferences`

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
    ["meeting-preferences", growthSettingsCalendarPreferencesPath],
    ["gmail", GROWTH_COMMUNICATIONS_MAILBOXES_PATH],
    ["microsoft-365", GROWTH_COMMUNICATIONS_MAILBOXES_PATH],
  ]
  for (const [sectionId, expectedHref] of bridgeExpectations) {
    assert.equal(resolveGrowthEngineSettingsBridgeHref(sectionId), expectedHref, sectionId)
    assert.equal(resolveGrowthEngineSectionLiftKind(sectionId), "bridged", sectionId)
  }

  const aiPage = readSource("app/(growth)/growth/settings/ai-preferences/page.tsx")
  assert.match(aiPage, /GrowthAiCopilotSettingsPanel/)

  const compliancePage = readSource("app/(growth)/growth/settings/compliance/page.tsx")
  assert.match(compliancePage, /GrowthComplianceDashboardPanel/)

  const notificationsPanel = readSource("components/growth/settings/growth-settings-notifications-panel.tsx")
  assert.match(notificationsPanel, /Growth operator notifications/)
  assert.match(notificationsPanel, /Core workspace notifications/)

  const shell = readSource("components/growth/settings/growth-settings-shell.tsx")
  assert.doesNotMatch(shell, /delivery setup/i)

  const workspaceNav = readSource("lib/settings/workspace-settings-navigation.ts")
  assert.match(workspaceNav, /GROWTH_COMMUNICATIONS_MAILBOXES_PATH/)
  assert.match(workspaceNav, /GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH/)
  assert.match(workspaceNav, /GROWTH_CANONICAL_NOTIFICATIONS_PATH/)

  const connectedDashboard = readSource("components/growth/mailboxes/growth-connected-mailboxes-dashboard.tsx")
  assert.doesNotMatch(connectedDashboard, /\/settings\/growth-engine\//)
  assert.match(connectedDashboard, /GROWTH_COMMUNICATIONS_MAILBOXES_PATH/)

  assert.equal(GROWTH_WORKSPACE_SETTINGS_WORKSPACE_PATH, "/growth/settings/workspace")
  assert.equal(GROWTH_CORE_SETTINGS_TEAM_PATH, "/settings/team")

  console.log("growth-settings-canonicalization-8f: ok")
}

main()
