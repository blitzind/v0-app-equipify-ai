/**
 * BlitzPay capability registry smoke tests.
 * Run: pnpm test:blitzpay-capabilities-architecture
 */
import assert from "node:assert/strict"
import {
  getBlitzpayFccPrefetchAllowedSlugSet,
  getBlitzPayUpgradePreviewEligibleSectionIds,
  getVisibleBlitzPaySections,
  resolveBlitzPayFccSectionSurface,
} from "../lib/blitzpay/capabilities"
import {
  getExecutiveOverviewWidgetsForTier,
  resolveExecutiveOverviewWidgetSurface,
} from "../lib/blitzpay/executive-overview-widgets"
import { getVisibleOverviewWidgets } from "../lib/blitzpay/overview-widgets"
import { readBlitzPayTierGateEnforcement } from "../lib/blitzpay/packaging-surface"
import { resolveFccTierSectionRoute } from "../lib/blitzpay/fcc-tier-navigation"
import { BLITZPAY_FCC_NAV_ITEMS } from "../lib/navigation/blitzpay-financial-command-center-nav"

function navSeeds() {
  return BLITZPAY_FCC_NAV_ITEMS.map((i) => ({ slug: i.slug, label: i.label, icon: i.icon }))
}

function testSoloNavIsLean() {
  const enforce = false
  assert.equal(resolveBlitzPayFccSectionSurface("solo", "overview", { enforceTierGates: enforce }), "enabled")
  assert.equal(resolveBlitzPayFccSectionSurface("solo", "ai-financial-copilot", { enforceTierGates: enforce }), "hidden")
  assert.equal(resolveFccTierSectionRoute("solo", "multi-entity-finance", { strictEnforcement: false }), "upgrade_preview")
  const soloNav = getVisibleBlitzPaySections("solo", navSeeds(), { enforceTierGates: enforce, billingReady: true })
  assert.ok(soloNav.every((r) => r.surface === "enabled"))
  assert.ok(soloNav.some((r) => r.slug === "overview"))
  assert.equal(soloNav.some((r) => r.slug === "ai-financial-copilot"), false)
}

function testScaleUnlocksScalePack() {
  const enforce = false
  assert.equal(resolveBlitzPayFccSectionSurface("scale", "multi-entity-finance", { enforceTierGates: enforce }), "enabled")
  assert.equal(resolveBlitzPayFccSectionSurface("growth", "multi-entity-finance", { enforceTierGates: enforce }), "upgrade_preview")
}

function testEnforcedHidesPreviewRoutes() {
  assert.equal(resolveBlitzPayFccSectionSurface("solo", "multi-entity-finance", { enforceTierGates: true }), "hidden")
}

function testPrefetchSubset() {
  const solo = getBlitzpayFccPrefetchAllowedSlugSet("solo")
  assert.ok(solo.has("overview"))
  assert.equal(solo.has("ai-financial-copilot"), false)
  assert.equal(solo.has("multi-entity-finance"), false)
}

function testUpgradePreviewList() {
  const ids = getBlitzPayUpgradePreviewEligibleSectionIds("solo", { enforceTierGates: false })
  assert.ok(ids.includes("multi-entity-finance"))
  assert.equal(getBlitzPayUpgradePreviewEligibleSectionIds("solo", { enforceTierGates: true }).length, 0)
}

function testOverviewWidgets() {
  const solo = getVisibleOverviewWidgets("solo", { enforceTierGates: false })
  assert.ok(solo.every((w) => w.id !== "cash_runway_summary"))
  assert.ok(solo.some((w) => w.id === "ar_ap_treasury_tiles"))
  const growth = getVisibleOverviewWidgets("growth", { enforceTierGates: false })
  assert.ok(growth.some((w) => w.id === "cash_runway_summary"))
}

function testExecutiveOverviewWidgetSurfaces() {
  assert.equal(resolveExecutiveOverviewWidgetSurface("solo", "recurring_revenue"), "upgrade_cta")
  assert.equal(resolveExecutiveOverviewWidgetSurface("core", "recurring_revenue"), "enabled")
  assert.equal(resolveExecutiveOverviewWidgetSurface("growth", "enterprise_rollups"), "preview")
  assert.equal(resolveExecutiveOverviewWidgetSurface("scale", "enterprise_rollups"), "enabled")
  assert.equal(resolveExecutiveOverviewWidgetSurface("core", "cash_runway"), "upgrade_cta")
  assert.equal(resolveExecutiveOverviewWidgetSurface("growth", "cash_runway"), "enabled")

  const soloWidgets = getExecutiveOverviewWidgetsForTier("solo", () => true)
  assert.ok(soloWidgets.some((w) => w.id === "recurring_revenue" && w.surface === "upgrade_cta"))
  assert.equal(soloWidgets.some((w) => w.id === "cash_runway"), false)

  const gated = getExecutiveOverviewWidgetsForTier("core", (slug) => slug !== "recurring-revenue")
  const recurring = gated.find((w) => w.id === "recurring_revenue")
  assert.equal(recurring?.surface, "preview")
}

function testReadEnforcementIsBoolean() {
  assert.equal(typeof readBlitzPayTierGateEnforcement(), "boolean")
}

testSoloNavIsLean()
testScaleUnlocksScalePack()
testEnforcedHidesPreviewRoutes()
testPrefetchSubset()
testUpgradePreviewList()
testOverviewWidgets()
testExecutiveOverviewWidgetSurfaces()
testReadEnforcementIsBoolean()

console.log("blitzpay capabilities architecture tests passed")
