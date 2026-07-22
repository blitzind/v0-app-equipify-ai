/**
 * FUZOR-ADOPTION-1D — Configuration static contract delegation parity.
 * Run: pnpm test:fuzor-adoption-1d-configuration-constant-parity
 */
import assert from "node:assert/strict"

import {
  PLATFORM_CALIBRATION_DEFAULT_CONFIG,
  PLATFORM_FEATURE_KEYS,
  PLATFORM_FEATURE_REGISTRY,
  PLATFORM_FEATURE_REGISTRY_VERSION,
  PLATFORM_RUNTIME_DAILY_BUDGET_CAPS,
  PLATFORM_RUNTIME_DEFAULT_KILL_SWITCHES,
  PLATFORM_RUNTIME_GUARDRAIL_LIMITS,
  PLATFORM_RUNTIME_GUARDRAILS_QA_MARKER,
  PLATFORM_RUNTIME_HOURLY_BUDGET_CAPS,
  getPlatformBudgetCapForResource,
  getPlatformDefaultCalibrationConfig,
  getPlatformFeatureConfig,
  listPlatformFeaturesByMode,
  listPlatformFeaturesByTier,
  resolvePlatformCalibrationConfigKey,
  resolvePlatformCalibrationWeight,
  resolvePlatformCommunicationEngineWeights,
  resolvePlatformEffectiveCalibrationConfig,
  resolvePlatformMetaRecommenderCoefficients,
  resolvePlatformPriorityEngineMetaMultiplier,
  truncatePlatformSearchResults,
} from "@fuzor/configuration"

import {
  GROWTH_CALIBRATION_DEFAULT_CONFIG,
  getDefaultCalibrationConfig,
  resolveCalibrationConfigKey,
} from "../lib/growth/aios/learning/growth-adaptive-calibration-config-registry"

import {
  clearInMemoryCalibrationConfig,
  resolveCalibrationWeight,
  resolveCommunicationEngineWeights,
  resolveEffectiveCalibrationConfig,
  resolveMetaRecommenderCoefficients,
  resolvePriorityEngineMetaMultiplier,
  setInMemoryCalibrationConfig,
} from "../lib/growth/aios/learning/growth-adaptive-calibration-config-resolver"

import {
  GROWTH_FEATURE_KEYS,
  GROWTH_FEATURE_REGISTRY,
  GROWTH_FEATURE_REGISTRY_VERSION,
  getGrowthFeatureConfig,
  listGrowthFeaturesByMode,
  listGrowthFeaturesByTier,
} from "../lib/growth/runtime/growth-feature-registry"

import {
  GROWTH_RUNTIME_DAILY_BUDGET_CAPS,
  GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES,
  GROWTH_RUNTIME_GUARDRAIL_LIMITS,
  GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
  GROWTH_RUNTIME_HOURLY_BUDGET_CAPS,
  getBudgetCapForResource,
  truncateSearchResults,
} from "../lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

console.log("[FUZOR-ADOPTION-1D] Configuration static contract delegation parity")

assert.strictEqual(GROWTH_RUNTIME_GUARDRAILS_QA_MARKER, PLATFORM_RUNTIME_GUARDRAILS_QA_MARKER)
assert.strictEqual(GROWTH_RUNTIME_GUARDRAIL_LIMITS, PLATFORM_RUNTIME_GUARDRAIL_LIMITS)
assert.strictEqual(GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES, PLATFORM_RUNTIME_DEFAULT_KILL_SWITCHES)
assert.strictEqual(GROWTH_RUNTIME_DAILY_BUDGET_CAPS, PLATFORM_RUNTIME_DAILY_BUDGET_CAPS)
assert.strictEqual(GROWTH_RUNTIME_HOURLY_BUDGET_CAPS, PLATFORM_RUNTIME_HOURLY_BUDGET_CAPS)
assert.strictEqual(GROWTH_CALIBRATION_DEFAULT_CONFIG, PLATFORM_CALIBRATION_DEFAULT_CONFIG)
assert.strictEqual(GROWTH_FEATURE_REGISTRY, PLATFORM_FEATURE_REGISTRY)
assert.strictEqual(GROWTH_FEATURE_KEYS, PLATFORM_FEATURE_KEYS)
assert.strictEqual(GROWTH_FEATURE_REGISTRY_VERSION, PLATFORM_FEATURE_REGISTRY_VERSION)

