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
  buildCanonicalCompanyBackfillApiResponse,
  buildCanonicalCompanyBackfillWarnings,
  canonicalCompanyBackfillResponseExcludesSecrets,
  GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM,
  GROWTH_CANONICAL_COMPANY_BACKFILL_API_QA_MARKER,
  parseCanonicalCompanyBackfillRequest,
  resolveCanonicalCompanyRuntimeContext,
} from "../lib/growth/canonical-companies/canonical-company-backfill-api"
import {
  GROWTH_CANONICAL_COMPANY_MIGRATION,
  GROWTH_CANONICAL_COMPANY_QA_MARKER,
  type GrowthCanonicalCompanyBackfillStats,
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

  assert.equal(GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM, "APPLY_GROWTH_CANONICAL_COMPANIES_7_2A")

  const dryParsed = parseCanonicalCompanyBackfillRequest({ mode: "dry_run" })
  assert.equal(dryParsed.ok, true)
  if (dryParsed.ok) assert.equal(dryParsed.mode, "dry_run")

  const applyBad = parseCanonicalCompanyBackfillRequest({ mode: "apply", confirm: "wrong" })
  assert.equal(applyBad.ok, false)
  if (!applyBad.ok) assert.equal(applyBad.error, "confirm_required")

  const applyOk = parseCanonicalCompanyBackfillRequest({
    mode: "apply",
    confirm: GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM,
  })
  assert.equal(applyOk.ok, true)

  const routeSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/canonical-companies/backfill/route.ts"),
    "utf8",
  )
  assert.match(routeSource, /requireGrowthEnginePlatformAccess/)
  assert.match(routeSource, /runCanonicalCompanyBackfill/)
  assert.match(routeSource, /isGrowthCanonicalCompanySchemaReady/)
  assert.match(routeSource, /parseCanonicalCompanyBackfillRequest/)
  assert.doesNotMatch(routeSource, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(routeSource, /serviceRoleKey/)
  assert.doesNotMatch(routeSource, /createServiceRoleClient/)
  if (!routeSource.includes("if (!access.ok) return access.response")) {
    assert.fail("route must return access.response when unauthorized")
  }

  const panelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-canonical-company-backfill-panel.tsx"),
    "utf8",
  )
  assert.match(panelSource, /canonical-companies\/backfill/)
  assert.match(panelSource, /GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM/)

  const infraPage = fs.readFileSync(
    path.join(process.cwd(), "app/(admin)/admin/growth/infrastructure/page.tsx"),
    "utf8",
  )
  assert.match(infraPage, /GrowthCanonicalCompanyBackfillPanel/)

  const mockStats: GrowthCanonicalCompanyBackfillStats = {
    qa_marker: GROWTH_CANONICAL_COMPANY_QA_MARKER,
    mode: "dry_run",
    sources: {
      external_company_candidates: {
        rows_processed: 1,
        already_linked: 0,
        resolved_normalized_domain: 1,
        resolved_domain_alias: 0,
        resolved_name_city: 0,
        resolved_name_state: 0,
        would_create_new: 0,
        review_tier: 1,
        errors: 0,
      },
      real_world_company_candidates: {
        rows_processed: 0,
        already_linked: 0,
        resolved_normalized_domain: 0,
        resolved_domain_alias: 0,
        resolved_name_city: 0,
        resolved_name_state: 0,
        would_create_new: 0,
        review_tier: 0,
        errors: 0,
      },
      discovery_candidates: {
        rows_processed: 0,
        already_linked: 0,
        resolved_normalized_domain: 0,
        resolved_domain_alias: 0,
        resolved_name_city: 0,
        resolved_name_state: 0,
        would_create_new: 0,
        review_tier: 0,
        errors: 0,
      },
    },
    canonical_companies_existing: 0,
    canonical_companies_after: 1,
    unique_normalized_domains: 1,
    merge_groups_by_domain: 2,
  }
  const warnings = buildCanonicalCompanyBackfillWarnings(mockStats)
  assert.ok(warnings.some((w) => w.includes("review-tier")))
  assert.ok(warnings.some((w) => w.includes("domain group")))

  const apiPayload = buildCanonicalCompanyBackfillApiResponse({
    mode: "dry_run",
    stats: mockStats,
    duration_ms: 42,
  })
  assert.equal(apiPayload.api_qa_marker, GROWTH_CANONICAL_COMPANY_BACKFILL_API_QA_MARKER)
  assert.equal(apiPayload.target_schema, "growth")
  assert.equal(apiPayload.duration_ms, 42)
  assert.ok(canonicalCompanyBackfillResponseExcludesSecrets(apiPayload))

  const ctx = resolveCanonicalCompanyRuntimeContext()
  assert.equal(ctx.target_schema, "growth")
  assert.ok(typeof ctx.deployment_environment === "string")

  console.log("growth-canonical-companies-7.2a: ok")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
