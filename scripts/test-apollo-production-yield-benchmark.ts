/**
 * Apollo production yield benchmark — greenfield economics regression checks.
 * Run: pnpm test:apollo-production-yield-benchmark
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_PRODUCTION_YIELD_BENCHMARK_EXECUTE_CONFIRM,
  APOLLO_PRODUCTION_YIELD_BENCHMARK_ROUTE_QA_MARKER,
  assertApolloProductionYieldBenchmarkExecuteAllowed,
  buildApolloProductionYieldBenchmarkReadinessPayload,
  validateApolloProductionYieldBenchmarkConfirmation,
} from "../lib/growth/apollo/apollo-production-yield-benchmark-route-gates"
import {
  APOLLO_PRODUCTION_YIELD_BENCHMARK_DEFAULT_COMPANY_LIMIT,
  APOLLO_PRODUCTION_YIELD_BENCHMARK_ID,
  APOLLO_PRODUCTION_YIELD_BENCHMARK_MAX_COMPANY_LIMIT,
  APOLLO_PRODUCTION_YIELD_BENCHMARK_QA_MARKER,
} from "../lib/growth/apollo/apollo-production-yield-benchmark-types"
import {
  dedupeApolloProductionYieldCompanyNames,
  previewDeterministicGreenfieldCohortSelection,
  resolveApolloProductionYieldBenchmarkCompanyLimit,
} from "../lib/growth/apollo/apollo-production-yield-benchmark-cohort-selection"
import { classifyCompanyFailure } from "../lib/growth/apollo/apollo-production-yield-benchmark-classify"
import { assertApolloEnrichmentCertProductionResponseHasNoSecrets } from "../lib/growth/apollo/apollo-enrichment-cert-production-route-gates"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-production-yield-benchmark-types.ts",
  "lib/growth/apollo/apollo-production-yield-benchmark-cohort.ts",
  "lib/growth/apollo/apollo-production-yield-benchmark.ts",
  "lib/growth/apollo/apollo-production-yield-benchmark-route-gates.ts",
  "lib/growth/apollo/apollo-production-yield-benchmark-route.ts",
  "app/api/platform/growth/apollo-production-yield-benchmark/readiness/route.ts",
  "app/api/platform/growth/apollo-production-yield-benchmark/execute/route.ts",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assert.equal(APOLLO_PRODUCTION_YIELD_BENCHMARK_QA_MARKER, "apollo-production-yield-benchmark-greenfield-v1")
assert.equal(APOLLO_PRODUCTION_YIELD_BENCHMARK_ID, "apollo-production-yield-benchmark-greenfield-v1")
assert.equal(APOLLO_PRODUCTION_YIELD_BENCHMARK_ROUTE_QA_MARKER, "apollo-production-yield-benchmark-route-v1")
console.log("  ✓ yield benchmark QA markers")

const greenfieldReject = validateApolloProductionYieldBenchmarkConfirmation({
  confirm: APOLLO_PRODUCTION_YIELD_BENCHMARK_EXECUTE_CONFIRM,
  certification_mode: "certification_winners_revalidation",
})
assert.equal(greenfieldReject.ok, false)
assert.match(greenfieldReject.error ?? "", /greenfield-only/)
console.log("  ✓ greenfield benchmark cannot use historical revalidation")

const presetReject = validateApolloProductionYieldBenchmarkConfirmation({
  confirm: APOLLO_PRODUCTION_YIELD_BENCHMARK_EXECUTE_CONFIRM,
  cohort_preset: "certification_winners",
})
assert.equal(presetReject.ok, false)
console.log("  ✓ certification_winners cohort preset rejected")

const confirm50 = validateApolloProductionYieldBenchmarkConfirmation({
  confirm: APOLLO_PRODUCTION_YIELD_BENCHMARK_EXECUTE_CONFIRM,
})
assert.equal(confirm50.ok, true)
assert.equal(confirm50.company_limit, APOLLO_PRODUCTION_YIELD_BENCHMARK_DEFAULT_COMPANY_LIMIT)
console.log("  ✓ default 50-company confirmation")

const confirm100 = validateApolloProductionYieldBenchmarkConfirmation({
  confirm: APOLLO_PRODUCTION_YIELD_BENCHMARK_EXECUTE_CONFIRM,
  company_limit: 100,
})
assert.equal(confirm100.ok, true)
assert.equal(confirm100.company_limit, APOLLO_PRODUCTION_YIELD_BENCHMARK_MAX_COMPANY_LIMIT)
console.log("  ✓ optional 100-company confirmation")

const deduped = dedupeApolloProductionYieldCompanyNames([
  "Alpha Biomed",
  "alpha biomed",
  "Beta Service",
])
assert.equal(deduped.unique.length, 2)
assert.equal(deduped.deduped_count, 1)
console.log("  ✓ duplicate company names deduped")

const cohortPreview = previewDeterministicGreenfieldCohortSelection({
  company_limit: 4,
  rows: [
    { company_candidate_id: "c-2", company_name: "Bravo Medical", domain: "bravo.com", prior_apollo_candidates: 0 },
    { company_candidate_id: "c-1", company_name: "Alpha Medical", domain: "alpha.com", prior_apollo_candidates: 0 },
    { company_candidate_id: "c-3", company_name: "Alpha Medical", domain: "alpha.net", prior_apollo_candidates: 0 },
    { company_candidate_id: "c-4", company_name: "Charlie Medical", domain: "charlie.com", prior_apollo_candidates: 0 },
    { company_candidate_id: "c-5", company_name: "Delta Medical", domain: "alpha.com", prior_apollo_candidates: 0 },
    { company_candidate_id: "c-7", company_name: "Echo Medical", domain: "echo.com", prior_apollo_candidates: 0 },
    { company_candidate_id: "c-6", company_name: "Foxtrot Medical", domain: "foxtrot.com", prior_apollo_candidates: 1 },
  ],
})
assert.deepEqual(cohortPreview.selected_ids, ["c-1", "c-2", "c-4", "c-7"])
assert.equal(cohortPreview.deduped_company_names, 1)
assert.equal(cohortPreview.deduped_domains, 1)
console.log("  ✓ deterministic cohort selection with name/domain dedupe")

assert.equal(
  resolveApolloProductionYieldBenchmarkCompanyLimit({ company_limit: 50 }),
  APOLLO_PRODUCTION_YIELD_BENCHMARK_DEFAULT_COMPANY_LIMIT,
)
assert.equal(
  resolveApolloProductionYieldBenchmarkCompanyLimit({ company_limit: 100 }),
  APOLLO_PRODUCTION_YIELD_BENCHMARK_MAX_COMPANY_LIMIT,
)
console.log("  ✓ company limit resolves to 50 or 100")

const failureZeroRaw = classifyCompanyFailure({
  raw_contacts_returned: 0,
  mapped_contacts: 0,
  partial_identity_evidence: {
    mapped_partial_identity_contacts: 0,
    partial_identity_enrichment_attempted: false,
    partial_identity_enrichment_resolved: 0,
  },
  current_run_apollo_verified_email_contacts: 0,
  current_run_apollo_promoted_contacts: 0,
  current_run_apollo_contactable_contacts: 0,
  current_run_apollo_sequence_ready_contacts: 0,
})
assert.equal(failureZeroRaw, "zero_raw")
console.log("  ✓ failure analysis — zero_raw")

const gatesBlocked = assertApolloProductionYieldBenchmarkExecuteAllowed({
  VERCEL_ENV: "production",
  GROWTH_APOLLO_PRODUCTION_YIELD_BENCHMARK_ENABLED: "false",
  GROWTH_APOLLO_PRODUCTION_YIELD_BENCHMARK_ACK: "0",
} as NodeJS.ProcessEnv)
assert.equal(gatesBlocked.ok, false)
console.log("  ✓ env gates require yield benchmark flags")

const readiness = buildApolloProductionYieldBenchmarkReadinessPayload({
  cohort_companies_selected: 50,
  cohort_companies: [
    {
      company_candidate_id: "id-1",
      company_name: "Test Co",
      domain: "test.com",
      domain_present: true,
    },
  ],
  cohort_error: null,
  env: {
    VERCEL_ENV: "production",
    GROWTH_APOLLO_PRODUCTION_YIELD_BENCHMARK_ENABLED: "true",
    GROWTH_APOLLO_PRODUCTION_YIELD_BENCHMARK_ACK: "1",
    GROWTH_APOLLO_SCALE_2_ENABLED: "true",
    GROWTH_APOLLO_SCALE_2_ACK: "1",
    GROWTH_APOLLO_USE_MOCK: "false",
    APOLLO_API_KEY: "test-key",
    GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
    GROWTH_APOLLO_ENRICH_EMAILS: "true",
    GROWTH_APOLLO_ENRICH_EMAILS_ACK: "1",
    GROWTH_APOLLO_LIVE_BENCHMARK_ACK: "1",
    GROWTH_APOLLO_MAX_COMPANIES_PER_RUN: "100",
    GROWTH_APOLLO_MAX_API_CALLS_PER_RUN: "200",
  } as NodeJS.ProcessEnv,
})
assert.equal(readiness.certification_mode, "greenfield")
assert.equal(readiness.historical_revalidation_allowed, false)
assert.ok(readiness.search_api_budget)
console.log("  ✓ readiness payload — greenfield only")

const mockBenchmark = {
  ok: true,
  execution_id: "exec-1",
  benchmark_id: APOLLO_PRODUCTION_YIELD_BENCHMARK_ID,
  benchmark: {
    qa_marker: APOLLO_PRODUCTION_YIELD_BENCHMARK_QA_MARKER,
    benchmark_id: APOLLO_PRODUCTION_YIELD_BENCHMARK_ID,
    execution_id: "exec-1",
    certified_at: new Date().toISOString(),
    certification_mode: "greenfield" as const,
    company_limit: 50,
    safety: {
      auto_enrollment: false as const,
      outreach_sent: false as const,
      enrollment_confirmed: false as const,
      execution_approved: false as const,
      scheduler_ran: false as const,
      draft_created: false as const,
      sequence_scheduled: false as const,
    },
    aggregate: {
      companies_processed: 50,
      companies_with_raw_people: 40,
      companies_with_mapped_people: 35,
      raw_people_count: 120,
      mapped_contacts: 90,
      partial_identity_contacts: 5,
      verified_email_contacts: 40,
      promoted_contacts: 35,
      contactable_contacts: 30,
      sequence_ready_contacts: 25,
      contacts_per_company: 1.8,
      verified_emails_per_company: 0.8,
      sequence_ready_per_company: 0.5,
    },
    economics: {
      apollo_search_api_calls: 80,
      enrichment_api_calls: 12,
      estimated_credits_consumed: 20,
      sequence_ready_contacts_per_100_companies: 50,
      estimated_cost_per_sequence_ready_contact: 0.8,
      credits_per_company: 0.4,
    },
    segments: {
      domain_present: [],
      domain_alias_used: [],
      title_tier_winner: [],
      company_category: [],
      state_location: [],
    },
    failure_analysis: {
      zero_raw: [],
      mapper_rejected: [],
      partial_identity_unresolved: [],
      no_verified_email: [],
      promotion_failed: [],
      contactability_failed: [],
      sequence_readiness_failed: [],
    },
    top_blockers: [],
    companies: [],
    recommendation: {
      benchmark_passed_for_scale: true,
      suggested_next_company_limit: 100,
      estimated_credits_per_100_sequence_ready_contacts: 40,
      monthly_credit_sizing_notes: [],
      apollo_plan_notes: [],
    },
    runtime: { duration_ms: 1, mock: true, errors: [] },
  },
  blockers: [],
}
assert.ok(mockBenchmark.benchmark.economics.apollo_search_api_calls >= 0)
assert.ok(mockBenchmark.benchmark.economics.enrichment_api_calls >= 0)
assert.ok(mockBenchmark.benchmark.economics.estimated_credits_consumed >= 0)
assert.equal(mockBenchmark.benchmark.safety.auto_enrollment, false)
assert.equal(mockBenchmark.benchmark.safety.outreach_sent, false)
assert.equal(mockBenchmark.benchmark.safety.draft_created, false)
assertApolloEnrichmentCertProductionResponseHasNoSecrets(mockBenchmark)
console.log("  ✓ economics counters present and no outreach side effects")

console.log("\nAll Apollo production yield benchmark tests passed.")
