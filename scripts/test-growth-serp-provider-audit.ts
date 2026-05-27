/**
 * SERP provider execution wiring audit (Real-World Discovery).
 * Run: pnpm test:growth-serp-provider-audit
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  mapSerpLocalResultToCandidate,
  parseSerpAddressFromString,
} from "../lib/growth/real-world-discovery/providers/serp-mapper"
import { buildSerpDiscoveryQuery } from "../lib/growth/real-world-discovery/providers/serp-query-builder"
import { GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER } from "../lib/growth/real-world-discovery/providers/serp-types"
import { GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER as PROSPECT_AUDIT_MARKER } from "../lib/growth/prospect-search/prospect-search-types"

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER, "growth-serp-provider-audit-v1")
  assert.equal(PROSPECT_AUDIT_MARKER, "growth-serp-provider-audit-v1")

  const serpProviderSource = read("lib/growth/real-world-discovery/providers/serp-provider.ts")
  const serpClientSource = read("lib/growth/real-world-discovery/providers/serp-client.ts")
  const registrySource = read("lib/growth/real-world-discovery/real-world-discovery-registry.ts")
  const repoSource = read("lib/growth/real-world-discovery/real-world-discovery-repository.ts")
  const prospectRepoSource = read("lib/growth/prospect-search/prospect-search-repository.ts")
  const shellSource = read("components/growth/prospect-search/prospect-search-shell.tsx")

  // 1. SERPAPI_API_KEY detection
  assert.match(serpClientSource, /SERPAPI_API_KEY/)
  assert.match(serpClientSource, /SERP_API_KEY/)
  assert.match(serpProviderSource, /isSerpApiConfigured/)

  // 2. Provider registry execution path
  assert.match(registrySource, /createRealWorldSerpProvider/)
  assert.match(registrySource, /runRealWorldDiscoveryProviders/)
  assert.match(registrySource, /useFixtureFallback/)
  assert.match(registrySource, /provider_executed/)
  assert.match(registrySource, /provider_latency_ms/)
  assert.match(registrySource, /provider_result_count/)
  assert.match(registrySource, /provider_fallback_reason/)

  // 3. Real HTTP request executes (SerpAPI client)
  assert.match(serpClientSource, /fetch\(/)
  assert.match(serpClientSource, /serpapi\.com\/search\.json/)
  assert.match(serpClientSource, /engine: "google_maps"/)
  assert.match(serpProviderSource, /searchSerpGoogleMaps/)
  assert.doesNotMatch(serpProviderSource, /status: "skipped"/)
  assert.doesNotMatch(serpProviderSource, /scrape|puppeteer|cheerio/i)

  // 4. SERP response normalization
  const mapped = mapSerpLocalResultToCandidate(
    {
      title: "Summit Commercial HVAC",
      address: "100 Main St, Nashville, TN 37201, USA",
      phone: "+1 615-555-0100",
      website: "https://summithvac.example",
      rating: 4.4,
      reviews: 210,
      type: "HVAC contractor",
      types: ["HVAC contractor"],
      place_id: "ChIJserp123",
      link: "https://maps.google.com/?cid=456",
    },
    { query: "commercial HVAC repair Nashville TN", source_rank: 1 },
  )
  assert.ok(mapped)
  assert.equal(mapped!.company_name, "Summit Commercial HVAC")
  assert.equal(mapped!.raw_payload_server_only?.source_provider, "serp")
  assert.equal(mapped!.raw_payload_server_only?.serp_place_id, "ChIJserp123")
  assert.ok(mapped!.evidence.length > 0)
  assert.ok(mapped!.source_attribution.length > 0)

  const parsed = parseSerpAddressFromString("100 Main St, Nashville, TN 37201, USA")
  assert.equal(parsed.city, "Nashville")
  assert.equal(parsed.state, "TN")

  const q = buildSerpDiscoveryQuery({
    industry: "commercial HVAC repair",
    location: "Nashville TN",
  })
  assert.match(q, /HVAC|hvac/i)
  assert.match(q, /Nashville TN/)

  // 5. Prospect Search discover mode consumes live SERP candidates
  assert.match(prospectRepoSource, /runProspectSearchRealWorldDiscovery/)
  assert.match(prospectRepoSource, /provider_diagnostics/)
  assert.match(prospectRepoSource, /provider_fallback_reason/)
  assert.match(prospectRepoSource, /GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER/)
  assert.match(repoSource, /runRealWorldDiscoveryProviders/)
  assert.match(repoSource, /provider_diagnostics/)

  // 6. Fixture fallback only when SERP (and other live providers) unavailable
  assert.match(registrySource, /if \(p\.provider_type === "fixture"\) return useFixtureFallback/)
  assert.match(registrySource, /!anyLiveProviderConfigured/)

  // Diagnostics + QA marker in UI
  assert.match(shellSource, /provider_diagnostics/)
  assert.match(shellSource, /GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER/)
  assert.match(shellSource, /provider_executed/)

  console.log(`${GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER} checks passed`)
}

void main()
