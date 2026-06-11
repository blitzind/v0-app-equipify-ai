/**
 * Apollo current-run search-verified email attribution + promotion regression checks.
 * Run: pnpm test:apollo-current-run-search-verified-attribution
 */
import assert from "node:assert/strict"
import {
  assessApolloScale3SearchStrategyResult,
} from "../lib/growth/apollo/apollo-scale-3-certification-assessment"
import {
  resolveApolloCandidateIdsAttributedThisRun,
  resolveApolloCurrentRunAttribution,
  resolveApolloVerifiedEmailSource,
} from "../lib/growth/apollo/apollo-current-run-attribution"
import { buildApolloCompanyEnrichmentEvidence } from "../lib/growth/apollo/apollo-mapped-contact-enrichment-evidence"
import {
  evaluateApolloVerifiedEmailPromotionBlocker,
} from "../lib/growth/apollo/apollo-verified-email-promotion-evidence"
import type { GrowthContactCandidate } from "../lib/growth/contact-discovery/contact-discovery-types"

function candidate(input: {
  id: string
  full_name: string
  email?: string | null
  apollo_person_id: string
  apollo_email_status?: string
  apollo_enriched_at?: string
}): GrowthContactCandidate {
  return {
    id: input.id,
    company_candidate_id: "stat-company",
    provider_type: "future_apollo",
    full_name: input.full_name,
    first_name: input.full_name.split(" ")[0] ?? null,
    last_name: input.full_name.split(" ").slice(1).join(" ") || null,
    job_title: "Owner",
    email: input.email ?? null,
    phone: null,
    linkedin_url: null,
    metadata: {
      apollo_person_id: input.apollo_person_id,
      apollo_email_status: input.apollo_email_status ?? "verified",
      identity_classification: "named_person",
      eligible_for_canonical_person: true,
      eligible_for_committee: true,
      ...(input.apollo_enriched_at ? { apollo_enriched_at: input.apollo_enriched_at } : {}),
    },
    verification_state: "unknown",
    confidence: 0.9,
    source_attribution: [],
    evidence: [],
    dedupe_hash: `hash-${input.id}`,
  } as GrowthContactCandidate
}

function statBiomedicalCohort(): GrowthContactCandidate[] {
  return [
    candidate({
      id: "shannon-historical",
      full_name: "Shannon Moore",
      email: "shannon@stat-biomed.com",
      apollo_person_id: "apollo-shannon",
    }),
    candidate({
      id: "bryan-historical",
      full_name: "Bryan Ginther",
      email: "bryan@statbiomedical.com",
      apollo_person_id: "apollo-bryan",
    }),
    candidate({
      id: "luke-historical",
      full_name: "Luke Watson",
      email: null,
      apollo_person_id: "apollo-luke",
      apollo_email_status: "unavailable",
    }),
    candidate({
      id: "jennifer-historical",
      full_name: "Jennifer Wenz",
      email: null,
      apollo_person_id: "apollo-jennifer",
      apollo_email_status: "unavailable",
    }),
  ]
}

function testDedupedSearchVerifiedCandidatesAttributedThisRun(): void {
  const cohort = statBiomedicalCohort()
  const before = new Set(cohort.map((row) => row.id))
  const personIds = ["apollo-shannon", "apollo-bryan", "apollo-luke", "apollo-jennifer"]

  const attributed = resolveApolloCandidateIdsAttributedThisRun({
    before,
    apollo_candidates: cohort,
    apollo_person_ids_mapped_this_run: personIds,
  })

  assert.equal(attributed.length, 4)
  assert.ok(attributed.includes("shannon-historical"))
  assert.ok(attributed.includes("bryan-historical"))
}

function testSearchReturnedVerifiedEmailCountsAsCurrentRunVerified(): void {
  const cohort = statBiomedicalCohort()
  const attribution = resolveApolloCurrentRunAttribution({
    apollo_mapped_this_run: 4,
    apollo_persisted_this_run: 0,
    apollo_candidate_ids_before: new Set(cohort.map((row) => row.id)),
    apollo_candidates_after: cohort,
    apollo_person_ids_mapped_this_run: [
      "apollo-shannon",
      "apollo-bryan",
      "apollo-luke",
      "apollo-jennifer",
    ],
    verified_email_promotion: null,
    existing_contactable_before: 0,
    company_contacts: [],
    promotion_attempted: true,
  })

  assert.equal(attribution.current_run_apollo_verified_email_contacts, 2)
  assert.equal(attribution.search_verified_email_contacts, 2)
  assert.equal(attribution.enrichment_verified_email_contacts, 0)
  assert.equal(attribution.apollo_candidate_ids_this_run.length, 0)
  assert.equal(attribution.apollo_candidate_ids_attributed_this_run.length, 4)
}

