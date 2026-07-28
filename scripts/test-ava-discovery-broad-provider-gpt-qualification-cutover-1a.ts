/**
 * AVA-DISCOVERY-BROAD-PROVIDER-GPT-QUALIFICATION-CUTOVER-1A — Certification.
 *
 *   pnpm test:ava-discovery-broad-provider-gpt-qualification-cutover-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildLive1bEquipifyCompanyProfileContent } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { prepareDatamoonAudienceImportRequestForBuild } from "@/lib/growth/lead-sources/datamoon/datamoon-b2b-audience-import-prepare"
import {
  AUTONOMOUS_BROAD_PROVIDER_QUALIFICATION_FILTER_FIELDS,
  GROWTH_DATAMOON_AUTONOMOUS_BROAD_PROVIDER_DISCOVERY_1A_QA_MARKER,
  isAutonomousBroadProviderDiscoveryRequest,
  prepareAutonomousBroadProviderDiscoveryRequest,
  stripAutonomousBroadProviderQualificationFromRequest,
} from "@/lib/growth/lead-sources/datamoon/datamoon-autonomous-broad-provider-discovery-1a"
import {
  emptyDatamoonDiscoverySearchSliceState,
  GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_1A_QA_MARKER,
} from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a-types"
import {
  recordDatamoonDiscoverySearchSliceOutcome,
  selectNextDatamoonDiscoverySearchSlice,
} from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a"
import { projectApprovedBusinessProfileToLeadDiscovery } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import { buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile } from "@/lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a"
import {
  applyProspectSearchExternalCompanyFilters,
  buildAutonomousPortfolioExternalDiscoveryFilters,
  GROWTH_AUTONOMOUS_PORTFOLIO_EXTERNAL_DISCOVERY_DEFERRAL_1A_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-external-filters"
import { buildProspectSearchFiltersFromBusinessProfile } from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"

const CERT_ID = GROWTH_DATAMOON_AUTONOMOUS_BROAD_PROVIDER_DISCOVERY_1A_QA_MARKER
const ROOT = process.cwd()
const GENERATED_AT = "2026-07-27T22:30:00.000Z"
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
  const sliceSource = readSource("lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a.ts")

  assert.match(prepareSource, /isAutonomousBroadProviderDiscoveryRequest/)
  assert.match(projectionSource, /autonomousBroadProviderDiscovery: true/)
  assert.match(projectionSource, /discoveryQualificationContext/)
  assert.match(sliceSource, /zero_provider_results/)
  console.log("  ✓ Architecture guard — broad provider path wired")

  const profile = buildLive1bEquipifyCompanyProfileContent()
  const searchSlice = {
    qaMarker: GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_1A_QA_MARKER,
    sliceKey: SLICE_KEY,
    clusterId: "commercial_kitchen_fleet",
    clusterRotationIndex: 0,
    geoBucketId: "us_midwest",
    geoBucketLabel: "US Midwest",
    stateCodes: ["OH", "IN", "IL"],
    topicVariantIndex: 2,
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
  assert.equal(projection.request.workbench_context?.autonomousBroadProviderDiscovery, true)
  assert.ok(projection.request.workbench_context?.discoveryQualificationContext?.topicPhrases?.length)
  assert.ok(projection.request.workbench_context?.providerDiscoveryConcept)

  const stateOrQualification = projection.request.filters.filter((row) =>
    (AUTONOMOUS_BROAD_PROVIDER_QUALIFICATION_FILTER_FIELDS as readonly string[]).includes(row.field),
  )
  assert.equal(stateOrQualification.length, 0, "projection must not include qualification provider filters")
  assert.ok(
    projection.request.filters.some((row) => row.field === "country" && row.value === "US"),
  )
  console.log("  ✓ Autonomous projection is US-wide with one broad discovery concept")

  const prepared = await prepareDatamoonAudienceImportRequestForBuild(projection.request, {
    env: { ...process.env, DATAMOON_DRY_RUN_ONLY: "true" },
  })
  assert.equal(prepared.ok, true)
  if (!prepared.ok) throw new Error("prepare_failed")
  assert.equal(prepared.request.audience_type, "b2b")
  assert.ok((prepared.request.topic_ids?.length ?? 0) >= 1)
  const providerFields = prepared.request.filters.map((row) => row.field)
  assert.deepEqual(providerFields, ["contact_country"])
  assert.equal(prepared.request.filters[0]?.value, "US")
  assert.equal(prepared.request.filters.some((row) => row.field === "score_category"), false)
  assert.equal(prepared.request.filters.some((row) => row.field === "event_date"), false)
  assert.equal(prepared.request.filters.some((row) => row.field === "job_title"), false)
  console.log("  ✓ Prepare resolves broad b2b topic signal without qualification intent filters")

  const manualBroad = stripAutonomousBroadProviderQualificationFromRequest({
    audience_type: "b2b",
    filters: [
      { field: "personal_state", operator: "in", value: ["OH"] },
      { field: "score_category", operator: "in", value: ["high"] },
      { field: "job_title", operator: "in", value: ["CEO"] },
    ],
    topic_ids: ["123"],
    workbench_context: {
      topics: ["commercial kitchen equipment service"],
      intentLevels: ["high"],
      lookbackDays: 7,
      autonomousBroadProviderDiscovery: true,
    },
    run_name: "test",
    provider_mode: "module",
  })
  assert.equal(isAutonomousBroadProviderDiscoveryRequest(manualBroad), true)
  assert.equal(manualBroad.workbench_context?.topics?.[0], "commercial kitchen equipment service")
  assert.equal(manualBroad.topic_ids, undefined)
  console.log("  ✓ Broad provider prep strips legacy qualification filters but keeps discovery concept")

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
  assert.equal(survivor.diagnostics.autonomous_portfolio_discovery_deferred, true)
  console.log("  ✓ Post-provider filters defer industry/geography for GPT admission")

  let sliceState = emptyDatamoonDiscoverySearchSliceState()
  sliceState.currentSliceKey = SLICE_KEY
  sliceState = recordDatamoonDiscoverySearchSliceOutcome({
    state: sliceState,
    selection: {
      sliceKey: SLICE_KEY,
      clusterId: "commercial_kitchen_fleet",
      geoBucketId: "us_midwest",
      topicVariantIndex: 2,
    },
    generatedAt: GENERATED_AT,
    selectedCount: 0,
    pushedCount: 0,
    existingCount: 0,
    rawCompanyCount: 0,
    normalizedCompanyCount: 0,
  })
  assert.equal(sliceState.slices[SLICE_KEY]?.lastOutcomeKind, "zero_provider_results")
  assert.ok(sliceState.slices[SLICE_KEY]?.exhaustedUntil)

  const nextSlice = selectNextDatamoonDiscoverySearchSlice({
    projection: projectApprovedBusinessProfileToLeadDiscovery(profile, "Equipify"),
    state: sliceState,
    generatedAt: GENERATED_AT,
  })
  assert.notEqual(nextSlice.sliceKey, SLICE_KEY)
  assert.equal(nextSlice.topicVariantIndex, 0)
  console.log("  ✓ Zero provider results exhaust slice and rotate to a different concept")

  assert.ok(
    readSource("lib/growth/prospect-search/prospect-search-external-filters.ts").includes(
      GROWTH_AUTONOMOUS_PORTFOLIO_EXTERNAL_DISCOVERY_DEFERRAL_1A_QA_MARKER,
    ),
  )
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
