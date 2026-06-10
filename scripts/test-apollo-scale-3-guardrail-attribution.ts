/**
 * Apollo Scale-3 guardrail budgets + current-run attribution regression checks.
 * Run: pnpm test:apollo-scale-3-guardrail-attribution
 */
import assert from "node:assert/strict"
import {
  assessApolloScale3SearchStrategyResult,
} from "../lib/growth/apollo/apollo-scale-3-certification-assessment"
import {
  assertApolloCurrentRunMetricsConsistent,
  resolveApolloCurrentRunAttribution,
} from "../lib/growth/apollo/apollo-current-run-attribution"
import { buildApolloAcquisitionSearchEvidence } from "../lib/growth/apollo/apollo-acquisition-search-evidence"
import {
  ApolloRunGuardrailError,
  assertApolloCompanyAcquisitionAllowed,
  assertApolloSearchApiCallAllowed,
  beginApolloRunGuardrails,
  formatApolloRunGuardrailExceededMessage,
  recordApolloCompanyAcquisitionStarted,
  recordApolloSearchApiCall,
  resetApolloRunGuardrails,
} from "../lib/growth/providers/apollo/apollo-run-guardrails"
import type { GrowthContactCandidate } from "../lib/growth/contact-discovery/contact-discovery-types"

function candidate(id: string, email: string): GrowthContactCandidate {
  return {
    id,
    company_candidate_id: "company-1",
    provider_type: "future_apollo",
    full_name: "Jane Owner",
    email,
    metadata: { apollo_email_status: "verified" },
  } as GrowthContactCandidate
}

function testSearchApiCallsDoNotIncrementCompanyBudget(): void {
  beginApolloRunGuardrails()
  for (let index = 0; index < 20; index += 1) {
    recordApolloSearchApiCall()
  }
  assert.throws(() => assertApolloSearchApiCallAllowed({ env: { GROWTH_APOLLO_MAX_API_CALLS_PER_RUN: "15" } }), ApolloRunGuardrailError)
  assert.doesNotThrow(() => assertApolloCompanyAcquisitionAllowed({ env: { GROWTH_APOLLO_MAX_COMPANIES_PER_RUN: "15" } }))
  resetApolloRunGuardrails()
}

function testFifteenCompaniesCanEnterAcquisition(): void {
  beginApolloRunGuardrails()
  for (let index = 0; index < 15; index += 1) {
    assert.doesNotThrow(() => assertApolloCompanyAcquisitionAllowed({ env: { GROWTH_APOLLO_MAX_COMPANIES_PER_RUN: "15" } }))
    recordApolloCompanyAcquisitionStarted()
  }
  assert.throws(() => assertApolloCompanyAcquisitionAllowed({ env: { GROWTH_APOLLO_MAX_COMPANIES_PER_RUN: "15" } }), ApolloRunGuardrailError)
  resetApolloRunGuardrails()
}

function testGuardrailMessagesNameBudget(): void {
  assert.match(
    formatApolloRunGuardrailExceededMessage("search_api_calls", 60),
    /max search API calls per run \(60\)/,
  )
  assert.match(
    formatApolloRunGuardrailExceededMessage("companies_acquired", 15),
    /max companies acquired per run \(15\)/,
  )
  assert.match(
    formatApolloRunGuardrailExceededMessage("enrichment_api_calls", 10),
    /max enrichment API calls per run \(10\)/,
  )
}

function testZeroRawHistoricalContactsDoNotCurrentRunPass(): void {
  const attribution = resolveApolloCurrentRunAttribution({
    apollo_mapped_this_run: 0,
    apollo_persisted_this_run: 0,
    apollo_candidate_ids_before: new Set(["historical-1"]),
    apollo_candidates_after: [candidate("historical-1", "jane@omi.com")],
    verified_email_promotion: {
      qa_marker: "apollo-verified-email-promotion-evidence-v1",
      verified_email_contacts: 3,
      canonical_person_created: 0,
      canonical_person_matched: 3,
      company_contacts_promoted: 4,
      contactable_after_promotion: 3,
      sequence_ready_after_promotion: 3,
      blockers_by_contact: [],
    },
    existing_contactable_before: 0,
    company_contacts: [
      {
        contact_candidate_id: "historical-1",
        email: "jane@omi.com",
        email_status: "verified",
        canonical_person_id: "person-1",
      },
    ],
  })

  assert.equal(attribution.current_run_apollo_verified_email_contacts, 0)
  assert.equal(attribution.historical_apollo_verified_email_contacts, 1)
  assert.equal(
    assessApolloScale3SearchStrategyResult({
      mock: false,
      companies: [
        {
          company_candidate_id: "omi",
          company_name: "OMI MedTech",
          domain: "omimedtech.com",
          search_attempted: true,
          contacts_found: 0,
          contacts_enriched: 0,
          contacts_promoted: 0,
          contactable_contacts: 0,
          sequence_ready_contacts: 0,
          blockers: [],
          error: null,
          failed: false,
          tier_used: 1,
          raw_contacts_returned: 0,
          mapped_contacts: 0,
          mapping_rejections: 0,
          rejection_reasons: {},
          mapper_rejection_evidence: null,
          tier_attempts: [],
          tier_attempts_compact: [],
          contactable: 0,
          sequence_ready: 0,
          legacy_fallback_used: false,
          promotion_evidence: {
            apollo_search_attempted: true,
            apollo_search_skipped_reason: null,
            enrichment_attempted: true,
            enrichment_skipped_reason: null,
            verified_status_without_email_selected: 0,
            email_enrichment_candidates_selected: 0,
            email_enrichment_candidates_updated: 0,
            email_enrichment_error: null,
            email_enrichment_error_stage: null,
            verified_email_contacts: 3,
            company_contacts_promoted: 4,
            contactable_after_promotion: 3,
            sequence_ready_after_promotion: 3,
            current_run_apollo_verified_email_contacts: 0,
            current_run_apollo_promoted_contacts: 0,
            current_run_apollo_contactable_contacts: 0,
            current_run_apollo_sequence_ready_contacts: 0,
            historical_apollo_verified_email_contacts: 3,
            legacy_contactable_contacts: 0,
          },
          acquisition_evidence: null,
        },
      ],
    }),
    "FAIL",
  )
}

