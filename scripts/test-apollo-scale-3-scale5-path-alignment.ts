/**
 * Apollo-Scale-3 — Scale-5 promotion path alignment regression checks.
 * Run: pnpm test:apollo-scale-3-scale5-path-alignment
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  assertApolloScale3CompanyMatchesScale5PromotionPath,
  buildApolloScale3CompanyPromotionEvidence,
  mapApolloScale3CompanyEvidenceRow,
} from "../lib/growth/apollo/apollo-scale-3-company-promotion-evidence"
import type { ApolloPrimaryContactAcquisitionCompanyEvidence } from "../lib/growth/apollo/apollo-primary-contact-acquisition-evidence"

function mesScale5PassAcquisition(): ApolloPrimaryContactAcquisitionCompanyEvidence {
  return {
    company_candidate_id: "mes-company",
    company_name: "Medical Equipment Solutions",
    domain: "medicalequipmentsolutions.com",
    canonical_company_id: "canonical-mes",
    apollo_search_attempted: true,
    apollo_search_skipped_reason: null,
    apollo_people_found: 9,
    existing_contacts_reused: 5,
    existing_contactable_before: 5,
    enrichment_attempted: true,
    enrichment_skipped_reason: null,
    enrichment_candidates_updated: 4,
    email_enrichment: {
      candidates_selected: 4,
      candidates_updated: 4,
      verified_status_without_email_selected: 4,
      channel_less_selected: 0,
      skipped_reason: null,
      error: null,
      error_stage: null,
    },
    credits_consumed: 4,
    promoted_contacts: 9,
    contactable_contacts: 5,
    sequence_ready_contacts: 4,
    blockers: [],
    search_strategy: {
      qa_marker: "apollo-tiered-people-search-v1",
      tier_used: 2,
      raw_contacts_returned: 9,
      mapped_contacts: 9,
      mapping_rejections: 0,
      rejection_reasons: {},
      tier_attempts: [],
      legacy_fallback_used: false,
      legacy_contactable_count: 0,
    },
    verified_email_promotion: {
      qa_marker: "apollo-verified-email-promotion-evidence-v1",
      verified_email_contacts: 4,
      canonical_person_created: 0,
      canonical_person_matched: 4,
      company_contacts_promoted: 9,
      contactable_after_promotion: 5,
      sequence_ready_after_promotion: 4,
      blockers_by_contact: [],
    },
  }
}

function mesScale2BaseRow() {
  return {
    company_candidate_id: "mes-company",
    company_name: "Medical Equipment Solutions",
    domain: "medicalequipmentsolutions.com",
    search_attempted: true,
    contacts_found: 9,
    contacts_enriched: 4,
    contacts_promoted: 9,
    contactable_contacts: 5,
    sequence_ready_contacts: 4,
    blockers: [],
    error: null,
    error_metadata: null,
    apollo_response_status: "success",
    failed: false,
  }
}

function testMedicalEquipmentSolutionsScale5PassMapsToScale3Evidence(): void {
  const acquisition = mesScale5PassAcquisition()
  const row = mapApolloScale3CompanyEvidenceRow({
    base: mesScale2BaseRow(),
    acquisition,
  })

  assert.equal(row.tier_used, 2, "MES should remain tier 2, not tier 4 fallback")
  assert.equal(row.legacy_fallback_used, false)
  assert.equal(row.promotion_evidence.verified_email_contacts, 4)
  assert.equal(row.promotion_evidence.company_contacts_promoted, 9)
  assert.equal(row.promotion_evidence.contactable_after_promotion, 5)
  assert.equal(row.promotion_evidence.sequence_ready_after_promotion, 4)
  assert.equal(row.promotion_evidence.verified_status_without_email_selected, 4)
  assert.equal(row.promotion_evidence.email_enrichment_candidates_updated, 4)

  const regression = assertApolloScale3CompanyMatchesScale5PromotionPath({
    company_name: row.company_name,
    tier_used: row.tier_used,
    legacy_fallback_used: row.legacy_fallback_used,
    mapped_contacts: row.mapped_contacts,
    promotion: row.promotion_evidence,
    blockers: row.blockers,
  })
  assert.equal(regression, null, regression ?? "unexpected regression")
}

function testLegacyTier4OnlyFallbackDetected(): void {
  const promotion = buildApolloScale3CompanyPromotionEvidence(null)
  assert.equal(
    assertApolloScale3CompanyMatchesScale5PromotionPath({
      company_name: "Legacy Only Co",
      tier_used: 4,
      legacy_fallback_used: true,
      mapped_contacts: 0,
      promotion,
      blockers: ["no_enriched_candidates_with_contact_channel"],
    }),
    null,
  )

  const bad = assertApolloScale3CompanyMatchesScale5PromotionPath({
    company_name: "Medical Equipment Solutions",
    tier_used: 4,
    legacy_fallback_used: true,
    mapped_contacts: 0,
    promotion: buildApolloScale3CompanyPromotionEvidence(mesScale5PassAcquisition()),
    blockers: ["no_enriched_candidates_with_contact_channel"],
  })
  assert.match(bad ?? "", /regressed to tier-4 fallback/)
}

function testAcquisitionSkipRequiresApolloCandidatesWhenLegacyContactable(): void {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/apollo/apollo-primary-contact-acquisition.ts"),
    "utf8",
  )
  assert.match(
    source,
    /existing\.existing_contactable_before > 0 && existing\.existing_apollo_with_channel > 0/,
  )
  assert.match(source, /existing\.existing_apollo_candidates === 0/)
}

function testScale2UsesForcedSearchPath(): void {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/apollo/apollo-scale-2-live-acquisition-certification.ts"),
    "utf8",
  )
  assert.match(source, /skip_apollo_search_if_existing_contactable: false/)
}

function testScale3ExecuteReturnsStructuredFailure(): void {
  const route = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/apollo-scale-3/execute/route.ts"),
    "utf8",
  )
  const productionRoute = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/apollo/apollo-scale-3-production-route.ts"),
    "utf8",
  )
  assert.match(route, /jsonResponse/)
  assert.match(route, /formatApolloScale5ExecutionFailure/)
  assert.match(productionRoute, /failure_analysis/)
  assert.match(productionRoute, /aggregate/)
}

function main(): void {
  testMedicalEquipmentSolutionsScale5PassMapsToScale3Evidence()
  console.log("  ✓ MES Scale-5 PASS acquisition maps to Scale-3 tier-2 promotion evidence")
  testLegacyTier4OnlyFallbackDetected()
  console.log("  ✓ tier-4-only fallback regression detector flags MES mismatch")
  testAcquisitionSkipRequiresApolloCandidatesWhenLegacyContactable()
  console.log("  ✓ acquisition skip requires Apollo candidates when legacy contactable exists")
  testScale2UsesForcedSearchPath()
  console.log("  ✓ Scale-2/3 cohort acquisition forces Apollo search")
  testScale3ExecuteReturnsStructuredFailure()
  console.log("  ✓ Scale-3 execute route returns structured JSON failures")
  console.log("\nApollo-Scale-3 Scale-5 path alignment checks passed.")
}

main()
