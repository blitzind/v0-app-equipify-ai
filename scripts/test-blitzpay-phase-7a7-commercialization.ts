/**
 * BlitzPay Phase 7A.7 — commercial packaging, upgrade readiness, positioning infrastructure.
 * Run: pnpm test:blitzpay-phase-7a7-commercialization
 */
import assert from "node:assert/strict"
import { BLITZPAY_COMMERCIAL_METADATA_VERSION } from "../lib/blitzpay/blitzpay-commercial-readiness"
import { BLITZPAY_ENTITLEMENTS_FOUNDATION_VERSION } from "../lib/billing/blitzpay-entitlements"
import { canAccessBlitzpayFeature } from "../lib/billing/blitzpay-entitlements"
import {
  assertBlitzpayModulePackagingCategoryCoverage,
  BLITZPAY_COMMERCIAL_TIER_SEQUENCE,
  blitzpayCommercialTierOperationalPosture,
  blitzpayMaturityStageRank,
  buildBlitzpayPlatformCommercialPackagingHistogram,
  buildBlitzpayUpgradeRecommendationSummary,
  getBlitzpayModulePackagingCategory,
  getBlitzpayModulePackagingCategoryLabel,
  getBlitzpayNextPackagingTier,
  getBlitzpayUpgradeMetadata,
  summarizeBlitzpayCommercialPlanSample,
  summarizeBlitzpayModulePackagingCategorySkewSample,
  summarizeBlitzpayOnboardingReadinessBandSample,
  summarizeBlitzpayOperationalMaturityPostureSample,
} from "../lib/billing/blitzpay-commercial-packaging"
import { BLITZPAY_PLAN_METADATA } from "../lib/billing/blitzpay-plan-metadata"

function testVersions() {
  assert.equal(BLITZPAY_COMMERCIAL_METADATA_VERSION, "7a.7")
  assert.equal(BLITZPAY_ENTITLEMENTS_FOUNDATION_VERSION, "7a.7")
}

function testTierSequenceMonotonic() {
  for (let i = 0; i < BLITZPAY_COMMERCIAL_TIER_SEQUENCE.length - 1; i++) {
    const cur = BLITZPAY_COMMERCIAL_TIER_SEQUENCE[i]!
    const nxt = BLITZPAY_COMMERCIAL_TIER_SEQUENCE[i + 1]!
    assert.equal(getBlitzpayNextPackagingTier(cur), nxt)
  }
  assert.equal(getBlitzpayNextPackagingTier("enterprise"), null)
}

function testModuleCategoriesComplete() {
  assertBlitzpayModulePackagingCategoryCoverage()
  assert.ok(getBlitzpayModulePackagingCategoryLabel("payments_connect").length > 0)
}

function testUpgradeMetadata() {
  const u = getBlitzpayUpgradeMetadata("solo", "blitzpay.ai.copilot")
  assert.ok(u)
  assert.ok(u!.modulePackagingCategoryLabel.length > 0)
  assert.equal(u!.recommendedTier, "growth")
}

function testUpgradeSummary() {
  const up = buildBlitzpayUpgradeRecommendationSummary({
    currentTier: "solo",
    featureKeys: ["blitzpay.ai.copilot"],
  })
  assert.equal(up.needsUpgrade, true)
  assert.equal(up.recommendedTier, "growth")
}

function testPlanSampleDeterministic() {
  const a = summarizeBlitzpayCommercialPlanSample(["solo", "core", "solo", ""])
  const b = summarizeBlitzpayCommercialPlanSample(["solo", "core", "solo", ""])
  assert.deepEqual(a.countsApprox, b.countsApprox)
  assert.equal(a.otherOrUnknownSampleCount, 1)
  assert.equal(a.dominantTier, "solo")
}

function testOnboardingAndMaturitySamples() {
  const plans = ["solo", "solo", "core", "growth"]
  const ob = summarizeBlitzpayOnboardingReadinessBandSample(plans)
  assert.equal(ob.counts.quick, 2)
  assert.equal(ob.counts.moderate, 1)
  assert.equal(ob.counts.delegated_finance, 1)
  const mat = summarizeBlitzpayOperationalMaturityPostureSample(plans)
  assert.equal(mat.counts.launch, 2)
  assert.equal(mat.counts.operate, 1)
  assert.equal(mat.counts.optimize, 1)
}

function testMaturityProgressionOrder() {
  assert.ok(blitzpayMaturityStageRank("launch") < blitzpayMaturityStageRank("govern"))
  assert.equal(blitzpayCommercialTierOperationalPosture("solo"), "launch")
  assert.equal(blitzpayCommercialTierOperationalPosture("enterprise"), "govern")
}

function testModuleSkewAndPlatformHistogram() {
  const skew = summarizeBlitzpayModulePackagingCategorySkewSample(["solo", "enterprise"])
  assert.ok(skew.topCategories.length > 0)
  const hist = buildBlitzpayPlatformCommercialPackagingHistogram(["scale", "scale", "core"], 800)
  assert.equal(hist.planIdsSampled, 3)
  assert.equal(hist.planSampleLimit, 800)
  assert.ok(hist.compositeNarrativeLine.includes("Sample"))
}

function testPlanMetadataFields() {
  for (const t of BLITZPAY_COMMERCIAL_TIER_SEQUENCE) {
    const m = BLITZPAY_PLAN_METADATA[t]
    assert.ok(m.bestForTag.length > 0)
    assert.ok(m.setupComplexityLabel.length > 0)
    assert.ok(m.onboardingReadinessBand)
    assert.ok(m.commonlyEnabledTogetherHint.length > 0)
    for (const mod of m.visibleModules) {
      assert.ok(getBlitzpayModulePackagingCategory(mod))
    }
  }
}

function testNoHardLock() {
  assert.equal(canAccessBlitzpayFeature("solo", "blitzpay.ai.copilot"), true)
  assert.equal(canAccessBlitzpayFeature("solo", "blitzpay.ai.copilot", { enforceTierGates: false }), true)
}

testVersions()
testTierSequenceMonotonic()
testModuleCategoriesComplete()
testUpgradeMetadata()
testUpgradeSummary()
testPlanSampleDeterministic()
testOnboardingAndMaturitySamples()
testMaturityProgressionOrder()
testModuleSkewAndPlatformHistogram()
testPlanMetadataFields()
testNoHardLock()

console.log("blitzpay phase 7a7 commercialization tests passed")
