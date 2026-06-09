/**
 * Apollo-Scale-2 evidence generation — verifies failed companies are preserved.
 * Run: pnpm test:apollo-scale-2-evidence-generation
 */
import assert from "node:assert/strict"
import { buildApolloScale2EvidenceBundle } from "../lib/growth/apollo/apollo-scale-2-evidence-bundle"

const certification = {
  qa_marker: "apollo-scale-2-live-acquisition-cert-v1",
  result: "FAIL",
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
    companies_requested: 2,
    companies_selected: 2,
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
  companies: [
    {
      company_candidate_id: "company-1",
      company_name: "Company 1",
      domain: "company1.com",
      search_attempted: true,
      contacts_found: 2,
      contacts_enriched: 2,
      contacts_promoted: 2,
      contactable_contacts: 1,
      sequence_ready_contacts: 0,
      blockers: [],
      error: null,
      error_metadata: null,
      apollo_response_status: "success",
      failed: false,
    },
    {
      company_candidate_id: "company-2",
      company_name: "Company 2",
      domain: "company2.com",
      search_attempted: true,
      contacts_found: 2,
      contacts_enriched: 0,
      contacts_promoted: 0,
      contactable_contacts: 0,
      sequence_ready_contacts: 0,
      blockers: ["enrichment_failed", "missing_person"],
      error: "enrichment_failed",
      error_metadata: { name: "Error", stack: "stack-trace" },
      apollo_response_status: "success",
      failed: true,
    },
  ],
  failure_analysis: {
    enrichment_failure: ["Company 2"],
    missing_person: ["Company 2"],
    low_confidence: ["Company 2"],
    no_email: [],
    no_phone: [],
    canonical_failure: [],
    promotion_failure: [],
    suppression: [],
    other: [],
  },
  aggregate: {
    companies_processed: 2,
    apollo_contacts_found: 4,
    apollo_contacts_enriched: 2,
    company_contacts_created: 2,
    contactable_contacts: 1,
    sequence_ready_contacts: 0,
    search_to_enriched_pct: 50,
    search_to_contactable_pct: 25,
    search_to_sequence_ready_pct: 0,
    enrichment_success_pct: 50,
    promotion_success_pct: 50,
    canonical_resolution_success_pct: 100,
  },
  credit_efficiency: {
    apollo_credits_consumed: 2,
    contacts_per_credit: 2,
    contactable_contacts_per_credit: 0.5,
    sequence_ready_contacts_per_credit: 0,
    estimated_cost_per_sequence_ready_lead: null,
  },
  failures_by_category: {
    enrichment_failure: 1,
    missing_person: 2,
    low_confidence: 1,
    no_email: 0,
    no_phone: 0,
    canonical_failure: 0,
    promotion_failure: 0,
    suppression: 0,
    other: 0,
  },
  failures_ranked: [
    { category: "missing_person", count: 2, examples: ["Company 2"] },
    { category: "enrichment_failure", count: 1, examples: ["Company 2"] },
    { category: "low_confidence", count: 1, examples: ["Company 2"] },
  ],
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
    expected_sequence_ready_yield_pct: 0,
    biggest_blockers: ["missing_person (2)", "enrichment_failure (1)"],
    answers: {
      is_apollo_ready_as_primary: "No",
      expected_sequence_ready_yield: "0%",
      biggest_blockers_before_hundreds: "missing_person (2); enrichment_failure (1)",
    },
  },
  runtime: { duration_ms: 1, api_calls: 2, errors: [], mock: false },
}

const bundle = buildApolloScale2EvidenceBundle({ certification: certification as Parameters<typeof buildApolloScale2EvidenceBundle>[0]["certification"] })

assert.equal(certification.companies.length, 2)
assert.equal(certification.companies[1]?.failed, true)
console.log("  ✓ failed company row preserved in companies[]")

assert.ok(certification.failure_analysis.enrichment_failure.includes("Company 2"))
assert.ok(certification.failure_analysis.missing_person.includes("Company 2"))
assert.equal(certification.failures_ranked.find((row) => row.category === "missing_person")?.count, 2)
console.log("  ✓ failure_analysis lists company names by category")

assert.equal(bundle.companies.length, 2)
assert.equal(bundle.verdict, "FAIL")
assert.ok(bundle.blockers.some((blocker) => blocker.startsWith("missing_person")))
assert.equal(bundle.failure_analysis.enrichment_failure.length, 1)
console.log("  ✓ evidence bundle exposes top-level companies and failure_analysis")

console.log("\nApollo-Scale-2 evidence generation checks passed.")
