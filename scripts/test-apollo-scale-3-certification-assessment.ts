/**
 * Apollo Scale-3 certification assessment — false-PASS regression checks.
 * Run: pnpm test:apollo-scale-3-certification-assessment
 */
import assert from "node:assert/strict"
import {
  assessApolloScale3SearchStrategyResult,
  buildApolloScale3CertificationAssessment,
  normalizeApolloCurrentRunMetric,
  resolveApolloScale3CompanyCurrentRunMetrics,
} from "../lib/growth/apollo/apollo-scale-3-certification-assessment"
import type { ApolloScale3MappedCompanyEvidenceRow } from "../lib/growth/apollo/apollo-scale-3-company-promotion-evidence"
import { emptyApolloPartialIdentityEvidence } from "../lib/growth/apollo/apollo-partial-identity-evidence"

function basePromotion(overrides?: Partial<ApolloScale3MappedCompanyEvidenceRow["promotion_evidence"]>) {
  return {
    apollo_search_attempted: true,
    apollo_search_skipped_reason: null,
    enrichment_attempted: true,
    enrichment_skipped_reason: null,
    verified_status_without_email_selected: 0,
    email_enrichment_candidates_selected: 0,
    email_enrichment_candidates_updated: 0,
    email_enrichment_error: null,
    email_enrichment_error_stage: null,
    verified_email_contacts: 0,
    company_contacts_promoted: 0,
    contactable_after_promotion: 0,
    sequence_ready_after_promotion: 0,
    current_run_apollo_verified_email_contacts: 0,
    current_run_apollo_promoted_contacts: 0,
    current_run_apollo_contactable_contacts: 0,
    current_run_apollo_sequence_ready_contacts: 0,
    historical_apollo_verified_email_contacts: 0,
    legacy_contactable_contacts: 0,
    ...overrides,
  }
}

function scale3Row(
  partial: Partial<ApolloScale3MappedCompanyEvidenceRow> &
    Pick<ApolloScale3MappedCompanyEvidenceRow, "company_candidate_id" | "company_name" | "domain">,
): ApolloScale3MappedCompanyEvidenceRow {
  const promotion_evidence = basePromotion(partial.promotion_evidence)
  return {
    company_candidate_id: partial.company_candidate_id,
    company_name: partial.company_name,
    domain: partial.domain,
    search_attempted: partial.search_attempted ?? true,
    contacts_found: partial.contacts_found ?? partial.mapped_contacts ?? 0,
    contacts_enriched: partial.contacts_enriched ?? 0,
    contacts_promoted: partial.contacts_promoted ?? 0,
    contactable_contacts: partial.contactable_contacts ?? 0,
    sequence_ready_contacts: partial.sequence_ready_contacts ?? 0,
    blockers: partial.blockers ?? [],
    error: partial.error ?? null,
    failed: partial.failed ?? false,
    tier_used: partial.tier_used ?? 4,
    raw_contacts_returned: partial.raw_contacts_returned ?? partial.mapped_contacts ?? 0,
    mapped_contacts: partial.mapped_contacts ?? 0,
    mapping_rejections: partial.mapping_rejections ?? 0,
    rejection_reasons: partial.rejection_reasons ?? {},
    mapper_rejection_evidence: partial.mapper_rejection_evidence ?? null,
    tier_attempts: partial.tier_attempts ?? [],
    tier_attempts_compact: partial.tier_attempts_compact ?? [],
    contactable: partial.contactable ?? promotion_evidence.current_run_apollo_contactable_contacts,
    sequence_ready: partial.sequence_ready ?? promotion_evidence.current_run_apollo_sequence_ready_contacts,
    current_run_apollo_verified_email_contacts:
      partial.current_run_apollo_verified_email_contacts ??
      promotion_evidence.current_run_apollo_verified_email_contacts,
    current_run_apollo_promoted_contacts:
      partial.current_run_apollo_promoted_contacts ??
      promotion_evidence.current_run_apollo_promoted_contacts,
    current_run_apollo_contactable_contacts:
      partial.current_run_apollo_contactable_contacts ??
      promotion_evidence.current_run_apollo_contactable_contacts,
    current_run_apollo_sequence_ready_contacts:
      partial.current_run_apollo_sequence_ready_contacts ??
      promotion_evidence.current_run_apollo_sequence_ready_contacts,
    certification_fail_reasons: partial.certification_fail_reasons ?? [],
    partial_identity_evidence: partial.partial_identity_evidence ?? emptyApolloPartialIdentityEvidence(),
    cohort_search_debug: partial.cohort_search_debug ?? null,
    legacy_fallback_used: partial.legacy_fallback_used ?? false,
    promotion_evidence,
    acquisition_evidence: partial.acquisition_evidence ?? null,
  }
}