function testMetricLeakBlockerWhenMappedZero(): void {
  const blockers = assertApolloCurrentRunMetricsConsistent({
    apollo_mapped_this_run: 0,
    apollo_persisted_this_run: 0,
    current_run_apollo_verified_email_contacts: 3,
    current_run_apollo_promoted_contacts: 4,
    current_run_apollo_sequence_ready_contacts: 3,
  })
  assert.ok(blockers.includes("current_run_metric_leak:verified_email_without_search_yield"))
  assert.ok(blockers.includes("current_run_metric_leak:promoted_without_search_yield"))
}

function testZeroRawPreservesLastAttemptedTierEvidence(): void {
  const built = buildApolloAcquisitionSearchEvidence({
    company_name: "OMI MedTech",
    company_domain: "omimedtech.com",
    apollo_search_attempted: true,
    apollo_search_skipped_reason: null,
    apollo_persisted_this_run: 0,
    existing_contactable_before: 0,
    blockers: ["apollo_zero_contacts_mapped"],
    search_strategy: {
      qa_marker: "apollo-tiered-people-search-v2",
      tier_used: null,
      chosen_tier: 5,
      chosen_tier_name: "E_no_title_fallback",
      last_attempted_tier: 5,
      last_attempted_tier_name: "E_no_title_fallback",
      stop_reason: "exhausted_all_tiers",
      tier_attempts: [
        {
          tier: 5,
          tier_name: "E_no_title_fallback",
          request_payload: { per_page: "5" },
          request_payload_summary: "E_no_title_fallback;domain=omimedtech.com",
          company_domain: "omimedtech.com",
          company_name: "OMI MedTech",
          organization_location: null,
          person_titles: [],
          person_seniorities: [],
          domain_exact_only: true,
          title_filter_applied: false,
          raw_contacts_returned: 0,
          mapped_contacts: 0,
          mapping_rejections: 0,
          rejection_reasons: {},
          mapper_rejection_samples: [],
          apollo_status: "success",
          apollo_message: null,
          skipped_reason: null,
        },
      ],
      raw_contacts_returned: 0,
      mapped_contacts: 0,
      mapping_rejections: 0,
      rejection_reasons: {},
      legacy_fallback_used: false,
      legacy_contactable_count: 0,
    },
    env: {
      GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
      APOLLO_API_KEY: "test-key",
      GROWTH_APOLLO_USE_MOCK: "true",
    },
  })

  assert.equal(built.apollo_search_evidence?.chosen_tier_name, "E_no_title_fallback")
  assert.equal(built.apollo_search_evidence?.last_attempted_tier_name, "E_no_title_fallback")
}

function main(): void {
  testSearchApiCallsDoNotIncrementCompanyBudget()
  console.log("  ✓ search API calls do not consume company-acquired budget")
  testFifteenCompaniesCanEnterAcquisition()
  console.log("  ✓ 15 companies can enter acquisition under company budget")
  testGuardrailMessagesNameBudget()
  console.log("  ✓ guardrail messages name the exceeded budget")
  testZeroRawHistoricalContactsDoNotCurrentRunPass()
  console.log("  ✓ zero raw + historical contacts cannot current-run PASS")
  testMetricLeakBlockerWhenMappedZero()
  console.log("  ✓ raw=0/mapped=0 cannot report current-run verified/promoted/sequence-ready")
  testZeroRawPreservesLastAttemptedTierEvidence()
  console.log("  ✓ zero_raw preserves chosen/last_attempted tier evidence")
  console.log("\nApollo Scale-3 guardrail + attribution checks passed.")
}

main()
