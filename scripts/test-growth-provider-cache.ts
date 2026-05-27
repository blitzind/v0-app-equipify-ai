/**
 * Provider query cache + cost control regression checks (Prompt 30).
 * Run: pnpm test:growth-provider-cache
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildProviderQueryHash,
  normalizeProviderQuery,
  stableQueryInputJson,
} from "../lib/growth/provider-cache/provider-cache-normalizer"
import {
  estimateProviderCost,
  isProviderCacheEnabled,
  mergeProviderQueryCacheStats,
  providerCacheExpiresAt,
  statsFromCachedQueryResults,
} from "../lib/growth/provider-cache/provider-cache-cost"
import { isCacheValid } from "../lib/growth/provider-cache/provider-cache-types"
import {
  GROWTH_PROVIDER_CACHE_QA_MARKER,
  PROVIDER_CACHE_TTL_DAYS,
} from "../lib/growth/provider-cache/provider-cache-types"
import {
  assertGrowthProviderCacheSchemaMigrationContent,
  GROWTH_PROVIDER_CACHE_SCHEMA_MIGRATION,
  resolveGrowthProviderCacheSchemaMigration,
} from "../lib/growth/provider-cache/provider-cache-schema-health"

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_PROVIDER_CACHE_QA_MARKER, "growth-provider-cache-v1")

  const migrationFile = resolveGrowthProviderCacheSchemaMigration()
  assert.equal(
    migrationFile,
    GROWTH_PROVIDER_CACHE_SCHEMA_MIGRATION,
    "resolved migration filename should match exported constant",
  )
  assert.equal(migrationFile, "20270407120000_growth_engine_provider_query_cache.sql")

  const migration = read(`supabase/migrations/${migrationFile}`)
  assertGrowthProviderCacheSchemaMigrationContent(migration)
  assert.match(migration, /provider_name, query_hash/)
  assert.match(migration, /expires_at/)
  assert.match(migration, /service_role/)

  const norm1 = normalizeProviderQuery("  Medical Equipment Repair,  Tennessee!! ")
  const norm2 = normalizeProviderQuery("medical equipment repair tennessee")
  assert.equal(norm1, norm2)

  const hash1 = buildProviderQueryHash("google_places", norm1)
  const hash2 = buildProviderQueryHash("google_places", norm2)
  const hash3 = buildProviderQueryHash("serp", norm1)
  assert.equal(hash1, hash2)
  assert.notEqual(hash1, hash3)
  assert.equal(hash1.length, 40)

  assert.deepEqual(stableQueryInputJson({ limit: 20, z: 1, a: 2 }), { a: 2, limit: 20, z: 1 })

  assert.equal(PROVIDER_CACHE_TTL_DAYS.google_places, 14)
  assert.equal(PROVIDER_CACHE_TTL_DAYS.serp, 7)
  assert.equal(PROVIDER_CACHE_TTL_DAYS.business_directory, 30)
  assert.equal(isProviderCacheEnabled("google_places"), true)
  assert.equal(isProviderCacheEnabled("fixture" as never), false)

  assert.equal(estimateProviderCost("google_places", 2), 0.064)
  assert.equal(estimateProviderCost("serp", 1), 0.01)

  const expires = Date.parse(providerCacheExpiresAt("google_places"))
  const fourteenDays = 14 * 24 * 60 * 60 * 1000
  assert.ok(expires > Date.now() + fourteenDays - 60_000)
  assert.ok(expires < Date.now() + fourteenDays + 60_000)

  const future = new Date(Date.now() + 60_000).toISOString()
  const past = new Date(Date.now() - 60_000).toISOString()
  assert.equal(
    isCacheValid({
      id: "1",
      provider_name: "google_places",
      query_hash: "abc",
      normalized_query: "test",
      query_input_json: {},
      response_summary: null,
      candidate_count: 0,
      cached_result_json: {},
      provider_latency_ms: 10,
      provider_cost_estimate: 0.03,
      cache_hit_count: 0,
      created_at: new Date().toISOString(),
      expires_at: future,
      last_used_at: new Date().toISOString(),
    }),
    true,
  )
  assert.equal(
    isCacheValid({
      id: "1",
      provider_name: "google_places",
      query_hash: "abc",
      normalized_query: "test",
      query_input_json: {},
      response_summary: null,
      candidate_count: 0,
      cached_result_json: {},
      provider_latency_ms: 10,
      provider_cost_estimate: 0.03,
      cache_hit_count: 0,
      created_at: new Date().toISOString(),
      expires_at: past,
      last_used_at: new Date().toISOString(),
    }),
    false,
  )

  const stats = statsFromCachedQueryResults([
    { cache_hit: true, provider_latency_ms: 0, provider_cost_estimate: 0 },
    { cache_hit: false, provider_latency_ms: 420, provider_cost_estimate: 0.032 },
  ])
  assert.equal(stats.live_request_count, 1)
  assert.equal(stats.cache_hit_count, 1)
  assert.equal(stats.provider_cost_estimate, 0.032)
  assert.equal(stats.any_cache_hit, true)

  const merged = mergeProviderQueryCacheStats([
    { live_request_count: 2, cache_hit_count: 3, provider_cost_estimate: 0.064, average_latency_ms: 400, any_cache_hit: true, newest_cache_age_ms: 1000 },
    { live_request_count: 1, cache_hit_count: 1, provider_cost_estimate: 0.01, average_latency_ms: 200, any_cache_hit: true, newest_cache_age_ms: 500 },
  ])
  assert.equal(merged.live_request_count, 3)
  assert.equal(merged.cache_hit_count, 4)
  assert.equal(merged.provider_cost_estimate, 0.074)

  const googlePlacesSource = read("lib/growth/real-world-discovery/providers/google-places-provider.ts")
  const serpSource = read("lib/growth/real-world-discovery/providers/serp-provider.ts")
  const registrySource = read("lib/growth/real-world-discovery/real-world-discovery-registry.ts")
  const repoSource = read("lib/growth/real-world-discovery/real-world-discovery-repository.ts")
  const shellSource = read("components/growth/prospect-search/prospect-search-shell.tsx")
  const diagnosticsSource = read(
    "components/growth/prospect-search/prospect-search-diagnostics-disclosure.tsx",
  )

  assert.match(googlePlacesSource, /executeCachedRealWorldProviderQuery/)
  assert.match(serpSource, /executeCachedRealWorldProviderQuery/)
  assert.match(registrySource, /admin\?: SupabaseClient/)
  assert.match(repoSource, /runRealWorldDiscoveryProviders\(providerQuery, \{ admin \}\)/)
  assert.match(shellSource, /ProspectSearchDiagnosticsDisclosure/)
  assert.match(diagnosticsSource, /ProviderCacheCostDiagnostics/)
  assert.match(diagnosticsSource, /provider_cache_qa_marker/)
  assert.match(read("components/growth/prospect-search/real-world-provider-status.tsx"), /GROWTH_PROVIDER_CACHE_QA_MARKER/)

  console.log(`${GROWTH_PROVIDER_CACHE_QA_MARKER} checks passed`)
}

void main()
