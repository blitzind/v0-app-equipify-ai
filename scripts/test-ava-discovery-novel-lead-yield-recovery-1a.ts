/**
 * AVA-DISCOVERY-NOVEL-LEAD-YIELD-RECOVERY-1A — Certification + production replay proof.
 *
 *   pnpm test:ava-discovery-novel-lead-yield-recovery-1a
 *   pnpm test:ava-discovery-novel-lead-yield-recovery-1a --production-replay
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildProspectSearchFiltersFromBusinessProfile,
  buildProspectSearchQueryFromBusinessProfile,
} from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"
import { buildCanonicalProspectSearchFiltersFromBusinessProfile } from "@/lib/growth/business-profile/business-profile-prospect-search-canonical-filters-1k"
import { buildLive1bEquipifyCompanyProfileContent } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { projectApprovedBusinessProfileToLeadDiscovery } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import { buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile } from "@/lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a"
import { loadDatamoonRunProspectCompaniesForPushRevalidation } from "@/lib/growth/prospect-search/prospect-search-datamoon-discovery-1a"
import {
  applyProspectSearchExternalCompanyFilters,
  buildAutonomousPortfolioExternalDiscoveryFilters,
  GROWTH_AUTONOMOUS_PORTFOLIO_EXTERNAL_DISCOVERY_DEFERRAL_1A_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-external-filters"
import { enrichProspectSearchExternalCompanies } from "@/lib/growth/prospect-search/prospect-search-external-enrichment"
import { parseProspectSearchQuery } from "@/lib/growth/prospect-search/prospect-search-query-parser"
import { checkLeadInboxDuplicate } from "@/lib/growth/lead-inbox/lead-inbox-dedupe"
import { prospectSearchDedupeHash } from "@/lib/growth/prospect-search/prospect-search-index"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

const QA_MARKER = GROWTH_AUTONOMOUS_PORTFOLIO_EXTERNAL_DISCOVERY_DEFERRAL_1A_QA_MARKER
const ROOT = process.cwd()
const PRODUCTION_REPLAY = process.argv.includes("--production-replay")
const DUPLICATE_RUN_ID = "192a7ced-a1a3-4b50-a33e-a277f79c680e"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function buildSyntheticCompany(input: {
  name: string
  industry: string
  state?: string
}): GrowthProspectSearchCompanyResult {
  return {
    id: `synthetic:${input.name.toLowerCase().replace(/\s+/g, "-")}`,
    source_type: "external_discovered",
    company_name: input.name,
    website: `https://${input.name.toLowerCase().replace(/\s+/g, "")}.example`,
    industry: input.industry,
    subindustry: null,
    city: "Chicago",
    state: input.state ?? "IL",
    country: "US",
    employees: null,
    revenue_range: null,
    location: `${input.state ?? "IL"}, US`,
    intent_score: null,
    buying_stage: null,
    lead_score: null,
    confidence: 0.5,
    company_match_confidence: null,
    decision_maker_coverage: null,
    verification_status: "external_unverified",
    signals: ["Discovered via DataMoon audience search"],
    search_intent_category: null,
    growth_lead_id: null,
    prospect_id: null,
    customer_id: null,
    rank_score: 0.5,
    match_reasoning: ["Discovered via DataMoon — routed through canonical Prospect Search."],
    discovery_provider_type: "datamoon",
    discovery_provider_name: "DataMoon",
    discovery_source_badge: "DataMoon",
    keywords: [input.industry],
    notes: null,
  }
}

async function main() {
  console.log(`[${QA_MARKER}] certification\n`)

  const externalSource = readSource("lib/growth/prospect-search/prospect-search-external-filters.ts")
  const enrichmentSource = readSource("lib/growth/prospect-search/prospect-search-external-enrichment.ts")
  const projectionSource = readSource(
    "lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a.ts",
  )
  const targetingSource = readSource("lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a.ts")

  assert.match(externalSource, /buildAutonomousPortfolioExternalDiscoveryFilters/)
  assert.match(externalSource, /autonomous_portfolio_discovery_deferred/)
  assert.match(enrichmentSource, /discovery_authority/)
  assert.match(enrichmentSource, /autonomous_portfolio_discovery/)
  assert.match(projectionSource, /autonomousBroadProviderDiscovery/)
  assert.match(projectionSource, /providerDiscoveryConcept/)
  assert.doesNotMatch(projectionSource, /field: "state"/)
  console.log("  ✓ Architecture guard — broad provider discovery + deferred qualification")

  const profile = buildLive1bEquipifyCompanyProfileContent()
  const canonicalFilters = buildProspectSearchFiltersFromBusinessProfile(profile)
  const deferred = buildAutonomousPortfolioExternalDiscoveryFilters(canonicalFilters)
  assert.equal(deferred.industry, null)
  assert.equal(deferred.location, null)
  assert.equal(deferred.industry_aliases, undefined)
  assert.equal(deferred.territory_id, null)
  console.log("  ✓ Autonomous portfolio filters defer industry + geography")

  const nonIcp = buildSyntheticCompany({
    name: "Baker Hughes Company",
    industry: "Oil and Gas",
    state: "TX",
  })
  const strict = applyProspectSearchExternalCompanyFilters([nonIcp], canonicalFilters)
  const autonomous = applyProspectSearchExternalCompanyFilters([nonIcp], canonicalFilters, {
    autonomous_portfolio_discovery: true,
  })
  assert.equal(strict.companies.length, 0, "strict industry aliases should drop non-ICP oil & gas")
  assert.equal(autonomous.companies.length, 1, "autonomous discovery should defer industry gate")
  assert.equal(autonomous.diagnostics.autonomous_portfolio_discovery_deferred, true)
  assert.equal(autonomous.diagnostics.industry_deferred_count, 1)
  console.log("  ✓ Industry deferral keeps provider candidates for GPT admission")

  const slicedRequest = buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
    profile,
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    batchSize: 25,
    generatedAt: new Date().toISOString(),
    searchSlice: {
      qaMarker: "ava-discovery-search-diversity-and-exhaustion-1a-v1",
      sliceKey: "commercial_kitchen_fleet:us_midwest",
      clusterId: "commercial_kitchen_fleet",
      clusterRotationIndex: 0,
      geoBucketId: "us_midwest",
      geoBucketLabel: "US Midwest",
      stateCodes: ["OH", "IN", "IL"],
      topicVariantIndex: 0,
      selectionReason: "test",
      resumedSlice: false,
      advancedTopicVariant: false,
      rotatedFromSliceKey: null,
    },
  })
  const stateFilters = slicedRequest.request.filters.filter(
    (row) => row.field === "state" || row.field === "personal_state",
  )
  assert.equal(stateFilters.length, 0, "slice rotation must not send state filters to DataMoon")
  assert.ok(
    slicedRequest.request.filters.some(
      (row) => row.field === "country" && row.value === "United States",
    ),
  )
  assert.equal(slicedRequest.request.workbench_context?.topics?.length, 1)
  assert.ok(slicedRequest.request.workbench_context?.providerDiscoveryConcept)
  console.log("  ✓ Sliced provider request is US-wide with one broad discovery concept")

  if (PRODUCTION_REPLAY) {
    process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = "1"
    const cert = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: false })
    if (!cert?.admin) throw new Error("production_admin_unavailable")
    const admin = cert.admin
    const orgId = EQUIPIFY_PRODUCTION_ORG_ID
    const query = buildProspectSearchQueryFromBusinessProfile(profile, "Equipify")
    const parsed = parseProspectSearchQuery(query)
    const schedulerFilters = await buildCanonicalProspectSearchFiltersFromBusinessProfile(admin, {
      profile,
      query,
    })
    const reloaded = await loadDatamoonRunProspectCompaniesForPushRevalidation(admin, {
      organizationId: orgId,
      datamoonRunId: DUPLICATE_RUN_ID,
      filters: schedulerFilters,
    })
    if (!reloaded) throw new Error("duplicate_run_not_found")
    const before = applyProspectSearchExternalCompanyFilters(reloaded.companies, schedulerFilters)
    const afterEnriched = await enrichProspectSearchExternalCompanies(admin, reloaded.companies, {
      query,
      filters: schedulerFilters,
      parsed,
      discovery_authority: "autonomous_portfolio",
    })

    let novelSimulated = 0
    const novelSamples: Array<{ company: string; website: string | null }> = []
    for (const company of afterEnriched.companies.slice(0, 25)) {
      const dedupe_hash = prospectSearchDedupeHash([
        "prospect_search",
        company.source_type,
        company.id,
        company.website ?? "",
      ])
      const duplicate = await checkLeadInboxDuplicate(admin, {
        dedupe_hash,
        intent_session_id: `prospect-search-${company.id}`,
        domain: company.website,
      })
      if (!duplicate.is_duplicate) {
        novelSimulated += 1
        novelSamples.push({
          company: company.company_name ?? "unknown",
          website: company.website ?? null,
        })
      }
    }

    console.log(
      JSON.stringify(
        {
          qaMarker: QA_MARKER,
          duplicateRunId: DUPLICATE_RUN_ID,
          normalizedCompanies: reloaded.companies.length,
          strictSurvivors: before.companies.length,
          strictDroppedReasons: before.diagnostics.dropped_reasons,
          autonomousSurvivors: afterEnriched.companies.length,
          autonomousDiagnostics: afterEnriched.filter_diagnostics,
          novelSimulated,
          novelSamples: novelSamples.slice(0, 5),
        },
        null,
        2,
      ),
    )

    assert.ok(
      afterEnriched.companies.length > before.companies.length,
      "autonomous deferral must increase survivors on duplicate-exhaustion run",
    )
    assert.ok(
      afterEnriched.companies.length >= 10,
      "192a7ced replay should retain most normalized companies after deferral",
    )
    console.log("  ✓ Production replay — duplicate run survivor count increased")
  } else {
    console.log("  ○ Production replay skipped (pass --production-replay)")
  }

  console.log(`\n[${QA_MARKER}] PASS`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
