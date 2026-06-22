/**
 * GS-GROWTH-SETTINGS-8C — Communications settings workspace routes certification.
 * Run: pnpm test:growth-communications-settings-8c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
  GROWTH_COMMUNICATIONS_SETTINGS_PATH,
  GROWTH_COMMUNICATIONS_SETTINGS_QA_MARKER,
} from "../lib/growth/navigation/growth-communications-settings-navigation"
import {
  GROWTH_DELIVERY_SETTINGS_PATH,
  GROWTH_DELIVERY_SETTINGS_QA_MARKER,
  GROWTH_WORKSPACE_DNS_VERIFICATION_PATH,
  GROWTH_WORKSPACE_MAILBOXES_PATH,
} from "../lib/growth/navigation/growth-delivery-settings-navigation"
import {
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
  getGrowthWorkspaceSettingsSectionById,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(GROWTH_COMMUNICATIONS_SETTINGS_QA_MARKER, "growth-communications-settings-8k-v1")
  assert.equal(GROWTH_DELIVERY_SETTINGS_QA_MARKER, "growth-delivery-settings-8k-v1")
  assert.equal(GROWTH_DELIVERY_SETTINGS_PATH, GROWTH_COMMUNICATIONS_SETTINGS_PATH)
  assert.equal(GROWTH_WORKSPACE_MAILBOXES_PATH, "/settings/growth-engine/connected-mailboxes")

  const routes = [
    "app/(growth)/growth/settings/communications/page.tsx",
    "app/(growth)/growth/settings/communications/mailboxes/page.tsx",
    "app/(growth)/growth/settings/communications/sending-domains/page.tsx",
    "app/(growth)/growth/settings/communications/deliverability/page.tsx",
    "app/(growth)/growth/settings/communications/warmup/page.tsx",
    "app/(growth)/growth/settings/communications/sender-pools/page.tsx",
    "app/(growth)/growth/settings/communications/reputation/page.tsx",
  ]
  for (const route of routes) {
    assert.ok(fs.existsSync(route), `missing route ${route}`)
  }

  const mailboxesPage = readSource("app/(growth)/growth/settings/communications/mailboxes/page.tsx")
  assert.match(mailboxesPage, /GrowthConnectedMailboxesDashboard/)
  assert.match(mailboxesPage, /GrowthCommunicationsSettingsSection/)

  const connectedDashboard = readSource("components/growth/mailboxes/growth-connected-mailboxes-dashboard.tsx")
  assert.match(connectedDashboard, /validation_message/)
  assert.match(connectedDashboard, /startWarmup/)
  assert.match(connectedDashboard, /resolveConnectedMailboxWarmupDisplay/)

  const warmupPanel = readSource("components/growth/growth-warmup-dashboard.tsx")
  assert.match(warmupPanel, /approved sequence sends/)
  assert.doesNotMatch(warmupPanel, /Schedule planning only/)

  const communicationsSection = getGrowthWorkspaceSettingsSectionById("communications")
  assert.ok(communicationsSection)
  assert.equal(communicationsSection!.href, "/settings/growth-engine/connected-mailboxes")

  const mailboxesNav = getGrowthWorkspaceSettingsSectionById("mailboxes")
  assert.ok(mailboxesNav)
  assert.equal(mailboxesNav!.href, "/settings/growth-engine/connected-mailboxes")

  const communications = GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((group) => group.id === "communications")
  assert.ok(communications?.items.some((item) => item.id === "deliverability"))
  assert.equal(GROWTH_WORKSPACE_DNS_VERIFICATION_PATH, "/settings/growth-engine/dns-verification")

  const deliveryRedirect = readSource("app/(growth)/growth/settings/delivery/page.tsx")
  assert.match(deliveryRedirect, /redirect/)

  console.log("growth-communications-settings-8c: ok")
}

main()