assert.equal(getBudgetCapForResource("searches", "hourly"), getPlatformBudgetCapForResource("searches", "hourly"))
assert.equal(getBudgetCapForResource("searches", "daily"), getPlatformBudgetCapForResource("searches", "daily"))
assert.equal(getBudgetCapForResource("autonomous_research_runs", "daily"), 0)

const oversized = Array.from({ length: 600 }, (_, index) => index)
assert.deepEqual(truncateSearchResults(oversized), truncatePlatformSearchResults(oversized))

for (const target of [
  "communication_engine",
  "meta_recommender",
  "priority_engine",
  "research_agent",
  "qualification_agent",
  "forecasting",
  "campaign_optimization",
] as const) {
  assert.deepEqual(getDefaultCalibrationConfig(target), getPlatformDefaultCalibrationConfig(target))
  assert.deepEqual(
    GROWTH_CALIBRATION_DEFAULT_CONFIG[target],
    PLATFORM_CALIBRATION_DEFAULT_CONFIG[target],
  )
  assert.equal(resolveCalibrationConfigKey(target, "engagement_weight"), "engagement_weight")
  assert.equal(
    resolveCalibrationConfigKey(target, "unknown_key"),
    resolvePlatformCalibrationConfigKey(target, "unknown_key"),
  )
}

assert.equal(new Set(GROWTH_FEATURE_KEYS).size, GROWTH_FEATURE_KEYS.length)
assert.deepEqual(listGrowthFeaturesByTier(1), listPlatformFeaturesByTier(1))
assert.deepEqual(listGrowthFeaturesByMode("cold_hidden_disabled"), listPlatformFeaturesByMode("cold_hidden_disabled"))
assert.deepEqual(getGrowthFeatureConfig("prospectSearch"), getPlatformFeatureConfig("prospectSearch"))

clearInMemoryCalibrationConfig()
setInMemoryCalibrationConfig({
  organizationId: "org-1",
  targetSystem: "communication_engine",
  config: { engagement_weight: 0.9 },
})

const equipifyEffective = resolveEffectiveCalibrationConfig({
  organizationId: "org-1",
  targetSystem: "communication_engine",
})
const platformEffective = resolvePlatformEffectiveCalibrationConfig({
  organizationId: "org-1",
  targetSystem: "communication_engine",
})
assert.deepEqual(equipifyEffective, platformEffective)

assert.equal(
  resolveCalibrationWeight({
    organizationId: "org-1",
    targetSystem: "priority_engine",
    key: "meta_score_multiplier",
    defaultValue: 0.15,
  }),
  resolvePlatformCalibrationWeight({
    organizationId: "org-1",
    targetSystem: "priority_engine",
    key: "meta_score_multiplier",
    defaultValue: 0.15,
  }),
)

assert.deepEqual(
  resolveCommunicationEngineWeights({ organizationId: "org-1" }),
  resolvePlatformCommunicationEngineWeights({ organizationId: "org-1" }),
)
assert.deepEqual(
  resolveMetaRecommenderCoefficients({ organizationId: "org-1" }),
  resolvePlatformMetaRecommenderCoefficients({ organizationId: "org-1" }),
)
assert.equal(
  resolvePriorityEngineMetaMultiplier({ organizationId: "org-1" }),
  resolvePlatformPriorityEngineMetaMultiplier({ organizationId: "org-1" }),
)

clearInMemoryCalibrationConfig()

const invalidWeight = resolveCalibrationWeight({
  organizationId: "org-2",
  targetSystem: "communication_engine",
  key: "missing_weight",
  defaultValue: 0.42,
})
assert.equal(invalidWeight, 0.42)

console.log("[FUZOR-ADOPTION-1D] PASS")