function testSearchVerifiedEmailTriggersPromotionWithoutEnrichmentBlocker(): void {
  const shannon = candidate({
    id: "shannon-historical",
    full_name: "Shannon Moore",
    email: "shannon@stat-biomed.com",
    apollo_person_id: "apollo-shannon",
  })
  assert.equal(evaluateApolloVerifiedEmailPromotionBlocker(shannon), null)
  assert.equal(resolveApolloVerifiedEmailSource(shannon), "search")
}

function testEnrichmentNotAttemptedDoesNotBlockWhenSearchVerifiedPresent(): void {
  const evidence = buildApolloCompanyEnrichmentEvidence({
    candidates: statBiomedicalCohort(),
    env: {
      GROWTH_APOLLO_ENRICH_EMAILS: "true",
      GROWTH_APOLLO_ENRICH_EMAILS_ACK: "1",
    } as NodeJS.ProcessEnv,
    enrichment_attempted: false,
    enrichment_result: {
      candidates_selected: 0,
      candidates_updated: 0,
      verified_status_without_email_selected: 0,
      channel_less_selected: 0,
      credits_consumed: 0,
      skipped_reason: "no_candidates_need_email_enrichment",
      error: null,
      error_stage: null,
      enrichment_provider: null,
      enrichment_request_summary: null,
      enrichment_response_summary: null,
      enrichment_verified_email_contacts: 0,
      enrichment_no_email_count: 0,
      enrichment_unverified_email_count: 0,
      bulk_match_batches: 0,
    },
  })

  assert.equal(evidence.search_verified_email_contacts, 2)
  assert.ok(!evidence.enrichment_blockers.includes("enrichment_not_attempted"))
}

function testVerifiedStatusWithoutEmailDoesNotCount(): void {
  const ghost = candidate({
    id: "ghost",
    full_name: "Ghost Verified",
    email: null,
    apollo_person_id: "apollo-ghost",
    apollo_email_status: "verified",
  })
  const attribution = resolveApolloCurrentRunAttribution({
    apollo_mapped_this_run: 1,
    apollo_persisted_this_run: 0,
    apollo_candidate_ids_before: new Set(["ghost"]),
    apollo_candidates_after: [ghost],
    apollo_person_ids_mapped_this_run: ["apollo-ghost"],
    verified_email_promotion: null,
    existing_contactable_before: 0,
    company_contacts: [],
    promotion_attempted: false,
  })

  assert.equal(attribution.current_run_apollo_verified_email_contacts, 0)
  assert.equal(evaluateApolloVerifiedEmailPromotionBlocker(ghost), "apollo_verified_status_without_email")
}

function testSearchVerifiedCanBecomeSequenceReadyInCurrentRunMetrics(): void {
  const cohort = statBiomedicalCohort()
  const attribution = resolveApolloCurrentRunAttribution({
    apollo_mapped_this_run: 4,
    apollo_persisted_this_run: 0,
    apollo_candidate_ids_before: new Set(cohort.map((row) => row.id)),
    apollo_candidates_after: cohort,
    apollo_person_ids_mapped_this_run: ["apollo-shannon", "apollo-bryan"],
    verified_email_promotion: null,
    existing_contactable_before: 0,
    company_contacts: [
      {
        contact_candidate_id: "shannon-historical",
        full_name: "Shannon Moore",
        title: "President/Owner",
        email: "shannon@stat-biomed.com",
        email_status: "verified",
        phone_status: "unknown",
        canonical_person_id: "person-shannon",
        metadata: {
          identity_classification: "named_person",
          eligible_for_canonical_person: true,
          eligible_for_committee: true,
        },
      },
    ],
    promotion_attempted: true,
  })

  assert.equal(attribution.current_run_apollo_promoted_contacts, 1)
  assert.equal(attribution.current_run_apollo_contactable_contacts, 1)
  assert.equal(attribution.current_run_apollo_sequence_ready_contacts, 1)
  assert.equal(
    attribution.sequence_readiness_blockers_by_candidate.filter(
      (row) => row.contact_candidate_id === "bryan-historical",
    ).length,
    1,
  )
}

