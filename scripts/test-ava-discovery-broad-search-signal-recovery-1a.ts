/**
 * AVA-DISCOVERY-BROAD-SEARCH-SIGNAL-RECOVERY-1A — Certification.
 *
 *   pnpm test:ava-discovery-broad-search-signal-recovery-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildLive1bEquipifyCompanyProfileContent } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { prepareDatamoonAudienceImportRequestForBuild } from "@/lib/growth/lead-sources/datamoon/datamoon-b2b-audience-import-prepare"
import {
  AUTONOMOUS_BROAD_PROVIDER_QUALIFICATION_FILTER_FIELDS,
} from "@/lib/growth/lead-sources/datamoon/datamoon-autonomous-broad-provider-discovery-1a"
import {
  AUTONOMOUS_BROAD_DISCOVERY_MAX_TOPIC_IDS,
  GROWTH_DATAMOON_AUTONOMOUS_BROAD_SEARCH_SIGNAL_1A_QA_MARKER,
  resolveAutonomousBroadDiscoveryConceptFromSlice,
} from "@/lib/growth/lead-sources/datamoon/datamoon-autonomous-broad-search-signal-1a"
import {
  emptyDatamoonDiscoverySearchSliceState,
  GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_1A_QA_MARKER,
} from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a-types"
import {
  DATAMOON_SLICE_OUTCOME_UNTRUSTWORTHY_STOP_REASONS,
  recordDatamoonDiscoverySearchSliceOutcome,
  selectNextDatamoonDiscoverySearchSlice,
} from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a"
import { translateDatamoonOperationalModelTargeting } from "@/lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a"
import { projectApprovedBusinessProfileToLeadDiscovery } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import { buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile } from "@/lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a"
import {
  applyProspectSearchExternalCompanyFilters,
  buildAutonomousPortfolioExternalDiscoveryFilters,
} from "@/lib/growth/prospect-search/prospect-search-external-filters"
import { buildProspectSearchFiltersFromBusinessProfile } from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"

const CERT_ID = GROWTH_DATAMOON_AUTONOMOUS_BROAD_SEARCH_SIGNAL_1A_QA_MARKER
const ROOT = process.cwd()
const GENERATED_AT = "2026-07-28T01:00:00.000Z"
const SLICE_KEY = "commercial_kitchen_fleet:us_midwest"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

async function main() {
  console.log(`[${CERT_ID}] certification\n`)

  const prepareSource = readSource("lib/growth/lead-sources/datamoon/datamoon-b2b-audience-import-prepare.ts")
  const projectionSource = readSource(
    "lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a.ts",
  )
  const signalSource = readSource("lib/growth/lead-sources/datamoon/datamoon-autonomous-broad-search-signal-1a.ts")

  assert.match(prepareSource, /prepareAutonomousBroadSearchSignalDiscoveryRequest/)
  assert.match(projectionSource, /resolveAutonomousBroadDiscoveryConceptFromSlice/)
  assert.match(projectionSource, /providerDiscoveryConcept/)
  assert.match(signalSource, /AUTONOMOUS_BROAD_DISCOVERY_MAX_TOPIC_IDS/)
  console.log("  ✓ Architecture guard — broad search signal path wired")

  const profile = buildLive1bEquipifyCompanyProfileContent()
  const leadProjection = projectApprovedBusinessProfileToLeadDiscovery(profile, "Equipify")
  const operationalTargeting = translateDatamoonOperationalModelTargeting({
    projection: leadProjection,
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    clusterRotationIndex: 0,
    topicVariantIndex: 1,
    preferClusterBroadeningAnchors: true,
  })
  const concept = resolveAutonomousBroadDiscoveryConceptFromSlice({
    searchSlice: {
      qaMarker: GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_1A_QA_MARKER,
      sliceKey: SLICE_KEY,
      clusterId: "commercial_kitchen_fleet",
      clusterRotationIndex: 0,
      geoBucketId: "us_midwest",
      geoBucketLabel: "US Midwest",
      stateCodes: ["OH", "IN", "IL"],
      topicVariantIndex: 1,
      selectionReason: "test",
      resumedSlice: true,
      advancedTopicVariant: false,
      rotatedFromSliceKey: null,
    },
    operationalTargeting,
  })
  assert.equal(concept.conceptSource, "slice_cluster_anchor")
  assert.match(concept.primaryConcept, /fleet maintenance|commercial kitchen|appliance|field service/i)
  assert.equal(concept.geoPolicy, "us_wide")
  console.log("  ✓ Slice context selects one broad discovery concept without geo gate")

  const searchSlice = {
    qaMarker: GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_1A_QA_MARKER,
    sliceKey: SLICE_KEY,
    clusterId: "commercial_kitchen_fleet",
    clusterRotationIndex: 0,
    geoBucketId: "us_midwest",
    geoBucketLabel: "US Midwest",
    stateCodes: ["OH", "IN", "IL"],
    topicVariantIndex: 1,
    selectionReason: "test",
    resumedSlice: true,
    advancedTopicVariant: true,
    rotatedFromSliceKey: null,
  }

  const projection = buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
    profile,
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    batchSize: 25,
    generatedAt: GENERATED_AT,
    searchSlice,
  })

  assert.equal(projection.request.workbench_context?.topics?.length, 1)
  assert.equal(
    projection.request.workbench_context?.providerDiscoveryConcept,
    projection.request.workbench_context?.topics?.[0],
  )
  assert.equal(projection.request.workbench_context?.autonomousBroadSearchSignal, true)
  assert.equal(projection.request.workbench_context?.qualificationFiltersDeferred, true)
  assert.ok(projection.request.workbench_context?.broadDiscoveryObservability?.providerDiscoveryConcept)

  const stateOrQualification = projection.request.filters.filter((row) =>
    (AUTONOMOUS_BROAD_PROVIDER_QUALIFICATION_FILTER_FIELDS as readonly string[]).includes(row.field),
  )
  assert.equal(stateOrQualification.length, 0)
  assert.ok(
    projection.request.filters.some(
      (row) => row.field === "country" && row.value === "United States",
    ),
  )
  console.log("  ✓ Autonomous projection retains US-wide geography and one discovery concept")

  const prepared = await prepareDatamoonAudienceImportRequestForBuild(projection.request, {
    env: { ...process.env, DATAMOON_DRY_RUN_ONLY: "true" },
  })
  assert.equal(prepared.ok, true)
  if (!prepared.ok) throw new Error("prepare_failed")
  assert.equal(prepared.request.audience_type, "b2b")
  assert.ok((prepared.request.topic_ids?.length ?? 0) >= 1)
  assert.ok((prepared.request.topic_ids?.length ?? 0) <= AUTONOMOUS_BROAD_DISCOVERY_MAX_TOPIC_IDS)
  const providerFields = prepared.request.filters.map((row) => row.field)
  assert.deepEqual(providerFields, ["contact_country"])
  assert.equal(prepared.request.workbench_context?.qualificationFiltersDeferred, true)
  assert.equal(
    prepared.request.filters.some((row) => row.field === "score_category"),
    false,
  )
  assert.equal(prepared.request.filters.some((row) => row.field === "event_date"), false)
  assert.equal(prepared.request.filters.some((row) => row.field === "job_title"), false)
  assert.equal(prepared.request.filters.some((row) => row.field === "primary_industry"), false)
  console.log("  ✓ Prepare resolves broad b2b topic signal without qualification gates")

  const variantZero = buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
    profile,
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    batchSize: 25,
    generatedAt: GENERATED_AT,
    searchSlice: { ...searchSlice, topicVariantIndex: 0 },
  })
  const variantOne = buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
    profile,
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    batchSize: 25,
    generatedAt: GENERATED_AT,
    searchSlice: { ...searchSlice, topicVariantIndex: 1 },
  })
  assert.notEqual(
    variantZero.request.workbench_context?.providerDiscoveryConcept,
    variantOne.request.workbench_context?.providerDiscoveryConcept,
  )
  console.log("  ✓ Topic variant changes discovery concept without adding provider geo gates")

  const canonicalFilters = buildProspectSearchFiltersFromBusinessProfile(profile)
  const deferred = buildAutonomousPortfolioExternalDiscoveryFilters(canonicalFilters)
  assert.equal(deferred.industry, null)
  assert.equal(deferred.location, null)
  const survivor = applyProspectSearchExternalCompanyFilters(
    [
      {
        id: "synthetic:acme",
        source_type: "external_discovered",
        company_name: "Acme Field Service",
        website: "https://acme.example",
        industry: "Oil and Gas",
        subindustry: null,
        city: "Chicago",
        state: "IL",
        country: "US",
        employees: null,
        revenue_range: null,
        location: "IL, US",
        intent_score: null,
        buying_stage: null,
        lead_score: null,
        confidence: 0.5,
        company_match_confidence: null,
        decision_maker_coverage: null,
        verification_status: "external_unverified",
        signals: [],
        search_intent_category: null,
        growth_lead_id: null,
        prospect_id: null,
        customer_id: null,
        rank_score: 0.5,
        match_reasoning: [],
        discovery_provider_type: "datamoon",
        discovery_provider_name: "DataMoon",
        discovery_source_badge: "DataMoon",
        keywords: [],
        notes: null,
      },
    ],
    canonicalFilters,
    { autonomous_portfolio_discovery: true },
  )
  assert.equal(survivor.companies.length, 1)
  console.log("  ✓ GPT remains downstream ICP authority via deferred post-provider filters")

  let sliceState = emptyDatamoonDiscoverySearchSliceState()
  sliceState.currentSliceKey = SLICE_KEY
  sliceState = recordDatamoonDiscoverySearchSliceOutcome({
    state: sliceState,
    selection: {
      sliceKey: SLICE_KEY,
      clusterId: "commercial_kitchen_fleet",
      geoBucketId: "us_midwest",
      topicVariantIndex: 1,
    },
    generatedAt: GENERATED_AT,
    selectedCount: 0,
    pushedCount: 0,
    existingCount: 0,
    rawCompanyCount: 0,
    normalizedCompanyCount: 0,
  })
  assert.equal(sliceState.slices[SLICE_KEY]?.lastOutcomeKind, "zero_provider_results")
  const nextSlice = selectNextDatamoonDiscoverySearchSlice({
    projection: leadProjection,
    state: sliceState,
    generatedAt: GENERATED_AT,
  })
  assert.notEqual(nextSlice.sliceKey, SLICE_KEY)
  assert.equal(nextSlice.topicVariantIndex, 0)
  console.log("  ✓ Zero provider results rotate to a materially different slice")

  assert.ok(DATAMOON_SLICE_OUTCOME_UNTRUSTWORTHY_STOP_REASONS.includes("datamoon_provider_error"))
  console.log("  ✓ Provider failure stop reasons do not penalize slice exhaustion")

  assert.doesNotMatch(
    readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts"),
    /approveFirstTouch|sendOutbound|delivery_attempts/i,
  )
  console.log("  ✓ Safety guard — no approval/send path changes")

  console.log(`\n[${CERT_ID}] PASS`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
