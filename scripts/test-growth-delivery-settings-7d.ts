/**
 * GS-GROWTH-MAIL-7D — Growth workspace delivery settings surface certification.
 * Run: pnpm test:growth-delivery-settings-7d
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_COMMUNICATIONS_SETTINGS_PATH,
} from "../lib/growth/navigation/growth-communications-settings-navigation"
import {
  GROWTH_DELIVERY_SETTINGS_PATH,
  GROWTH_DELIVERY_SETTINGS_QA_MARKER,
} from "../lib/growth/navigation/growth-delivery-settings-navigation"
import {
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
  getGrowthWorkspaceSettingsSectionById,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(GROWTH_DELIVERY_SETTINGS_QA_MARKER, "growth-delivery-settings-8c-v1")
  assert.equal(GROWTH_DELIVERY_SETTINGS_PATH, GROWTH_COMMUNICATIONS_SETTINGS_PATH)

  assert.ok(fs.existsSync("app/(growth)/growth/settings/delivery/page.tsx"))
  const pageSource = readSource("app/(growth)/growth/settings/delivery/page.tsx")
  assert.match(pageSource, /redirect/)

  const panelSource = readSource("components/growth/delivery/growth-delivery-setup-panel.tsx")
  assert.match(panelSource, /GrowthConnectedMailboxesDashboard/)
  assert.match(panelSource, /GrowthProviderSetupDashboard/)
  assert.match(panelSource, /variant="operator"/)

  const communicationsSection = getGrowthWorkspaceSettingsSectionById("communications")
  assert.ok(communicationsSection)
  assert.equal(communicationsSection!.href, GROWTH_COMMUNICATIONS_SETTINGS_PATH)

  const communications = GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((group) => group.id === "communications")
  assert.ok(communications?.items.some((item) => item.id === "mailboxes"))

  const shellSource = readSource("components/growth/settings/growth-settings-shell.tsx")
  assert.match(shellSource, /Communications/)

  console.log("growth-delivery-settings-7d: ok")
}

main()
