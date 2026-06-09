/**
 * Apollo EN-1 enrichment certification — gates, audit, go/no-go matrix.
 * Run: pnpm test:apollo-enrichment-cert-en-1
 */
import assert from "node:assert/strict"
import {
  APOLLO_ENRICHMENT_PATH_AUDIT,
  getRecommendedApolloEnrichmentPath,
  listApolloEnrichmentPathsForSearchOnlyCandidates,
} from "../lib/growth/apollo/apollo-enrichment-cert-audit"
import {
  assertApolloEnrichmentCertAllowed,
  APOLLO_ENRICHMENT_CERT_DEFAULT_MAX_PEOPLE,
  resolveApolloEnrichmentCertMaxPeople,
} from "../lib/growth/apollo/apollo-enrichment-cert-gates"
import { certifyApolloEnrichmentGoNoGo } from "../lib/growth/apollo/apollo-enrichment-cert-evidence-types"

function baseEnrichmentEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    GROWTH_APOLLO_EN_1_CERT_ENABLED: "true",
    GROWTH_APOLLO_EN_1_CERT_ACK: "1",
    GROWTH_APOLLO_ENRICH_EMAILS: "true",
    GROWTH_APOLLO_ENRICH_EMAILS_ACK: "1",
    GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
    GROWTH_APOLLO_USE_MOCK: "true",
    APOLLO_API_KEY: "test-key",
    GROWTH_APOLLO_EN_1_COMPANY_CANDIDATE_ID: "company-test-1",
    ...overrides,
  }
}

