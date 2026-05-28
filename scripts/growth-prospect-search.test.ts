/**
 * Regression checks for Prospect Search + ICP Builder (Prompt 23).
 * Run: pnpm test:growth-prospect-search
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { sanitizeGrowthAdminUiError } from "../lib/growth/admin-route-runtime-types"
import {
  GROWTH_PROSPECT_SEARCH_RUNTIME_FIX_QA_MARKER,
  resolveProspectSearchDiscoveryMode,
} from "../lib/growth/prospect-search/prospect-search-runtime"
import {
  applyProspectSearchFilters,
  explainProspectSearchFilterDrop,
  filterProspectPeopleByTitle,
  inferEmployeeSizeBand,
  normalizeProspectSearchFilters,
} from "../lib/growth/prospect-search/prospect-search-filters"
import {
  buildLiveProviderDiscoveryQueries,
  buildLiveProviderFallbackQueries,
  GROWTH_LIVE_PROVIDER_QUERY_EXPANSION_QA_MARKER,
  liveProviderIcpInputs,
} from "../lib/growth/real-world-discovery/live-provider-query-expansion"
import {
  mergeParsedQueryIntoFilters,
  parseProspectSearchQuery,
} from "../lib/growth/prospect-search/prospect-search-query-parser"
import {
  createFutureApolloProspectSearchProvider,
  createInternalProspectSearchProvider,
  GROWTH_PROSPECT_SEARCH_PROVIDER_QA_MARKER,
} from "../lib/growth/prospect-search/prospect-search-provider"
import { rankProspectSearchCompanies } from "../lib/growth/prospect-search/prospect-search-ranking"
import {
  GROWTH_PROSPECT_SEARCH_INTERNAL_SIGNAL_HYDRATION_QA_MARKER,
  hydrateInternalCompanySignals,
  hasDisplayableCompanySignalSummary,
} from "../lib/growth/prospect-search/internal-company-signal-hydration"
import {
  GROWTH_PROSPECT_SEARCH_INDEX_ENRICHMENT_QA_MARKER,
  mapCrmCustomerIndexEnrichment,
  mapCrmProspectIndexEnrichment,
  mapGrowthLeadIndexEnrichment,
  mapLeadInboxIndexEnrichment,
  pickWebsitePlatformFromTechnologies,
} from "../lib/growth/prospect-search/prospect-search-index-enrichment"
import {
  GROWTH_PROSPECT_SEARCH_DISCOVERY_MODES,
  GROWTH_PROSPECT_SEARCH_QA_MARKER,
  GROWTH_PROSPECT_SEARCH_RESULT_ACTIONS,
  GROWTH_PROSPECT_SEARCH_SOURCE_TYPES,
  GROWTH_LIVE_PROVIDER_QUERY_EXPANSION_QA_MARKER as GROWTH_LIVE_PROVIDER_QUERY_EXPANSION_QA_MARKER_TYPE,
} from "../lib/growth/prospect-search/prospect-search-types"
import {
  GROWTH_TITLE_TARGETING_SMART_QA_MARKER,
  getIndustryTitleRecommendations,
} from "../lib/growth/prospect-search/title-industry-mapping"
import {
  GROWTH_PROSPECT_SEARCH_QUALIFICATION_QA_MARKER,
  applyProspectSearchQualificationToIndexRow,
  extractBuyingStageFromMetadata,
  extractLeadEngineScoreOverlay,
  resolveProspectSearchQualificationFields,
} from "../lib/growth/prospect-search/prospect-search-qualification-overlays"
import {
  GROWTH_PROSPECT_SEARCH_LEAD_ENGINE_HANDOFF_QA_MARKER,
  buildProspectSearchLeadEngineHandoffUrl,
  parseProspectSearchLeadEngineHandoffParams,
} from "../lib/growth/prospect-search/prospect-search-lead-engine-handoff"
import { GROWTH_LEAD_ENGINE_RUN_METADATA_KEY } from "../lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import {
  GROWTH_PROSPECT_SEARCH_BULK_PUSH_QA_MARKER,
  buildProspectSearchPushMetadata,
  formatBulkPushSummary,
} from "../lib/growth/prospect-search/prospect-search-push-metadata"
import {
  buildProspectSearchGetRequestParams,
  compactProspectSearchFiltersForTransport,
} from "../lib/growth/prospect-search/prospect-search-client-request"
import { prospectSearchSelectionKey } from "../lib/growth/prospect-search/prospect-search-selection"
import {
  parseTitleChips,
  serializeTitleChips,
  suggestTitles,
} from "../lib/growth/prospect-search/title-suggestion-engine"

async function main(): Promise<void> {
  assert.equal(GROWTH_PROSPECT_SEARCH_QA_MARKER, "growth-prospect-search-v1")
  assert.ok(GROWTH_PROSPECT_SEARCH_SOURCE_TYPES.includes("external_discovered"))
  assert.ok(GROWTH_PROSPECT_SEARCH_DISCOVERY_MODES.includes("discover_external"))
  assert.ok(GROWTH_PROSPECT_SEARCH_RESULT_ACTIONS.includes("export_csv"))
  assert.ok(GROWTH_PROSPECT_SEARCH_RESULT_ACTIONS.includes("push_to_lead_inbox"))
  assert.ok(GROWTH_PROSPECT_SEARCH_RESULT_ACTIONS.includes("bulk_push_to_lead_inbox"))

  const migration = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20270321120000_growth_engine_prospect_search.sql",
    ),
    "utf8",
  )
  assert.match(migration, /growth\.prospect_search_saved_searches/)
  assert.match(migration, /growth\.prospect_search_lists/)
  assert.match(migration, /growth\.prospect_search_list_members/)

  const indexSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-index.ts"),
    "utf8",
  )
  assert.match(indexSource, /growth\.leads/)
  assert.match(indexSource, /growth\.lead_inbox/)
  assert.match(indexSource, /search_intent_signals/)
  assert.doesNotMatch(indexSource, /scrape|outbound|apollo\.io/)
  assert.match(indexSource, /hydrateInternalCompanySignals/)
  assert.match(indexSource, /applyInternalSignalHydration/)
  assert.match(indexSource, /mapGrowthLeadIndexEnrichment/)
  assert.match(indexSource, /loadProspectResearchOverlays/)
  assert.match(indexSource, /loadCustomerDefaultLocations/)
  assert.equal(
    GROWTH_PROSPECT_SEARCH_INDEX_ENRICHMENT_QA_MARKER,
    "growth-prospect-search-index-enrichment-v1",
  )

  const actionsSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-actions.ts"),
    "utf8",
  )
  assert.match(actionsSource, /pushProspectSearchCompanyToLeadInbox/)
  assert.match(actionsSource, /executeBulkPushToLeadInbox/)
  assert.match(actionsSource, /bulk_push_to_lead_inbox/)
  assert.doesNotMatch(actionsSource, /sendEmail|executePipeline/)

  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app/(admin)/admin/growth/search/page.tsx"),
    "utf8",
  )
  assert.match(pageSource, /GrowthProspectSearchAdmin/)
  assert.match(pageSource, /Prospect Search/)
  assert.doesNotMatch(pageSource, /GROWTH_PROSPECT_SEARCH_UX_QA_MARKER/)
  assert.doesNotMatch(pageSource, /growth-prospect-search-ux-v1/)

  const shellSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-shell.tsx"),
    "utf8",
  )
  assert.match(shellSource, /ProspectSearchShell/)
  assert.match(shellSource, /GROWTH_PROSPECT_SEARCH_QA_MARKER/)
  assert.match(shellSource, /ProspectSearchDiagnosticsDisclosure/)
  assert.match(shellSource, /ProspectSearchCleanStartPanel/)
  assert.match(shellSource, /loadInitialMeta/)
  assert.doesNotMatch(shellSource, /void runSearch\(\)\s*\n\s*\}, \[\]\)/)
  assert.match(shellSource, /data-has-searched-marker/)
  assert.match(shellSource, /GROWTH_SEARCH_HAS_SEARCHED_STATE_QA_MARKER/)
  assert.match(shellSource, /GROWTH_SEARCH_CLEAN_START_QA_MARKER/)
  assert.match(shellSource, /GROWTH_SEARCH_DIAGNOSTICS_HIDDEN_QA_MARKER/)
  assert.doesNotMatch(shellSource, /<ProspectSearchLiveEstimation/)
  assert.doesNotMatch(shellSource, /useProspectSearchLiveEstimation/)
  assert.match(shellSource, /GROWTH_PROSPECT_SEARCH_TRUTHFUL_LIFECYCLE_QA_MARKER/)
  assert.match(shellSource, /GROWTH_PROSPECT_SEARCH_NO_PRESEARCH_COUNTS_QA_MARKER/)
  assert.match(shellSource, /GROWTH_PROSPECT_SEARCH_STAGED_SEARCH_QA_MARKER/)
  assert.match(shellSource, /lastSearchedCriteriaKey/)
  assert.match(shellSource, /currentCriteriaKey/)
  assert.match(shellSource, /fetchAbortRef/)
  assert.match(shellSource, /enabled: hasSearched && !criteriaStale/)
  const providerStatusSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/real-world-provider-status.tsx"),
    "utf8",
  )
  assert.match(providerStatusSource, /data-qa-marker=\{GROWTH_REAL_WORLD_COMPANY_DISCOVERY_QA_MARKER\}/)
  assert.match(providerStatusSource, /GROWTH_GOOGLE_PLACES_QUERY_EXPANSION_QA_MARKER/)
  assert.match(providerStatusSource, /GROWTH_PROVIDER_CACHE_QA_MARKER/)
  assert.match(shellSource, /ProspectSearchFilterRail/)
  assert.match(shellSource, /IcpTemplatesDrawer/)
  assert.match(shellSource, /GROWTH_PROSPECT_SEARCH_LAYOUT_V2_QA_MARKER/)
  assert.match(shellSource, /flex flex-col gap-4/)
  assert.doesNotMatch(shellSource, /lg:grid-cols-2/)
  assert.match(shellSource, /SearchRecommendations/)
  assert.match(shellSource, /CompanyResultCard/)
  assert.doesNotMatch(shellSource, /runLeadEnginePipeline/)
  assert.match(shellSource, /data-ux-marker/)
  assert.match(shellSource, /DiscoveryModeToggle/)
  assert.match(shellSource, /mode.*discover_external|discover_external/)
  assert.match(shellSource, /useSearchParams/)
  assert.match(shellSource, /resolveProspectSearchDiscoveryMode/)
  assert.match(shellSource, /ProspectSearchShellInner/)
  assert.match(shellSource, /Suspense/)
  assert.match(shellSource, /ProspectSearchDiagnosticsDisclosure/)
  const companyCardSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/company-result-card.tsx"),
    "utf8",
  )
  assert.match(companyCardSource, /BuyingCommitteePanel/)
  assert.match(companyCardSource, /CompanyIntelligenceCard/)
  assert.match(companyCardSource, /company_signal_summary/)
  assert.match(companyCardSource, /CompanySignalSummaryPanel/)
  assert.match(companyCardSource, /CompanyEnrichmentBadges/)

  const hydrationSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/internal-company-signal-hydration.ts"),
    "utf8",
  )
  assert.match(hydrationSource, /normalizeDetectedCompanySignals/)
  assert.match(hydrationSource, /buildCompanySignalUiSummary/)
  assert.equal(
    GROWTH_PROSPECT_SEARCH_INTERNAL_SIGNAL_HYDRATION_QA_MARKER,
    "growth-prospect-search-internal-signals-v1",
  )

  const leadHydration = hydrateInternalCompanySignals({
    id: "lead-1",
    source_type: "growth_lead",
    company_name: "Acme Field Service",
    website: "https://acme-hvac.com",
    industry: "HVAC",
    subindustry: null,
    employees: "45",
    revenue_range: "$5m",
    location: "Nashville, TN",
    city: "Nashville",
    state: "TN",
    service_area: "Middle Tennessee",
    notes: "Uses FieldPulse and QuickBooks. Hiring field technicians.",
    crm_detected: "HubSpot",
    website_platform: null,
    field_service_software: "FieldPulse",
    keywords: [],
    signals: [],
  })
  assert.ok(leadHydration)
  assert.ok(leadHydration!.company_signal_summary.technology_signals.length > 0)
  assert.ok(leadHydration!.signal_confidence > 0)
  assert.ok(hasDisplayableCompanySignalSummary(leadHydration!.company_signal_summary, leadHydration!.signal_count))

  const sparseHydration = hydrateInternalCompanySignals({
    id: "cust-1",
    source_type: "crm_customer",
    company_name: "Plain Co",
    website: null,
    industry: null,
    subindustry: null,
    employees: null,
    revenue_range: null,
    location: null,
    city: null,
    state: null,
    service_area: null,
    notes: null,
    crm_detected: null,
    website_platform: null,
    field_service_software: null,
    keywords: [],
    signals: [],
  })
  assert.equal(sparseHydration, null)

  const badgeSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/result-signal-badges.tsx"),
    "utf8",
  )
  assert.match(badgeSource, /companyIntelligenceBadges/)
  assert.match(badgeSource, /inferProspectSearchResultBadges/)

  const growthLeadEnrichment = mapGrowthLeadIndexEnrichment({
    raw: {
      website: "https://acme-hvac.com",
      city: "Nashville",
      state: "TN",
      country: "US",
      notes: "Uses FieldPulse",
      estimated_employee_count: "45",
      estimated_annual_revenue: "$5m",
      crm_detected: "HubSpot",
      field_service_stack_detected: "FieldPulse",
      metadata: { industry: "HVAC", service_area: "Middle Tennessee" },
    },
    research: {
      industry_guess: "HVAC",
      employee_size_guess: "50+ employees",
      revenue_size_guess: "$5m-$10m",
      detected_technologies: ["WordPress", "ServiceTitan"],
    },
  })
  assert.equal(growthLeadEnrichment.industry, "HVAC")
  assert.equal(growthLeadEnrichment.crm_detected, "HubSpot")
  assert.equal(growthLeadEnrichment.field_service_software, "FieldPulse")
  assert.equal(growthLeadEnrichment.website_platform, "WordPress")
  assert.equal(growthLeadEnrichment.service_area, "Middle Tennessee")

  const inboxEnrichment = mapLeadInboxIndexEnrichment({
    raw: {
      domain: "example.com",
      metadata: {
        industry: "Medical Equipment",
        service_area: "Texas",
        crm_detected: "Salesforce",
        website_platform: "WordPress",
      },
    },
  })
  assert.equal(inboxEnrichment.industry, "Medical Equipment")
  assert.equal(inboxEnrichment.crm_detected, "Salesforce")
  assert.equal(inboxEnrichment.website_platform, "WordPress")

  const prospectEnrichment = mapCrmProspectIndexEnrichment({
    raw: {
      website: "https://prospect.example",
      city: "Austin",
      state: "TX",
      notes: "Quoted account",
      estimated_value_cents: 2_500_000,
    },
  })
  assert.equal(prospectEnrichment.website, "https://prospect.example")
  assert.equal(prospectEnrichment.location, "Austin, TX")
  assert.ok(prospectEnrichment.revenue_range)

  const customerEnrichment = mapCrmCustomerIndexEnrichment({
    raw: { notes: "Active service contract" },
    location: { city: "Dallas", state: "TX", postal_code: "75201", address_line1: "100 Main St" },
  })
  assert.equal(customerEnrichment.location, "Dallas, TX")
  assert.equal(pickWebsitePlatformFromTechnologies(["HubSpot", "Google Analytics"]), "HubSpot")

  const techFiltered = applyProspectSearchFilters(
    [
      {
        id: "1",
        source_type: "growth_lead",
        company_name: "Acme HVAC",
        website: null,
        industry: "HVAC",
        subindustry: null,
        employees: "50",
        revenue_range: "$5m",
        location: "Tennessee",
        city: null,
        state: "TN",
        service_area: "Middle Tennessee",
        notes: null,
        keywords: [],
        crm_detected: "HubSpot",
        website_platform: "WordPress",
        field_service_software: "FieldPulse",
        intent_score: 15,
        buying_stage: "consideration",
        lead_score: 40,
        company_match_confidence: 0.7,
        decision_maker_count: 2,
        verification_status: "unverified",
        priority: null,
        signals: [],
        search_intent_category: null,
        returning_visitor: false,
        existing_account: false,
        lead_inbox_id: null,
        growth_lead_id: "1",
        prospect_id: null,
        customer_id: null,
      },
    ],
    normalizeProspectSearchFilters({ technologies: ["FieldPulse"], crm_detected: "HubSpot" }),
  )
  assert.equal(techFiltered.length, 1)

  const sparseCustomer = mapCrmCustomerIndexEnrichment({ raw: { notes: null }, location: null })
  assert.equal(sparseCustomer.location, null)
  assert.equal(sparseCustomer.revenue_range, null)

  const suggestionSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/search-suggestion-engine.ts"),
    "utf8",
  )
  assert.match(suggestionSource, /buildSearchSuggestions/)

  const recSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/search-recommendation-engine.ts"),
    "utf8",
  )
  assert.match(recSource, /buildFilterRecommendations/)
  assert.match(recSource, /Medical Equipment Service/)

  const uxConstants = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-ux-constants.ts"),
    "utf8",
  )
  assert.match(uxConstants, /growth-prospect-search-ux-v1/)
  assert.match(uxConstants, /PROSPECT_SEARCH_ICP_TEMPLATES/)

  const navSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-section-sidebar-nav.tsx"),
    "utf8",
  )
  assert.match(navSource, /GROWTH_NAV_GROUP_DEFS/)
  const navDefsSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts"),
    "utf8",
  )
  assert.match(navDefsSource, /\/admin\/growth\/search/)
  assert.match(navDefsSource, /Prospect Search/)

  const parsed = parseProspectSearchQuery("hvac companies 20-100 employees Tennessee")
  assert.ok(parsed.industry_hints.includes("hvac") || parsed.keywords.length > 0)
  assert.equal(parsed.employee_min, 20)
  assert.equal(parsed.employee_max, 100)
  assert.ok(parsed.location_hints.includes("tennessee"))

  const merged = normalizeProspectSearchFilters(
    mergeParsedQueryIntoFilters(parsed, {}) as Record<string, unknown>,
  )
  assert.ok(merged.location === "tennessee" || merged.keywords?.length)

  assert.equal(inferEmployeeSizeBand("45 staff"), "21-50")

  const filtered = applyProspectSearchFilters(
    [
      {
        id: "1",
        source_type: "growth_lead",
        company_name: "Acme HVAC",
        website: null,
        industry: "HVAC",
        subindustry: null,
        employees: "50",
        revenue_range: null,
        location: "Tennessee",
        city: null,
        state: "TN",
        service_area: null,
        notes: null,
        keywords: [],
        crm_detected: null,
        website_platform: null,
        field_service_software: null,
        intent_score: 15,
        buying_stage: "consideration",
        lead_score: 40,
        company_match_confidence: 0.7,
        decision_maker_count: 2,
        verification_status: "unverified",
        priority: null,
        signals: [],
        search_intent_category: null,
        returning_visitor: false,
        existing_account: false,
        lead_inbox_id: null,
        growth_lead_id: "1",
        prospect_id: null,
        customer_id: null,
      },
    ],
    normalizeProspectSearchFilters({ industry: "hvac", intent_score_min: 10 }),
  )
  assert.equal(filtered.length, 1)

  const ranked = rankProspectSearchCompanies(filtered, "hvac Tennessee", parsed, 10)
  assert.ok(ranked[0]!.rank_score > 0)

  const rankedWithSignals = rankProspectSearchCompanies(
    [
      {
        ...filtered[0]!,
        notes: "FieldPulse dispatch scheduling",
        crm_detected: "HubSpot",
        field_service_software: "FieldPulse",
        website_platform: "WordPress",
        service_area: "Middle Tennessee",
        company_signal_summary: leadHydration!.company_signal_summary,
        signal_confidence: leadHydration!.signal_confidence,
        signal_count: leadHydration!.signal_count,
      },
    ],
    "hvac Tennessee",
    parsed,
    10,
    normalizeProspectSearchFilters({
      industry: "hvac",
      crm_detected: "HubSpot",
      service_area: "Tennessee",
    }),
  )
  assert.ok(rankedWithSignals[0]!.rank_score >= ranked[0]!.rank_score)
  assert.ok(rankedWithSignals[0]!.company_signal_summary)
  assert.ok((rankedWithSignals[0]!.signal_confidence ?? 0) > 0)
  assert.equal(rankedWithSignals[0]!.crm_detected, "HubSpot")
  assert.equal(rankedWithSignals[0]!.service_area, "Middle Tennessee")

  const internal = createInternalProspectSearchProvider()
  assert.equal(internal.slot, "internal_observable_index")
  assert.equal(internal.describe().status, "success")

  const apollo = createFutureApolloProspectSearchProvider()
  assert.equal(apollo.query({ query: "x", filters: {} }).status, "skipped")
  assert.equal(GROWTH_PROSPECT_SEARCH_PROVIDER_QA_MARKER, "growth-prospect-search-provider-v1")

  assert.equal(GROWTH_TITLE_TARGETING_SMART_QA_MARKER, "growth-title-targeting-smart-v1")

  const icpSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/guided-icp-builder.tsx"),
    "utf8",
  )
  assert.match(icpSource, /TitleTargetingCard/)
  assert.match(icpSource, /GROWTH_TITLE_TARGETING_SMART_QA_MARKER|title-targeting-card/)
  assert.match(icpSource, /Account safety/)
  assert.match(icpSource, /Hide suppressed/)

  const titleCardSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/title-targeting-card.tsx"),
    "utf8",
  )
  assert.match(titleCardSource, /GROWTH_TITLE_TARGETING_SMART_QA_MARKER/)
  assert.match(titleCardSource, /data-qa-marker/)

  const medRecs = getIndustryTitleRecommendations("Medical Equipment Service", 10)
  assert.ok(medRecs.includes("Biomedical Manager"))
  assert.ok(medRecs.includes("HTM Director"))
  assert.ok(medRecs.includes("Field Service Manager"))

  const operSuggest = suggestTitles({ query: "oper", limit: 10 }).map((r) => r.title)
  assert.ok(operSuggest.includes("Operations Manager"))
  assert.ok(operSuggest.includes("Director of Operations"))
  assert.ok(operSuggest.includes("Operations Director"))

  const bioSuggest = suggestTitles({ query: "bio", limit: 10 }).map((r) => r.title)
  assert.ok(bioSuggest.includes("Biomedical Manager"))
  assert.ok(bioSuggest.includes("Biomedical Engineer"))

  assert.deepEqual(parseTitleChips("Owner|CEO|Director of Operations"), [
    "Owner",
    "CEO",
    "Director of Operations",
  ])
  assert.equal(
    serializeTitleChips(["Owner", "CEO"]).title_contains,
    "Owner|CEO",
  )

  const titleFiltered = filterProspectPeopleByTitle(
    [
      { title: "CEO", role: "Executive" },
      { title: "Engineer", role: "Staff" },
      { title: "Director of Operations", role: "Operations" },
    ],
    "Owner|CEO|Director of Operations",
    "Owner|CEO|Director of Operations",
  )
  assert.equal(titleFiltered.length, 2)
  assert.ok(titleFiltered.some((p) => p.title === "CEO"))
  assert.ok(titleFiltered.some((p) => p.title === "Director of Operations"))

  assert.equal(
    GROWTH_PROSPECT_SEARCH_QUALIFICATION_QA_MARKER,
    "growth-prospect-search-qualification-v1",
  )
  assert.equal(
    GROWTH_PROSPECT_SEARCH_LEAD_ENGINE_HANDOFF_QA_MARKER,
    "growth-prospect-search-lead-engine-handoff-v1",
  )
  assert.match(indexSource, /applyProspectSearchQualificationToIndexRow/)
  assert.match(indexSource, /buyingStageOverlayFromAssessmentRow/)
  assert.match(actionsSource, /buildProspectSearchLeadEngineHandoffUrl/)
  assert.match(companyCardSource, /CompanyQualificationMetrics/)
  assert.doesNotMatch(companyCardSource, /"—"/)
  assert.match(shellSource, /run_lead_engine/)
  const leadEngineWorkspaceSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-lead-engine-workspace.tsx"),
    "utf8",
  )
  assert.match(leadEngineWorkspaceSource, /parseProspectSearchLeadEngineHandoffParams/)

  const leadEngineRunFixture = {
    run_id: "run-test-1",
    qa_marker: "lead-engine-orchestrator-v1",
    mode: "fixture_dry_run",
    provider_mode: null,
    provider_adapter_qa_marker: null,
    pipeline_status: "completed",
    current_stage: null,
    completed_stages: ["lead_score"],
    failed_stage: null,
    execution_duration_ms: 120,
    pipeline_confidence: 0.82,
    human_review_required: false,
    stage_results: [
      {
        stage_id: "lead_score",
        parse_ok: true,
        parsed: {
          lead_score: 78,
          lead_grade: "B",
          priority_level: "high_priority",
          score_explanation: "Strong ICP fit with field service signals.",
        },
      },
    ],
    pipeline_diagnostics: [],
    pipeline_evidence_chain: [],
    pipeline_attribution_chain: [],
    fatal_errors: [],
    warning_messages: [],
    execution_summary: "Fixture run",
    input: {
      companyName: "Acme HVAC",
      domain: "acme.example",
      industry: "HVAC",
      location: "Tennessee",
      notes: "",
    },
  }

  const engineOverlay = extractLeadEngineScoreOverlay({
    [GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]: leadEngineRunFixture,
    lead_engine_completed_at: "2026-05-01T12:00:00.000Z",
  })
  assert.ok(engineOverlay)
  assert.equal(engineOverlay!.lead_engine_score, 78)
  assert.equal(engineOverlay!.lead_engine_score_label, "Grade B")
  assert.match(engineOverlay!.lead_engine_score_explanation ?? "", /ICP fit/)

  const qualified = resolveProspectSearchQualificationFields(
    { lead_score: 40, buying_stage: null },
    { metadata: { [GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]: leadEngineRunFixture } },
  )
  assert.equal(qualified.lead_score, 78)
  assert.equal(qualified.lead_engine_score, 78)

  const fallback = resolveProspectSearchQualificationFields(
    { lead_score: 40, buying_stage: "consideration" },
    { metadata: {} },
  )
  assert.equal(fallback.lead_score, 40)
  assert.equal(fallback.lead_engine_score, null)

  const buyingMeta = extractBuyingStageFromMetadata({
    buying_stage_summary: {
      detected_stage: "purchase_ready",
      stage_confidence: 0.86,
      stage_reasoning: ["Repeated pricing page visits."],
      assessed_at: "2026-05-02T10:00:00.000Z",
    },
  })
  assert.ok(buyingMeta)
  assert.equal(buyingMeta!.buying_stage, "purchase_ready")
  assert.equal(buyingMeta!.buying_stage_confidence, 0.86)

  const inboxQualified = applyProspectSearchQualificationToIndexRow(
    {
      id: "inbox-1",
      source_type: "lead_inbox",
      company_name: "Acme",
      website: "acme.example",
      industry: "HVAC",
      subindustry: null,
      employees: null,
      revenue_range: null,
      location: "TN",
      city: null,
      state: "TN",
      service_area: null,
      notes: null,
      keywords: [],
      crm_detected: null,
      website_platform: null,
      field_service_software: null,
      intent_score: 18,
      buying_stage: null,
      buying_stage_confidence: null,
      buying_stage_reason: null,
      buying_stage_last_assessed_at: null,
      lead_score: 18,
      lead_engine_score: null,
      lead_engine_score_label: null,
      lead_engine_score_explanation: null,
      lead_engine_last_run_at: null,
      company_match_confidence: 0.82,
      decision_maker_count: 0,
      verification_status: "candidate",
      priority: null,
      signals: [],
      search_intent_category: "pricing",
      returning_visitor: true,
      existing_account: false,
      lead_inbox_id: "inbox-1",
      growth_lead_id: null,
      prospect_id: null,
      customer_id: null,
    },
    {
      metadata: { [GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]: leadEngineRunFixture },
      buyingOverlay: buyingMeta,
    },
  )
  assert.equal(inboxQualified.lead_engine_score, 78)
  assert.equal(inboxQualified.buying_stage, "purchase_ready")

  const handoffUrl = buildProspectSearchLeadEngineHandoffUrl(
    {
      id: "crm-1",
      source_type: "crm_prospect",
      company_name: "Summit Garage",
      website: "summitgarage.example",
      industry: "Garage Door",
      location: "Phoenix, AZ",
      subindustry: null,
      employees: null,
      revenue_range: null,
      intent_score: null,
      buying_stage: null,
      buying_stage_confidence: null,
      buying_stage_reason: null,
      buying_stage_last_assessed_at: null,
      lead_score: null,
      lead_engine_score: null,
      lead_engine_score_label: null,
      lead_engine_score_explanation: null,
      lead_engine_last_run_at: null,
      confidence: 0.5,
      company_match_confidence: null,
      decision_maker_coverage: null,
      verification_status: "crm_prospect",
      signals: [],
      search_intent_category: null,
      lead_inbox_id: null,
      growth_lead_id: null,
      prospect_id: "crm-1",
      customer_id: null,
      rank_score: 0.4,
      match_reasoning: [],
    },
    "garage door phoenix",
  )
  assert.match(handoffUrl, /\/admin\/growth\/leads\/lead-engine\?/)
  assert.match(handoffUrl, /companyName=Summit\+Garage/)
  assert.match(handoffUrl, /sourceType=crm_prospect/)
  assert.match(handoffUrl, /prospectId=crm-1/)

  const parsedHandoff = parseProspectSearchLeadEngineHandoffParams(
    new URLSearchParams(handoffUrl.split("?")[1]!),
  )
  assert.ok(parsedHandoff)
  assert.equal(parsedHandoff!.companyName, "Summit Garage")
  assert.equal(parsedHandoff!.domain, "summitgarage.example")

  const baseRankRow = {
    id: "1",
    source_type: "growth_lead" as const,
    company_name: "Acme HVAC",
    website: null,
    industry: "HVAC",
    subindustry: null,
    employees: "50",
    revenue_range: null,
    location: "Tennessee",
    city: null,
    state: "TN",
    service_area: null,
    notes: null,
    keywords: [],
    crm_detected: null,
    website_platform: null,
    field_service_software: null,
    intent_score: null,
    buying_stage: null,
    buying_stage_confidence: null,
    buying_stage_reason: null,
    buying_stage_last_assessed_at: null,
    lead_score: null,
    lead_engine_score: null,
    lead_engine_score_label: null,
    lead_engine_score_explanation: null,
    lead_engine_last_run_at: null,
    company_match_confidence: null,
    decision_maker_count: 0,
    verification_status: "unverified",
    priority: null,
    signals: [],
    search_intent_category: null,
    returning_visitor: false,
    existing_account: false,
    lead_inbox_id: null,
    growth_lead_id: "1",
    prospect_id: null,
    customer_id: null,
  }
  const baseRank = rankProspectSearchCompanies([baseRankRow], "Acme HVAC", parsed, 10)[0]!.rank_score
  const qualifiedRank = rankProspectSearchCompanies(
    [
      {
        ...baseRankRow,
        lead_engine_score: 85,
        buying_stage: "purchase_ready",
        company_match_confidence: 0.9,
        intent_score: 20,
      },
    ],
    "Acme HVAC",
    parsed,
    10,
  )[0]!.rank_score
  assert.ok(qualifiedRank > baseRank)
  assert.ok(qualifiedRank - baseRank <= 0.11)

  assert.match(actionsSource, /pushProspectSearchCompanyToLeadInbox/)
  assert.match(actionsSource, /executeBulkPushToLeadInbox/)

  const pushSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-push-to-inbox.ts"),
    "utf8",
  )
  assert.match(pushSource, /Already in Lead Inbox/)
  assert.match(pushSource, /resolveProspectSearchCompaniesForPush/)
  assert.match(pushSource, /createLeadCandidate/)
  assert.match(pushSource, /not autonomous/)

  const pushMetadataSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-push-metadata.ts"),
    "utf8",
  )
  assert.match(pushMetadataSource, /qualification_context/)

  const routeSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/prospect-search/route.ts"),
    "utf8",
  )
  assert.match(routeSource, /parseSelectedRefs/)
  assert.match(routeSource, /discovery_mode/)
  assert.match(routeSource, /requireGrowthEnginePlatformAccess/)

  assert.match(shellSource, /selectedKeys/)
  assert.match(shellSource, /bulk_push_to_lead_inbox/)
  assert.match(shellSource, /ProspectSearchBulkActionBar/)
  assert.match(shellSource, /Select all visible/)
  assert.match(shellSource, /setSelectedKeys\(new Set\(\)\)/)
  assert.match(companyCardSource, /Checkbox/)
  assert.match(companyCardSource, /onCheckedChange/)

  const bulkBarSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-bulk-action-bar.tsx"),
    "utf8",
  )
  assert.match(bulkBarSource, /growth-prospect-search-bulk-action-bar/)
  assert.match(bulkBarSource, /Push selected to Lead Inbox/)
  assert.match(bulkBarSource, /View Lead Inbox/)

  assert.equal(GROWTH_PROSPECT_SEARCH_BULK_PUSH_QA_MARKER, "growth-prospect-search-bulk-push-v1")
  assert.equal(
    prospectSearchSelectionKey({ source_type: "growth_lead", id: "abc" }),
    "growth_lead:abc",
  )
  assert.equal(
    formatBulkPushSummary({
      selected_total: 12,
      pushed: 8,
      already_exists: 3,
      skipped_invalid: 1,
      failed: 0,
    }),
    "12 selected · 8 added to Lead Inbox · 3 already existed · 1 skipped because source was incomplete",
  )

  const pushMetadata = buildProspectSearchPushMetadata(
    {
      id: "lead-1",
      source_type: "growth_lead",
      company_name: "Acme HVAC",
      website: "acme.example",
      industry: "HVAC",
      subindustry: null,
      employees: null,
      revenue_range: null,
      location: "TN",
      intent_score: 12,
      buying_stage: "consideration",
      buying_stage_confidence: 0.7,
      buying_stage_reason: "Pricing interest",
      buying_stage_last_assessed_at: "2026-05-01T00:00:00.000Z",
      lead_score: 55,
      lead_engine_score: 72,
      lead_engine_score_label: "Grade B",
      lead_engine_score_explanation: "Strong fit",
      lead_engine_last_run_at: null,
      confidence: 0.8,
      company_match_confidence: 0.75,
      decision_maker_coverage: null,
      verification_status: "unverified",
      signals: ["CRM indicators"],
      search_intent_category: "pricing",
      lead_inbox_id: null,
      growth_lead_id: "lead-1",
      prospect_id: null,
      customer_id: null,
      rank_score: 0.5,
      match_reasoning: [],
      company_signal_summary: {
        technology_signals: ["Field service software detected"],
        growth_indicators: [],
        fit_indicators: [],
        operational_maturity: "Growing operations",
      },
      crm_detected: "HubSpot",
      field_service_software: "FieldPulse",
    },
    "hvac tennessee",
  )
  const qualification = pushMetadata.qualification_context as Record<string, unknown>
  assert.equal(qualification.lead_engine_score, 72)
  assert.equal(qualification.buying_stage, "consideration")
  assert.ok(pushMetadata.company_signal_summary)
  assert.equal((pushMetadata.prospect_search as { query: string }).query, "hvac tennessee")

  const {
    GROWTH_PROSPECT_SEARCH_EXPLANATIONS_QA_MARKER,
    buildProspectSearchExplanations,
    hasProspectSearchExplanations,
  } = await import("../lib/growth/prospect-search/prospect-search-explanations")
  const {
    deriveProspectSearchCompanyStatus,
    GROWTH_PROSPECT_SEARCH_STATUS_QA_MARKER,
  } = await import("../lib/growth/prospect-search/prospect-search-status")
  const { finalizeProspectSearchCompanyResult } = await import(
    "../lib/growth/prospect-search/prospect-search-result-finalize"
  )

  assert.equal(GROWTH_PROSPECT_SEARCH_EXPLANATIONS_QA_MARKER, "growth-prospect-search-explanations-v1")
  assert.equal(GROWTH_PROSPECT_SEARCH_STATUS_QA_MARKER, "growth-prospect-search-status-v1")

  const explained = buildProspectSearchExplanations({
    row: {
      company_name: "Acme HVAC",
      website: "https://acme-hvac.com",
      industry: "HVAC",
      location: "Tennessee",
      signals: ["CRM indicators"],
      match_reasoning: ["Strong text match to search query."],
      rank_score: 0.7,
      confidence: 0.8,
      signal_confidence: 0.82,
      lead_engine_score: 72,
      lead_engine_score_explanation: "Strong ICP fit.",
      lead_score: null,
      buying_stage: "consideration",
      buying_stage_reason: "Pricing interest observed.",
      intent_score: 14,
      search_intent_category: "pricing",
      company_match_confidence: 0.75,
      crm_detected: "HubSpot",
      field_service_software: "FieldPulse",
      website_platform: null,
      company_signal_summary: {
        technology_signals: ["Field service software detected"],
        growth_indicators: ["Hiring activity"],
        fit_indicators: [],
        operational_maturity: "Growing operations",
      },
      existing_customer: false,
      existing_prospect: false,
      in_lead_inbox: false,
      is_suppressed: false,
      suppression_reason: null,
      source_type: "growth_lead",
    },
    query: "hvac",
    filters: { industry: "HVAC" },
    parsed: parseProspectSearchQuery("hvac Tennessee"),
  })
  assert.ok(explained.score_explanation_items.length > 0)
  assert.ok(explained.confidence_explanation_items.length > 0)
  assert.ok(explained.recommended_next_step_reason)
  assert.ok(hasProspectSearchExplanations(explained))

  const sparseExplained = buildProspectSearchExplanations({
    row: {
      company_name: "Unknown Co",
      website: null,
      industry: null,
      location: null,
      signals: [],
      match_reasoning: [],
      rank_score: 0.1,
      confidence: 0.4,
      signal_confidence: null,
      lead_engine_score: null,
      lead_engine_score_explanation: null,
      lead_score: null,
      buying_stage: null,
      buying_stage_reason: null,
      intent_score: null,
      search_intent_category: null,
      company_match_confidence: null,
      crm_detected: null,
      field_service_software: null,
      website_platform: null,
      company_signal_summary: null,
      existing_customer: false,
      existing_prospect: false,
      in_lead_inbox: false,
      is_suppressed: false,
      suppression_reason: null,
      source_type: "crm_prospect",
    },
  })
  assert.ok(sparseExplained.confidence_explanation_items.some((item) => /limited/i.test(item)))

  const status = deriveProspectSearchCompanyStatus({
    source_type: "lead_inbox",
    lead_inbox_id: "inbox-1",
    customer_id: null,
    prospect_id: null,
    existing_account: false,
    signals: [],
  })
  assert.equal(status.in_lead_inbox, true)
  assert.equal(status.already_pushed, true)

  const finalized = finalizeProspectSearchCompanyResult({
    id: "1",
    source_type: "crm_customer",
    company_name: "Customer Co",
    website: "customer.example",
    industry: "HVAC",
    subindustry: null,
    employees: null,
    revenue_range: null,
    location: "TN",
    intent_score: null,
    buying_stage: null,
    buying_stage_confidence: null,
    buying_stage_reason: null,
    buying_stage_last_assessed_at: null,
    lead_score: null,
    lead_engine_score: null,
    lead_engine_score_label: null,
    lead_engine_score_explanation: null,
    lead_engine_last_run_at: null,
    confidence: 0.6,
    company_match_confidence: null,
    decision_maker_coverage: null,
    verification_status: "existing_account",
    signals: [],
    search_intent_category: null,
    lead_inbox_id: null,
    growth_lead_id: null,
    prospect_id: null,
    customer_id: "cust-1",
    rank_score: 0.4,
    match_reasoning: [],
    existing_account: true,
    is_suppressed: true,
    suppression_reason: "unsubscribe",
    suppression_scope: "domain",
    suppressed_at: null,
    in_lead_inbox: false,
    existing_customer: true,
    existing_prospect: false,
    already_pushed: false,
  })
  assert.ok(finalized.confidence_explanation_items.length > 0)
  assert.match(finalized.recommended_next_step_reason ?? "", /suppressed/i)
  assert.ok(finalized.existing_customer)

  const suppressionFiltered = applyProspectSearchFilters(
    [
      {
        id: "1",
        source_type: "growth_lead",
        company_name: "Allowed",
        website: null,
        industry: "HVAC",
        subindustry: null,
        employees: null,
        revenue_range: null,
        location: null,
        city: null,
        state: null,
        service_area: null,
        notes: null,
        keywords: [],
        crm_detected: null,
        website_platform: null,
        field_service_software: null,
        intent_score: null,
        buying_stage: null,
        buying_stage_confidence: null,
        buying_stage_reason: null,
        buying_stage_last_assessed_at: null,
        lead_score: null,
        lead_engine_score: null,
        lead_engine_score_label: null,
        lead_engine_score_explanation: null,
        lead_engine_last_run_at: null,
        company_match_confidence: null,
        decision_maker_count: 0,
        verification_status: "unverified",
        priority: null,
        signals: [],
        search_intent_category: null,
        returning_visitor: false,
        existing_account: false,
        in_lead_inbox: false,
        existing_customer: false,
        existing_prospect: false,
        already_pushed: false,
        is_suppressed: false,
        suppression_reason: null,
        suppression_scope: null,
        suppressed_at: null,
        lead_inbox_id: null,
        growth_lead_id: "1",
        prospect_id: null,
        customer_id: null,
      },
      {
        id: "2",
        source_type: "growth_lead",
        company_name: "Blocked",
        website: null,
        industry: "HVAC",
        subindustry: null,
        employees: null,
        revenue_range: null,
        location: null,
        city: null,
        state: null,
        service_area: null,
        notes: null,
        keywords: [],
        crm_detected: null,
        website_platform: null,
        field_service_software: null,
        intent_score: null,
        buying_stage: null,
        buying_stage_confidence: null,
        buying_stage_reason: null,
        buying_stage_last_assessed_at: null,
        lead_score: null,
        lead_engine_score: null,
        lead_engine_score_label: null,
        lead_engine_score_explanation: null,
        lead_engine_last_run_at: null,
        company_match_confidence: null,
        decision_maker_count: 0,
        verification_status: "unverified",
        priority: null,
        signals: [],
        search_intent_category: null,
        returning_visitor: false,
        existing_account: false,
        in_lead_inbox: false,
        existing_customer: false,
        existing_prospect: false,
        already_pushed: false,
        is_suppressed: true,
        suppression_reason: "unsubscribe",
        suppression_scope: "email",
        suppressed_at: "2026-05-01T00:00:00.000Z",
        lead_inbox_id: null,
        growth_lead_id: "2",
        prospect_id: null,
        customer_id: null,
      },
    ],
    normalizeProspectSearchFilters({ suppression_mode: "exclude" }),
  )
  assert.equal(suppressionFiltered.length, 1)
  assert.equal(suppressionFiltered[0]!.company_name, "Allowed")

  const crmExcluded = applyProspectSearchFilters(
    [
      {
        ...suppressionFiltered[0]!,
        id: "3",
        company_name: "Prospect Co",
        existing_prospect: true,
        prospect_id: "p-1",
        growth_lead_id: null,
      },
      {
        ...suppressionFiltered[0]!,
        id: "4",
        company_name: "Fresh Co",
        existing_prospect: false,
        growth_lead_id: "4",
      },
    ],
    normalizeProspectSearchFilters({ existing_account_mode: "exclude_crm" }),
  )
  assert.equal(crmExcluded.length, 1)
  assert.equal(crmExcluded[0]!.company_name, "Fresh Co")

  assert.match(
    formatBulkPushSummary({
      selected_total: 4,
      pushed: 2,
      already_exists: 1,
      skipped_invalid: 0,
      suppressed: 1,
      failed: 0,
    }),
    /1 suppressed row was skipped/,
  )

  const explanationsSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-explanations.ts"),
    "utf8",
  )
  assert.match(explanationsSource, /buildProspectSearchExplanations/)
  assert.match(companyCardSource, /CompanyResultExplanations/)
  assert.match(companyCardSource, /CompanyStatusBadges/)
  const filtersSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-filters.ts"),
    "utf8",
  )
  assert.match(filtersSource, /suppression_mode/)
  assert.equal(normalizeProspectSearchFilters({}).suppression_mode, "exclude")
  assert.match(pushSource, /Suppressed from outreach/)

  const indexMigration = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20270401120000_growth_engine_prospect_search_index.sql",
    ),
    "utf8",
  )
  assert.match(indexMigration, /growth\.prospect_search_index/)
  assert.match(indexMigration, /unique \(source_type, source_id\)/)
  assert.match(indexMigration, /search_text/)
  assert.match(indexMigration, /force row level security/)

  const {
    indexCompanyToMaterializedRow,
    materializedRowToIndexCompany,
  } = await import("../lib/growth/prospect-search/prospect-search-materialized-index-map")
  const {
    paginateRankedProspectSearchCompanies,
  } = await import("../lib/growth/prospect-search/prospect-search-ranking")

  const materializedSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-materialized-index.ts"),
    "utf8",
  )
  assert.match(materializedSource, /growth-prospect-search-materialized-index-v1/)

  const builderSourceEarly = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-index-builder.ts"),
    "utf8",
  )
  assert.match(builderSourceEarly, /growth-prospect-search-index-builder-v1/)

  const sampleIndexRow = {
    id: "lead-1",
    source_type: "growth_lead" as const,
    company_name: "Acme HVAC",
    website: "https://acme-hvac.com",
    industry: "HVAC",
    subindustry: null,
    employees: "21-50",
    revenue_range: "1m_5m",
    location: "Nashville, TN",
    city: "Nashville",
    state: "TN",
    service_area: "Middle Tennessee",
    notes: "Field service operator",
    keywords: ["hvac"],
    crm_detected: "HubSpot",
    website_platform: "WordPress",
    field_service_software: "FieldPulse",
    intent_score: 12,
    buying_stage: "consideration",
    buying_stage_confidence: 0.7,
    buying_stage_reason: "Pricing interest",
    buying_stage_last_assessed_at: null,
    lead_score: 55,
    lead_engine_score: 72,
    lead_engine_score_label: "Strong",
    lead_engine_score_explanation: "Strong ICP fit",
    lead_engine_last_run_at: null,
    company_match_confidence: 0.8,
    decision_maker_count: 1,
    verification_status: "unverified",
    priority: null,
    signals: ["CRM indicators"],
    search_intent_category: "pricing",
    returning_visitor: false,
    existing_account: false,
    in_lead_inbox: false,
    existing_customer: false,
    existing_prospect: false,
    already_pushed: false,
    is_suppressed: false,
    suppression_reason: null,
    suppression_scope: null,
    suppressed_at: null,
    lead_inbox_id: null,
    growth_lead_id: "lead-1",
    prospect_id: null,
    customer_id: null,
    company_signal_summary: {
      technology_signals: ["Field service software detected"],
      growth_indicators: [],
      fit_indicators: [],
      operational_maturity: "Growing operations",
    },
    signal_confidence: 0.82,
    signal_count: 2,
  }

  const materialized = indexCompanyToMaterializedRow(sampleIndexRow)
  assert.equal(materialized.source_type, "growth_lead")
  assert.equal(materialized.source_id, "lead-1")
  assert.equal(materialized.domain, "acme-hvac.com")
  assert.equal(materialized.is_customer, false)

  const roundTrip = materializedRowToIndexCompany(materialized)
  assert.equal(roundTrip.id, "lead-1")
  assert.equal(roundTrip.company_name, "Acme HVAC")
  assert.equal(roundTrip.lead_engine_score, 72)
  assert.equal(roundTrip.signals[0], "CRM indicators")

  const paged = paginateRankedProspectSearchCompanies(
    [
      { ...sampleIndexRow, id: "1", company_name: "Alpha HVAC" },
      { ...sampleIndexRow, id: "2", company_name: "Beta Plumbing", industry: "Plumbing", keywords: [] },
      { ...sampleIndexRow, id: "3", company_name: "Gamma HVAC" },
    ],
    "hvac",
    parseProspectSearchQuery("hvac"),
    1,
    2,
  )
  assert.ok(paged.total_count >= 2)
  assert.equal(paged.companies.length, 2)
  assert.equal(paged.page, 1)
  assert.equal(paged.page_size, 2)

  const pageTwo = paginateRankedProspectSearchCompanies(
    Array.from({ length: 5 }, (_, index) => ({
      ...sampleIndexRow,
      id: `row-${index}`,
      company_name: `Company ${index}`,
    })),
    "",
    parseProspectSearchQuery(""),
    2,
    2,
  )
  assert.equal(pageTwo.companies.length, 2)
  assert.equal(pageTwo.page, 2)
  assert.ok(pageTwo.has_next_page)

  const repositorySource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-repository.ts"),
    "utf8",
  )
  assert.match(repositorySource, /loadProspectSearchMaterializedCompanies/)
  assert.match(repositorySource, /buildProspectSearchIndex/)
  assert.match(repositorySource, /index_diagnostics/)
  assert.match(repositorySource, /resolveProspectSearchCompanyResultsForPush/)

  const builderSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-index-builder.ts"),
    "utf8",
  )
  assert.match(builderSource, /rebuildProspectSearchMaterializedIndex/)
  assert.match(builderSource, /mode: "materialized"/)

  const rebuildRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/prospect-search/index/rebuild/route.ts"),
    "utf8",
  )
  assert.match(rebuildRouteSource, /requireGrowthEnginePlatformAccess/)
  assert.match(rebuildRouteSource, /rows_indexed/)

  assert.match(shellSource, /ProspectSearchPagination/)
  assert.doesNotMatch(shellSource, /<ProspectSearchIndexDiagnostics/)
  assert.match(shellSource, /page_size/)

  const territoryMigration = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20270402120000_growth_engine_prospect_search_territory_geo.sql",
    ),
    "utf8",
  )
  assert.match(territoryMigration, /lat numeric/)
  assert.match(territoryMigration, /normalized_geo_key/)

  const {
    GROWTH_PROSPECT_SEARCH_GEO_QA_MARKER,
    buildNormalizedGeoKey,
    evaluateTerritoryMatch,
    haversineDistanceMiles,
    normalizeCity,
    normalizePostalCode,
    normalizeState,
    normalizeTerritoryFilter,
    parseTerritoryInput,
    rowMatchesTerritoryFilter,
  } = await import("../lib/growth/prospect-search/prospect-search-geo")

  assert.equal(GROWTH_PROSPECT_SEARCH_GEO_QA_MARKER, "growth-prospect-search-geo-v1")
  assert.equal(normalizeState("Tennessee"), "TN")
  assert.equal(normalizeState("tn"), "TN")
  assert.equal(normalizeCity("Nashville metro"), "nashville")
  assert.equal(normalizePostalCode("37745-1234"), "37745")
  assert.equal(buildNormalizedGeoKey({ city: "Nashville", state: "TN", postal_code: "37201" }), "tn|nashville|37201")

  const parsedTn = parseTerritoryInput("TN")
  assert.deepEqual(parsedTn.states, ["TN"])
  const parsedCityState = parseTerritoryInput("Greeneville, TN")
  assert.deepEqual(parsedCityState.states, ["TN"])
  assert.equal(parsedCityState.cities?.[0], "greeneville")
  const parsedZip = parseTerritoryInput("37745")
  assert.deepEqual(parsedZip.postal_codes, ["37745"])
  const parsedMetro = parseTerritoryInput("Nashville metro")
  assert.deepEqual(parsedMetro.metros, ["nashville"])

  const row = {
    city: "Greeneville",
    state: "TN",
    postal_code: "37745",
    country: "US",
    location: "Greeneville, TN",
    service_area: "East Tennessee",
    metro: "greeneville",
    lat: 36.1631,
    lng: -82.8307,
  }

  assert.ok(
    rowMatchesTerritoryFilter(row, normalizeTerritoryFilter({ states: ["Tennessee"] })!),
  )
  assert.ok(
    rowMatchesTerritoryFilter(row, normalizeTerritoryFilter({ cities: ["Greeneville"], states: ["TN"] })!),
  )
  assert.ok(
    rowMatchesTerritoryFilter(row, normalizeTerritoryFilter({ postal_codes: ["37745"] })!),
  )

  const radiusMatch = evaluateTerritoryMatch(row, {
    radius: { center_lat: 36.16, center_lng: -82.83, miles: 25, label: "Greeneville" },
  })
  assert.ok(radiusMatch.matches)
  assert.ok(radiusMatch.reasons.some((reason) => /Within 25 miles/i.test(reason)))

  const missingCoords = evaluateTerritoryMatch(
    { ...row, lat: null, lng: null },
    { radius: { center_lat: 36.16, center_lng: -82.83, miles: 25 } },
  )
  assert.equal(missingCoords.matches, false)

  assert.ok(haversineDistanceMiles(36.16, -82.83, 36.1631, -82.8307) < 5)

  const territoryFiltered = applyProspectSearchFilters(
    [
      {
        id: "1",
        source_type: "growth_lead",
        company_name: "TN Co",
        website: null,
        industry: "HVAC",
        subindustry: null,
        employees: null,
        revenue_range: null,
        location: "Nashville, TN",
        city: "Nashville",
        state: "TN",
        postal_code: "37201",
        country: "US",
        metro: "nashville",
        lat: 36.1627,
        lng: -86.7816,
        service_area: null,
        notes: null,
        keywords: [],
        crm_detected: null,
        website_platform: null,
        field_service_software: null,
        intent_score: null,
        buying_stage: null,
        buying_stage_confidence: null,
        buying_stage_reason: null,
        buying_stage_last_assessed_at: null,
        lead_score: null,
        lead_engine_score: null,
        lead_engine_score_label: null,
        lead_engine_score_explanation: null,
        lead_engine_last_run_at: null,
        company_match_confidence: null,
        decision_maker_count: 0,
        verification_status: "unverified",
        priority: null,
        signals: [],
        search_intent_category: null,
        returning_visitor: false,
        existing_account: false,
        in_lead_inbox: false,
        existing_customer: false,
        existing_prospect: false,
        already_pushed: false,
        is_suppressed: false,
        suppression_reason: null,
        suppression_scope: null,
        suppressed_at: null,
        lead_inbox_id: null,
        growth_lead_id: "1",
        prospect_id: null,
        customer_id: null,
      },
      {
        id: "2",
        source_type: "growth_lead",
        company_name: "TX Co",
        website: null,
        industry: "HVAC",
        subindustry: null,
        employees: null,
        revenue_range: null,
        location: "Austin, TX",
        city: "Austin",
        state: "TX",
        postal_code: "78701",
        country: "US",
        metro: "austin",
        lat: 30.2672,
        lng: -97.7431,
        service_area: null,
        notes: null,
        keywords: [],
        crm_detected: null,
        website_platform: null,
        field_service_software: null,
        intent_score: null,
        buying_stage: null,
        buying_stage_confidence: null,
        buying_stage_reason: null,
        buying_stage_last_assessed_at: null,
        lead_score: null,
        lead_engine_score: null,
        lead_engine_score_label: null,
        lead_engine_score_explanation: null,
        lead_engine_last_run_at: null,
        company_match_confidence: null,
        decision_maker_count: 0,
        verification_status: "unverified",
        priority: null,
        signals: [],
        search_intent_category: null,
        returning_visitor: false,
        existing_account: false,
        in_lead_inbox: false,
        existing_customer: false,
        existing_prospect: false,
        already_pushed: false,
        is_suppressed: false,
        suppression_reason: null,
        suppression_scope: null,
        suppressed_at: null,
        lead_inbox_id: null,
        growth_lead_id: "2",
        prospect_id: null,
        customer_id: null,
      },
    ],
    normalizeProspectSearchFilters({
      territory_filter: { states: ["TN"] },
    }),
  )
  assert.equal(territoryFiltered.length, 1)
  assert.equal(territoryFiltered[0]!.company_name, "TN Co")

  const locationCompat = applyProspectSearchFilters(
    territoryFiltered,
    normalizeProspectSearchFilters({ location: "Nashville" }),
  )
  assert.equal(locationCompat.length, 1)

  const savedRoundTrip = normalizeProspectSearchFilters({
    territory_filter: {
      states: ["TN"],
      cities: ["Nashville"],
      postal_codes: ["37201"],
      radius: { center_lat: 36.16, center_lng: -86.78, miles: 30, label: "Nashville" },
    },
  })
  assert.ok(savedRoundTrip.territory_filter?.states?.includes("TN"))
  assert.ok(savedRoundTrip.territory_filter?.radius?.miles === 30)

  const territoryExplained = buildProspectSearchExplanations({
    row: {
      company_name: "TN Co",
      website: null,
      industry: "HVAC",
      location: "Nashville, TN",
      city: "Nashville",
      state: "TN",
      postal_code: "37201",
      country: "US",
      metro: "nashville",
      lat: 36.1627,
      lng: -86.7816,
      service_area: "Middle Tennessee",
      signals: [],
      match_reasoning: [],
      rank_score: 0.6,
      confidence: 0.7,
      signal_confidence: null,
      lead_engine_score: null,
      lead_engine_score_explanation: null,
      lead_score: null,
      buying_stage: null,
      buying_stage_reason: null,
      intent_score: null,
      search_intent_category: null,
      company_match_confidence: null,
      crm_detected: null,
      field_service_software: null,
      website_platform: null,
      company_signal_summary: null,
      existing_customer: false,
      existing_prospect: false,
      in_lead_inbox: false,
      is_suppressed: false,
      suppression_reason: null,
      source_type: "growth_lead",
    },
    filters: savedRoundTrip,
  })
  assert.ok(territoryExplained.score_explanation_items.some((item) => /state/i.test(item)))

  const pagedTerritory = paginateRankedProspectSearchCompanies(
    territoryFiltered,
    "",
    parseProspectSearchQuery(""),
    1,
    10,
    savedRoundTrip,
  )
  assert.equal(pagedTerritory.total_count, 1)

  const geoSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-geo.ts"),
    "utf8",
  )
  assert.match(geoSource, /parseTerritoryInput/)
  assert.match(filtersSource, /territory_filter/)
  assert.match(icpSource, /Territory/)
  assert.match(companyCardSource, /matched_territory_label/)
  assert.match(pushSource, /resolveProspectSearchCompanyResultsForPush/)
  assert.match(repositorySource, /territory_radius_note/)

  const {
    GROWTH_PROSPECT_SEARCH_CONTACT_INTELLIGENCE_QA_MARKER,
  } = await import("../lib/growth/prospect-search/prospect-search-contact-intelligence-types")
  const {
    buildProspectSearchContactIntelligence,
    computeContactConfidenceRankBoost,
    computeContactCoverageRankBoost,
    decisionMakerToContactInput,
    leadEngineContactResearchToInputs,
    MAX_CONTACT_CONFIDENCE_RANK_BOOST,
  } = await import("../lib/growth/prospect-search/prospect-search-contact-intelligence")
  const {
    buildProspectSearchLeadEngineHandoffInput,
  } = await import("../lib/growth/prospect-search/prospect-search-lead-engine-handoff")

  assert.equal(
    GROWTH_PROSPECT_SEARCH_CONTACT_INTELLIGENCE_QA_MARKER,
    "growth-prospect-search-contact-intelligence-v1",
  )
  assert.equal(MAX_CONTACT_CONFIDENCE_RANK_BOOST, 0.05)
  assert.equal(computeContactCoverageRankBoost(3), 0.05)
  assert.equal(computeContactCoverageRankBoost(0), 0)

  const dmWithEvidence = decisionMakerToContactInput({
    id: "dm-1",
    leadId: "lead-1",
    fullName: "Maria Chen",
    title: "Director Clinical Engineering",
    email: "maria@example.com",
    phone: null,
    linkedinUrl: null,
    source: "website",
    sourceDetail: "Leadership page listing",
    confidence: 0.92,
    evidenceExcerpt: "Listed on company team page as Director Clinical Engineering.",
    status: "confirmed",
    isPrimary: true,
    createdBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  })
  assert.ok(dmWithEvidence)
  assert.equal(dmWithEvidence!.full_name, "Maria Chen")

  const dmWithoutEvidence = decisionMakerToContactInput({
    id: "dm-2",
    leadId: "lead-1",
    fullName: "Hallucinated Person",
    title: "CEO",
    email: null,
    phone: null,
    linkedinUrl: null,
    source: "manual",
    sourceDetail: null,
    confidence: 0.99,
    evidenceExcerpt: null,
    status: "suspected",
    isPrimary: false,
    createdBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  })
  assert.equal(dmWithoutEvidence, null)

  const contactResearchInputs = leadEngineContactResearchToInputs({
    contact_candidates: [
      {
        full_name: "Maria Chen",
        job_title: "Director Clinical Engineering",
        department: "Clinical Engineering",
        role_match_type: "decision_maker",
        email: "maria@example.com",
        email_confidence: 1,
        phone: "",
        phone_confidence: 0,
        linkedin_url: "",
        confidence: 0.92,
        source_evidence: [
          {
            claim: "Leadership listing",
            evidence: "Company team page lists Maria Chen as Director Clinical Engineering.",
            source: "website",
          },
        ],
      },
      {
        full_name: "Invented Contact",
        job_title: "CEO",
        department: "",
        role_match_type: "owner",
        email: "fake@example.com",
        email_confidence: 1,
        phone: "",
        phone_confidence: 0,
        linkedin_url: "",
        confidence: 0.99,
        source_evidence: [],
      },
    ],
    coverage: {
      primary_roles_found: ["decision_maker"],
      missing_roles: ["economic buyer"],
      committee_completion: 0.5,
    },
    research_quality: { score: 0.8, reasoning: ["Evidence-backed only"] },
  })
  assert.equal(contactResearchInputs.length, 1)

  const intelligence = buildProspectSearchContactIntelligence({
    contacts: [dmWithEvidence!, ...contactResearchInputs],
    decision_maker_hypothesis: {
      recommended_targeting_strategy: { primary_motion: "Clinical ops", reason: "ICP fit" },
      buying_committee: {
        primary_targets: [
          { role: "Director Clinical Engineering", confidence: 0.9, reason: "Primary buyer" },
          { role: "Biomedical Manager", confidence: 0.75, reason: "Influencer" },
        ],
        secondary_targets: [],
        avoid_roles: [],
      },
      role_patterns: {
        owner_patterns: [],
        operations_patterns: ["Director Clinical Engineering"],
        service_patterns: [],
        executive_patterns: [],
        procurement_patterns: [],
        technical_patterns: ["Biomedical Manager"],
      },
      committee_completeness: {
        recommended_contacts: 4,
        minimum_contacts: 2,
        critical_missing_roles: ["Procurement"],
      },
      escalation_path: ["Director Clinical Engineering"],
      engagement_priority: ["Director Clinical Engineering", "Biomedical Manager"],
      confidence_assessment: { score: 88, reasoning: ["Strong title alignment"] },
    },
    committee_completeness: 0.75,
    source_labels: ["growth.lead_decision_makers", "lead_engine.contact_research"],
  })

  assert.equal(intelligence.qa_marker, GROWTH_PROSPECT_SEARCH_CONTACT_INTELLIGENCE_QA_MARKER)
  assert.equal(intelligence.contacts.length, 1)
  assert.ok(intelligence.committee_roles.length >= 2)
  assert.ok(intelligence.first_contact)
  assert.equal(intelligence.first_contact!.role, "Director Clinical Engineering")
  assert.ok(intelligence.first_contact!.reasons.includes("Highest evidence"))
  assert.ok(intelligence.confidence_explanation)
  assert.ok(intelligence.confidence_explanation!.evidence.length > 0)
  assert.equal(computeContactConfidenceRankBoost(intelligence), 0.05)

  const sparse = buildProspectSearchContactIntelligence({ contacts: [] })
  assert.equal(sparse.has_contacts, false)
  assert.ok(sparse.empty_reason)

  const duplicateMerged = buildProspectSearchContactIntelligence({
    contacts: [
      dmWithEvidence!,
      {
        ...dmWithEvidence!,
        id: "dm-dup",
        confidence: 0.5,
      },
    ],
  })
  assert.equal(duplicateMerged.contacts.length, 1)

  const handoffInput = buildProspectSearchLeadEngineHandoffInput({
    company_name: "Acme Biomed",
    website: "acme.example",
    industry: "Biomedical",
    location: "Chicago, IL",
    source_type: "growth_lead",
    id: "lead-row-1",
    signals: [],
    crm_detected: null,
    field_service_software: null,
    service_area: null,
    buying_stage: "consideration",
    lead_engine_score: 78,
    lead_engine_score_explanation: "Strong ICP fit",
    contact_intelligence: intelligence,
  })
  assert.match(handoffInput.notes, /First contact/)
  assert.ok(handoffInput.contactHandoff)
  assert.equal(handoffInput.contactHandoff!.first_contact_name, "Maria Chen")

  const contactBridgeHandoffUrl = buildProspectSearchLeadEngineHandoffUrl(
    {
      id: "lead-row-1",
      source_type: "growth_lead",
      company_name: "Acme Biomed",
      website: "acme.example",
      industry: "Biomedical",
      location: "Chicago, IL",
      signals: [],
      buying_stage: "consideration",
      lead_engine_score: 78,
      lead_engine_score_explanation: "Strong ICP fit",
      contact_intelligence: intelligence,
    } as import("../lib/growth/prospect-search/prospect-search-types").GrowthProspectSearchCompanyResult,
    "biomedical chicago",
  )
  assert.match(contactBridgeHandoffUrl, /contactHandoff=/)
  const parsedHandoffUrl = parseProspectSearchLeadEngineHandoffParams(
    new URLSearchParams(contactBridgeHandoffUrl.split("?")[1]!),
  )
  assert.ok(parsedHandoffUrl?.contactHandoff)
  assert.equal(parsedHandoffUrl!.contactHandoff!.first_contact_role, "Director Clinical Engineering")

  const contactIntelSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-contact-intelligence.ts"),
    "utf8",
  )
  const contactIntelLoaderSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-contact-intelligence-loader.ts"),
    "utf8",
  )
  assert.match(contactIntelSource, /recommendFirstContact/)
  assert.match(contactIntelSource, /hasEvidence/)
  assert.match(contactIntelLoaderSource, /applyProspectSearchContactIntelligenceOverlay/)
  assert.match(contactIntelLoaderSource, /listGrowthLeadDecisionMakers/)
  assert.match(repositorySource, /applyProspectSearchContactIntelligenceOverlay/)
  assert.match(companyCardSource, /CompanyContactIntelligencePanel/)
  assert.match(leadEngineWorkspaceSource, /contactHandoff/)
  const rankingSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-ranking.ts"),
    "utf8",
  )
  assert.match(rankingSource, /computeContactCoverageRankBoost/)
  assert.match(companyCardSource, /external_discovered.*BuyingCommitteePanel/s)

  const contactExplained = buildProspectSearchExplanations({
    row: {
      company_name: "Acme Biomed",
      website: "acme.example",
      industry: "Biomedical",
      location: "Chicago, IL",
      city: "Chicago",
      state: "IL",
      postal_code: null,
      country: "US",
      metro: null,
      lat: null,
      lng: null,
      service_area: null,
      signals: [],
      match_reasoning: [],
      rank_score: 0.7,
      confidence: 0.8,
      signal_confidence: null,
      lead_engine_score: 78,
      lead_engine_score_explanation: "Strong ICP fit",
      lead_score: 78,
      buying_stage: "consideration",
      buying_stage_reason: null,
      intent_score: null,
      search_intent_category: null,
      company_match_confidence: null,
      crm_detected: null,
      field_service_software: null,
      website_platform: null,
      company_signal_summary: null,
      existing_customer: false,
      existing_prospect: false,
      in_lead_inbox: false,
      is_suppressed: false,
      suppression_reason: null,
      source_type: "growth_lead",
      contact_intelligence: intelligence,
      decision_maker_coverage: 0.75,
    },
  })
  assert.ok(contactExplained.confidence_explanation_items.some((item) => /Contact confidence/i.test(item)))
  assert.ok(contactExplained.recommended_next_step_reason?.includes("Recommended first contact"))

  const {
    applyGrowthSignalsToCompanyResult,
  } = await import("../lib/growth/company-growth-signals/integrations/prospect-search-growth-signals-overlay")
  const { growthSignalRankBoost } = await import("../lib/growth/company-growth-signals/growth-signal-scoring")

  assert.match(repositorySource, /applyProspectSearchIntelligenceOverlays/)
  assert.match(rankingSource, /growthSignalRankBoost/)
  assert.match(companyCardSource, /CompanyGrowthSignalsPanel/)
  assert.match(companyCardSource, /growth_signal_score/)

  const growthBridged = applyGrowthSignalsToCompanyResult(
    {
      id: "co-growth-1",
      source_type: "external_discovered",
      company_name: "Signal HVAC",
      website: "https://signal.example",
      industry: "HVAC",
      location: "Denver, CO",
      city: "Denver",
      state: "CO",
      postal_code: null,
      country: "US",
      metro: null,
      lat: null,
      lng: null,
      service_area: null,
      signals: [],
      match_reasoning: [],
      rank_score: 0.55,
      confidence: 0.72,
      signal_confidence: 0.45,
      lead_engine_score: 74,
      lead_engine_score_explanation: "Strong ICP fit",
      lead_score: 74,
      buying_stage: "consideration",
      buying_stage_reason: null,
      intent_score: null,
      search_intent_category: null,
      company_match_confidence: null,
      crm_detected: null,
      field_service_software: null,
      website_platform: null,
      company_signal_summary: null,
      existing_customer: false,
      existing_prospect: false,
      in_lead_inbox: false,
      is_suppressed: false,
      suppression_reason: null,
    },
    {
      qa_marker: "growth-company-growth-signals-v1",
      schema_ready: true,
      company_id: "co-growth-1",
      evidence_sources: [],
      signals: [],
      score: {
        company_id: "co-growth-1",
        growth_signal_score: 72,
        signal_tier: "high",
        top_signals: [
          {
            signal_type: "hiring_technicians",
            confidence_score: 80,
            evidence_excerpt: "HVAC technician role listed on careers page",
          },
        ],
        recommended_next_action: "Research hiring contacts and validate operational pain",
        last_computed_at: new Date().toISOString(),
      },
      privacy_note: "Evidence required",
    },
  )
  assert.equal(growthBridged.growth_signal_score, 72)
  assert.equal(growthBridged.growth_signal_tier, "high")
  assert.ok(growthSignalRankBoost(72) > 0)

  const growthPushSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-push-to-inbox.ts"),
    "utf8",
  )
  assert.match(growthPushSource, /growthSignalInboxIntentBoost/)

  const territoryPanelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/territory-intelligence-panel.tsx"),
    "utf8",
  )
  assert.match(repositorySource, /attachTerritoryIntelligenceToSearchResult/)
  assert.match(territoryPanelSource, /growth-territory-intelligence-v1/)
  assert.match(filtersSource, /territory_id/)

  const marketPanelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/related-companies-panel.tsx"),
    "utf8",
  )
  assert.match(repositorySource, /applyProspectSearchIntelligenceOverlays/)
  assert.match(marketPanelSource, /Related Companies/)
  assert.match(marketPanelSource, /GROWTH_MARKET_INTELLIGENCE_QA_MARKER/)
  assert.match(companyCardSource, /company_confidence/)
  assert.match(companyCardSource, /committee_completion/)
  assert.match(companyCardSource, /related_companies/)

  const anchor = {
    id: "co-market-1",
    source_type: "growth_lead" as const,
    company_name: "Anchor HVAC",
    website: "https://anchor.example",
    industry: "HVAC",
    subindustry: null,
    employees: "51-100",
    revenue_range: null,
    location: "Nashville, TN",
    city: "Nashville",
    state: "TN",
    intent_score: null,
    buying_stage: null,
    buying_stage_confidence: null,
    buying_stage_reason: null,
    buying_stage_last_assessed_at: null,
    lead_score: 78,
    lead_engine_score: 78,
    lead_engine_score_label: null,
    lead_engine_score_explanation: null,
    lead_engine_last_run_at: null,
    confidence: 0.8,
    company_match_confidence: null,
    decision_maker_coverage: null,
    verification_status: "unverified",
    signals: [],
    search_intent_category: null,
    lead_inbox_id: null,
    growth_lead_id: null,
    prospect_id: null,
    customer_id: null,
    rank_score: 1,
    match_reasoning: [],
    field_service_software: "ServiceTitan",
    crm_detected: null,
    growth_signal_score: 70,
    growth_signal_tier: "high" as const,
    company_signal_summary: { growth_indicators: ["hiring"], technology_signals: [], fit_indicators: [], operational_maturity: "Unknown", digital_maturity: "Unknown", field_service_maturity: "Unknown" },
  }
  const peer = { ...anchor, id: "co-market-2", company_name: "Peer HVAC", lead_engine_score: 74, lead_score: 74 }
  const { buildCompanyRelationships } = await import(
    "../lib/growth/market-intelligence/integrations/prospect-search-market-bridge"
  )
  const { applyMarketIntelligenceToCompanyResult, computeProspectSearchCommitteeCompletion, computeProspectSearchCompanyConfidence } =
    await import("../lib/growth/market-intelligence/integrations/prospect-search-market-overlay")
  const related = buildCompanyRelationships(anchor, [anchor, peer], 5)
  assert.ok(related.length > 0)
  const committee = computeProspectSearchCommitteeCompletion(anchor)
  const confidence = computeProspectSearchCompanyConfidence(anchor, committee)
  const marketBridged = applyMarketIntelligenceToCompanyResult(anchor, {
    related_companies: related,
    company_confidence: confidence,
    committee_completion: committee,
  })
  assert.ok(marketBridged.related_companies?.length)
  assert.ok(marketBridged.committee_completion)

  const {
    GROWTH_SAVED_SEARCH_WORKFLOWS_QA_MARKER,
    buildSavedSearchWorkflowMetadata,
    formatSavedSearchCountDelta,
    parseSavedSearchWorkflowMetadata,
  } = await import("../lib/growth/prospect-search/saved-search-workflows")
  assert.equal(GROWTH_SAVED_SEARCH_WORKFLOWS_QA_MARKER, "growth-saved-search-workflows-v1")

  const metadata = buildSavedSearchWorkflowMetadata({
    resultCount: 120,
    previousResultCount: 108,
    lastRefreshedAt: "2026-05-26T12:00:00.000Z",
    page: 2,
    pageSize: 50,
    savePagination: true,
    discoveryMode: "internal",
  })
  const workflow = parseSavedSearchWorkflowMetadata(metadata)
  assert.equal(workflow.resultCount, 120)
  assert.equal(workflow.countDelta, 12)
  assert.equal(formatSavedSearchCountDelta(12), "+12")
  assert.equal(formatSavedSearchCountDelta(-5), "-5")

  assert.ok(GROWTH_PROSPECT_SEARCH_RESULT_ACTIONS.includes("refresh_saved_search_counts"))
  assert.ok(GROWTH_PROSPECT_SEARCH_RESULT_ACTIONS.includes("delete_saved_search"))

  const savedSearchWorkflowSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/saved-search-workflows.ts"),
    "utf8",
  )
  assert.match(savedSearchWorkflowSource, /growth-saved-search-workflows-v1/)

  const countSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-internal-estimate.ts"),
    "utf8",
  )
  assert.match(countSource, /countProspectSearchMatchesInternalDetailed/)
  assert.match(countSource, /loadProspectSearchMaterializedCompanies/)
  assert.match(countSource, /real_world_company_candidates/)
  assert.doesNotMatch(countSource, /discover_external/)

  const savedWorkflowShellSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-shell.tsx"),
    "utf8",
  )
  assert.match(savedWorkflowShellSource, /SaveSearchWorkflowDialog/)
  assert.match(savedWorkflowShellSource, /loadSavedById/)
  assert.match(savedWorkflowShellSource, /refresh_saved_search_counts/)
  assert.match(savedWorkflowShellSource, /save_pagination/)
  assert.match(savedWorkflowShellSource, /GROWTH_SAVED_SEARCH_WORKFLOWS_QA_MARKER/)

  const filterRailSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-filter-rail.tsx"),
    "utf8",
  )
  assert.match(filterRailSource, /SavedSearchWorkflowSidebar/)

  const sidebarSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/saved-search-workflow-sidebar.tsx"),
    "utf8",
  )
  assert.match(sidebarSource, /Saved workflows/)
  assert.match(sidebarSource, /Inbox/)
  assert.match(sidebarSource, /Research/)

  const savedWorkflowIcpSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/guided-icp-builder.tsx"),
    "utf8",
  )
  assert.match(savedWorkflowIcpSource, /Accordion/)
  assert.match(savedWorkflowIcpSource, /lead_score_min/)
  assert.match(savedWorkflowIcpSource, /revenue_bands/)
  assert.match(savedWorkflowIcpSource, /buying_stages/)
  assert.match(savedWorkflowIcpSource, /company_identification_confidence_min/)
  assert.match(savedWorkflowIcpSource, /service_area/)

  const clientRequestParams = buildProspectSearchGetRequestParams({
    query: "hvac companies",
    filters: {
      industry: "HVAC",
      employee_size_bands: ["21-50"],
      location: "Tennessee",
    },
    discoveryMode: "discover_external",
    page: 1,
    pageSize: 50,
  })
  assert.equal(clientRequestParams.get("mode"), "discover_external")
  assert.match(clientRequestParams.get("filters") ?? "", /HVAC/)
  assert.match(clientRequestParams.get("filters") ?? "", /21-50/)
  assert.equal(compactProspectSearchFiltersForTransport({ existing_account_mode: "any" }), null)

  assert.match(shellSource, /buildProspectSearchGetRequestParams/)
  assert.match(shellSource, /filtersOverride/)
  assert.match(shellSource, /filtersRef\.current/)
  assert.match(shellSource, /updateFilters/)
  assert.match(shellSource, /filters: filtersRef\.current/)
  assert.match(filterRailSource, /Apply & search|onApply/)
  assert.match(savedWorkflowIcpSource, /applyFilters/)
  assert.match(savedWorkflowIcpSource, /onChange\(\(prev\)/)
  assert.match(shellSource, /replaceFilters\(row\.filters\)/)
  assert.match(shellSource, /filters: nextFilters/)

  assert.equal(GROWTH_LIVE_PROVIDER_QUERY_EXPANSION_QA_MARKER, "growth-live-provider-query-expansion-v1")
  assert.equal(GROWTH_LIVE_PROVIDER_QUERY_EXPANSION_QA_MARKER_TYPE, "growth-live-provider-query-expansion-v1")
  assert.match(shellSource, /data-live-provider-query-expansion-marker=\{GROWTH_LIVE_PROVIDER_QUERY_EXPANSION_QA_MARKER\}/)
  assert.match(shellSource, /No companies found after expanded provider search/)

  const medicalPlan = buildLiveProviderDiscoveryQueries({
    industry: "Medical Equipment Service",
    raw_query: "medical equipment service companies",
    location: "",
  })
  assert.ok(medicalPlan.queries.length >= 3)
  assert.ok(medicalPlan.fallback_queries.length >= 3)
  assert.ok(
    medicalPlan.queries.some((q) => /biomedical equipment repair|clinical engineering service/i.test(q)),
  )
  for (const q of medicalPlan.queries) {
    assert.doesNotMatch(q, /employees/i)
  }

  const fallbackOnly = buildLiveProviderFallbackQueries(
    liveProviderIcpInputs({ industry: "Medical Equipment Service", raw_query: "medical equipment service companies" }),
    medicalPlan.queries,
  )
  assert.ok(fallbackOnly.length >= 3)

  const externalRow = {
    id: "ext-1",
    source_type: "external_discovered" as const,
    company_name: "Acme Biomedical Repair",
    website: "https://acmebiomed.example",
    industry: null,
    subindustry: "Medical equipment repair service",
    employees: null,
    revenue_range: null,
    location: "Nashville, TN",
    intent_score: null,
    buying_stage: null,
    lead_score: null,
    confidence: 0.7,
    company_match_confidence: null,
    decision_maker_coverage: null,
    verification_status: "external_unverified" as const,
    signals: [],
    search_intent_category: null,
    lead_inbox_id: null,
    growth_lead_id: null,
    prospect_id: null,
    customer_id: null,
    rank_score: 0.5,
    match_reasoning: [],
    keywords: [],
    notes: null,
  }
  const medFilters = normalizeProspectSearchFilters({
    industry: "Medical Equipment Service",
    employee_size_bands: ["21-50", "51-100"],
  })
  assert.equal(explainProspectSearchFilterDrop(externalRow, medFilters, { external_discovery: true }), null)
  assert.equal(
    explainProspectSearchFilterDrop(
      { ...externalRow, subindustry: "Unrelated retail", company_name: "Generic Store" },
      medFilters,
      { external_discovery: true },
    ),
    "industry",
  )

  const {
    GROWTH_SAVED_SEARCH_SCHEMA_READY_QA_MARKER,
    GROWTH_PROSPECT_SEARCH_GRANTS_MIGRATION,
  } = await import("../lib/growth/prospect-search/prospect-search-schema-health")
  const { GROWTH_SIGNAL_MOMENTUM_QA_MARKER } = await import("../lib/growth/signals/company-signal-rollup")
  const { buildProspectSearchSignalIntelligenceOverlay } = await import(
    "../lib/growth/signals/integrations/prospect-search-signal-overlay"
  )
  assert.equal(GROWTH_SAVED_SEARCH_SCHEMA_READY_QA_MARKER, "growth-saved-search-schema-ready-v1")
  const grantsMigration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_PROSPECT_SEARCH_GRANTS_MIGRATION}`),
    "utf8",
  )
  assert.match(grantsMigration, /grant select, insert, update, delete on table growth.prospect_search_saved_searches to service_role/)
  assert.match(grantsMigration, /growth-saved-search-schema-ready-v1/)

  const {
    GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER,
    GROWTH_PROVIDER_RELAXED_FILTER_RETRY_QA_MARKER,
    deriveProspectSearchProviderStatus,
  } = await import("../lib/growth/prospect-search/prospect-search-provider-runtime-diagnostics")
  assert.equal(GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER, "growth-provider-runtime-diagnostics-v1")
  assert.equal(GROWTH_PROVIDER_RELAXED_FILTER_RETRY_QA_MARKER, "growth-provider-relaxed-filter-retry-v1")
  assert.equal(
    deriveProspectSearchProviderStatus({
      google_places_key_present: true,
      serp_key_present: false,
      raw_result_count: 0,
      filtered_result_count: 0,
      fixture_active: false,
      provider_diagnostics: [{ provider_executed: true } as never],
      used_relaxed_filters: false,
    }).label,
    "provider_returned_raw_0",
  )
  assert.equal(
    deriveProspectSearchProviderStatus({
      google_places_key_present: false,
      serp_key_present: false,
      raw_result_count: 0,
      filtered_result_count: 0,
      fixture_active: false,
      provider_diagnostics: [],
      used_relaxed_filters: false,
    }).label,
    "provider_key_missing",
  )

  assert.match(savedWorkflowShellSource, /ProspectSearchDiagnosticsDisclosure/)
  assert.match(savedWorkflowShellSource, /used_relaxed_external_filters/)
  assert.match(savedWorkflowShellSource, /Showing provider matches with incomplete firmographic data/)

  assert.match(savedWorkflowShellSource, /signal_momentum/)
  const companyCardMomentumSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/company-result-card.tsx"),
    "utf8",
  )
  assert.match(companyCardMomentumSource, /CompanySignalMomentumPanel/)
  assert.match(companyCardMomentumSource, /CompanySignalAiInsightPanel/)
  assert.equal(GROWTH_SIGNAL_MOMENTUM_QA_MARKER, "growth-signal-momentum-v1")

  const {
    GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER,
    GROWTH_SIGNAL_COPILOT_QA_MARKER,
  } = await import("../lib/growth/signals/ai/signal-copilot-client-types")
  assert.equal(GROWTH_SIGNAL_COPILOT_QA_MARKER, "growth-signal-copilot-v1")
  assert.equal(GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER, "growth-signal-ai-insights-v1")

  const overlayWithoutSignals = buildProspectSearchSignalIntelligenceOverlay({
    company: {
      website: "https://emptyco.com",
      company_name: "Empty Co",
      growth_lead_id: null,
      prospect_id: null,
      customer_id: null,
    },
    signals: [],
  })
  assert.equal(overlayWithoutSignals.signal_ai_short_summary, null)
  assert.equal(overlayWithoutSignals.signal_copilot_qa_marker, null)

  const {
    GROWTH_LIVE_ESTIMATED_RESULTS_QA_MARKER,
    GROWTH_FILTER_ESTIMATION_STATE_QA_MARKER,
    GROWTH_LIVE_RESULT_ESTIMATION_QA_MARKER,
    GROWTH_SEARCH_RESULT_PREVIEW_QA_MARKER,
    GROWTH_PROVIDER_HEALTH_DASHBOARD_QA_MARKER,
  } = await import("../lib/growth/prospect-search/prospect-search-estimation-types")
  assert.equal(GROWTH_LIVE_ESTIMATED_RESULTS_QA_MARKER, "growth-live-estimated-results-v1")
  assert.equal(GROWTH_FILTER_ESTIMATION_STATE_QA_MARKER, "growth-filter-estimation-state-v1")
  assert.equal(GROWTH_LIVE_RESULT_ESTIMATION_QA_MARKER, "growth-live-result-estimation-v1")
  assert.equal(GROWTH_SEARCH_RESULT_PREVIEW_QA_MARKER, "growth-search-result-preview-v1")
  assert.equal(GROWTH_PROVIDER_HEALTH_DASHBOARD_QA_MARKER, "growth-provider-health-dashboard-v1")

  const { floorEstimateToRange, buildProspectSearchButtonLabel, formatProspectSearchMatchingCount, buildProspectSearchNumericalEstimateDisplay } =
    await import("../lib/growth/prospect-search/prospect-search-estimation-format")
  assert.equal(floorEstimateToRange(260).label, "~250+")
  assert.equal(floorEstimateToRange(1200).label, "~1k+")
  assert.equal(formatProspectSearchMatchingCount(29000), "29,000")
  const numerical = buildProspectSearchNumericalEstimateDisplay({
    company_count: 29000,
    contact_count: 8400,
    decision_maker_count: 1250,
    tier: "large",
    broad_market_category: true,
    discovery_mode: "discover_external",
    unavailable_filter_reasons: [],
  })
  assert.match(numerical.numerical_headline, /29,000 matching companies/)
  assert.match(numerical.market_helper, /No credits used for estimate/)
  assert.match(numerical.market_helper, /Based on internal index/)
  assert.doesNotMatch(numerical.market_helper, /likely contacts/)
  assert.match(
    buildProspectSearchButtonLabel({
      state: "ready",
      discovery_mode: "discover_external",
      exact_count: null,
      confidence: "broad",
      provider_readiness: {
        google_places: "available",
        serp: "available",
        any_live: true,
        external_discovery_available: true,
        label: "Live providers available",
      },
      broad_market_category: true,
      market_tier: "large",
    }).label,
    /^Search market$/,
  )
  assert.equal(
    buildProspectSearchButtonLabel({
      state: "ready",
      discovery_mode: "discover_external",
      exact_count: null,
      confidence: "broad",
      provider_readiness: {
        google_places: "available",
        serp: "available",
        any_live: true,
        external_discovery_available: true,
        label: "Live providers available",
      },
      broad_market_category: true,
      market_tier: "large",
    }).disabled,
    false,
  )
  assert.match(
    buildProspectSearchButtonLabel({
      state: "ready",
      discovery_mode: "internal",
      exact_count: 248,
      confidence: "heuristic",
      provider_readiness: {
        google_places: "available",
        serp: "available",
        any_live: true,
        external_discovery_available: true,
        label: "Live providers available",
      },
    }).label,
    /^Search$/,
  )

  const {
    GROWTH_DISCOVER_ESTIMATE_HIDDEN_WHEN_STALE_QA_MARKER,
    hasProspectSearchEstimateCriteria,
    isProspectSearchLiveEstimateStale,
  } = await import("../lib/growth/prospect-search/prospect-search-estimate-visibility")
  assert.equal(GROWTH_DISCOVER_ESTIMATE_HIDDEN_WHEN_STALE_QA_MARKER, "growth-discover-estimate-hidden-when-stale-v1")
  assert.equal(hasProspectSearchEstimateCriteria("", {}), false)
  assert.equal(hasProspectSearchEstimateCriteria("hvac", {}), true)
  assert.equal(hasProspectSearchEstimateCriteria("", { industry: "HVAC" }), true)
  assert.equal(isProspectSearchLiveEstimateStale("a", "b"), true)
  assert.equal(isProspectSearchLiveEstimateStale("a", "a"), false)

  assert.match(shellSource, /useProspectSearchTerritoryHeatmap/)
  assert.doesNotMatch(shellSource, /estimationSlot/)
  assert.doesNotMatch(shellSource, /prominent/)

  const liveEstimationSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-live-estimation.tsx"),
    "utf8",
  )
  assert.match(liveEstimationSource, /data-estimate-hidden-stale-qa=\{GROWTH_DISCOVER_ESTIMATE_HIDDEN_WHEN_STALE_QA_MARKER\}/)
  assert.match(shellSource, /ProspectSearchRelaxFilters/)
  assert.match(shellSource, /GROWTH_RESULTS_HEADER_LAYOUT_V1_QA_MARKER/)
  assert.doesNotMatch(shellSource, /GROWTH_PROVIDER_STATUS_LAYOUT_V1_QA_MARKER/)
  assert.match(shellSource, /inline-flex max-w-full flex-wrap items-baseline/)
  assert.match(savedWorkflowIcpSource, /GROWTH_SEARCH_FILTERS_COLLAPSED_DEFAULT_QA_MARKER/)
  assert.doesNotMatch(savedWorkflowIcpSource, /writeProspectSearchFilterAccordionExpanded/)
  assert.doesNotMatch(savedWorkflowIcpSource, /defaultValue=\{accordionDefaults\}/)
  assert.doesNotMatch(savedWorkflowIcpSource, /accordionDefaults = \["industry"/)

  const filterAccordionStateSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-filter-accordion-state.ts"),
    "utf8",
  )
  assert.match(filterAccordionStateSource, /GROWTH_SEARCH_FILTERS_COLLAPSED_DEFAULT_QA_MARKER/)
  assert.match(filterAccordionStateSource, /migrateProspectSearchFilterAccordionStorage/)
  assert.match(filterAccordionStateSource, /filter-sections-v2/)

  const uxConstantsSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-ux-constants.ts"),
    "utf8",
  )
  assert.match(uxConstantsSource, /growth-search-clean-start-v1/)
  assert.match(uxConstantsSource, /growth-search-has-searched-state-v1/)
  assert.match(uxConstantsSource, /growth-search-diagnostics-hidden-v1/)
  assert.match(uxConstantsSource, /growth-search-filters-collapsed-default-v1/)

  const cleanStartSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-clean-start-panel.tsx"),
    "utf8",
  )
  assert.match(cleanStartSource, /Find your next prospects/)
  assert.match(cleanStartSource, /Search by company type, industry, location, technology, or plain English/)

  const providerStatusLayoutSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/real-world-provider-status.tsx"),
    "utf8",
  )
  assert.match(providerStatusLayoutSource, /w-full min-w-0/)
  assert.match(providerStatusLayoutSource, /break-words/)

  const estimateRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/prospect-search/estimate/route.ts"),
    "utf8",
  )
  assert.match(estimateRouteSource, /estimateProspectSearchMatches/)

  const providerHealthPageSource = fs.readFileSync(
    path.join(process.cwd(), "app/(admin)/admin/growth/settings/provider-health/page.tsx"),
    "utf8",
  )
  assert.match(providerHealthPageSource, /GrowthProspectSearchProviderHealthDashboard/)
  assert.match(providerHealthPageSource, /Provider Health/)

  const providerHealthNavSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts"),
    "utf8",
  )
  assert.match(providerHealthNavSource, /\/admin\/growth\/settings\/provider-health/)

  await testProspectPipelineAutomation()

  await testProspectSearchProviderIntent()

  await testProspectSearchDiscoverUiState()

  await testProspectSearchIntelligenceSchemaHealth()

  await testProspectOutboundLaunchMotion()

  await testProspectTerritoryOpportunityHeatmap()

  await testProspectSearchPresearchMarketEstimation()

  console.log("growth-prospect-search: all checks passed")
}

async function testProspectSearchIntelligenceSchemaHealth(): Promise<void> {
  const {
    GROWTH_PROSPECT_SEARCH_INTELLIGENCE_SCHEMA_QA_MARKER,
    formatGrowthSchemaHealthNotice,
    mergeGrowthSchemaHealthSummaries,
    shouldShowGrowthSchemaHealthWarning,
    summarizeGrowthSchemaProbeResults,
  } = await import("../lib/growth/schema-health/growth-schema-health-types")

  assert.equal(GROWTH_PROSPECT_SEARCH_INTELLIGENCE_SCHEMA_QA_MARKER, "growth-prospect-search-intelligence-schema-v1")

  const ready = summarizeGrowthSchemaProbeResults({
    featureLabel: "Contact discovery",
    objects: [{ table: "contact_candidates", columns: ["id"], label: "growth.contact_candidates" }],
    outcomes: ["detected"],
  })
  assert.equal(ready.ready, true)
  assert.equal(shouldShowGrowthSchemaHealthWarning(ready), false)

  const uncertain = summarizeGrowthSchemaProbeResults({
    featureLabel: "Contact discovery",
    objects: [{ table: "contact_candidates", columns: ["id"], label: "growth.contact_candidates" }],
    outcomes: ["uncertain"],
  })
  assert.equal(uncertain.ready, true)
  assert.equal(shouldShowGrowthSchemaHealthWarning(uncertain), false)

  const partial = summarizeGrowthSchemaProbeResults({
    featureLabel: "Contact discovery",
    objects: [
      { table: "contact_candidates", columns: ["id"], label: "growth.contact_candidates" },
      { table: "buying_committees", columns: ["id"], label: "growth.buying_committees" },
    ],
    outcomes: ["detected", "missing"],
  })
  assert.equal(partial.ready, false)
  assert.match(formatGrowthSchemaHealthNotice(partial) ?? "", /missing growth\.buying_committees/)
  assert.doesNotMatch(formatGrowthSchemaHealthNotice(partial) ?? "", /20270323120000/)

  const merged = mergeGrowthSchemaHealthSummaries([
    { ready: false, verified: false, uncertain: false, missing_objects: ["growth.contact_candidates"], warning_message: "Contact discovery schema is incomplete — missing growth.contact_candidates.", env_hint: null },
    { ready: true, verified: true, uncertain: false, missing_objects: [], warning_message: null, env_hint: null },
  ])
  assert.equal(merged.ready, false)

  const contactPanelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/company-contact-intelligence-panel.tsx"),
    "utf8",
  )
  assert.match(contactPanelSource, /ProspectSearchSchemaHealthNotice/)
  assert.doesNotMatch(contactPanelSource, /20270323120000/)

  const buyingCommitteeSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/buying-committee-panel.tsx"),
    "utf8",
  )
  assert.doesNotMatch(buyingCommitteeSource, /schema not applied/)

  const probeSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/schema-health/growth-postgrest-table-probe.ts"),
    "utf8",
  )
  assert.match(probeSource, /GROWTH_SCHEMA_HEALTH_PROBE_CACHE_MS = 15_000/)
  assert.match(probeSource, /growth\.contact_discovery_runs/)

  const typesSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/schema-health/growth-schema-health-types.ts"),
    "utf8",
  )
  assert.match(typesSource, /Connected to Supabase project/)
}

async function testProspectSearchProviderIntent(): Promise<void> {
  const {
    GROWTH_PROSPECT_SEARCH_PROVIDER_INTENT_QA_MARKER,
    PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES,
    shouldFetchProspectSearchResults,
    resolveProspectSearchExternalPendingMessage,
  } = await import("../lib/growth/prospect-search/prospect-search-provider-search-intent")

  assert.equal(GROWTH_PROSPECT_SEARCH_PROVIDER_INTENT_QA_MARKER, "growth-prospect-search-provider-intent-v1")

  assert.equal(
    shouldFetchProspectSearchResults({
      discoveryMode: "discover_external",
      trigger: "explicit_operator_search",
    }),
    true,
  )
  assert.equal(
    shouldFetchProspectSearchResults({
      discoveryMode: "discover_external",
      trigger: "icp_template_selection",
    }),
    false,
  )
  assert.equal(
    shouldFetchProspectSearchResults({
      discoveryMode: "discover_external",
      trigger: "saved_workflow_restore",
    }),
    false,
  )
  assert.equal(
    shouldFetchProspectSearchResults({
      discoveryMode: "discover_external",
      trigger: "suggested_query_click",
    }),
    false,
  )
  assert.equal(
    shouldFetchProspectSearchResults({
      discoveryMode: "internal",
      trigger: "icp_template_selection",
    }),
    true,
  )
  assert.equal(
    shouldFetchProspectSearchResults({
      discoveryMode: "internal",
      trigger: "saved_workflow_restore",
    }),
    true,
  )

  assert.equal(
    resolveProspectSearchExternalPendingMessage("icp_template_selection"),
    PROSPECT_SEARCH_EXTERNAL_PENDING_MESSAGES.templateApplied,
  )
  assert.match(
    resolveProspectSearchExternalPendingMessage("saved_workflow_restore"),
    /Workflow restored/i,
  )
  assert.match(
    resolveProspectSearchExternalPendingMessage("search_recommendation_select"),
    /Query updated/i,
  )

  const shellSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-shell.tsx"),
    "utf8",
  )
  assert.match(shellSource, /shouldFetchProspectSearchResults/)
  assert.match(shellSource, /trigger: "icp_template_selection"/)
  assert.match(shellSource, /trigger: "saved_workflow_restore"/)
  assert.match(shellSource, /trigger: "explicit_operator_search"/)
  assert.match(shellSource, /data-provider-search-intent-marker/)
  assert.match(shellSource, /data-provider-search-pending-hint/)
  assert.match(shellSource, /pendingProviderSearchHint/)
  assert.match(shellSource, /resolveProspectSearchExternalPendingMessage/)
  assert.doesNotMatch(shellSource, /void runSearch\(\{ queryText: template\.query, filters: nextFilters \}\)/)
  assert.match(shellSource, /trigger: "suggested_query_click"/)
  assert.match(shellSource, /searchCompleted/)
  assert.match(shellSource, /ProspectSearchDiscoverReadyPanel/)
  assert.match(shellSource, /GROWTH_DISCOVER_READY_TO_SEARCH_QA_MARKER/)
  assert.match(shellSource, /Apply filters/)
  assert.match(shellSource, /Search market/)
  assert.match(shellSource, /clearAllFilters/)
  assert.match(shellSource, /resetExecutionState/)
  assert.match(shellSource, /setQuery\(""\)/)
  assert.doesNotMatch(shellSource, /ProspectSearchFilterHealthWarnings/)
  assert.match(shellSource, /Filters are hiding all discovered companies/)

  const intentSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-provider-search-intent.ts"),
    "utf8",
  )
  assert.match(intentSource, /Template applied\. Review filters, then click Search\./)
  assert.match(intentSource, /Template applied\. Review filters, then click Search market\./)
  assert.match(intentSource, /Workflow restored — click Search\./)
  assert.match(intentSource, /Filters updated — click Search market\./)
  assert.doesNotMatch(intentSource, /Search providers/)
  assert.doesNotMatch(shellSource, /Search providers/)
  assert.doesNotMatch(shellSource, /Searching providers/)
}

async function testProspectSearchDiscoverUiState(): Promise<void> {
  const {
    GROWTH_DISCOVER_READY_TO_SEARCH_QA_MARKER,
    resolveProspectSearchDiscoverResultsPhase,
    resolveRawProviderCount,
    shouldShowProspectSearchCleanStart,
    shouldShowProspectSearchResultsCount,
    formatProspectSearchResultsCountLabel,
  } = await import("../lib/growth/prospect-search/prospect-search-discover-ui-state")

  assert.equal(GROWTH_DISCOVER_READY_TO_SEARCH_QA_MARKER, "growth-discover-ready-to-search-v1")

  assert.equal(
    resolveProspectSearchDiscoverResultsPhase({
      discoveryMode: "discover_external",
      isSearching: false,
      searchCompleted: false,
      filteredCount: 0,
      rawProviderCount: null,
    }),
    "ready_to_search",
  )
  assert.equal(
    resolveProspectSearchDiscoverResultsPhase({
      discoveryMode: "discover_external",
      isSearching: true,
      searchCompleted: false,
      filteredCount: 0,
      rawProviderCount: null,
    }),
    "searching",
  )
  assert.equal(
    resolveProspectSearchDiscoverResultsPhase({
      discoveryMode: "discover_external",
      isSearching: false,
      searchCompleted: true,
      filteredCount: 0,
      rawProviderCount: 0,
    }),
    "no_raw_results",
  )
  assert.equal(
    resolveProspectSearchDiscoverResultsPhase({
      discoveryMode: "discover_external",
      isSearching: false,
      searchCompleted: true,
      filteredCount: 0,
      rawProviderCount: 12,
    }),
    "filters_hiding_results",
  )

  assert.equal(
    shouldShowProspectSearchCleanStart({
      discoveryMode: "discover_external",
      hasSearched: false,
      searchCompleted: false,
    }),
    false,
  )
  assert.equal(
    shouldShowProspectSearchResultsCount({
      discoveryMode: "discover_external",
      searchCompleted: false,
      loading: false,
    }),
    false,
  )
  assert.match(
    formatProspectSearchResultsCountLabel({
      discoveryMode: "discover_external",
      searchCompleted: false,
      totalCompanies: 0,
    }),
    /Not searched yet/i,
  )

  assert.equal(
    resolveRawProviderCount({
      external_filter_diagnostics: { raw_provider_count: 8, normalized_result_count: 0, dropped_result_count: 8, dropped_reasons: {} },
    } as never),
    8,
  )

  const readyPanel = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-discover-ready-panel.tsx"),
    "utf8",
  )
  assert.match(readyPanel, /prospect-search-discover-ui-state/)
  assert.match(readyPanel, /Ready to search this market/)
}

async function testProspectPipelineAutomation(): Promise<void> {
  const {
    GROWTH_PROSPECT_PIPELINE_AUTOMATION_QA_MARKER,
    deriveProspectPipelineRecommendation,
    deriveProspectSequenceBridge,
    buildProspectWorkflowLauncherActions,
    applyProspectPipelineAutomationOverlay,
  } = await import("../lib/growth/prospect-search/prospect-pipeline-automation")
  const {
    buildGrowthWorkflowContext,
    decodeGrowthWorkflowContext,
    encodeGrowthWorkflowContext,
    GROWTH_PROSPECT_WORKFLOW_CONTEXT_QA_MARKER,
  } = await import("../lib/growth/prospect-search/prospect-workflow-context")
  const { finalizeProspectSearchCompanyResult } = await import(
    "../lib/growth/prospect-search/prospect-search-result-finalize"
  )

  assert.equal(GROWTH_PROSPECT_PIPELINE_AUTOMATION_QA_MARKER, "growth-prospect-pipeline-automation-v1")
  assert.equal(GROWTH_PROSPECT_WORKFLOW_CONTEXT_QA_MARKER, "growth-prospect-pipeline-automation-v1")
  assert.ok(GROWTH_PROSPECT_SEARCH_RESULT_ACTIONS.includes("record_prospect_workflow_continuity"))

  const baseCompany = {
    id: "co-1",
    source_type: "growth_lead" as const,
    company_name: "Acme HVAC",
    website: "https://acme.example",
    industry: "HVAC",
    subindustry: null,
    employees: "25-50",
    revenue_range: null,
    location: "Austin, TX",
    city: "Austin",
    state: "TX",
    postal_code: "78701",
    country: "US",
    metro: null,
    lat: null,
    lng: null,
    intent_score: 40,
    buying_stage: "consideration",
    buying_stage_confidence: 70,
    buying_stage_reason: "Recent hiring signal",
    buying_stage_last_assessed_at: null,
    lead_score: 62,
    lead_engine_score: 68,
    lead_engine_score_label: "qualified",
    lead_engine_score_explanation: "Strong fit",
    lead_engine_last_run_at: "2026-05-01T00:00:00.000Z",
    confidence: 0.72,
    company_match_confidence: 0.8,
    decision_maker_coverage: 55,
    verification_status: "verified",
    signals: ["Reply received last week"],
    search_intent_category: null,
    lead_inbox_id: "inbox-1",
    growth_lead_id: "lead-1",
    prospect_id: null,
    customer_id: null,
    rank_score: 88,
    match_reasoning: ["Industry match"],
    crm_detected: null,
    field_service_software: null,
    in_lead_inbox: true,
    existing_customer: false,
    existing_prospect: false,
    already_pushed: true,
    is_suppressed: false,
    suppression_reason: null,
    contact_intelligence: {
      qa_marker: "growth-prospect-search-contact-intelligence-v1",
      schema_ready: true,
      has_contacts: true,
      contacts: [],
      committee_roles: [],
      committee_completeness_pct: 60,
      first_contact: {
        contact_id: "c1",
        role: "Owner",
        name: "Pat",
        confidence: 0.8,
        reasons: ["Named owner on website"],
      },
      confidence_explanation: null,
      outreach_recommendation: "Follow up on prior reply",
      source_labels: ["website"],
      empty_reason: null,
      contact_coverage_label: "partial",
      contact_confidence_score: 55,
    },
    committee_completion: { completeness_score: 60, missing_roles: [], covered_roles: ["owner"] },
    growth_signal_recommended_action: "Send follow-up draft for operator review",
    recommended_next_step_reason: "Continue qualification review",
  }

  const sequenceBridge = deriveProspectSequenceBridge(baseCompany)
  assert.ok(sequenceBridge.recommended_sequence_label)
  assert.ok((sequenceBridge.recommended_sequence_confidence ?? 0) >= 40)

  const recommendation = deriveProspectPipelineRecommendation(baseCompany, sequenceBridge)
  assert.equal(recommendation.recommended_next_action, "Open Meeting Prep")
  assert.match(recommendation.recommended_next_action_reason, /Buying stage/i)

  const suppressed = {
    ...baseCompany,
    is_suppressed: true,
    suppression_reason: "Do not contact",
    growth_lead_id: null,
    lead_inbox_id: null,
  }
  const suppressedRec = deriveProspectPipelineRecommendation(
    suppressed,
    deriveProspectSequenceBridge(suppressed),
  )
  assert.equal(suppressedRec.recommended_next_action, "Review suppression")

  const finalized = finalizeProspectSearchCompanyResult(baseCompany, { query: "hvac austin" })
  assert.equal(finalized.pipeline_automation?.qa_marker, GROWTH_PROSPECT_PIPELINE_AUTOMATION_QA_MARKER)
  assert.equal(finalized.recommended_next_action, recommendation.recommended_next_action)
  assert.equal(finalized.rank_score, baseCompany.rank_score)

  const overlay = applyProspectPipelineAutomationOverlay(baseCompany, { query: "hvac austin" })
  const context = buildGrowthWorkflowContext({
    company: overlay,
    query: "hvac austin",
    recommendation: overlay.pipeline_automation!.recommendation,
    sequenceBridge: overlay.pipeline_automation!.sequence_bridge,
  })
  const encoded = encodeGrowthWorkflowContext(context)
  const decoded = decodeGrowthWorkflowContext(encoded)
  assert.ok(decoded)
  assert.equal(decoded!.company_name, "Acme HVAC")
  assert.equal(decoded!.qualification.lead_engine_score, 68)
  assert.equal(decoded!.search_query, "hvac austin")

  const launcherActions = buildProspectWorkflowLauncherActions({
    company: overlay,
    query: "hvac austin",
  })
  const suppressedLaunch = buildProspectWorkflowLauncherActions({ company: suppressed }).find(
    (action) => action.id === "queue_outreach_draft",
  )
  assert.equal(suppressedLaunch?.enabled, false)
  assert.match(suppressedLaunch?.disabled_reason ?? "", /Do not contact|Suppressed/i)

  const sequenceLaunch = launcherActions.find((action) => action.id === "launch_qualification_sequence")
  assert.equal(sequenceLaunch?.enabled, true)
  assert.ok(sequenceLaunch?.launch_url?.includes("leadId=lead-1"))

  const noLead = buildProspectWorkflowLauncherActions({
    company: { ...baseCompany, growth_lead_id: null, lead_inbox_id: null, in_lead_inbox: false },
  }).find((action) => action.id === "open_copilot")
  assert.equal(noLead?.enabled, false)

  const pipelineAutomationSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-pipeline-automation.ts"),
    "utf8",
  )
  assert.match(pipelineAutomationSource, /growth-prospect-pipeline-automation-v1/)

  const launcherSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-workflow-launcher.tsx"),
    "utf8",
  )
  assert.match(launcherSource, /GROWTH_PROSPECT_PIPELINE_AUTOMATION_QA_MARKER/)

  const shellSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-shell.tsx"),
    "utf8",
  )
  assert.match(shellSource, /data-pipeline-automation-marker/)
  assert.match(shellSource, /ProspectWorkflowLauncher/)

  const actionsSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-actions.ts"),
    "utf8",
  )
  assert.match(actionsSource, /record_prospect_workflow_continuity/)

  const draftAction = launcherActions.find((action) => action.id === "generate_outreach_draft")
  assert.equal(draftAction?.enabled, true)
  assert.ok(draftAction?.launch_url?.includes("/admin/growth/copilot"))
  assert.ok(draftAction?.launch_url?.includes("leadId=lead-1"))
  assert.doesNotMatch(draftAction?.launch_url ?? "", /lead_inbox_id|inbox-1/)
}

async function testProspectOutboundLaunchMotion(): Promise<void> {
  const {
    assertNoAutonomousOutboundSend,
    buildOutboundApprovalChain,
    buildOutboundLaunchUrls,
    buildSavedSearchBatchLaunchPreview,
    GROWTH_OUTBOUND_LAUNCH_MOTION_QA_MARKER,
    OUTBOUND_LAUNCH_BATCH_MAX,
    runOutboundLaunchPreflight,
  } = await import("../lib/growth/outbound-launch/outbound-launch-motion")

  assert.equal(GROWTH_OUTBOUND_LAUNCH_MOTION_QA_MARKER, "growth-outbound-launch-motion-v1")
  assert.deepEqual(assertNoAutonomousOutboundSend(), { auto_send: false, autonomous_enrollment: false })

  const company = {
    id: "co-1",
    growth_lead_id: "lead-1",
    lead_inbox_id: "inbox-1",
    company_name: "Acme",
    is_suppressed: false,
    suppression_reason: null,
    existing_customer: false,
    existing_prospect: false,
    decision_maker_coverage: 50,
    contact_intelligence: null,
    committee_completion: null,
    in_lead_inbox: true,
    buying_stage: "consideration",
    lead_engine_score: 55,
    lead_score: 55,
    recommended_next_action: "Queue Outreach Draft",
    recommended_sequence_confidence: 45,
  }

  const preflight = runOutboundLaunchPreflight({ company, contact_email: "pat@acme.example" })
  assert.equal(preflight.can_launch, true)
  assert.equal(preflight.growth_lead_id, "lead-1")

  const suppressed = runOutboundLaunchPreflight({
    company: { ...company, is_suppressed: true, suppression_reason: "Unsubscribed", growth_lead_id: "lead-1" },
  })
  assert.equal(suppressed.can_launch, false)

  const inboxOnly = runOutboundLaunchPreflight({
    company: { ...company, growth_lead_id: null },
  })
  assert.equal(inboxOnly.can_launch, false)
  assert.match(inboxOnly.checks.find((c) => c.id === "crm_lead")?.detail ?? "", /CRM lead/i)

  const urls = buildOutboundLaunchUrls({ company })
  assert.ok(urls.generate_draft?.includes("leadId=lead-1"))
  assert.ok(urls.approval_queue?.includes("leadId=lead-1"))
  assert.doesNotMatch(urls.approval_queue ?? "", /inbox-1/)

  const chain = buildOutboundApprovalChain({ currentStepId: "review" })
  assert.equal(chain.find((s) => s.id === "draft")?.status, "complete")
  assert.equal(chain.find((s) => s.id === "review")?.status, "current")

  const batch = buildSavedSearchBatchLaunchPreview({
    savedSearchId: "saved-1",
    companies: [
      company as import("../lib/growth/prospect-search/prospect-search-types").GrowthProspectSearchCompanyResult,
      {
        ...company,
        id: "co-2",
        growth_lead_id: null,
        decision_maker_coverage: 10,
        lead_engine_score: 20,
        lead_score: 20,
      } as import("../lib/growth/prospect-search/prospect-search-types").GrowthProspectSearchCompanyResult,
    ],
  })
  assert.equal(batch.auto_send, false)
  assert.equal(batch.approval_required, true)
  assert.ok(batch.rows.length <= OUTBOUND_LAUNCH_BATCH_MAX)

  const launcherSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-workflow-launcher.tsx"),
    "utf8",
  )
  assert.match(launcherSource, /OutboundLaunchMotionPanel/)

  const approvalPage = fs.readFileSync(
    path.join(process.cwd(), "app/(admin)/admin/growth/outreach/approval/page.tsx"),
    "utf8",
  )
  assert.match(approvalPage, /filterLeadId/)
  assert.match(approvalPage, /OutboundLaunchContextBanner/)
}

async function testProspectTerritoryOpportunityHeatmap(): Promise<void> {
  const {
    aggregateTerritoryOpportunityHeatmap,
    applyTerritoryHeatmapDrilldown,
    averageBuyingStageMaturity,
    computeTerritoryOpportunityHeatScore,
    GROWTH_TERRITORY_OPPORTUNITY_HEATMAP_QA_MARKER,
    isTerritoryHighIntentProspect,
    isTerritoryQualifiedProspect,
    resolveTerritoryDecisionMakerCoveragePct,
    resolveTerritoryOpportunityBucketDimension,
  } = await import("../lib/growth/prospect-search/territory-opportunity-heatmap")

  assert.equal(GROWTH_TERRITORY_OPPORTUNITY_HEATMAP_QA_MARKER, "growth-territory-opportunity-heatmap-v1")

  const nashville = {
    id: "n1",
    city: "nashville",
    state: "TN",
    lead_engine_score: 72,
    buying_stage: "purchase_ready",
    buying_stage_confidence: 0.8,
    decision_maker_count: 2,
    company_match_confidence: 70,
    is_suppressed: false,
    existing_customer: false,
    existing_prospect: false,
  }
  const knoxville = {
    id: "k1",
    city: "knoxville",
    state: "TN",
    lead_engine_score: 58,
    buying_stage: "vendor_evaluation",
    decision_maker_count: 1,
    is_suppressed: false,
  }
  const chattanooga = {
    id: "c1",
    city: "chattanooga",
    state: "TN",
    lead_engine_score: 44,
    buying_stage: "solution_research",
    is_suppressed: false,
  }
  const suppressed = {
    id: "s1",
    city: "greeneville",
    state: "TN",
    lead_engine_score: 80,
    buying_stage: "purchase_ready",
    decision_maker_count: 3,
    is_suppressed: true,
  }

  assert.equal(isTerritoryQualifiedProspect(nashville), true)
  assert.equal(isTerritoryQualifiedProspect({ ...chattanooga, lead_engine_score: 20 }), false)
  assert.equal(isTerritoryHighIntentProspect(nashville), true)
  assert.equal(resolveTerritoryDecisionMakerCoveragePct(nashville), 40)
  assert.ok(averageBuyingStageMaturity([nashville, knoxville]) >= 50)

  const suppressedScore = computeTerritoryOpportunityHeatScore({
    companies: [nashville, suppressed],
    existingAccountMode: "exclude",
  })
  assert.match(suppressedScore.explanation.join(" "), /Suppression penalty/)
  assert.ok(
    suppressedScore.score <
      computeTerritoryOpportunityHeatScore({ companies: [nashville], existingAccountMode: "exclude" }).score,
  )

  const maturityScore = computeTerritoryOpportunityHeatScore({
    companies: [nashville, chattanooga],
    existingAccountMode: "exclude",
  })
  assert.match(maturityScore.explanation.join(" "), /Buying stage maturity/)

  const dmScore = computeTerritoryOpportunityHeatScore({
    companies: [nashville, { ...chattanooga, decision_maker_count: 0 }],
    existingAccountMode: "exclude",
  })
  assert.match(dmScore.explanation.join(" "), /Decision maker coverage/)

  assert.equal(
    resolveTerritoryOpportunityBucketDimension({ territory_filter: { states: ["TN"] } }),
    "city",
  )
  assert.equal(
    resolveTerritoryOpportunityBucketDimension({ territory_filter: { metros: ["Nashville metro"] } }),
    "metro",
  )

  const heatmap = aggregateTerritoryOpportunityHeatmap({
    companies: [nashville, knoxville, chattanooga, suppressed],
    filters: { territory_filter: { states: ["TN"] } },
    bucket_dimension: "city",
  })

  assert.equal(heatmap.no_provider_calls, true)
  assert.equal(heatmap.source, "materialized_index")
  assert.equal(heatmap.territories[0]?.label, "Nashville, TN")
  assert.ok(heatmap.territories[0]!.suppression_adjusted_opportunity_count >= 1)
  assert.ok(heatmap.summary.qualified_prospects >= 3)

  const drilldown = applyTerritoryHeatmapDrilldown(
    { territory_filter: { states: ["TN"] } },
    heatmap.territories[0]!,
  )
  assert.deepEqual(drilldown.territory_filter?.cities, ["nashville"])
  assert.deepEqual(drilldown.territory_filter?.states, ["TN"])

  const metadata = (
    await import("../lib/growth/prospect-search/saved-search-workflows")
  ).buildSavedSearchWorkflowMetadata({
    resultCount: 120,
    previousResultCount: 108,
    territoryOpportunityCount: 84,
    previousTerritoryOpportunityCount: 72,
    bestTerritoryBucket: "Nashville, TN",
    territoryOpportunityScore: 68,
    previousTerritoryOpportunityScore: 61,
  })
  const workflow = (
    await import("../lib/growth/prospect-search/saved-search-workflows")
  ).parseSavedSearchWorkflowMetadata(metadata)
  assert.equal(workflow.territoryOpportunityCount, 84)
  assert.equal(workflow.territoryOpportunityDelta, 12)
  assert.equal(workflow.bestTerritoryBucket, "Nashville, TN")

  const heatmapRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/prospect-search/territory-heatmap/route.ts"),
    "utf8",
  )
  assert.match(heatmapRouteSource, /loadTerritoryOpportunityHeatmap/)
  assert.doesNotMatch(heatmapRouteSource, /google|mapbox|geocode|provider/i)

  const repositorySource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/territory-opportunity-heatmap-repository.ts"),
    "utf8",
  )
  assert.match(repositorySource, /loadProspectSearchMaterializedCompanies/)
  assert.doesNotMatch(repositorySource, /discover_external|google_places|serp/i)

  const panelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/territory-opportunity-heatmap-panel.tsx"),
    "utf8",
  )
  assert.match(panelSource, /GROWTH_TERRITORY_OPPORTUNITY_HEATMAP_QA_MARKER/)
  assert.match(panelSource, /data-mobile-source-wiring/)

  const shellSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-shell.tsx"),
    "utf8",
  )
  assert.match(shellSource, /TerritoryOpportunityHeatmapPanel/)
  assert.match(shellSource, /useProspectSearchTerritoryHeatmap/)
  assert.match(shellSource, /applyTerritoryHeatmapDrilldown/)

  const savedSearchSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/saved-searches.ts"),
    "utf8",
  )
  assert.match(savedSearchSource, /loadTerritoryOpportunitySnapshotForSavedSearch/)
}

async function testProspectSearchPresearchMarketEstimation(): Promise<void> {
  const {
    computePresearchMarketEstimate,
    GROWTH_MARKET_ESTIMATION_TIER_QA_MARKER,
    GROWTH_NO_FALSE_NEGATIVE_ESTIMATES_QA_MARKER,
    GROWTH_PRESEARCH_ESTIMATION_VS_RESULTS_QA_MARKER,
    isBroadMarketCategory,
    isImpossiblyRestrictivePresearchFilters,
  } = await import("../lib/growth/prospect-search/prospect-search-presearch-market-estimation")

  assert.equal(GROWTH_MARKET_ESTIMATION_TIER_QA_MARKER, "growth-market-estimation-tier-v1")
  assert.equal(GROWTH_PRESEARCH_ESTIMATION_VS_RESULTS_QA_MARKER, "growth-presearch-estimation-vs-results-v1")
  assert.equal(GROWTH_NO_FALSE_NEGATIVE_ESTIMATES_QA_MARKER, "growth-no-false-negative-estimates-v1")

  const medicalTemplate = {
    query: "medical equipment service companies",
    filters: {
      industry: "Medical Equipment Service",
      employee_size_bands: ["21-50", "51-100"],
    },
  }

  assert.equal(isBroadMarketCategory(medicalTemplate.query, medicalTemplate.filters), true)

  const medicalExternal = computePresearchMarketEstimate({
    ...medicalTemplate,
    discovery_mode: "discover_external",
    indexed_count_hint: 0,
    provider_searchable: true,
  })
  assert.ok(["large", "massive"].includes(medicalExternal.tier))
  assert.doesNotMatch(medicalExternal.headline, /No likely matches/i)
  assert.match(medicalExternal.helper, /Broad external discovery expected/i)

  const hvacExternal = computePresearchMarketEstimate({
    query: "hvac companies 20-100 employees",
    filters: { industry: "HVAC", employee_size_bands: ["21-50", "51-100"] },
    discovery_mode: "discover_external",
    indexed_count_hint: 0,
    provider_searchable: true,
  })
  assert.ok(["large", "massive", "moderate"].includes(hvacExternal.tier))
  assert.doesNotMatch(hvacExternal.display_label, /No likely matches/i)

  const biomedicalExternal = computePresearchMarketEstimate({
    query: "biomedical field service",
    filters: { industry: "Biomedical", keywords: ["biomedical", "field service"] },
    discovery_mode: "discover_external",
    indexed_count_hint: 0,
    provider_searchable: true,
  })
  assert.equal(biomedicalExternal.broad_market_category, true)
  assert.ok(["large", "massive"].includes(biomedicalExternal.tier))

  const narrowExternal = computePresearchMarketEstimate({
    query: "acme robotics llc",
    filters: {
      industry: "Niche Robotics",
      employee_size_bands: ["1-10"],
      revenue_bands: ["under_1m"],
      lead_score_min: 90,
      buying_stages: ["purchase_ready"],
      company_identification_confidence_min: 80,
      technologies: ["Salesforce"],
      location: "Remote",
    },
    discovery_mode: "discover_external",
    indexed_count_hint: 0,
    provider_searchable: true,
  })
  assert.ok(["tiny", "small", "moderate"].includes(narrowExternal.tier))

  assert.equal(
    isImpossiblyRestrictivePresearchFilters("", {
      industry: "Medical Equipment Service",
      employee_size_bands: ["21-50"],
    }),
    false,
  )

  const estimationSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-estimation.ts"),
    "utf8",
  )
  assert.match(estimationSource, /countProspectSearchMatchesInternalDetailed/)
  assert.match(estimationSource, /numerical_headline/)
  assert.match(estimationSource, /credits_used: false/)
  assert.match(estimationSource, /company_count/)
  assert.match(estimationSource, /estimate_visible/)
  assert.match(estimationSource, /buildHiddenProspectSearchEstimate/)

  const liveEstimationSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-live-estimation.tsx"),
    "utf8",
  )
  assert.match(liveEstimationSource, /data-estimation-phase="presearch"/)
  assert.match(liveEstimationSource, /GROWTH_DISCOVER_LIVE_ESTIMATE_QA_MARKER/)
  assert.match(liveEstimationSource, /GROWTH_DISCOVER_NO_CREDITS_ESTIMATE_QA_MARKER/)
  assert.match(liveEstimationSource, /numerical_headline/)
  assert.match(liveEstimationSource, /GROWTH_DISCOVER_ESTIMATE_HIDDEN_WHEN_STALE_QA_MARKER/)
  assert.doesNotMatch(liveEstimationSource, /likely contacts/)
  assert.doesNotMatch(liveEstimationSource, /Large market/)
  assert.doesNotMatch(liveEstimationSource, /No likely matches/)

  const shellSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-shell.tsx"),
    "utf8",
  )
  assert.match(shellSource, /ProspectSearchDiscoverResultsTable/)
  assert.match(shellSource, /GROWTH_DISCOVER_COMPANY_INTELLIGENCE_PANEL_QA_MARKER/)
  assert.match(shellSource, /shouldFetchProspectSearchResults/)
  assert.doesNotMatch(shellSource, /<ProspectSearchLiveEstimation/)
  assert.match(shellSource, /data-staged-search-pending="v1"/)
  assert.match(shellSource, /GROWTH_PROSPECT_SEARCH_RUNTIME_STABLE_QA_MARKER/)
  assert.match(shellSource, /GROWTH_PROSPECT_SEARCH_RUNTIME_FIX_QA_MARKER/)
  assert.match(shellSource, /resolveProspectSearchDiscoveryMode/)
  assert.match(shellSource, /ProspectSearchShellInner/)
  assert.match(shellSource, /Suspense/)
  assert.match(shellSource, /sanitizeGrowthAdminUiError/)

  const prospectSearchAdminSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/growth-prospect-search-admin.tsx"),
    "utf8",
  )
  assert.match(prospectSearchAdminSource, /GrowthAdminWidgetErrorBoundary/)
  assert.match(prospectSearchAdminSource, /GROWTH_PROSPECT_SEARCH_RUNTIME_STABLE_QA_MARKER/)
  assert.match(prospectSearchAdminSource, /GROWTH_PROSPECT_SEARCH_RUNTIME_FIX_QA_MARKER/)
  assert.match(prospectSearchAdminSource, /Suspense/)

  const prospectSearchPageSource = fs.readFileSync(
    path.join(process.cwd(), "app/(admin)/admin/growth/search/page.tsx"),
    "utf8",
  )
  assert.match(prospectSearchPageSource, /Suspense/)
  assert.match(prospectSearchPageSource, /GROWTH_ADMIN_ROUTE_RUNTIME_STABLE_QA_MARKER/)
  assert.match(prospectSearchPageSource, /GROWTH_PROSPECT_SEARCH_RUNTIME_STABLE_QA_MARKER/)
  assert.match(prospectSearchPageSource, /GROWTH_PROSPECT_SEARCH_RUNTIME_FIX_QA_MARKER/)

  const adminRuntimeSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/admin-route-runtime-types.ts"),
    "utf8",
  )
  assert.match(adminRuntimeSource, /growth-admin-route-runtime-stable-v1/)
  assert.match(adminRuntimeSource, /growth-prospect-search-runtime-stable-v2/)
  assert.match(adminRuntimeSource, /growth-provider-delivery-runtime-stable-v1/)
  assert.equal(
    sanitizeGrowthAdminUiError("ReferenceError: webhookDashboard is not defined").includes("configuration issue"),
    true,
  )

  const stagedLifecycleSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-staged-lifecycle.ts"),
    "utf8",
  )
  assert.match(stagedLifecycleSource, /GROWTH_PROSPECT_SEARCH_TRUTHFUL_LIFECYCLE_QA_MARKER/)
  assert.match(stagedLifecycleSource, /Filters updated — click Search market/)

  const filterHealthSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-filter-health.ts"),
    "utf8",
  )
  assert.match(filterHealthSource, /parseTitleChips/)
  assert.match(filterHealthSource, /title_contains: null/)
  assert.doesNotMatch(filterHealthSource, /title_keywords/)
}

assert.equal(GROWTH_PROSPECT_SEARCH_RUNTIME_FIX_QA_MARKER, "growth-prospect-search-runtime-fix-v1")
assert.equal(resolveProspectSearchDiscoveryMode("discover"), "discover_external")
assert.equal(resolveProspectSearchDiscoveryMode("discover_external"), "discover_external")
assert.equal(resolveProspectSearchDiscoveryMode("internal"), "internal")
assert.equal(resolveProspectSearchDiscoveryMode(null), "discover_external")
assert.equal(resolveProspectSearchDiscoveryMode("bogus"), "discover_external")

const runtimeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-runtime.ts"),
  "utf8",
)
assert.match(runtimeSource, /logProspectSearchRuntimeIssue/)
assert.match(runtimeSource, /invalid_mode_param/)

const errorBoundarySource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-admin-widget-error-boundary.tsx"),
  "utf8",
)
assert.match(errorBoundarySource, /errorMessage/)
assert.doesNotMatch(errorBoundarySource, /ReferenceError: panel render failed/)

void main()
