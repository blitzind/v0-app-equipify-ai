/**
 * Regression checks for External Company Discovery (Prompt 26).
 * Run: pnpm test:growth-external-company-discovery
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildExternalCompanyDedupeHash,
  dedupeNormalizedCandidates,
  normalizeExternalCompanyCandidate,
} from "../lib/growth/external-discovery/external-company-normalizer"
import { rankExternalCompanyCandidates } from "../lib/growth/external-discovery/external-company-ranking"
import { GROWTH_EXTERNAL_DISCOVERY_SCHEMA_MIGRATION } from "../lib/growth/external-discovery/external-discovery-schema-health"
import {
  GROWTH_EXTERNAL_COMPANY_DISCOVERY_QA_MARKER,
  GROWTH_EXTERNAL_DISCOVERY_PRIVACY_NOTE,
} from "../lib/growth/external-discovery/external-discovery-types"
import { GROWTH_EXTERNAL_DISCOVERY_PROVIDER_TYPES } from "../lib/growth/external-discovery/external-discovery-provider-types"
import { createManualImportExternalDiscoveryProvider } from "../lib/growth/external-discovery/providers/manual-import-provider"

async function main(): Promise<void> {
assert.equal(GROWTH_EXTERNAL_COMPANY_DISCOVERY_QA_MARKER, "growth-external-company-discovery-v1")
assert.equal(
  GROWTH_EXTERNAL_DISCOVERY_SCHEMA_MIGRATION,
  "20270322120000_growth_engine_external_company_discovery.sql",
)
assert.ok(GROWTH_EXTERNAL_DISCOVERY_PROVIDER_TYPES.includes("google_places"))
assert.ok(GROWTH_EXTERNAL_DISCOVERY_PROVIDER_TYPES.includes("manual_import"))
assert.ok(GROWTH_EXTERNAL_DISCOVERY_PROVIDER_TYPES.includes("future_apollo"))
assert.match(GROWTH_EXTERNAL_DISCOVERY_PRIVACY_NOTE, /not leads/)

const migration = fs.readFileSync(
  path.join(process.cwd(), `supabase/migrations/${GROWTH_EXTERNAL_DISCOVERY_SCHEMA_MIGRATION}`),
  "utf8",
)
assert.match(migration, /external_company_discovery_runs/)
assert.match(migration, /external_company_candidates/)
assert.match(migration, /raw_payload/)
assert.match(migration, /external_discovered/)
assert.match(migration, /dedupe_hash/)

const repoSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/external-discovery/external-discovery-repository.ts"),
  "utf8",
)
assert.match(repoSource, /runExternalDiscoveryProviders/)
assert.doesNotMatch(repoSource, /runLeadEnginePipeline|sendEmail|executePipeline|scrape/i)

const registrySource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/external-discovery/external-discovery-registry.ts"),
  "utf8",
)
assert.match(registrySource, /createManualImportExternalDiscoveryProvider/)
assert.match(registrySource, /createGooglePlacesExternalDiscoveryProvider/)
assert.doesNotMatch(registrySource, /apollo\.io|api\.seamless/i)
assert.match(registrySource, /createFutureApolloExternalDiscoveryProvider/)

const prospectRepo = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-repository.ts"),
  "utf8",
)
assert.match(prospectRepo, /discover_external/)
assert.match(prospectRepo, /runProspectSearchExternalDiscovery/)

const prospectRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/prospect-search/route.ts"),
  "utf8",
)
assert.match(prospectRoute, /discover_external/)

const shellSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/prospect-search/prospect-search-shell.tsx"),
  "utf8",
)
assert.match(shellSource, /DiscoveryModeToggle/)
assert.match(shellSource, /Discover new companies/)

const contactRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/contact-discovery/route.ts"),
  "utf8",
)
assert.match(contactRoute, /contact-discovery/)

const actionsSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-actions.ts"),
  "utf8",
)
assert.match(actionsSource, /external_discovered/)
assert.match(actionsSource, /not an automatic lead/)

// Normalizer — rejects empty names
assert.equal(
  normalizeExternalCompanyCandidate(
    { company_name: "", evidence: [], source_attribution: [] },
    "manual_fixture",
    "manual_import",
    "test",
  ),
  null,
)

const normalized = normalizeExternalCompanyCandidate(
  {
    company_name: "Acme Field Service",
    website: "https://acme.example",
    industry: "field service",
    location: "Austin, TX",
    evidence: [{ claim: "Listing", evidence: "Fixture", source: "test" }],
    source_attribution: [],
  },
  "manual_fixture",
  "manual_import",
  "field service Austin",
)
assert.ok(normalized)
assert.equal(normalized!.domain, "acme.example")
assert.ok(normalized!.dedupe_hash.length >= 20)

const hashA = buildExternalCompanyDedupeHash({
  provider_name: "manual_fixture",
  company_name: "Acme",
  domain: "acme.example",
  city: "Austin",
  state: "TX",
})
const hashB = buildExternalCompanyDedupeHash({
  provider_name: "manual_fixture",
  company_name: "Acme",
  domain: "acme.example",
  city: "Austin",
  state: "TX",
})
assert.equal(hashA, hashB)

const deduped = dedupeNormalizedCandidates([
  normalized!,
  { ...normalized!, company_name: "Acme Field Service" },
])
assert.equal(deduped.length, 1)

// Manual fixture provider
const manual = createManualImportExternalDiscoveryProvider()
assert.equal(manual.isConfigured(), true)
const fixtureResult = await manual.discover({
  query: "biomedical Boston",
  industry: "biomedical",
  location: "Boston",
})
assert.equal(fixtureResult.status, "success")
assert.ok(fixtureResult.candidates.length > 0)
assert.ok(fixtureResult.candidates[0]!.evidence.length > 0)
assert.ok(fixtureResult.candidates[0]!.source_attribution.length > 0)
assert.doesNotMatch(JSON.stringify(fixtureResult.candidates), /@[a-z]+\.com/)

const googlePlacesSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/external-discovery/providers/google-places-provider.ts"),
  "utf8",
)
assert.match(googlePlacesSource, /GOOGLE_PLACES_API_KEY/)
assert.match(googlePlacesSource, /skipped/)

const ranked = rankExternalCompanyCandidates(
  [
    {
      id: "1",
      created_at: "",
      updated_at: "",
      run_id: "r1",
      provider_name: "manual_fixture",
      provider_type: "manual_import",
      query: "hvac",
      industry: "hvac",
      location: "Denver",
      company_name: "Northstar Field Service Co.",
      website: null,
      domain: null,
      phone: null,
      address: null,
      city: "Denver",
      state: "CO",
      country: "US",
      category: null,
      rating: 4.3,
      review_count: 10,
      source_url: null,
      confidence: 0.7,
      dedupe_hash: "abc",
      existing_customer_match: false,
      existing_prospect_match: false,
      existing_growth_lead_match: false,
      evidence: [],
      source_attribution: [],
      metadata: {},
    },
  ],
  "hvac Denver",
  "hvac",
  "Denver",
)
assert.ok(ranked[0]!.rank_score > 0)

console.log("growth-external-company-discovery-v1 checks passed")
}

void main()