function main(): void {
  console.log("Apollo EN-1 enrichment certification tests\n")

  const recommended = getRecommendedApolloEnrichmentPath()
  assert.equal(recommended.path_id, "apollo_bulk_match")
  assert.equal(listApolloEnrichmentPathsForSearchOnlyCandidates().length, 1)
  assert.ok(APOLLO_ENRICHMENT_PATH_AUDIT.length >= 5)
  console.log("  ✓ enrichment audit — bulk_match is sole search-only path")

  const allowed = assertApolloEnrichmentCertAllowed(baseEnrichmentEnv())
  assert.equal(allowed.ok, true)
  assert.equal(allowed.max_people, APOLLO_ENRICHMENT_CERT_DEFAULT_MAX_PEOPLE)
  console.log("  ✓ gates — all required flags pass in mock mode")

  const missingAck = assertApolloEnrichmentCertAllowed(
    baseEnrichmentEnv({ GROWTH_APOLLO_ENRICH_EMAILS_ACK: "0" }),
  )
  assert.equal(missingAck.ok, false)
  assert.match(missingAck.blockers.join(" "), /GROWTH_APOLLO_ENRICH_EMAILS_ACK/)
  console.log("  ✓ gates — rejects missing GROWTH_APOLLO_ENRICH_EMAILS_ACK")

  const missingEnrich = assertApolloEnrichmentCertAllowed(
    baseEnrichmentEnv({ GROWTH_APOLLO_ENRICH_EMAILS: "false" }),
  )
  assert.equal(missingEnrich.ok, false)
  console.log("  ✓ gates — rejects GROWTH_APOLLO_ENRICH_EMAILS=false")

  assert.equal(resolveApolloEnrichmentCertMaxPeople({ GROWTH_APOLLO_EN_1_MAX_PEOPLE: "99" }), 10)
  console.log("  ✓ gates — max people capped at 10")

  const goResult = certifyApolloEnrichmentGoNoGo({
    enrichment: {
      candidates_eligible: 10,
      candidates_with_apollo_person_id: 10,
      bulk_match_batches: 1,
      credits_consumed: 1,
      candidates_updated: 8,
    },
    channels: {
      emails_found: 5,
      phones_found: 2,
      linkedin_found: 3,
      verified_emails: 4,
      before: { email: 0, phone: 0, linkedin: 0 },
      after: { email: 5, phone: 2, linkedin: 3 },
    },
    promotion: { company_contacts_synced: 5, company_contacts_promoted: 5, enriched_candidates_with_email: 5, enriched_candidates_with_linkedin: 3, promotion_attempted: true, promotion_blockers: [], company_contacts_created: 5, company_contacts_updated: 0, contactable_after_promotion: 5, sequence_ready_after_promotion: 4, canonical_person_backfill_rows_processed: 5, canonical_person_backfill_persons_linked: 4, rejection_reasons: {} },
    runtime: { duration_ms: 100, api_calls: 1, errors: [] },
    gates: {
      enrich_emails: true,
      enrich_emails_ack: true,
      en_1_cert_enabled: true,
      en_1_cert_ack: true,
      max_people: 10,
    },
  })
  assert.equal(goResult.go_no_go, "go")
  console.log("  ✓ go/no-go — channels obtained → go")

  const conditionalResult = certifyApolloEnrichmentGoNoGo({
    enrichment: {
      candidates_eligible: 10,
      candidates_with_apollo_person_id: 10,
      bulk_match_batches: 1,
      credits_consumed: 1,
      candidates_updated: 0,
    },
    channels: {
      emails_found: 0,
      phones_found: 0,
      linkedin_found: 0,
      verified_emails: 0,
      before: { email: 0, phone: 0, linkedin: 0 },
      after: { email: 0, phone: 0, linkedin: 0 },
    },
    promotion: { company_contacts_synced: 0, company_contacts_promoted: 0, enriched_candidates_with_email: 0, enriched_candidates_with_linkedin: 0, promotion_attempted: false, promotion_blockers: ["no_enriched_candidates_with_contact_channel"], company_contacts_created: 0, company_contacts_updated: 0, contactable_after_promotion: 0, sequence_ready_after_promotion: 0, canonical_person_backfill_rows_processed: 0, canonical_person_backfill_persons_linked: 0, rejection_reasons: {} },
    runtime: { duration_ms: 100, api_calls: 1, errors: [] },
    gates: {
      enrich_emails: true,
      enrich_emails_ack: true,
      en_1_cert_enabled: true,
      en_1_cert_ack: true,
      max_people: 10,
    },
  })
  assert.equal(conditionalResult.go_no_go, "conditional")
  console.log("  ✓ go/no-go — credits spent, no channels → conditional")

  const noGoResult = certifyApolloEnrichmentGoNoGo({
    enrichment: {
      candidates_eligible: 0,
      candidates_with_apollo_person_id: 0,
      bulk_match_batches: 0,
      credits_consumed: 0,
      candidates_updated: 0,
    },
    channels: {
      emails_found: 0,
      phones_found: 0,
      linkedin_found: 0,
      verified_emails: 0,
      before: { email: 0, phone: 0, linkedin: 0 },
      after: { email: 0, phone: 0, linkedin: 0 },
    },
    promotion: { company_contacts_synced: 0, company_contacts_promoted: 0, enriched_candidates_with_email: 0, enriched_candidates_with_linkedin: 0, promotion_attempted: false, promotion_blockers: ["no_enriched_candidates_with_contact_channel"], company_contacts_created: 0, company_contacts_updated: 0, contactable_after_promotion: 0, sequence_ready_after_promotion: 0, canonical_person_backfill_rows_processed: 0, canonical_person_backfill_persons_linked: 0, rejection_reasons: {} },
    runtime: { duration_ms: 50, api_calls: 0, errors: [] },
    gates: {
      enrich_emails: true,
      enrich_emails_ack: true,
      en_1_cert_enabled: true,
      en_1_cert_ack: true,
      max_people: 10,
    },
  })
  assert.equal(noGoResult.go_no_go, "no_go")
  console.log("  ✓ go/no-go — no apollo person IDs → no_go")

  console.log("\nAll Apollo EN-1 enrichment certification checks passed.")
}

main()
