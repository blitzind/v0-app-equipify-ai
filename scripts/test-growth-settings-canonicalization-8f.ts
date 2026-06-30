/**
 * GS-GROWTH-SETTINGS-8F — Settings canonicalization & reuse certification.
 * Run: pnpm test:growth-settings-canonicalization-8f
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_CORE_SETTINGS_BILLING_PATH,
  GROWTH_CORE_SETTINGS_TEAM_PATH,
  GROWTH_WORKSPACE_SETTINGS_WORKSPACE_PATH,
} from "../lib/growth/navigation/growth-workspace-core-settings-links"
import {
  GROWTH_ENGINE_CUSTOMER_SETTINGS_BASE,
  GROWTH_WORKSPACE_SETTINGS_CANONICAL_QA_MARKER,
  growthEngineCustomerSettingsHref,
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
  assert.equal(GROWTH_WORKSPACE_SETTINGS_CANONICAL_QA_MARKER, "growth-workspace-settings-canonical-8k-v1")
  assert.equal(GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER, "growth-workspace-settings-nav-ux-polish-1a-v1")

  const workspaceGroup = GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((group) => group.id === "workspace")
  assert.equal(workspaceGroup, undefined, "duplicate workspace group removed from Growth settings nav")

  const complianceGroup = GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((group) => group.id === "compliance")
  assert.ok(complianceGroup?.items.some((item) => item.id === "compliance"))

  const advancedGroup = GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((group) => group.id === "advanced")
  assert.equal(advancedGroup, undefined, "Advanced group removed from Growth settings nav")

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
  assert.match(sectionPage, /getWorkspaceSettingsGrowthEngineLiftedPanel/)
  assert.match(sectionPage, /liftKind === "lifted"/)

  assert.equal(
    growthEngineCustomerSettingsHref("connected-mailboxes"),
    "/settings/growth-engine/connected-mailboxes",
  )
  assert.equal(resolveGrowthEngineSectionLiftKind("connected-mailboxes"), "lifted")

  const customerSettingsExpectations: Array<[string, string]> = [
    ["connected-mailboxes", growthEngineCustomerSettingsHref("connected-mailboxes")],
    ["sending-domains", growthEngineCustomerSettingsHref("sending-domains")],
    ["dns-verification", growthEngineCustomerSettingsHref("dns-verification")],
    ["mailbox-health", growthEngineCustomerSettingsHref("mailbox-health")],
    ["warmup", growthEngineCustomerSettingsHref("warmup")],
    ["sender-pools", growthEngineCustomerSettingsHref("sender-pools")],
    ["sending-limits", growthEngineCustomerSettingsHref("sending-limits")],
    ["notification-preferences", growthEngineCustomerSettingsHref("notification-preferences")],
    ["copilot-preferences", growthEngineCustomerSettingsHref("copilot-preferences")],
    ["unsubscribe-settings", growthEngineCustomerSettingsHref("unsubscribe-settings")],
    ["suppression-lists", growthEngineCustomerSettingsHref("suppression-lists")],
    ["compliance-rules", growthEngineCustomerSettingsHref("compliance-rules")],
    ["meeting-preferences", growthEngineCustomerSettingsHref("meeting-preferences")],
    ["gmail", growthEngineCustomerSettingsHref("gmail")],
    ["microsoft-365", growthEngineCustomerSettingsHref("microsoft-365")],
  ]
  for (const [sectionId, expectedHref] of customerSettingsExpectations) {
    assert.equal(growthEngineCustomerSettingsHref(sectionId), expectedHref, sectionId)
    assert.equal(resolveGrowthEngineSectionLiftKind(sectionId), "lifted", sectionId)
  }
  assert.equal(GROWTH_ENGINE_CUSTOMER_SETTINGS_BASE, "/settings/growth-engine")

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
  assert.match(workspaceNav, /growthEngineHref\("connected-mailboxes"\)/)
  assert.match(workspaceNav, /growthEngineHref\("unsubscribe-settings"\)/)
  assert.match(workspaceNav, /GROWTH_CANONICAL_NOTIFICATIONS_PATH/)

  const connectedDashboard = readSource("components/growth/mailboxes/growth-connected-mailboxes-dashboard.tsx")
  assert.doesNotMatch(connectedDashboard, /\/settings\/growth-engine\//)
  assert.match(connectedDashboard, /\/settings\/growth-engine/)

  assert.equal(GROWTH_WORKSPACE_SETTINGS_WORKSPACE_PATH, "/growth/settings/workspace")
  assert.equal(GROWTH_CORE_SETTINGS_TEAM_PATH, "/settings/team")

  console.log("growth-settings-canonicalization-8f: ok")
}

main()
