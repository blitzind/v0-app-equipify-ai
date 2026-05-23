/**
 * Regression checks for Growth Lead research AI schema normalization.
 * Run: pnpm test:growth-lead-research-schema
 */
import assert from "node:assert/strict"
import {
  clampGrowthLeadFitScore,
  clampGrowthLeadResearchConfidence,
  growthLeadResearchModelSchema,
  mapGrowthLeadResearchModelToResult,
  normalizeGrowthLeadFitModelVersion,
  normalizeGrowthLeadResearchStringList,
} from "../lib/growth/research-schema"

assert.deepEqual(normalizeGrowthLeadResearchStringList(null), [])
assert.deepEqual(normalizeGrowthLeadResearchStringList(undefined), [])
assert.deepEqual(normalizeGrowthLeadResearchStringList("Regional HVAC"), ["Regional HVAC"])
assert.deepEqual(normalizeGrowthLeadResearchStringList("  "), [])
assert.deepEqual(normalizeGrowthLeadResearchStringList([" Dallas ", "", 42, null]), ["Dallas", "42"])

assert.equal(clampGrowthLeadFitScore(150.6), 100)
assert.equal(clampGrowthLeadFitScore(-12), 0)
assert.equal(clampGrowthLeadFitScore("62"), 62)

assert.equal(clampGrowthLeadResearchConfidence(1.4), 1)
assert.equal(clampGrowthLeadResearchConfidence(-0.2), 0)
assert.equal(clampGrowthLeadResearchConfidence("0.55"), 0.55)

assert.equal(normalizeGrowthLeadFitModelVersion(null), "v1")
assert.equal(normalizeGrowthLeadFitModelVersion("v2-beta"), "v2-beta")

const parsed = growthLeadResearchModelSchema.parse({
  company_summary: "Commercial HVAC contractor.",
  recommended_next_action: "Verify fleet size on a call.",
  service_area_clues: "Dallas-Fort Worth metro",
  equipment_service_indicators: null,
  equipify_pain_points: ["Manual dispatch", ""],
  equipify_fit_score: 130,
  research_confidence: 2,
  outreach_angles: "Lead with maintenance plans",
  source_urls: undefined,
  caveats: ["Unverified website"],
})

assert.deepEqual(parsed.service_area_clues, ["Dallas-Fort Worth metro"])
assert.deepEqual(parsed.equipment_service_indicators, [])
assert.deepEqual(parsed.equipify_pain_points, ["Manual dispatch"])
assert.deepEqual(parsed.outreach_angles, ["Lead with maintenance plans"])
assert.equal(parsed.equipify_fit_score, 100)
assert.equal(parsed.research_confidence, 1)
assert.equal(parsed.fit_model_version, "v1")

const mapped = mapGrowthLeadResearchModelToResult(parsed)
assert.equal(mapped.fitModelVersion, "v1")
assert.deepEqual(mapped.serviceAreaClues, ["Dallas-Fort Worth metro"])
assert.equal(mapped.equipifyFitScore, 100)

console.log("growth-lead-research-schema tests passed.")
