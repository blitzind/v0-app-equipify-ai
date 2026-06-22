/**
 * GS-GROWTH-MAIL-7D — Growth workspace delivery settings surface certification.
 * Run: pnpm test:growth-delivery-settings-7d
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
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
  assert.equal(GROWTH_DELIVERY_SETTINGS_QA_MARKER, "growth-delivery-settings-7d-v1")
  assert.equal(GROWTH_DELIVERY_SETTINGS_PATH, "/growth/settings/delivery")

  assert.ok(fs.existsSync("app/(growth)/growth/settings/delivery/page.tsx"))
  const pageSource = readSource("app/(growth)/growth/settings/delivery/page.tsx")
  assert.match(pageSource, /GrowthDeliverySetupPanel/)

  const panelSource = readSource("components/growth/delivery/growth-delivery-setup-panel.tsx")
  assert.match(panelSource, /GrowthConnectedMailboxesDashboard/)
  assert.match(panelSource, /GrowthProviderSetupDashboard/)
  assert.match(panelSource, /variant="operator"/)
  assert.match(panelSource, /Delivery Setup/)

  const deliverySection = getGrowthWorkspaceSettingsSectionById("delivery")
  assert.ok(deliverySection)
  assert.equal(deliverySection!.label, "Delivery Setup")
  assert.equal(deliverySection!.href, GROWTH_DELIVERY_SETTINGS_PATH)

  const communications = GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((group) => group.id === "communications")
  assert.ok(communications?.items.some((item) => item.id === "delivery"))

  const shellSource = readSource("components/growth/settings/growth-settings-shell.tsx")
  assert.match(shellSource, /Delivery Setup/)

  console.log("growth-delivery-settings-7d: ok")
}

main()
