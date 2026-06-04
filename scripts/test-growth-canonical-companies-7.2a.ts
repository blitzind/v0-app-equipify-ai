/**
 * Phase 7.2A — Canonical company layer regression tests.
 * Run: pnpm test:growth-canonical-companies-7.2a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  canonicalNameCityKey,
  canonicalNormalizedDomain,
  canonicalNormalizedCompanyName,
} from "../lib/growth/canonical-companies/canonical-company-normalize"
import {
  createEmptyCanonicalCompanyResolverIndexes,
  registerNewCanonicalCompanyFromCandidate,
  resolveCanonicalCompany,
} from "../lib/growth/canonical-companies/canonical-company-resolver"
import { simulateCanonicalCompanyBackfill } from "../lib/growth/canonical-companies/canonical-company-simulate"
import {
  GROWTH_CANONICAL_COMPANY_MIGRATION,
  GROWTH_CANONICAL_COMPANY_QA_MARKER,
} from "../lib/growth/canonical-companies/canonical-company-types"

function candidate(
  partial: Partial<import("../lib/growth/canonical-companies/canonical-company-types").GrowthCanonicalCompanyCandidateInput> &
    Pick<
      import("../lib/growth/canonical-companies/canonical-company-types").GrowthCanonicalCompanyCandidateInput,
      "source_id" | "company_name"
    >,
): import("../lib/growth/canonical-companies/canonical-company-types").GrowthCanonicalCompanyCandidateInput {
  return {
    source_table: "real_world_company_candidates",
    run_id: "run-1",
    provider_name: "google_places",
    provider_type: "google_places",
    domain: null,
    website: null,
    city: null,
    state: null,
    confidence: 0.8,
    ...partial,
  }
}

async function main(): Promise<void> {
  assert.equal(GROWTH_CANONICAL_COMPANY_QA_MARKER, "growth-canonical-company-7.2a-v1")

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_CANONICAL_COMPANY_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /growth\.companies/)
  assert.match(migration, /growth\.company_domains/)
  assert.match(migration, /growth\.company_source_lineage/)
  assert.match(migration, /canonical_company_id/)
  assert.doesNotMatch(migration, /blitzpay|stripe|organization_subscriptions/i)

  const resolverSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/canonical-companies/canonical-company-resolver.ts"),
    "utf8",
  )
  assert.doesNotMatch(resolverSource, /\bopenai\b|\banthropic\b|\blevenshtein\b|\bembeddings?\b/i)

  assert.equal(canonicalNormalizedDomain("https://www.acme.com/path", null), "acme.com")
  assert.equal(canonicalNormalizedDomain(null, "https://acme.com"), "acme.com")
  assert.equal(canonicalNormalizedCompanyName("Acme Inc."), "acme")
  assert.equal(canonicalNameCityKey("Acme Inc.", "Dallas"), "acme|dallas")

  const indexes = createEmptyCanonicalCompanyResolverIndexes()
  registerNewCanonicalCompanyFromCandidate(
    indexes,
    "company-1",
    candidate({
      source_id: "a1",
      company_name: "Acme Corp",
      domain: "acme.com",
      website: "https://www.acme.com",
      city: "Dallas",
      state: "TX",
    }),
  )

  const byDomain = resolveCanonicalCompany(
    candidate({
      source_id: "a2",
      company_name: "ACME Incorporated",
      website: "http://acme.com/about",
      city: "Houston",
      state: "TX",
    }),
    indexes,
  )
  assert.equal(byDomain.resolution_method, "normalized_domain")
  assert.equal(byDomain.company_id, "company-1")
  assert.equal(byDomain.would_create_new, false)

  const byAlias = resolveCanonicalCompany(
    candidate({
      source_id: "a3",
      company_name: "Different Legal Name",
      domain: "acme.com",
    }),
    indexes,
  )
  assert.equal(byAlias.resolution_method, "normalized_domain")

  const indexes2 = createEmptyCanonicalCompanyResolverIndexes()
  registerNewCanonicalCompanyFromCandidate(
    indexes2,
    "company-dallas",
    candidate({
      source_id: "b1",
      company_name: "Beta LLC",
      city: "Austin",
      state: "TX",
    }),
  )

  const byNameCity = resolveCanonicalCompany(
    candidate({
      source_id: "b2",
      company_name: "Beta LLC",
      domain: "other-domain.com",
      city: "Austin",
      state: "TX",
    }),
    indexes2,
  )
  assert.equal(byNameCity.resolution_method, "name_city")
  assert.equal(byNameCity.review_tier, true)
  assert.equal(byNameCity.company_id, "company-dallas")

  const noFuzzyMerge = resolveCanonicalCompany(
    candidate({
      source_id: "b3",
      company_name: "Beta Services",
      domain: "gamma.com",
      city: "Austin",
    }),
    indexes2,
  )
  assert.equal(noFuzzyMerge.resolution_method, "new")
  assert.equal(noFuzzyMerge.company_id, null)

  const { company_ids_by_source } = simulateCanonicalCompanyBackfill([
    candidate({ source_id: "c1", company_name: "Gamma", domain: "gamma.com" }),
    candidate({ source_id: "c2", company_name: "Gamma Inc", website: "https://gamma.com" }),
    candidate({ source_id: "c3", company_name: "Delta", domain: "delta.com" }),
  ])
  assert.equal(company_ids_by_source.get("real_world_company_candidates:c1"), company_ids_by_source.get("real_world_company_candidates:c2"))
  assert.notEqual(company_ids_by_source.get("real_world_company_candidates:c1"), company_ids_by_source.get("real_world_company_candidates:c3"))

  const idempotent = simulateCanonicalCompanyBackfill([
    candidate({ source_id: "d1", company_name: "Epsilon", domain: "epsilon.com" }),
  ])
  const idempotent2 = simulateCanonicalCompanyBackfill([
    candidate({ source_id: "d1", company_name: "Epsilon", domain: "epsilon.com" }),
  ])
  assert.equal(
    idempotent.company_ids_by_source.get("real_world_company_candidates:d1"),
    idempotent2.company_ids_by_source.get("real_world_company_candidates:d1"),
  )

  const backfillSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/canonical-companies/canonical-company-backfill.ts"),
    "utf8",
  )
  assert.match(backfillSource, /source_metadata/)
  assert.match(backfillSource, /canonical-company-repository-core/)
  assert.doesNotMatch(backfillSource, /delete from|truncate/i)
  assert.doesNotMatch(backfillSource, /server-only/)

  const repoServer = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/canonical-companies/canonical-company-repository.ts"),
    "utf8",
  )
  assert.match(repoServer, /server-only/)
  assert.match(repoServer, /canonical-company-repository-core/)

  const scriptSource = fs.readFileSync(
    path.join(process.cwd(), "scripts/backfill-growth-canonical-companies-7.2a.ts"),
    "utf8",
  )
  assert.doesNotMatch(scriptSource, /\.env\.local/)
  assert.match(scriptSource, /resolveGrowthProductionSupabaseConfig/)

  console.log("growth-canonical-companies-7.2a: ok")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
