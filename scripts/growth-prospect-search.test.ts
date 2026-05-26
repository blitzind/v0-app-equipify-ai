/**
 * Regression checks for Prospect Search + ICP Builder (Prompt 23).
 * Run: pnpm test:growth-prospect-search
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  applyProspectSearchFilters,
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
  GROWTH_PROSPECT_SEARCH_QA_MARKER,
  GROWTH_PROSPECT_SEARCH_RESULT_ACTIONS,
} from "../lib/growth/prospect-search/prospect-search-types"

async function main(): Promise<void> {
  assert.equal(GROWTH_PROSPECT_SEARCH_QA_MARKER, "growth-prospect-search-v1")
  assert.ok(GROWTH_PROSPECT_SEARCH_RESULT_ACTIONS.includes("export_csv"))
  assert.ok(GROWTH_PROSPECT_SEARCH_RESULT_ACTIONS.includes("push_to_lead_inbox"))

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

  const actionsSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-actions.ts"),
    "utf8",
  )
  assert.match(actionsSource, /createLeadCandidate/)
  assert.match(actionsSource, /not autonomous/)
  assert.doesNotMatch(actionsSource, /sendEmail|executePipeline/)

  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app/(admin)/admin/growth/search/page.tsx"),
    "utf8",
  )
  assert.match(pageSource, /GrowthProspectSearchAdmin/)
  assert.match(pageSource, /Prospect Search/)
  assert.match(pageSource, /GROWTH_PROSPECT_SEARCH_UX_QA_MARKER/)

  const shellSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-shell.tsx"),
    "utf8",
  )
  assert.match(shellSource, /ProspectSearchShell/)
  assert.match(shellSource, /GuidedIcpBuilder/)
  assert.match(shellSource, /SearchRecommendations/)
  assert.match(shellSource, /CompanyResultCard/)
  assert.doesNotMatch(shellSource, /runLeadEnginePipeline/)
  assert.match(shellSource, /data-ux-marker/)

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
  assert.match(navSource, /\/admin\/growth\/search/)
  assert.match(navSource, /label: "Search"/)

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

  const internal = createInternalProspectSearchProvider()
  assert.equal(internal.slot, "internal_observable_index")
  assert.equal(internal.describe().status, "success")

  const apollo = createFutureApolloProspectSearchProvider()
  assert.equal(apollo.query({ query: "x", filters: {} }).status, "skipped")
  assert.equal(GROWTH_PROSPECT_SEARCH_PROVIDER_QA_MARKER, "growth-prospect-search-provider-v1")

  console.log("growth-prospect-search: all checks passed")
}

void main()
