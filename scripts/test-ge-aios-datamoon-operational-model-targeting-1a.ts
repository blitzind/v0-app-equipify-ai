/**
 * GE-AIOS-DATAMOON-OPERATIONAL-MODEL-TARGETING-1A — DataMoon operational targeting certification.
 * Run: pnpm test:ge-aios-datamoon-operational-model-targeting-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { projectApprovedBusinessProfileToLeadDiscovery } from "../lib/growth/business-profile/business-profile-lead-discovery-projection"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"
import { buildLive1bEquipifyCompanyProfileContent } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { expandDatamoonB2bTopicSearchQueries } from "../lib/growth/lead-sources/datamoon/datamoon-b2b-topic-broadening"
import {
  DATAMOON_OPERATIONAL_TARGETING_STRATEGY_VERSION,
  GROWTH_DATAMOON_OPERATIONAL_MODEL_TARGETING_1A_QA_MARKER,
  buildDatamoonOperationalTargetingStrategyMetadata,
  mergeDatamoonOperationalTopicSearchQueries,
  resolveOperationalClusterRotationIndex,
  translateDatamoonOperationalModelTargeting,
  translateOperationalCapabilityToTopicPhrase,
  translateQualificationCriteriaToTopicPhrases,
} from "../lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a"
import { buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile } from "../lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a"
import { buildProspectSearchFiltersFromBusinessProfile } from "../lib/growth/business-profile/business-profile-prospect-search-projection-1b"

const ROOT = process.cwd()
const ORG = "00757488-1026-44a5-aac4-269533ac21be"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function equipifyProfile(): BusinessProfileDraftContent {
  return buildLive1bEquipifyCompanyProfileContent()
}

console.log(`[${GROWTH_DATAMOON_OPERATIONAL_MODEL_TARGETING_1A_QA_MARKER}] operational model targeting certification\n`)

const targetingSource = readSource("lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a.ts")
const projectionSource = readSource("lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a.ts")
const broadeningSource = readSource("lib/growth/lead-sources/datamoon/datamoon-b2b-topic-broadening.ts")

assert.doesNotMatch(targetingSource, /buildAudience|topic_id|EQUIPIFY_ICP_B2B_TOPIC_PRIORITY_IDS/)
assert.match(projectionSource, /translateDatamoonOperationalModelTargeting/)
assert.match(projectionSource, /topics: operationalTargeting\.topicPhrases/)
assert.doesNotMatch(readSource("lib/growth/business-profile/business-profile-supported-service-verticals-projection.ts"), /datamoon-operational-model-targeting-1a/)
console.log("  ✓ provider-neutral adapter only; no Business Profile / Prospect Search changes")

assert.equal(translateOperationalCapabilityToTopicPhrase("dispatch"), "service dispatch operations")
assert.equal(translateOperationalCapabilityToTopicPhrase("preventive_maintenance"), "preventive maintenance contracts")
assert.equal(translateOperationalCapabilityToTopicPhrase("calibration"), "equipment calibration services")
assert.equal(
  translateQualificationCriteriaToTopicPhrases(["Maintains equipment with preventive maintenance program"])[0],
  "preventive maintenance contracts",
)
console.log("  ✓ operational capability + qualification translation")

const projection = projectApprovedBusinessProfileToLeadDiscovery(equipifyProfile(), "Equipify")
const rotation0 = translateDatamoonOperationalModelTargeting({
  projection,
  organizationId: ORG,
  audienceOrdinal: 0,
})
const rotation1 = translateDatamoonOperationalModelTargeting({
  projection,
  organizationId: ORG,
  audienceOrdinal: 1,
})

assert.equal(rotation0.topicPhrases.length, 5)
assert.equal(rotation1.topicPhrases.length, 5)
assert.notDeepEqual(rotation0.topicPhrases, rotation1.topicPhrases)
assert.notEqual(rotation0.operationalCluster, rotation1.operationalCluster)
assert.ok(rotation0.operationalConcepts.length >= rotation0.topicPhrases.length)
assert.ok(rotation0.industryAliasesUsed.length <= 2)
assert.ok(rotation0.selectedVerticalIds.length > 0)
console.log("  ✓ weighted topic selection + deterministic rotation")

assert.equal(
  resolveOperationalClusterRotationIndex({ audienceOrdinal: 7, clusterCount: 4 }),
  3,
)
console.log("  ✓ rotation index math")

const mergedQueries = mergeDatamoonOperationalTopicSearchQueries({
  topicPhrases: rotation0.topicPhrases,
  supplementalTopicSearchQueries: rotation0.industryAliasesUsed,
})
assert.ok(mergedQueries.length >= 5)
assert.ok(mergedQueries.length <= 7)
console.log("  ✓ alias merge for provider topic search")

const clusterBroadened = expandDatamoonB2bTopicSearchQueries(rotation0.topicPhrases, {
  clusterBroadeningAnchors: rotation0.clusterBroadeningAnchors,
  multiVerticalProfile: true,
})
assert.ok(clusterBroadened.some((query) => query.includes("hvac") || query.includes("medical") || query.includes("field service")))
assert.doesNotMatch(clusterBroadened.join(" "), /equipment maintenance software/i)
console.log("  ✓ cluster-aware broadening replaces generic biomedical anchors for multi-vertical profiles")

const requestProjection = buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
  profile: equipifyProfile(),
  companyName: "Equipify",
  organizationId: ORG,
  batchSize: 25,
  generatedAt: "2026-07-15T12:00:00.000Z",
  audienceOrdinal: 0,
})
const requestProjectionRotated = buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
  profile: equipifyProfile(),
  companyName: "Equipify",
  organizationId: ORG,
  batchSize: 25,
  generatedAt: "2026-07-15T12:00:00.000Z",
  audienceOrdinal: 1,
})

assert.deepEqual(requestProjection.request.workbench_context?.topics, rotation0.topicPhrases)
assert.deepEqual(
  requestProjection.request.workbench_context?.supplementalTopicSearchQueries,
  rotation0.industryAliasesUsed,
)
assert.deepEqual(
  requestProjection.request.workbench_context?.clusterBroadeningAnchors,
  rotation0.clusterBroadeningAnchors,
)
assert.notEqual(requestProjection.fingerprint, requestProjectionRotated.fingerprint)
assert.equal(
  requestProjection.targetingSummary.targetingStrategy?.version,
  DATAMOON_OPERATIONAL_TARGETING_STRATEGY_VERSION,
)
assert.equal(
  buildDatamoonOperationalTargetingStrategyMetadata(rotation0).selectedVerticalCluster,
  rotation0.operationalCluster,
)
console.log("  ✓ request wiring + metadata persistence fields")

const prospectFiltersBefore = buildProspectSearchFiltersFromBusinessProfile(equipifyProfile())
assert.equal(prospectFiltersBefore.industry, null)
assert.ok((prospectFiltersBefore.industry_aliases?.length ?? 0) > 10)
console.log("  ✓ Prospect Search ICP unchanged")

assert.match(broadeningSource, /clusterBroadeningAnchors/)
assert.match(readSource("lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts"), /targeting_strategy/)
assert.match(readSource("lib/growth/lead-sources/datamoon/datamoon-audience-import-service.ts"), /enrichDatamoonOperationalTargetingStrategyMetadata/)
console.log("  ✓ metadata enrichment hooks present")

console.log(`\nPASS ${GROWTH_DATAMOON_OPERATIONAL_MODEL_TARGETING_1A_QA_MARKER}`)
