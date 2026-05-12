/**
 * BlitzPay Phase 7A.5 — deterministic demo data, showcase fixtures, and sales-readiness helpers.
 * Run: pnpm test:blitzpay-phase-7a5-demo-data
 */
import assert from "node:assert/strict"
import { computeBlitzpayOperationalReadinessStrip } from "../lib/blitzpay/blitzpay-operational-readiness"
import {
  BLITZPAY_DEMO_MAX_ACTIVITY_FEED_LINES,
  BLITZPAY_DEMO_MAX_REFERENCE_DAY_OFFSETS,
  BLITZPAY_DEMO_MAX_SCENARIO_BULLETS,
  BLITZPAY_DEMO_OPERATIONAL_PRESETS,
  type BlitzpayDemoOrgArchetype,
  BLITZPAY_DEMO_ORG_ARCHETYPES,
  buildBlitzpayDemoFccShowcaseSnapshot,
  buildBlitzpayDemoOperationalReadinessInputs,
  describeBlitzpayDemoOrgArchetype,
  getBlitzpayDemoActivityFeedLines,
  getBlitzpayDemoModuleHealthTags,
  getBlitzpayDemoOperationalPresetBundle,
  getBlitzpayDemoScenarioCard,
  getBlitzpayDemoShowcaseMetricLabel,
  type BlitzpayDemoShowcaseMetricKey,
  listBlitzpayDemoOrgArchetypesSorted,
  validateBlitzpayDemoFixtureCoherence,
} from "../lib/blitzpay/blitzpay-demo-presets"

function assertNoUnderscoreHumanFields(arch: BlitzpayDemoOrgArchetype): void {
  const d = describeBlitzpayDemoOrgArchetype(arch)
  for (const v of [d.title, d.tagline, d.maturityLabel, d.primaryTradeFocus]) {
    assert.match(v, /^[^_]+$/, `human copy must not leak archetype keys: ${v}`)
  }
}

function assertShowcaseLabelsHumanized(): void {
  const keys: BlitzpayDemoShowcaseMetricKey[] = [
    "treasury_movement",
    "collections_pulse",
    "payroll_visibility",
    "ap_aging_signal",
    "financing_pipeline",
    "procurement_exposure",
    "claims_activity",
    "observability_health",
    "ai_advisory_queue",
    "revenue_optimization_queue",
    "multi_entity_footprint",
    "supplier_network_posture",
  ]
  for (const k of keys) {
    const label = getBlitzpayDemoShowcaseMetricLabel(k)
    assert.ok(label.length > 8)
    assert.match(label, /^[^_]+$/, `showcase label must not echo enum keys: ${label}`)
    assert.ok(!label.includes("treasury_movement"))
  }
}

function main(): void {
  assert.deepEqual(
    BLITZPAY_DEMO_OPERATIONAL_PRESETS,
    getBlitzpayDemoOperationalPresetBundle("mature_multi_department"),
  )

  const sorted = listBlitzpayDemoOrgArchetypesSorted()
  assert.deepEqual(sorted, [...BLITZPAY_DEMO_ORG_ARCHETYPES].sort((a, b) => a.localeCompare(b)))

  for (const arch of BLITZPAY_DEMO_ORG_ARCHETYPES) {
    assertNoUnderscoreHumanFields(arch)

    const a = JSON.stringify(buildBlitzpayDemoFccShowcaseSnapshot(arch))
    const b = JSON.stringify(buildBlitzpayDemoFccShowcaseSnapshot(arch))
    assert.equal(a, b)

    const snap = buildBlitzpayDemoFccShowcaseSnapshot(arch)
    const v = validateBlitzpayDemoFixtureCoherence(snap)
    assert.equal(v.ok, true)

    assert.ok(snap.aiFinancialRiskScore >= 0 && snap.aiFinancialRiskScore <= 100)
    assert.ok(snap.revenueOptimizationScore >= 0 && snap.revenueOptimizationScore <= 100)
    assert.ok(snap.collectionsRecoveryRhythm0to100 >= 0 && snap.collectionsRecoveryRhythm0to100 <= 100)
    assert.ok(snap.supplierNetworkHealth0to100 >= 0 && snap.supplierNetworkHealth0to100 <= 100)
    assert.ok(snap.treasuryOperatingCents + snap.treasuryHeldReserveCents < 400_000_00)

    const feed = getBlitzpayDemoActivityFeedLines(arch)
    assert.ok(feed.length <= BLITZPAY_DEMO_MAX_ACTIVITY_FEED_LINES)
    assert.ok(feed.every((line) => line.length > 20 && !line.toLowerCase().includes("lorem")))

    const card = getBlitzpayDemoScenarioCard(arch)
    assert.ok(card.bullets.length <= BLITZPAY_DEMO_MAX_SCENARIO_BULLETS)

    assert.ok(snap.referenceDayOffsets.length <= BLITZPAY_DEMO_MAX_REFERENCE_DAY_OFFSETS)

    const readinessIn = buildBlitzpayDemoOperationalReadinessInputs(arch)
    const strip = computeBlitzpayOperationalReadinessStrip(readinessIn)
    assert.ok(strip.overallComfort0to100 >= 0 && strip.overallComfort0to100 <= 100)
    assert.ok(strip.mobileFieldReadinessScore0to100 >= 0 && strip.mobileFieldReadinessScore0to100 <= 100)
    assert.ok(strip.reportingSnapshotRecursionGuard === "nominal" || strip.reportingSnapshotRecursionGuard === "depth_capped")

    const tags = getBlitzpayDemoModuleHealthTags(arch)
    const tones = new Set(tags.map((t) => t.tone))
    assert.ok(tones.size >= 2, "demo health tags should mix tones, not read as all-green")
    assert.ok(tags.every((t) => !t.moduleLabel.includes("_")))
  }

  assertShowcaseLabelsHumanized()

  // Cross-archetype: franchise has strictly more linked orgs than small.
  assert.ok(
    buildBlitzpayDemoFccShowcaseSnapshot("franchise_style_network").multiEntityLinkedOrgCount >
      buildBlitzpayDemoFccShowcaseSnapshot("small_contractor").multiEntityLinkedOrgCount,
  )
}

try {
  main()
} catch (e) {
  console.error(e)
  process.exit(1)
}
