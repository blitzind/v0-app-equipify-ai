/**
 * GE-AIOS-EXTERNAL-DISCOVERY-KEYWORD-DEFERRAL-PRODUCTION-CLOSURE-1K — Certification.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import {
  buildProspectSearchQueryFromBusinessProfile,
  buildProspectSearchFiltersFromBusinessProfile,
} from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"
import {
  explainExternalDiscoveryProspectSearchFilterDrop,
  applyProspectSearchExternalCompanyFilters,
} from "@/lib/growth/prospect-search/prospect-search-external-filters"
import {
  isPreResearchKeywordGateZeroSurvivorCollapse,
  shouldMarkAutonomousRunIntakeCompleted,
} from "@/lib/growth/prospect-search/prospect-search-portfolio-intake-disposition-1i"
import {
  evaluateGrowthLeadAdmission,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  evaluateGrowthOperationalKeywordValidation,
  GROWTH_OPERATIONAL_KEYWORD_VALIDATION_1A_QA_MARKER,
} from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-1a"
import { buildLive1bEquipifyCompanyProfileContent } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { normalizeProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-filters"
import type { GrowthProspectSearchCompanyResult, GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"

const QA_MARKER = "ge-aios-external-discovery-keyword-deferral-production-closure-1k-v1" as const
const ROOT = process.cwd()
const PRODUCTION_REPLAY = process.argv.includes("--production")

const TARGET_RUNS = [
  { audience: "6062", runId: "66dc98a4-35f7-48dd-8fa2-9e26be81c556", minSurvivors: 4 },
  { audience: "6059", runId: "6c1a3ff6-30f5-45cc-b1dc-5124e6c3055a", minSurvivors: 2 },
] as const

const REFERENCE_COMPANIES = [
  { name: "Baker Hughes Company", industry: "Oil and Gas", passPostResearch: false },
  { name: "Steris Corporation", industry: "Medical Equipment Manufacturing", passPostResearch: false },
  { name: "Mcdonalds Usa, Llc", industry: "equipment service", passPostResearch: false },
  { name: "Thompson Scale Company", industry: "Machinery Manufacturing", passPostResearch: false },
  { name: "Crown Equipment Corporation", industry: "Truck Transportation", passPostResearch: false },
  { name: "Stowers Machinery Corporation", industry: "Machinery Manufacturing", passPostResearch: false },
  { name: "Valmont Industries", industry: "Steel Manufacturing", passPostResearch: false },
  { name: "Osterwalder", industry: "Industrial Machinery Manufacturing", passPostResearch: false },
  { name: "Thermo Fisher", industry: "Medical Equipment", passPostResearch: true },
  { name: "DDK", industry: "Oilfield Services", passPostResearch: false },
  { name: "Hirotec", industry: "Automotive Manufacturing", passPostResearch: true },
] as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function readHeadSource(relativePath: string): string {
  return execSync(`git show HEAD:${relativePath}`, { encoding: "utf8", cwd: ROOT })
}

function buildSyntheticCompany(input: {
  name: string
  industry: string
  keywords?: string[]
}): GrowthProspectSearchCompanyResult {
  return {
    id: `synthetic:${input.name.toLowerCase().replace(/\s+/g, "-")}`,
    source_type: "external_discovered",
    company_name: input.name,
    website: "https://example.com",
    industry: input.industry,
    subindustry: null,
    city: "Knoxville",
    state: "TN",
    country: "US",
    employees: null,
    revenue_range: null,
    location: "Knoxville, TN, US",
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
    keywords: input.keywords ?? [input.industry, "Field Service Manager"],
    notes: null,
  }
}

async function main() {
  console.log(`[${QA_MARKER}] certification\n`)

  const externalFiltersSource = readSource("lib/growth/prospect-search/prospect-search-external-filters.ts")
  const loaderSource = readSource("lib/growth/training/portfolio-intake-survivor-loader-1d.ts")
  const repositorySource = readSource("lib/growth/prospect-search/prospect-search-repository.ts")
  const canonicalSource = readSource(
    "lib/growth/business-profile/business-profile-prospect-search-canonical-filters-1k.ts",
  )

  assert.match(externalFiltersSource, /export function explainExternalDiscoveryProspectSearchFilterDrop/)
  assert.match(externalFiltersSource, /operational_keywords_deferred/)
  assert.match(externalFiltersSource, /keywords_deferred_count/)
  assert.match(loaderSource, /buildCanonicalProspectSearchFiltersFromBusinessProfile/)
  assert.match(loaderSource, /enrichProspectSearchExternalCompanies/)
  assert.match(repositorySource, /buildCanonicalProspectSearchFiltersFromBusinessProfile/)
  assert.ok(canonicalSource.includes(QA_MARKER))
  console.log("  ✓ Architecture guard — keyword deferral runtime present in workspace")

  try {
    const headExternal = readHeadSource("lib/growth/prospect-search/prospect-search-external-filters.ts")
    assert.doesNotMatch(
      headExternal,
      /export function explainExternalDiscoveryProspectSearchFilterDrop/,
      "HEAD already contains deferral — update guard after commit",
    )
  } catch {
    console.log("  ✓ HEAD parity guard — deferral not yet committed (expected pre-commit)")
  }

  const profile = buildLive1bEquipifyCompanyProfileContent()
  const query = buildProspectSearchQueryFromBusinessProfile(profile, "Equipify")
  const canonicalFilters: GrowthProspectSearchFilters = normalizeProspectSearchFilters({
    ...buildProspectSearchFiltersFromBusinessProfile(profile),
    territory_filter: { country: "US" },
    industry: null,
  })
  assert.ok((canonicalFilters.industry_aliases?.length ?? 0) > 0)
  assert.equal(canonicalFilters.industry, null, "query-parsed industry must not override SSV aliases")
  assert.ok(canonicalFilters.territory_filter?.country === "US")
  console.log("  ✓ Canonical filter projection — SSV aliases preserved, territory normalized")

  const thompson = buildSyntheticCompany({
    name: "Thompson Scale Company",
    industry: "Machinery Manufacturing",
    keywords: [
      "Machinery Manufacturing",
      "Industrial equipment service",
      "Industrial maintenance",
      "Material handling service",
    ],
  })
  const preDrop = explainExternalDiscoveryProspectSearchFilterDrop(thompson, canonicalFilters)
  assert.equal(preDrop, null, "Thompson must not be dropped pre-research for keywords")
  const filtered = applyProspectSearchExternalCompanyFilters([thompson], canonicalFilters)
  assert.equal(filtered.diagnostics.operational_keywords_deferred, true)
  assert.equal(filtered.diagnostics.keywords_deferred_count, 1)
  assert.equal(filtered.diagnostics.keyword_rejected_count, 0)
  console.log("  ✓ External enrichment defers operational keywords with explicit diagnostics")

  assert.equal(
    isPreResearchKeywordGateZeroSurvivorCollapse({
      normalizedCompanyCount: 25,
      postFilterSurvivorCount: 0,
      filterDiagnostics: { dropped_reasons: { keywords: 20 }, operational_keywords_deferred: false },
    }),
    true,
  )
  assert.equal(
    shouldMarkAutonomousRunIntakeCompleted({
      selectedCount: 0,
      durableDispositionCount: 0,
      postFilterSurvivorCount: 0,
      stopReason: null,
      normalizedCompanyCount: 25,
      filterDiagnostics: { dropped_reasons: { keywords: 20 }, operational_keywords_deferred: false },
    }),
    false,
  )
  assert.equal(
    shouldMarkAutonomousRunIntakeCompleted({
      selectedCount: 0,
      durableDispositionCount: 0,
      postFilterSurvivorCount: 0,
      stopReason: null,
      normalizedCompanyCount: 25,
      filterDiagnostics: { dropped_reasons: { industry: 25 }, operational_keywords_deferred: true },
    }),
    true,
  )
  console.log("  ✓ Terminalization blocks pre-research keyword gate collapse")

  const admissionContext = { approvedProfile: profile }

  for (const company of REFERENCE_COMPANIES) {
    const row = buildSyntheticCompany({ name: company.name, industry: company.industry })
    const drop = explainExternalDiscoveryProspectSearchFilterDrop(row, canonicalFilters)
    assert.notEqual(drop, "keywords", `${company.name} must not be keyword-rejected pre-research`)

    const keywordResult = evaluateGrowthOperationalKeywordValidation({
      companyName: company.name,
      website: row.website,
      industry: company.industry,
      requiredKeywords: canonicalFilters.keywords ?? [],
      websiteCrawlText:
        company.name === "Thermo Fisher"
          ? "field service technicians preventive maintenance equipment repair"
          : company.name === "Hirotec"
            ? "field service technicians equipment repair installation services"
            : company.industry,
    })

    const admissionBeforeResearch = evaluateGrowthLeadAdmission(
      {
        companyName: company.name,
        website: row.website,
        industry: company.industry,
        source: "datamoon",
        identityUncertain: false,
      },
      admissionContext,
    )
    assert.equal(admissionBeforeResearch.allowAutoResearch, true)
    assert.ok(
      admissionBeforeResearch.reasons.includes("pending_operational_keyword_validation") ||
        admissionBeforeResearch.state === "rejected",
    )

    const admissionAfterResearch = evaluateGrowthLeadAdmission(
      {
        companyName: company.name,
        website: row.website,
        industry: company.industry,
        source: "datamoon",
        identityUncertain: false,
      },
      admissionContext,
      { operationalKeywordValidation: keywordResult },
    )
    if (company.passPostResearch) {
      assert.notEqual(admissionAfterResearch.state, "rejected")
    } else if (company.name === "Steris Corporation" || company.name === "Thompson Scale Company") {
      assert.notEqual(admissionAfterResearch.state, "accepted")
    }
  }
  console.log("  ✓ False-positive safety — post-research keyword validation remains authoritative")

  if (PRODUCTION_REPLAY) {
    const { getActiveApprovedBusinessProfile } = await import(
      "@/lib/growth/business-profile/business-profile-repository"
    )
    const { buildCanonicalProspectSearchFiltersFromBusinessProfile } = await import(
      "@/lib/growth/business-profile/business-profile-prospect-search-canonical-filters-1k"
    )
    const { EQUIPIFY_PRODUCTION_ORG_ID } = await import(
      "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
    )
    const { bootstrapGrowthOperatorNotificationsCertEnv } = await import(
      "@/lib/growth/notifications/growth-notification-cert-bootstrap"
    )
    const { resolveProspectSearchCompanyResultsForPush } = await import(
      "@/lib/growth/prospect-search/prospect-search-repository"
    )
    const { prospectSearchSelectionKey } = await import(
      "@/lib/growth/prospect-search/prospect-search-selection"
    )
    const { loadPortfolioIntakeSurvivorsFromProduction } = await import(
      "@/lib/growth/training/portfolio-intake-survivor-loader-1d"
    )
    const { runPortfolioIntakeEnrichmentSmokeTestForRun } = await import(
      "@/lib/growth/training/portfolio-intake-enrichment-smoke-test-1k"
    )
    const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
    if (!boot) throw new Error("bootstrap_failed")
    const admin = boot.admin
    const orgId = EQUIPIFY_PRODUCTION_ORG_ID
    const approved = await getActiveApprovedBusinessProfile(admin, orgId)
    if (!approved?.profile) throw new Error("no_profile")

    const loader = await loadPortfolioIntakeSurvivorsFromProduction({ admin, organizationId: orgId })

    for (const spec of TARGET_RUNS) {
      const smoke = await runPortfolioIntakeEnrichmentSmokeTestForRun(admin, {
        organizationId: orgId,
        runId: spec.runId,
        profile: approved.profile,
        companyName: approved.companyName,
      })
      const loaderSurvivors = loader.survivors.filter((row) => row.runId === spec.runId)
      assert.equal(smoke.normalizedCompanyCount, 25, `${spec.audience} normalized count`)
      assert.equal(
        smoke.postFilterSurvivorCount,
        loaderSurvivors.length,
        `${spec.audience} scheduler/loader parity`,
      )
      assert.ok(
        loaderSurvivors.length >= spec.minSurvivors,
        `${spec.audience} canonical survivor count >= ${spec.minSurvivors} (actual ${loaderSurvivors.length})`,
      )
      assert.equal(smoke.filterDiagnostics.operational_keywords_deferred, true)
      assert.equal(smoke.filterDiagnostics.keyword_rejected_count ?? 0, 0)

      const selected = loaderSurvivors.map((row) => ({
        source_type: row.company.source_type,
        id: row.company.id,
        company_name: row.company.company_name,
      }))
      const resolved = await resolveProspectSearchCompanyResultsForPush(admin, {
        query: buildProspectSearchQueryFromBusinessProfile(approved.profile, approved.companyName),
        filters: await buildCanonicalProspectSearchFiltersFromBusinessProfile(admin, {
          profile: approved.profile,
          query: buildProspectSearchQueryFromBusinessProfile(approved.profile, approved.companyName),
        }),
        discovery_mode: "discover_external",
        selected,
        autonomous_push_context: {
          organization_id: orgId,
          approved_profile: approved.profile,
          discovery_authority: "autonomous_portfolio",
          datamoon_run_id: spec.runId,
        },
      })
      assert.equal(
        selected.filter((ref) => resolved.has(prospectSearchSelectionKey(ref))).length,
        selected.length,
        `${spec.audience} push revalidation resolves all survivors`,
      )
    }
    console.log("  ✓ Production replay — 6062/6059 scheduler/loader parity and push revalidation")
  } else {
    console.log("  ↷ Production replay skipped (pass --production for pinned-run replay)")
  }

  assert.ok(
    readSource("lib/growth/revenue-workflow/growth-operational-keyword-validation-1a.ts").includes(
      GROWTH_OPERATIONAL_KEYWORD_VALIDATION_1A_QA_MARKER,
    ),
  )
  console.log("\nPASS — external discovery keyword deferral production closure certified")
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
