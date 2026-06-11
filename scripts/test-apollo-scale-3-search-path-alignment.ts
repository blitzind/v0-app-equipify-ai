/**
 * Apollo Scale-3 vs single-company diagnostic search path alignment.
 * Run: pnpm test:apollo-scale-3-search-path-alignment
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { buildApolloCohortCompanySearchDebug } from "../lib/growth/apollo/apollo-cohort-company-search-debug"
import {
  buildApolloScale3CompanyPromotionEvidence,
  mapApolloScale3CompanyEvidenceRow,
} from "../lib/growth/apollo/apollo-scale-3-company-promotion-evidence"
import { buildApolloSearchApiBudgetEvidence } from "../lib/growth/apollo/apollo-search-api-budget-evidence"
import { buildApolloScale3ProductionReadinessPayload } from "../lib/growth/apollo/apollo-scale-3-production-route-gates"
import { APOLLO_SCALE_3_RECOMMENDED_MAX_API_CALLS_PER_RUN } from "../lib/growth/apollo/apollo-single-company-search-diagnostic-gates"

const APOLLO_LIVE_PILOT_FRESH_SEARCH_PATH = "fresh_single_provider_run" as const
import type { ApolloPrimaryContactAcquisitionCompanyEvidence } from "../lib/growth/apollo/apollo-primary-contact-acquisition-evidence"
import type { ApolloSearchTierAttemptEvidence } from "../lib/growth/providers/apollo/apollo-tiered-people-search-types"
import {
  assertApolloSearchApiCallAllowed,
  beginApolloRunGuardrails,
  recordApolloSearchApiCall,
  resetApolloRunGuardrails,
} from "../lib/growth/providers/apollo/apollo-run-guardrails"

function pulseTierAttempts(): ApolloSearchTierAttemptEvidence[] {
  return [
    {
      tier: 4,
      tier_name: "D_org_only_fallback",
      request_payload: { q_organization_domains_list: ["pulsexray.com"] },
      request_payload_summary: "D_org_only_fallback;domain=pulsexray.com",
      company_domain: "pulsexray.com",
      company_name: "Pulse Biomedical Service",
      organization_location: null,
      person_titles: [],
      person_seniorities: [],
      domain_exact_only: false,
      title_filter_applied: false,
      raw_contacts_returned: 1,
      mapped_contacts: 1,
      mapped_partial_identity_contacts: 1,
      mapping_rejections: 0,
      rejection_reasons: {},
      mapper_rejection_samples: [],
      apollo_status: "success",
      apollo_message: null,
      skipped_reason: null,
    },
  ]
}

function pulseSearchStrategy() {
  return {
    qa_marker: "apollo-tiered-people-search-v2" as const,
    tier_used: 4 as const,
    chosen_tier: 4 as const,
    chosen_tier_name: "D_org_only_fallback",
    last_attempted_tier: 4 as const,
    last_attempted_tier_name: "D_org_only_fallback",
    stop_reason: "mapped_contacts_found" as const,
    tier_attempts: pulseTierAttempts(),
    raw_contacts_returned: 1,
    mapped_contacts: 1,
    mapping_rejections: 0,
    rejection_reasons: {},
    legacy_fallback_used: false,
    legacy_contactable_count: 0,
    mapped_partial_identity_contacts: 1,
    mapped_full_identity_contacts: 0,
  }
}

function pulseAcquisitionEvidence(): ApolloPrimaryContactAcquisitionCompanyEvidence {
  return {
    company_candidate_id: "pulse-company",
    company_name: "Pulse Biomedical Service",
    domain: "pulsexray.com",
    canonical_company_id: "canonical-pulse",
    apollo_search_attempted: true,
    apollo_search_skipped_reason: null,
    apollo_people_found: 1,
    existing_contacts_reused: 0,
    existing_contactable_before: 0,
    enrichment_attempted: false,
    enrichment_skipped_reason: "no_candidates_needing_enrichment",
    enrichment_candidates_updated: 0,
    email_enrichment: {
      candidates_selected: 0,
      candidates_updated: 0,
      verified_status_without_email_selected: 0,
      channel_less_selected: 0,
      skipped_reason: "no_candidates_needing_enrichment",
      error: null,
      error_stage: null,
    },
    credits_consumed: 0,
    promoted_contacts: 0,
    contactable_contacts: 0,
    sequence_ready_contacts: 0,
    blockers: [],
    search_strategy: pulseSearchStrategy(),
    apollo_search_evidence: null,
    verified_email_promotion: null,
    apollo_persisted_this_run: 1,
    current_run_attribution: {
      qa_marker: "apollo-current-run-attribution-v1",
      current_run_apollo_mapped_contacts: 1,
      current_run_apollo_persisted_contacts: 1,
      current_run_apollo_verified_email_contacts: 0,
      current_run_apollo_promoted_contacts: 0,
      current_run_apollo_contactable_contacts: 0,
      current_run_apollo_sequence_ready_contacts: 0,
      historical_apollo_verified_email_contacts: 0,
      legacy_contactable_contacts: 0,
      apollo_candidate_ids_this_run: ["pulse-candidate-1"],
      has_current_run_search_yield: true,
    },
    partial_identity_evidence: {
      qa_marker: "apollo-partial-identity-v1",
      mapped_partial_identity_contacts: 1,
      partial_identity_candidates_staged: 1,
      partial_identity_enrichment_attempted: false,
      partial_identity_enrichment_resolved: 0,
      partial_identity_promoted_after_resolution: 0,
      partial_identity_blockers: [],
    },
    search_debug: buildApolloCohortCompanySearchDebug({
      company_candidate_id: "pulse-company",
      company_name: "Pulse Biomedical Service",
      domain: "pulsexray.com",
      search_path: APOLLO_LIVE_PILOT_FRESH_SEARCH_PATH,
      guardrails_before_search: { search_api_calls: 32, api_calls: 32, companies_acquired: 8 },
      guardrails_after_search: { search_api_calls: 37, api_calls: 37, companies_acquired: 8 },
      search_strategy: pulseSearchStrategy(),
    }),
  }
}

function testSharedTieredSearchSurface(): void {
  const sharedSource = readFileSync(
    resolve(process.cwd(), "lib/growth/apollo/apollo-shared-tiered-search.ts"),
    "utf8",
  )
  const diagnosticSource = readFileSync(
    resolve(process.cwd(), "lib/growth/apollo/apollo-single-company-search-diagnostic.ts"),
    "utf8",
  )
  const providerSource = readFileSync(
    resolve(process.cwd(), "lib/growth/contact-discovery/providers/apollo-contact-discovery-provider.ts"),
    "utf8",
  )
  const acquisitionSource = readFileSync(
    resolve(process.cwd(), "lib/growth/apollo/apollo-live-pilot-contact-discovery.ts"),
    "utf8",
  )

  assert.match(sharedSource, /searchApolloPeopleWithTierStrategy/)
  assert.match(diagnosticSource, /runApolloSharedTieredPeopleSearch/)
  assert.match(providerSource, /runApolloSharedTieredPeopleSearch/)
  assert.doesNotMatch(diagnosticSource, /searchApolloPeopleWithTierStrategy\(/)
  assert.match(acquisitionSource, /fresh_apollo_search/)
  assert.match(sharedSource, /export async function runApolloSharedTieredPeopleSearch/)
  assert.match(sharedSource, /return searchApolloPeopleWithTierStrategy/)
}

function testPulseFixtureAlignedAcrossPaths(): void {
  const acquisition = pulseAcquisitionEvidence()
  const scale3Row = mapApolloScale3CompanyEvidenceRow({
    base: {
      company_candidate_id: acquisition.company_candidate_id,
      company_name: acquisition.company_name,
      domain: acquisition.domain!,
      search_attempted: true,
      contacts_found: 1,
      contacts_enriched: 0,
      contacts_promoted: 0,
      contactable_contacts: 0,
      sequence_ready_contacts: 0,
      blockers: [],
      error: null,
      failed: false,
    },
    acquisition,
  })

  assert.equal(scale3Row.raw_contacts_returned, 1)
  assert.equal(scale3Row.mapped_contacts, 1)
  assert.equal(scale3Row.partial_identity_evidence.mapped_partial_identity_contacts, 1)
  assert.equal(scale3Row.tier_used, 4)
  assert.ok(scale3Row.cohort_search_debug)
  assert.equal(scale3Row.cohort_search_debug?.domain, "pulsexray.com")
  assert.equal(scale3Row.cohort_search_debug?.search_path, APOLLO_LIVE_PILOT_FRESH_SEARCH_PATH)

  const tierD = scale3Row.cohort_search_debug?.tier_attempts_compact.find((row) => row.tier === 4)
  assert.ok(tierD)
  assert.equal(tierD?.raw_count, 1)
  assert.equal(tierD?.mapped_count, 1)
  assert.equal(tierD?.partial_identity_count, 1)
  assert.match(tierD?.request_payload_summary ?? "", /pulsexray\.com/)

  const diagnosticStrategy = pulseSearchStrategy()
  assert.equal(diagnosticStrategy.raw_contacts_returned, scale3Row.raw_contacts_returned)
  assert.equal(diagnosticStrategy.mapped_contacts, scale3Row.mapped_contacts)
  assert.equal(
    diagnosticStrategy.mapped_partial_identity_contacts,
    scale3Row.partial_identity_evidence.mapped_partial_identity_contacts,
  )
}

function testBudget90AllowsFullCohort(): void {
  beginApolloRunGuardrails()
  const env = { GROWTH_APOLLO_MAX_API_CALLS_PER_RUN: "90" } as NodeJS.ProcessEnv
  for (let company = 0; company < 15; company += 1) {
    for (let tier = 0; tier < 5; tier += 1) {
      assert.doesNotThrow(() => assertApolloSearchApiCallAllowed({ env }))
      recordApolloSearchApiCall()
    }
  }
  assert.doesNotThrow(() => assertApolloSearchApiCallAllowed({ env }))
  resetApolloRunGuardrails()

  const budget = buildApolloSearchApiBudgetEvidence({
    env: { GROWTH_APOLLO_MAX_API_CALLS_PER_RUN: "90" } as NodeJS.ProcessEnv,
    company_limit: 15,
  })
  assert.equal(budget.current_max_api_calls_per_run, 90)
  assert.equal(budget.minimum_for_full_cohort_tiers, 75)
  assert.equal(budget.sufficient_for_full_cohort, true)
  assert.equal(budget.recommended_for_cert, APOLLO_SCALE_3_RECOMMENDED_MAX_API_CALLS_PER_RUN)
}

function testReadinessAndExecuteExposeSearchApiBudget(): void {
  const readiness = buildApolloScale3ProductionReadinessPayload({
    cohort_companies_selected: 15,
    cohort_companies: [],
    cohort_error: null,
    env: {
      VERCEL_ENV: "production",
      GROWTH_APOLLO_SCALE_3_ENABLED: "true",
      GROWTH_APOLLO_SCALE_3_ACK: "1",
      GROWTH_APOLLO_SCALE_2_ENABLED: "true",
      GROWTH_APOLLO_SCALE_2_ACK: "1",
      GROWTH_APOLLO_USE_MOCK: "false",
      APOLLO_API_KEY: "test-key",
      GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
      GROWTH_APOLLO_MAX_API_CALLS_PER_RUN: "90",
    } as NodeJS.ProcessEnv,
  })

  assert.ok(readiness.search_api_budget)
  assert.equal(readiness.search_api_budget.current_max_api_calls_per_run, 90)

  const executeSource = readFileSync(
    resolve(process.cwd(), "lib/growth/apollo/apollo-scale-3-production-route.ts"),
    "utf8",
  )
  assert.match(executeSource, /search_api_budget: buildApolloSearchApiBudgetEvidence/)
}

function testCurrentRunApolloFieldsDefaultToZero(): void {
  const promotion = buildApolloScale3CompanyPromotionEvidence(null)
  assert.equal(promotion.current_run_apollo_verified_email_contacts, 0)
  assert.equal(promotion.current_run_apollo_promoted_contacts, 0)
  assert.equal(promotion.current_run_apollo_contactable_contacts, 0)
  assert.equal(promotion.current_run_apollo_sequence_ready_contacts, 0)
  assert.equal(promotion.historical_apollo_verified_email_contacts, 0)

  const row = mapApolloScale3CompanyEvidenceRow({
    base: {
      company_candidate_id: "x",
      company_name: "Example Co",
      domain: "example.com",
      search_attempted: false,
      contacts_found: 0,
      contacts_enriched: 0,
      contacts_promoted: 0,
      contactable_contacts: 0,
      sequence_ready_contacts: 0,
      blockers: [],
      error: null,
      failed: false,
    },
    acquisition: null,
  })
  assert.equal(row.current_run_apollo_contactable_contacts, 0)
  assert.equal(row.current_run_apollo_sequence_ready_contacts, 0)
  assert.equal(row.promotion_evidence.current_run_apollo_verified_email_contacts, 0)
  assert.equal(row.promotion_evidence.current_run_apollo_promoted_contacts, 0)
  assert.equal(row.promotion_evidence.current_run_apollo_contactable_contacts, 0)
  assert.equal(row.promotion_evidence.current_run_apollo_sequence_ready_contacts, 0)
  assert.equal(row.partial_identity_evidence.mapped_partial_identity_contacts, 0)
}

function main(): void {
  testSharedTieredSearchSurface()
  console.log("  ✓ diagnostic + cohort provider share runApolloSharedTieredPeopleSearch")
  testPulseFixtureAlignedAcrossPaths()
  console.log("  ✓ Pulse fixture raw=1/mapped=1/partial=1 aligned across diagnostic + Scale-3 evidence")
  testBudget90AllowsFullCohort()
  console.log("  ✓ search budget 90 allows 15 companies × 5 tiers")
  testReadinessAndExecuteExposeSearchApiBudget()
  console.log("  ✓ readiness + execute expose search_api_budget with current_max_api_calls_per_run")
  testCurrentRunApolloFieldsDefaultToZero()
  console.log("  ✓ current_run_apollo_* fields default to 0")
  console.log("\nApollo Scale-3 search path alignment checks passed.")
}

main()
