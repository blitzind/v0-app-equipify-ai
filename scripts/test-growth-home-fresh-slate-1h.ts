/**
 * GE-AVA-FRESH-SLATE-1H — Post-reset Growth Home must not render demo customer account cards.
 *
 * Run: pnpm test:growth-home-fresh-slate-1h
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_HOME_DEMO_CUSTOMER_ACCOUNT_NAMES,
  GROWTH_HOME_FRESH_SLATE_RUNTIME_ACTIVITY_QA_MARKER,
  collectGrowthHomeRenderedCustomerNames,
  containsGrowthHomeDemoCustomerAccount,
  hasLiveGrowthHomeRuntimeActivity,
  isGrowthHomeFreshSlateDashboard,
} from "../lib/growth/workspace/executive-briefing/growth-home-runtime-activity"
import {
  buildGrowthHomeExecutiveBriefingCertFixture,
  buildGrowthHomeExecutiveBriefingFreshSlateDashboard,
  buildGrowthHomeExecutiveBriefingFreshSlateFixture,
} from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"

const ROOT = process.cwd()

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function main(): void {
  console.log(`\n=== ${GROWTH_HOME_FRESH_SLATE_RUNTIME_ACTIVITY_QA_MARKER} (structure) ===\n`)

  const freshDashboard = buildGrowthHomeExecutiveBriefingFreshSlateDashboard()
  assert.equal(isGrowthHomeFreshSlateDashboard(freshDashboard), true)
  assert.equal(hasLiveGrowthHomeRuntimeActivity(freshDashboard), false)
  console.log("  ✓ fresh-slate dashboard has no live Growth runtime activity")

  const freshHome = buildGrowthHomeExecutiveBriefingFreshSlateFixture()
  assert.equal(freshHome.customerSuccessMissions.length, 0)
  assert.equal(freshHome.customerHealth.length, 0)
  assert.equal(freshHome.renewalsMonitoring.length, 0)
  assert.equal(freshHome.customerWins.length, 0)
  assert.equal(freshHome.expansionOpportunities.length, 0)
  assert.equal(freshHome.serviceMissions.length, 0)
  assert.equal(freshHome.checkIn.customerSuccessOperatorSummary, null)
  console.log("  ✓ post-reset Home synthesizer returns empty customer growth payloads")

  const renderedNames = collectGrowthHomeRenderedCustomerNames({
    customerSuccessMissions: freshHome.customerSuccessMissions,
    customerHealth: freshHome.customerHealth,
    renewalsMonitoring: freshHome.renewalsMonitoring,
    customerWins: freshHome.customerWins,
    serviceMissions: freshHome.serviceMissions,
  })
  for (const demo of GROWTH_HOME_DEMO_CUSTOMER_ACCOUNT_NAMES) {
    assert.equal(
      renderedNames.some((name) => containsGrowthHomeDemoCustomerAccount(name)),
      false,
      `demo account leaked on fresh slate: ${demo}`,
    )
  }
  console.log("  ✓ no demo customer accounts in fresh-slate Home output")

  const activeHome = buildGrowthHomeExecutiveBriefingCertFixture()
  assert.ok(hasLiveGrowthHomeRuntimeActivity(buildGrowthHomeExecutiveBriefingFreshSlateDashboard()) === false)
  assert.ok(activeHome.customerSuccessMissions.length >= 1)
  const activeRendered = collectGrowthHomeRenderedCustomerNames({
    customerSuccessMissions: activeHome.customerSuccessMissions,
    customerHealth: activeHome.customerHealth,
    renewalsMonitoring: activeHome.renewalsMonitoring,
    customerWins: activeHome.customerWins,
    serviceMissions: activeHome.serviceMissions,
  }).join("\n")
  assert.doesNotMatch(activeRendered, /Acme Manufacturing/)
  assert.doesNotMatch(activeRendered, /King of Boat Care/)
  console.log("  ✓ active fixture still synthesizes missions without demo account names")

  const csSynth = read("lib/growth/workspace/executive-briefing/growth-home-customer-success-mission-synthesizer.ts")
  assert.match(csSynth, /hasLiveGrowthHomeRuntimeActivity/)
  assert.doesNotMatch(csSynth, /Acme Manufacturing/)
  assert.doesNotMatch(csSynth, /King of Boat Care/)
  console.log("  ✓ CS synthesizer gated on runtime activity — hardcoded demo names removed")

  const serviceSynth = read("lib/growth/workspace/executive-briefing/growth-home-service-mission-synthesizer.ts")
  assert.match(serviceSynth, /hasLiveGrowthHomeRuntimeActivity/)
  assert.doesNotMatch(serviceSynth, /Acme Manufacturing/)
  console.log("  ✓ service synthesizer gated on runtime activity")

  const dashboard = read("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx")
  assert.match(dashboard, /GrowthHomeCustomerGrowthEmptySection/)
  assert.match(dashboard, /hasCustomerGrowthContent/)
  console.log("  ✓ Customer Growth section renders fresh Ava empty state")

  const emptySection = read("components/growth/workspace/executive-briefing/growth-home-customer-growth-empty-section.tsx")
  assert.match(emptySection, /GROWTH_HOME_FRESH_AVA_HEADLINE/)
  assert.match(emptySection, /GROWTH_HOME_FRESH_AVA_SUBLINE/)
  console.log("  ✓ empty-state copy present")

  console.log(`\n${GROWTH_HOME_FRESH_SLATE_RUNTIME_ACTIVITY_QA_MARKER} structure certification passed.\n`)
}

main()