function testStatLikeCompanyCanCurrentRunPassScale3(): void {
  const verdict = assessApolloScale3SearchStrategyResult({
    mock: false,
    companies: [
      {
        company_candidate_id: "stat",
        company_name: "Stat Biomedical Technicians, Inc.",
        domain: "stat-biomed.com",
        search_attempted: true,
        contacts_found: 4,
        contacts_enriched: 0,
        contacts_promoted: 1,
        contactable_contacts: 1,
        sequence_ready_contacts: 1,
        blockers: [],
        error: null,
        failed: false,
        tier_used: 2,
        raw_contacts_returned: 4,
        mapped_contacts: 4,
        mapping_rejections: 0,
        rejection_reasons: {},
        mapper_rejection_evidence: null,
        tier_attempts: [],
        tier_attempts_compact: [],
        contactable: 1,
        sequence_ready: 1,
        current_run_apollo_verified_email_contacts: 2,
        current_run_apollo_promoted_contacts: 1,
        current_run_apollo_contactable_contacts: 1,
        current_run_apollo_sequence_ready_contacts: 1,
        certification_fail_reasons: [],
        legacy_fallback_used: false,
        partial_identity_evidence: {
          qa_marker: "apollo-partial-identity-v1",
          mapped_partial_identity_contacts: 0,
          partial_identity_candidates_staged: 0,
          partial_identity_enrichment_attempted: false,
          partial_identity_enrichment_resolved: 0,
          partial_identity_promoted_after_resolution: 0,
          partial_identity_blockers: [],
        },
        promotion_evidence: {
          apollo_search_attempted: true,
          apollo_search_skipped_reason: null,
          enrichment_attempted: false,
          enrichment_skipped_reason: "no_candidates_need_email_enrichment",
          verified_status_without_email_selected: 0,
          email_enrichment_candidates_selected: 0,
          email_enrichment_candidates_updated: 0,
          email_enrichment_error: null,
          email_enrichment_error_stage: null,
          verified_email_contacts: 2,
          company_contacts_promoted: 1,
          contactable_after_promotion: 1,
          sequence_ready_after_promotion: 1,
          current_run_apollo_verified_email_contacts: 2,
          current_run_apollo_promoted_contacts: 1,
          current_run_apollo_contactable_contacts: 1,
          current_run_apollo_sequence_ready_contacts: 1,
          historical_apollo_verified_email_contacts: 0,
          legacy_contactable_contacts: 0,
          search_verified_email_contacts: 2,
          enrichment_verified_email_contacts: 0,
          promotion_attempted: true,
          promotion_blockers_by_candidate: [],
          contactability_blockers_by_candidate: [],
          sequence_readiness_blockers_by_candidate: [],
        },
        acquisition_evidence: null,
        enrichment_evidence: {
          qa_marker: "apollo-mapped-contact-enrichment-evidence-v1",
          mapped_contacts_count: 4,
          mapped_contacts_requiring_enrichment: 0,
          enrichment_attempted: false,
          enrichment_provider: null,
          enrichment_candidates_selected: 0,
          enrichment_candidates_updated: 0,
          search_verified_email_contacts: 2,
          enrichment_verified_email_contacts: 0,
          enrichment_no_email_count: 2,
          enrichment_unverified_email_count: 0,
          enrichment_blockers: [],
          enrichment_credit_guardrail_status: {
            enrichment_batches_consumed: 0,
            enrichment_batches_limit: 10,
            blocked: false,
          },
          enrichment_request_summary: null,
          enrichment_response_summary: null,
          config: {
            enrich_emails_enabled: true,
            enrich_emails_ack: true,
            mock_mode: false,
            search_only_mode: false,
            apollo_discovery_enabled: true,
          },
          mapped_contacts: [],
        },
        cohort_search_debug: null,
      },
    ],
  })

  assert.equal(verdict, "PASS")
}

function main(): void {
  testDedupedSearchVerifiedCandidatesAttributedThisRun()
  console.log("  ✓ deduped search-mapped candidates attributed via apollo_person_id")
  testSearchReturnedVerifiedEmailCountsAsCurrentRunVerified()
  console.log("  ✓ search-returned verified emails count as current-run verified")
  testSearchVerifiedEmailTriggersPromotionWithoutEnrichmentBlocker()
  console.log("  ✓ search verified email is promotable without bulk_match")
  testEnrichmentNotAttemptedDoesNotBlockWhenSearchVerifiedPresent()
  console.log("  ✓ enrichment_not_attempted omitted when search verified emails present")
  testVerifiedStatusWithoutEmailDoesNotCount()
  console.log("  ✓ verified status without email does not count as current-run verified")
  testSearchVerifiedCanBecomeSequenceReadyInCurrentRunMetrics()
  console.log("  ✓ search verified email can reach sequence-ready in current-run metrics")
  testStatLikeCompanyCanCurrentRunPassScale3()
  console.log("  ✓ Stat-like company can current-run PASS Scale-3")
  console.log("\nApollo current-run search-verified attribution checks passed.")
}

main()