function testMappedEnrichedCreatedButContactableZeroFails(): void {
  const companies = [
    scale3Row({
      company_candidate_id: "pulse",
      company_name: "Pulse Biomedical Service",
      domain: "pulsexray.com",
      mapped_contacts: 1,
      contacts_enriched: 1,
      contacts_promoted: 1,
      promotion_evidence: basePromotion({
        verified_email_contacts: 1,
        company_contacts_promoted: 1,
        email_enrichment_candidates_updated: 1,
      }),
    }),
    scale3Row({
      company_candidate_id: "sierra",
      company_name: "Sierra Biomed",
      domain: "sierrabiomed.com",
      mapped_contacts: 1,
      contacts_enriched: 1,
      contacts_promoted: 1,
      promotion_evidence: basePromotion({
        verified_email_contacts: 1,
        company_contacts_promoted: 1,
        email_enrichment_candidates_updated: 1,
      }),
    }),
  ]

  const assessment = buildApolloScale3CertificationAssessment({ mock: false, companies })
  assert.equal(assessment.result, "FAIL")
  assert.ok(assessment.fail_reasons.includes("aggregate_contactable_zero"))
  assert.ok(assessment.fail_reasons.includes("no_current_run_sequence_ready_contact"))
  assert.ok(assessment.fail_reasons.includes("insufficient_current_run_pipeline_yield"))
  assert.ok(!assessment.fail_reasons.includes("mapped_contacts_found_but_not_contactable"))
  assert.ok(!assessment.fail_reasons.includes("mapped_contacts_found_but_no_sequence_ready"))
  assert.ok(assessment.warnings.includes("mapped_contacts_found_but_not_contactable"))
  assert.ok(assessment.warnings.includes("mapped_contacts_found_but_no_sequence_ready"))
  assert.ok(assessment.partial_company_fail_reasons.pulse?.includes("mapped_contacts_found_but_not_contactable"))
  assert.equal(assessApolloScale3SearchStrategyResult({ mock: false, companies }), "FAIL")
}

function testContactableZeroForcesFailEvenWithMapped(): void {
  const companies = [
    scale3Row({
      company_candidate_id: "winner",
      company_name: "A Biomedical Service",
      domain: "example.com",
      mapped_contacts: 3,
      current_run_apollo_verified_email_contacts: undefined as unknown as number,
      current_run_apollo_promoted_contacts: undefined as unknown as number,
      current_run_apollo_contactable_contacts: undefined as unknown as number,
      current_run_apollo_sequence_ready_contacts: undefined as unknown as number,
    }),
  ]

  const metrics = resolveApolloScale3CompanyCurrentRunMetrics(companies[0]!)
  assert.equal(metrics.current_run_apollo_contactable_contacts, 0)
  assert.equal(normalizeApolloCurrentRunMetric(undefined), 0)
  assert.equal(buildApolloScale3CertificationAssessment({ mock: false, companies }).result, "FAIL")
}

function testPassRequiresCurrentRunSequenceReady(): void {
  const almost = scale3Row({
    company_candidate_id: "almost",
    company_name: "Almost Ready",
    domain: "almost.com",
    mapped_contacts: 1,
    promotion_evidence: basePromotion({
      current_run_apollo_verified_email_contacts: 1,
      current_run_apollo_promoted_contacts: 1,
      current_run_apollo_contactable_contacts: 1,
      current_run_apollo_sequence_ready_contacts: 0,
    }),
    current_run_apollo_verified_email_contacts: 1,
    current_run_apollo_promoted_contacts: 1,
    current_run_apollo_contactable_contacts: 1,
    current_run_apollo_sequence_ready_contacts: 0,
  })
  assert.equal(buildApolloScale3CertificationAssessment({ mock: false, companies: [almost] }).result, "FAIL")

  const ready = scale3Row({
    company_candidate_id: "ready",
    company_name: "Ready Co",
    domain: "ready.com",
    mapped_contacts: 1,
    promotion_evidence: basePromotion({
      current_run_apollo_verified_email_contacts: 1,
      current_run_apollo_promoted_contacts: 1,
      current_run_apollo_contactable_contacts: 1,
      current_run_apollo_sequence_ready_contacts: 1,
    }),
    current_run_apollo_verified_email_contacts: 1,
    current_run_apollo_promoted_contacts: 1,
    current_run_apollo_contactable_contacts: 1,
    current_run_apollo_sequence_ready_contacts: 1,
  })
  assert.equal(buildApolloScale3CertificationAssessment({ mock: false, companies: [ready] }).result, "PASS")
}

