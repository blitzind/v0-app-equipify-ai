/**
 * Apollo-Scale-2 production route certification — no live DB/Apollo HTTP in CI.
 * Run: pnpm test:apollo-scale-2-production-route
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_SCALE_2_DEFAULT_COMPANY_LIMIT,
  APOLLO_SCALE_2_EXECUTE_CONFIRM,
  APOLLO_SCALE_2_PRODUCTION_ROUTE_QA_MARKER,
  assertApolloScale2ProductionExecuteAllowed,
  buildApolloScale2ProductionReadinessPayload,
  isApolloScale2ProductionRuntime,
  validateApolloScale2Confirmation,
} from "../lib/growth/apollo/apollo-scale-2-production-route-gates"
import { buildApolloScale2EvidenceBundle } from "../lib/growth/apollo/apollo-scale-2-evidence-bundle"
import { assertApolloEnrichmentCertProductionResponseHasNoSecrets } from "../lib/growth/apollo/apollo-enrichment-cert-production-route-gates"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-scale-2-production-route-gates.ts",
  "lib/growth/apollo/apollo-scale-2-production-route.ts",
  "lib/growth/apollo/apollo-scale-2-evidence-bundle.ts",
  "lib/growth/apollo/apollo-scale-2-live-acquisition-certification.ts",
  "app/api/platform/growth/apollo-scale-2/readiness/route.ts",
  "app/api/platform/growth/apollo-scale-2/execute/route.ts",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assert.equal(APOLLO_SCALE_2_PRODUCTION_ROUTE_QA_MARKER, "apollo-scale-2-production-route-v1")
assert.equal(APOLLO_SCALE_2_EXECUTE_CONFIRM, "RUN_APOLLO_SCALE_2")
console.log("  ✓ Scale-2 production QA markers")

const nonProduction = assertApolloScale2ProductionExecuteAllowed({
  VERCEL_ENV: "preview",
  GROWTH_APOLLO_SCALE_2_ENABLED: "true",
  GROWTH_APOLLO_SCALE_2_ACK: "1",
  GROWTH_APOLLO_USE_MOCK: "false",
  APOLLO_API_KEY: "test-key",
  GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
} as NodeJS.ProcessEnv)
assert.equal(nonProduction.ok, false)
assert.ok(nonProduction.blockers.some((b) => b.includes("VERCEL_ENV")))
console.log("  ✓ gates — rejects non-production runtime")

const blocked = assertApolloScale2ProductionExecuteAllowed({
  VERCEL_ENV: "production",
  GROWTH_APOLLO_SCALE_2_ENABLED: "false",
  GROWTH_APOLLO_SCALE_2_ACK: "1",
} as NodeJS.ProcessEnv)
assert.ok(blocked.blockers.some((b) => b.includes("GROWTH_APOLLO_SCALE_2_ENABLED")))
console.log("  ✓ gates — requires GROWTH_APOLLO_SCALE_2_ENABLED")

const productionEnv = {
  VERCEL_ENV: "production",
  NODE_ENV: "production",
  GROWTH_APOLLO_SCALE_2_ENABLED: "true",
  GROWTH_APOLLO_SCALE_2_ACK: "1",
  GROWTH_APOLLO_USE_MOCK: "false",
  APOLLO_API_KEY: "test-key",
  GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
  GROWTH_APOLLO_ENRICH_EMAILS: "true",
  GROWTH_APOLLO_ENRICH_EMAILS_ACK: "1",
  GROWTH_APOLLO_LIVE_BENCHMARK_ACK: "1",
} as NodeJS.ProcessEnv
const allowed = assertApolloScale2ProductionExecuteAllowed(productionEnv)
assert.equal(allowed.ok, true)
assert.equal(allowed.company_limit, APOLLO_SCALE_2_DEFAULT_COMPANY_LIMIT)
console.log("  ✓ gates — production Scale-2 allowed with Apollo key")

const confirm = validateApolloScale2Confirmation({ confirm: APOLLO_SCALE_2_EXECUTE_CONFIRM })
assert.equal(confirm.ok, true)
assert.equal(confirm.company_limit, APOLLO_SCALE_2_DEFAULT_COMPANY_LIMIT)
console.log("  ✓ confirmation — accepts RUN_APOLLO_SCALE_2")

const readiness = buildApolloScale2ProductionReadinessPayload({
  cohort_companies_selected: 15,
  cohort_companies: [{ company_candidate_id: "a", company_name: "Test Co", domain: "test.co" }],
  cohort_error: null,
  env: productionEnv,
})
assert.equal(readiness.apollo_credits_required, true)
assert.equal(readiness.cohort_companies_selected, 15)
assert.match(readiness.browser_console_execute_snippet, /apollo-scale-2\/execute/)
const readinessJson = JSON.stringify(readiness)
assertApolloEnrichmentCertProductionResponseHasNoSecrets(readinessJson)
console.log("  ✓ readiness — cohort preview, no secrets, browser snippet")

const executeRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/apollo-scale-2/execute/route.ts"),
  "utf8",
)
const productionRoute = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-scale-2-production-route.ts"),
  "utf8",
)
assert.match(executeRoute, /requireGrowthEnginePlatformAccess/)
assert.match(executeRoute, /executeApolloScale2InProduction/)
assert.match(executeRoute, /maxDuration = 300/)
assert.match(productionRoute, /certifyApolloScale2LiveAcquisition/)
assert.match(productionRoute, /resolveApolloScale2LiveCohort/)
assert.doesNotMatch(executeRoute, /confirmGrowthSequenceEnrollment/)
assert.doesNotMatch(executeRoute, /runSequenceExecutionJob/)
assert.doesNotMatch(productionRoute, /APOLLO_API_KEY/)
console.log("  ✓ execute route — platform admin, acquisition only, no outreach")

const bundle = buildApolloScale2EvidenceBundle({
  certification: {
    qa_marker: "apollo-scale-2-live-acquisition-cert-v1",
    result: "PASS_PARTIAL",
    certified_at: new Date().toISOString(),
    mode: "live_apollo_acquisition",
    safety: {
      auto_enrollment: false,
      outreach_sent: false,
      enrollment_confirmed: false,
      execution_approved: false,
      scheduler_ran: false,
    },
    cohort_selection: {
      companies_requested: 15,
      companies_selected: 15,
      excluded_henry_schein: true,
      required: {
        canonical_company: true,
        valid_domain: true,
        no_prior_apollo_acquisition: true,
      },
      selected: [],
      skipped_due_to_prior_apollo: 0,
      skipped_due_to_missing_domain: 0,
    },
    company_results: [],
    aggregate: {
      companies_processed: 15,
      apollo_contacts_found: 20,
      apollo_contacts_enriched: 10,
      company_contacts_created: 8,
      contactable_contacts: 6,
      sequence_ready_contacts: 4,
      search_to_enriched_pct: 50,
      search_to_contactable_pct: 30,
      search_to_sequence_ready_pct: 20,
      enrichment_success_pct: 50,
      promotion_success_pct: 40,
      canonical_resolution_success_pct: 100,
    },
    credit_efficiency: {
      apollo_credits_consumed: 10,
      contacts_per_credit: 2,
      contactable_contacts_per_credit: 0.6,
      sequence_ready_contacts_per_credit: 0.4,
      estimated_cost_per_sequence_ready_lead: 2.5,
    },
    failures_by_category: {
      no_email: 0,
      no_phone: 0,
      missing_person: 0,
      canonical_failure: 0,
      enrichment_failure: 0,
      promotion_failure: 0,
      suppression: 0,
      low_confidence: 0,
      other: 0,
    },
    failures_ranked: [],
    henry_schein_baseline: {
      company_candidate_id: "d2e669d5-e912-4fb7-992a-b4f9a92ff56a",
      contacts_found: 10,
      contacts_enriched: 8,
      contactable: 5,
      sequence_ready: 5,
      note: "Certified reference path — excluded from this live cohort run.",
    },
    recommendation: {
      ready_as_primary_engine: false,
      expected_sequence_ready_yield_pct: 20,
      biggest_blockers: [],
      answers: {
        is_apollo_ready_as_primary: "Partially",
        expected_sequence_ready_yield: "20%",
        biggest_blockers_before_hundreds: "none",
      },
    },
    runtime: { duration_ms: 1, api_calls: 1, errors: [], mock: false },
  },
})
assert.equal(bundle.verdict, "PASS_PARTIAL")
assert.equal(bundle.safety.auto_enrollment, false)
assert.equal(bundle.safety.outreach_sent, false)
assert.equal(bundle.safety.scheduler_run, false)
assert.equal(bundle.safety.execution_created, false)
console.log("  ✓ evidence bundle — safety hard-coded, verdict preserved")

assert.equal(isApolloScale2ProductionRuntime({ VERCEL_ENV: "production" } as NodeJS.ProcessEnv), true)
console.log("  ✓ runtime helpers")

console.log("\nAll Apollo-Scale-2 production route checks passed.")
