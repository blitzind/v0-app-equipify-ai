/**
 * Regression checks for Real-World Company Discovery (Prompt 29).
 * Run: pnpm test:growth-real-world-company-discovery
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildRealWorldCompanyDedupeHash,
  dedupeNormalizedRealWorldCandidates,
  normalizeRealWorldCompanyCandidate,
} from "../lib/growth/real-world-discovery/real-world-company-normalizer"
import { rankRealWorldCompanyCandidates } from "../lib/growth/real-world-discovery/real-world-company-ranking"
import {
  buildRealWorldDiscoveryQuery,
  prospectSearchFiltersToRealWorldInputs,
} from "../lib/growth/real-world-discovery/real-world-discovery-query-builder"
import { GROWTH_REAL_WORLD_DISCOVERY_SCHEMA_MIGRATION } from "../lib/growth/real-world-discovery/real-world-discovery-schema-health"
import { GROWTH_REAL_WORLD_DISCOVERY_PROVIDER_TYPES } from "../lib/growth/real-world-discovery/real-world-discovery-provider-types"
import {
  GROWTH_REAL_WORLD_COMPANY_DISCOVERY_QA_MARKER,
  GROWTH_REAL_WORLD_DISCOVERY_PRIVACY_NOTE,
} from "../lib/growth/real-world-discovery/real-world-discovery-types"
import { createRealWorldFixtureProvider } from "../lib/growth/real-world-discovery/providers/fixture-provider"

async function main(): Promise<void> {
  assert.equal(GROWTH_REAL_WORLD_COMPANY_DISCOVERY_QA_MARKER, "growth-real-world-company-discovery-v1")
  assert.ok(GROWTH_REAL_WORLD_DISCOVERY_PROVIDER_TYPES.includes("google_places"))
  assert.ok(GROWTH_REAL_WORLD_DISCOVERY_PROVIDER_TYPES.includes("serp"))
  assert.ok(GROWTH_REAL_WORLD_DISCOVERY_PROVIDER_TYPES.includes("business_directory"))
  assert.ok(GROWTH_REAL_WORLD_DISCOVERY_PROVIDER_TYPES.includes("fixture"))
  assert.ok(!GROWTH_REAL_WORLD_DISCOVERY_PROVIDER_TYPES.includes("future_apollo" as never))
  assert.match(GROWTH_REAL_WORLD_DISCOVERY_PRIVACY_NOTE, /no Apollo/i)

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_REAL_WORLD_DISCOVERY_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /real_world_discovery_runs/)
  assert.match(migration, /real_world_company_candidates/)
  assert.match(migration, /raw_payload_server_only/)
  assert.match(migration, /description/)
  assert.match(migration, /source_rank/)
  assert.doesNotMatch(migration, /future_apollo|future_seamless|people_data_labs/i)

  const registrySource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/real-world-discovery/real-world-discovery-registry.ts"),
    "utf8",
  )
  assert.match(registrySource, /runRealWorldDiscoveryProviders/)
  assert.match(registrySource, /useFixtureFallback/)
  assert.doesNotMatch(registrySource, /apollo|seamless|clay|people_data_labs/i)

  const repoSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/real-world-discovery/real-world-discovery-repository.ts"),
    "utf8",
  )
  assert.match(repoSource, /raw_payload_server_only/)
  assert.doesNotMatch(repoSource, /runLeadEnginePipeline|sendEmail|scrape/i)

  const prospectRepo = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-repository.ts"),
    "utf8",
  )
  assert.match(prospectRepo, /runProspectSearchRealWorldDiscovery/)

  const shellSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-shell.tsx"),
    "utf8",
  )
  assert.match(shellSource, /RealWorldProviderStatus/)

  const q1 = buildRealWorldDiscoveryQuery({
    industry: "medical equipment service",
    location: "Tennessee",
  })
  assert.match(q1, /medical equipment service/)
  assert.match(q1, /Tennessee/)

  const q2 = buildRealWorldDiscoveryQuery({
    industry: "commercial HVAC",
    location: "Dallas",
    employee_size_estimate: "20-100",
    technology_hints: ["QuickBooks"],
  })
  assert.match(q2, /HVAC|hvac/i)
  assert.match(q2, /Dallas/)
  assert.match(q2, /20-100|QuickBooks/)

  const inputs = prospectSearchFiltersToRealWorldInputs(
    { industry: "biomedical", location: "Boston", technologies: ["QuickBooks"] },
    "biomedical equipment repair companies in Boston",
  )
  assert.equal(inputs.industry, "biomedical")

  const raw = {
    company_name: "Test Biomed Co",
    website: "https://testbiomed.example",
    domain: "testbiomed.example",
    evidence: [{ claim: "Listing", evidence: "Public API result", source: "test" }],
    source_attribution: [
      {
        source: "growth.real_world_discovery.fixture",
        provider_type: "fixture",
        provider_name: "real_world_fixture",
        signal: "test",
        evidence: "Fixture",
        confidence: 0.7,
      },
    ],
  }
  const norm = normalizeRealWorldCompanyCandidate(raw, "real_world_fixture", "fixture", q1)
  assert.ok(norm)
  assert.equal(
    norm!.dedupe_hash,
    buildRealWorldCompanyDedupeHash({
      company_name: "Test Biomed Co",
      domain: "testbiomed.example",
      city: null,
      state: null,
    }),
  )

  const deduped = dedupeNormalizedRealWorldCandidates([norm!, norm!])
  assert.equal(deduped.length, 1)

  const fixture = createRealWorldFixtureProvider()
  const result = await fixture.discover({
    query: "medical equipment Boston",
    industry: "medical equipment",
    location: "Boston",
    limit: 5,
  })
  assert.equal(result.status, "success")
  assert.ok(result.candidates.length > 0)

  const ranked = rankRealWorldCompanyCandidates(
    [
      {
        id: "1",
        created_at: "",
        updated_at: "",
        run_id: "r1",
        query: q1,
        industry: "medical",
        location: "Boston",
        provider_name: "fixture",
        provider_type: "fixture",
        company_name: "A",
        website: null,
        domain: null,
        phone: null,
        address: null,
        city: "Boston",
        state: "MA",
        country: null,
        category: null,
        description: null,
        rating: null,
        review_count: null,
        source_url: null,
        source_rank: 1,
        confidence: 0.7,
        dedupe_hash: "a",
        existing_customer_match: false,
        existing_prospect_match: false,
        existing_growth_lead_match: false,
        evidence: [],
        source_attribution: [],
        metadata: {},
      },
    ],
    q1,
    { industry: "medical", location: "Boston" },
    10,
  )
  assert.ok(ranked[0]!.rank_score > 0)

  console.log("growth-real-world-company-discovery-v1 checks passed")
}

void main()
