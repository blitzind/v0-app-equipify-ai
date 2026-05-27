/**
 * Regression checks for Prospect Search + ICP Builder (Prompt 23).
 * Run: pnpm test:growth-prospect-search
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  applyProspectSearchFilters,
  filterProspectPeopleByTitle,
  inferEmployeeSizeBand,
  normalizeProspectSearchFilters,
} from "../lib/growth/prospect-search/prospect-search-filters"
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
  assert.match(shellSource, /GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER/)
  assert.match(shellSource, /RealWorldProviderStatus/)
  const providerStatusSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/real-world-provider-status.tsx"),
    "utf8",
  )
  assert.match(providerStatusSource, /data-qa-marker=\{GROWTH_REAL_WORLD_COMPANY_DISCOVERY_QA_MARKER\}/)
  assert.match(providerStatusSource, /GROWTH_GOOGLE_PLACES_QUERY_EXPANSION_QA_MARKER/)
  assert.match(providerStatusSource, /GROWTH_PROVIDER_CACHE_QA_MARKER/)
  assert.match(shellSource, /GuidedIcpBuilder/)
  assert.match(shellSource, /SearchRecommendations/)
  assert.match(shellSource, /CompanyResultCard/)
  assert.doesNotMatch(shellSource, /runLeadEnginePipeline/)
  assert.match(shellSource, /data-ux-marker/)
  assert.match(shellSource, /DiscoveryModeToggle/)
  assert.match(shellSource, /mode.*discover_external|discover_external/)
  assert.match(shellSource, /useSearchParams/)
  assert.match(shellSource, /mode === "discover"/)
  assert.match(shellSource, /RealWorldProviderStatus/)
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

  console.log("growth-prospect-search: all checks passed")
}

void main()