function testPassWithNonWinningMappedCompaniesHasEmptyTopLevelFailReasons(): void {
  const winner = scale3Row({
    company_candidate_id: "stat",
    company_name: "Stat Biomedical Technicians, Inc.",
    domain: "stat-biomed.com",
    mapped_contacts: 4,
    promotion_evidence: basePromotion({
      current_run_apollo_verified_email_contacts: 2,
      current_run_apollo_promoted_contacts: 4,
      current_run_apollo_contactable_contacts: 2,
      current_run_apollo_sequence_ready_contacts: 1,
    }),
    current_run_apollo_verified_email_contacts: 2,
    current_run_apollo_promoted_contacts: 4,
    current_run_apollo_contactable_contacts: 2,
    current_run_apollo_sequence_ready_contacts: 1,
  })
  const laggard = scale3Row({
    company_candidate_id: "sterling",
    company_name: "Sterling Biomedical",
    domain: "sterlingbiomedical.com",
    mapped_contacts: 1,
    promotion_evidence: basePromotion({
      current_run_apollo_verified_email_contacts: 1,
      current_run_apollo_promoted_contacts: 1,
      current_run_apollo_contactable_contacts: 0,
      current_run_apollo_sequence_ready_contacts: 0,
    }),
    current_run_apollo_verified_email_contacts: 1,
    current_run_apollo_promoted_contacts: 1,
    current_run_apollo_contactable_contacts: 0,
    current_run_apollo_sequence_ready_contacts: 0,
  })

  const assessment = buildApolloScale3CertificationAssessment({
    mock: false,
    companies: [winner, laggard],
  })
  assert.equal(assessment.result, "PASS")
  assert.deepEqual(assessment.fail_reasons, [])
  assert.ok(assessment.warnings.includes("mapped_contacts_found_but_not_contactable"))
  assert.ok(assessment.warnings.includes("mapped_contacts_found_but_no_sequence_ready"))
  assert.ok(
    assessment.partial_company_fail_reasons.sterling?.includes(
      "mapped_contacts_found_but_not_contactable",
    ),
  )
}

function testPartialIdentityAloneCannotPass(): void {
  const companies = [
    scale3Row({
      company_candidate_id: "pulse",
      company_name: "Pulse Biomedical Service",
      domain: "pulsexray.com",
      mapped_contacts: 1,
      partial_identity_evidence: {
        ...emptyApolloPartialIdentityEvidence(),
        mapped_partial_identity_contacts: 1,
        partial_identity_candidates_staged: 1,
      },
      promotion_evidence: basePromotion({
        current_run_apollo_mapped_contacts: 1,
      }),
    }),
  ]

  const assessment = buildApolloScale3CertificationAssessment({ mock: false, companies })
  assert.equal(assessment.result, "FAIL")
  assert.ok(assessment.fail_reasons.includes("partial_identity_unresolved"))
  assert.ok(assessment.company_fail_reasons.pulse?.includes("partial_identity_unresolved"))
}

function main(): void {
  testMappedEnrichedCreatedButContactableZeroFails()
  console.log("  ✓ mapped/enriched/created with contactable=0 => FAIL")
  testContactableZeroForcesFailEvenWithMapped()
  console.log("  ✓ contactable=0 => FAIL; undefined current_run fields default to 0")
  testPassRequiresCurrentRunSequenceReady()
  console.log("  ✓ PASS requires current_run sequence_ready > 0")
  testPassWithNonWinningMappedCompaniesHasEmptyTopLevelFailReasons()
  console.log("  ✓ PASS with non-winning mapped companies keeps top-level fail_reasons empty")
  testPartialIdentityAloneCannotPass()
  console.log("  ✓ partial identity alone cannot PASS")
  console.log("\nApollo Scale-3 certification assessment checks passed.")
}

main()
