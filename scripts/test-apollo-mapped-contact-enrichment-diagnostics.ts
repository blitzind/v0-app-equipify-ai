/**
 * Apollo mapped-contact enrichment diagnostics.
 * Run: pnpm test:apollo-mapped-contact-enrichment-diagnostics
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  apolloCandidateNeedsEmailEnrichment,
  buildApolloEmailChannelEvidenceRow,
} from "../lib/growth/apollo/apollo-email-channel-evidence"
import {
  buildApolloCompanyEnrichmentEvidence,
  buildApolloMappedContactEnrichmentRow,
  resolveApolloMappedContactEnrichmentEligibilityBlocker,
} from "../lib/growth/apollo/apollo-mapped-contact-enrichment-evidence"
import {
  evaluateApolloVerifiedEmailPromotionBlocker,
  isApolloVerifiedEmailStatus,
} from "../lib/growth/apollo/apollo-verified-email-promotion-evidence"
import type { GrowthContactCandidate } from "../lib/growth/contact-discovery/contact-discovery-types"

function candidate(partial: Partial<GrowthContactCandidate>): GrowthContactCandidate {
  return {
    id: partial.id ?? "cand-1",
    company_candidate_id: partial.company_candidate_id ?? "company-1",
    provider_type: "future_apollo",
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

function testMappedContactsWithNoEmailTriggerEnrichment(): void {
  const row = candidate({
    email: null,
    linkedin_url: null,
    phone: null,
    metadata: { apollo_person_id: "apollo-person-1", apollo_email_status: "unavailable" },
  })
  assert.equal(apolloCandidateNeedsEmailEnrichment(row), true)
  assert.equal(resolveApolloMappedContactEnrichmentEligibilityBlocker(row), null)
}

function testLinkedinOnlyNeedsEmailEnrichment(): void {
  const row = candidate({
    email: null,
    linkedin_url: "https://www.linkedin.com/in/jane-owner",
    metadata: { apollo_person_id: "apollo-person-1", apollo_email_status: "unavailable" },
  })
  assert.equal(apolloCandidateNeedsEmailEnrichment(row), true)
  assert.equal(resolveApolloMappedContactEnrichmentEligibilityBlocker(row), null)
}

function testEnrichmentDisabledProducesExplicitBlocker(): void {
  const evidence = buildApolloCompanyEnrichmentEvidence({
    candidates: [
      candidate({
        email: null,
        linkedin_url: null,
        metadata: { apollo_person_id: "apollo-person-1" },
      }),
    ],
    env: {
      GROWTH_APOLLO_ENRICH_EMAILS: "false",
      GROWTH_APOLLO_ENRICH_EMAILS_ACK: "0",
    } as NodeJS.ProcessEnv,
    enrichment_attempted: false,
    enrichment_result: {
      candidates_selected: 0,
      candidates_updated: 0,
      verified_status_without_email_selected: 0,
      channel_less_selected: 0,
      credits_consumed: 0,
      skipped_reason: "enrichment_gates_blocked",
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
  assert.ok(evidence.enrichment_blockers.includes("enrichment_provider_disabled"))
  assert.equal(evidence.config.search_only_mode, true)
}

function testVerifiedEmailPersistsCandidateEmail(): void {
  const row = candidate({
    email: "jane@example.com",
    metadata: {
      apollo_person_id: "apollo-person-1",
      apollo_email_status: "verified",
      apollo_enriched_at: new Date().toISOString(),
      apollo_enriched_email: "jane@example.com",
    },
  })
  const mapped = buildApolloMappedContactEnrichmentRow(row)
  assert.equal(mapped.candidate_email, "jane@example.com")
  assert.equal(isApolloVerifiedEmailStatus(mapped.candidate_email_status), true)
  assert.equal(evaluateApolloVerifiedEmailPromotionBlocker(row), null)
}

function testVerifiedStatusWithoutEmailNotContactable(): void {
  const row = candidate({
    email: null,
    metadata: { apollo_person_id: "apollo-person-1", apollo_email_status: "verified" },
  })
  assert.equal(resolveApolloMappedContactEnrichmentEligibilityBlocker(row), null)
  assert.equal(evaluateApolloVerifiedEmailPromotionBlocker(row), "apollo_verified_status_without_email")
  const channel = buildApolloEmailChannelEvidenceRow({ candidate: row })
  assert.equal(channel.verified_status_without_email, true)
  assert.equal(channel.needs_email_enrichment, true)
}

function testEnrichmentEmailPresentButNotPersistedBlocker(): void {
  const evidence = buildApolloCompanyEnrichmentEvidence({
    candidates: [candidate({ email: null, linkedin_url: null })],
    env: { GROWTH_APOLLO_ENRICH_EMAILS: "true" } as NodeJS.ProcessEnv,
    enrichment_attempted: true,
    enrichment_result: {
      candidates_selected: 1,
      candidates_updated: 0,
      verified_status_without_email_selected: 0,
      channel_less_selected: 1,
      credits_consumed: 1,
      skipped_reason: "candidate_persistence_partial_failure",
      error: "update failed",
      error_stage: "candidate_persistence",
      enrichment_provider: "apollo_bulk_match",
      enrichment_request_summary: "apollo_bulk_match;people=1",
      enrichment_response_summary: "apollo_bulk_match;batches=1;emails_returned=1;verified_returned=1",
      enrichment_verified_email_contacts: 0,
      enrichment_no_email_count: 1,
      enrichment_unverified_email_count: 0,
      bulk_match_batches: 1,
    },
  })
  assert.ok(evidence.enrichment_blockers.includes("enrichment_email_present_but_not_persisted"))
}

function testDiagnosticRoutesExist(): void {
  const readiness = readFileSync(
    resolve(process.cwd(), "app/api/platform/growth/apollo-single-company-enrichment/readiness/route.ts"),
    "utf8",
  )
  const execute = readFileSync(
    resolve(process.cwd(), "app/api/platform/growth/apollo-single-company-enrichment/execute/route.ts"),
    "utf8",
  )
  assert.match(readiness, /buildApolloSingleCompanyEnrichmentDiagnosticReadiness/)
  assert.match(execute, /executeApolloSingleCompanyEnrichmentDiagnostic/)
}

function main(): void {
  testMappedContactsWithNoEmailTriggerEnrichment()
  console.log("  ✓ mapped contacts with no email trigger enrichment")
  testLinkedinOnlyNeedsEmailEnrichment()
  console.log("  ✓ linkedin-only requires bulk_match email enrichment")
  testEnrichmentDisabledProducesExplicitBlocker()
  console.log("  ✓ enrichment disabled produces explicit blocker")
  testVerifiedEmailPersistsCandidateEmail()
  console.log("  ✓ enrichment returned verified email persists candidate email")
  testVerifiedStatusWithoutEmailNotContactable()
  console.log("  ✓ verified status without actual email does not count contactable")
  testEnrichmentEmailPresentButNotPersistedBlocker()
  console.log("  ✓ enrichment email present but not persisted fails with explicit blocker")
  testDiagnosticRoutesExist()
  console.log("  ✓ single-company enrichment diagnostic routes wired")
  console.log("\nApollo mapped-contact enrichment diagnostic checks passed.")
}

main()
