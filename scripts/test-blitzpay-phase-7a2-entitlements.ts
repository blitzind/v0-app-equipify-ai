/**
 * BlitzPay Phase 7A.2 — entitlement registry, packaging metadata, permissive defaults.
 * Run: pnpm test:blitzpay-phase-7a2-entitlements
 */
import assert from "node:assert/strict"
import { BLITZPAY_FEATURE_CATALOG, BLITZPAY_FEATURE_KEYS, deriveBlitzpayModuleMinimumTiers } from "../lib/billing/blitzpay-feature-catalog"
import {
  blitzpayModuleWouldBeGatedAtTier,
  buildBlitzpayEntitlementAuditSnapshot,
  canAccessBlitzpayFeature,
  getBlitzpayPlanFeatures,
  getBlitzpayRecommendedTier,
  isBlitzpayModuleEnabledForTier,
} from "../lib/billing/blitzpay-entitlements"
import { getBlitzpayCommercialCategory, getBlitzpayUpgradeMetadata } from "../lib/billing/blitzpay-commercial-packaging"
import { BLITZPAY_PLAN_METADATA } from "../lib/billing/blitzpay-plan-metadata"

function testCatalogKeysUnique() {
  const seen = new Set<string>()
  for (const k of BLITZPAY_FEATURE_KEYS) {
    assert.equal(seen.has(k), false, `duplicate feature key ${k}`)
    seen.add(k)
  }
  assert.equal(seen.size, BLITZPAY_FEATURE_CATALOG.length)
}

function testPermissiveAccess() {
  assert.equal(canAccessBlitzpayFeature("solo", "blitzpay.ai.copilot"), true)
  assert.equal(canAccessBlitzpayFeature(null, "blitzpay.gl.books"), true)
  assert.equal(isBlitzpayModuleEnabledForTier("solo", "ai_copilot"), true)
}

function testEnforcedAccess() {
  assert.equal(canAccessBlitzpayFeature("solo", "blitzpay.ai.copilot", { enforceTierGates: true }), false)
  assert.equal(canAccessBlitzpayFeature("growth", "blitzpay.ai.copilot", { enforceTierGates: true }), true)
}

function testModuleGatePreview() {
  assert.equal(blitzpayModuleWouldBeGatedAtTier("solo", "ai_copilot"), true)
  assert.equal(blitzpayModuleWouldBeGatedAtTier("growth", "ai_copilot"), false)
  assert.equal(blitzpayModuleWouldBeGatedAtTier(null, "ai_copilot"), false)
}

function testPlanFeatures() {
  const solo = getBlitzpayPlanFeatures("solo")
  assert.ok(solo.includes("blitzpay.payments.connect"))
  assert.equal(solo.includes("blitzpay.ai.copilot"), false)
  const growth = getBlitzpayPlanFeatures("growth")
  assert.ok(growth.includes("blitzpay.ai.copilot"))
}

function testRecommendedTier() {
  assert.equal(getBlitzpayRecommendedTier(["blitzpay.payments.connect", "blitzpay.ai.copilot"]), "growth")
  assert.equal(getBlitzpayRecommendedTier(["blitzpay.payments.connect"]), "solo")
}

function testUpgradeMetadata() {
  const u = getBlitzpayUpgradeMetadata("solo", "blitzpay.ai.copilot")
  assert.ok(u)
  assert.equal(u!.recommendedTier, "growth")
  assert.ok(u!.headline.length > 0)
  assert.ok(u!.modulePackagingCategoryLabel.length > 0)
}

function testCommercialCategory() {
  const c = getBlitzpayCommercialCategory("blitzpay.ai.copilot")
  assert.equal(c.includes("Growth"), true)
}

function testPlatformAdminFeature() {
  const row = BLITZPAY_FEATURE_CATALOG.find((r) => r.key === "blitzpay.platform.ops")
  assert.ok(row)
  assert.equal(row!.moduleClassification, "platform_admin")
}

function testAuditSnapshot() {
  const snap = buildBlitzpayEntitlementAuditSnapshot("solo", { enforceTierGates: false })
  assert.equal(snap.enforcementModeEnabled, false)
  assert.ok(snap.modulesThatWouldGateIfEnforced.includes("ai_copilot"))
  assert.ok(snap.featuresBelowTierIfEnforced.includes("blitzpay.ai.copilot"))
}

function testPlanMetadataCompleteness() {
  for (const t of ["solo", "core", "growth", "scale", "enterprise"] as const) {
    assert.ok(BLITZPAY_PLAN_METADATA[t].visibleModules.length > 0)
  }
}

function testDerivedModuleMinsCoverAllModules() {
  const m = deriveBlitzpayModuleMinimumTiers()
  assert.equal(typeof m.ai_copilot, "string")
  assert.equal(m.platform_blitzpay_operations, "enterprise")
}

testCatalogKeysUnique()
testPermissiveAccess()
testEnforcedAccess()
testModuleGatePreview()
testPlanFeatures()
testRecommendedTier()
testUpgradeMetadata()
testCommercialCategory()
testPlatformAdminFeature()
testAuditSnapshot()
testPlanMetadataCompleteness()
testDerivedModuleMinsCoverAllModules()

console.log("blitzpay phase 7a2 entitlements tests passed")
