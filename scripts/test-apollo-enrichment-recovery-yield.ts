/**
 * Phase 14.3D — Apollo enrichment recovery regression tests.
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-apollo-enrichment-recovery-yield.ts
 */
import assert from "node:assert/strict"

import {
  apolloCandidateMissingPromotableEmail,
  apolloCandidateNeedsEmailEnrichment,
} from "../lib/growth/apollo/apollo-email-channel-evidence"
import {
  resolveApolloEnrichmentRecoveryStrategy,
  selectApolloEnrichmentRecoveryTargets,
  APOLLO_ENRICHMENT_RECOVERY_QA_MARKER,
} from "../lib/growth/apollo/apollo-enrichment-recovery-types"
import type { Apollo25CompanyPilotSelectionInput } from "../lib/growth/apollo/apollo-25-company-pilot-selection"
import type { GrowthContactCandidate } from "../lib/growth/contact-discovery/contact-discovery-types"

function candidate(partial: Partial<GrowthContactCandidate>): GrowthContactCandidate {
  return {
    id: partial.id ?? "cand-1",
    company_candidate_id: partial.company_candidate_id ?? "company-1",
    provider_type: "future_apollo",
    provider_name: "apollo",
    full_name: partial.full_name ?? "Jane Owner",
    first_name: partial.first_name ?? "Jane",
    last_name: partial.last_name ?? "Owner",
    job_title: partial.job_title ?? "President",
    email: partial.email ?? null,
    phone: partial.phone ?? null,
    linkedin_url: partial.linkedin_url ?? null,
    metadata: partial.metadata ?? { apollo_person_id: "apollo-person-1" },
    verification_state: "unknown",
    confidence: 0.8,
    source_attribution: [],
    evidence: [],
    dedupe_hash: "hash-1",
  } as GrowthContactCandidate
}

function selectionInput(
  partial: Partial<Apollo25CompanyPilotSelectionInput>,
): Apollo25CompanyPilotSelectionInput {
  return {
    company_candidate_id: partial.company_candidate_id ?? "company-1",
    company_name: partial.company_name ?? "Example Co",
    domain: partial.domain ?? "example.com",
    contacts: partial.contacts ?? [],
    snapshot_summary: partial.snapshot_summary ?? {
      mapped_contacts: 0,
      verified_email_contacts: 0,
      contactable_contacts: 0,
      sequence_ready_contacts: 0,
    },
    enrollment_status: partial.enrollment_status ?? null,
    in_active_pilot_cohort: partial.in_active_pilot_cohort ?? false,
    has_active_sequence_enrollment: partial.has_active_sequence_enrollment ?? false,
  }
}

function testLinkedInOnlyCandidateNeedsEnrichment(): void {
  const row = candidate({
    linkedin_url: "https://www.linkedin.com/in/jane-owner",
    email: null,
    metadata: { apollo_person_id: "apollo-person-1", apollo_email_status: "unavailable" },
  })
  assert.equal(apolloCandidateNeedsEmailEnrichment(row), true)
  assert.equal(apolloCandidateMissingPromotableEmail(row), true)
}

function testVerifiedStatusWithoutEmailEligibleForBulkMatch(): void {
  const row = candidate({
    email: null,
    linkedin_url: "https://www.linkedin.com/in/jane-owner",
    metadata: { apollo_person_id: "apollo-person-1", apollo_email_status: "verified" },
  })
  assert.equal(apolloCandidateNeedsEmailEnrichment(row), true)
  assert.equal(
    JSON.stringify({ eligible_for_bulk_match: apolloCandidateNeedsEmailEnrichment(row) }),
    JSON.stringify({ eligible_for_bulk_match: true }),
  )
}

function testExistingVerifiedEmailSkipsEnrichment(): void {
  const row = candidate({
    email: "user@example.com",
    metadata: { apollo_person_id: "apollo-person-1", apollo_email_status: "verified" },
  })
  assert.equal(apolloCandidateNeedsEmailEnrichment(row), false)
  assert.equal(
    JSON.stringify({ needs_email_enrichment: apolloCandidateNeedsEmailEnrichment(row) }),
    JSON.stringify({ needs_email_enrichment: false }),
  )
}

function testRecoveryTargetSelection(): void {
  const targets = selectApolloEnrichmentRecoveryTargets([
    selectionInput({
      company_candidate_id: "verified-co",
      snapshot_summary: {
        mapped_contacts: 2,
        verified_email_contacts: 1,
        contactable_contacts: 1,
        sequence_ready_contacts: 1,
      },
    }),
    selectionInput({
      company_candidate_id: "failed-co",
      snapshot_summary: {
        mapped_contacts: 3,
        verified_email_contacts: 0,
        contactable_contacts: 0,
        sequence_ready_contacts: 0,
      },
    }),
  ])
  assert.equal(targets.length, 1)
  assert.equal(targets[0]?.company_candidate_id, "failed-co")
  assert.equal(resolveApolloEnrichmentRecoveryStrategy(targets[0]!), "enrichment_only")
}

assert.equal(APOLLO_ENRICHMENT_RECOVERY_QA_MARKER, "apollo-enrichment-recovery-v14-3d")

testLinkedInOnlyCandidateNeedsEnrichment()
console.log("  ✓ LinkedIn-only candidate needs email enrichment")

testVerifiedStatusWithoutEmailEligibleForBulkMatch()
console.log("  ✓ verified status without email eligible for bulk_match")

testExistingVerifiedEmailSkipsEnrichment()
console.log("  ✓ existing verified email skips enrichment")

testRecoveryTargetSelection()
console.log("  ✓ recovery targets companies without verified email")

console.log("\nApollo enrichment recovery yield checks passed.")
