/**
 * Apollo-Scale-5A contactable eligibility audit — gate tracing regression checks.
 * Run: pnpm test:apollo-scale-5a-contactable-eligibility-audit
 */
import {
  APOLLO_CONTACTABLE_ELIGIBILITY_AUDIT_QA_MARKER,
  APOLLO_SCALE_5A_VERIFIED_CONTACT_NAMES,
  buildApolloContactableEligibilityAuditContact,
  buildApolloContactableEligibilityAuditReport,
} from "../lib/growth/apollo/apollo-contactable-eligibility-audit"

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function testVerifiedEmailMissingOnCompanyContactRow(): void {
  const contact = buildApolloContactableEligibilityAuditContact({
    full_name: "Kimberly Woolsey",
    company_contact_id: "cc-kimberly",
    contact_candidate_id: "cand-kimberly",
    contact_candidate: {
      id: "cand-kimberly",
      full_name: "Kimberly Woolsey",
      job_title: "Owner",
      email: "kimberly@medicalequipmentsolutions.com",
      metadata: { apollo_email_status: "verified" },
    },
    company_contact: {
      id: "cc-kimberly",
      full_name: "Kimberly Woolsey",
      title: "Owner",
      email: null,
      email_status: "verified",
      phone: null,
      phone_status: "unknown",
      canonical_person_id: "person-kimberly",
      contact_status: "candidate",
      metadata: {
        identity_classification: "named_person",
        eligible_for_canonical_person: true,
        eligible_for_committee: true,
      },
    },
    canonical_person: {
      id: "person-kimberly",
      full_name: "Kimberly Woolsey",
      status: "active",
    },
    canonical_person_primary_email: {
      email: "kimberly@medicalequipmentsolutions.com",
      verification_status: "observed",
    },
  })

  assert(contact.aggregate_contactable_enrichment_cert === false, "enrichment cert should fail without email field")
  assert(contact.aggregate_contactable_verified_email_promotion === false, "promotion row should fail without email field")
  assert(contact.scale5_blocker === "not_contactable", "Scale-5 blocker should be not_contactable")
  const promotionTrace = contact.contactable_traces.find(
    (trace) => trace.evaluator === "isContactablePromotionRow_verified_email_promotion",
  )
  assert(promotionTrace?.first_failing_gate === "has_email_field", "first gate should be has_email_field")
  assert(promotionTrace?.blocker === "missing_email_field", "blocker should be missing_email_field")
}

function testVerifiedEmailStatusOnRowPassesEnrichmentCert(): void {
  const contact = buildApolloContactableEligibilityAuditContact({
    full_name: "Tanya Powell",
    company_contact: {
      id: "cc-tanya",
      full_name: "Tanya Powell",
      title: "CEO",
      email: "tanya@medicalequipmentsolutions.com",
      email_status: "verified",
      phone: null,
      phone_status: "unknown",
      canonical_person_id: "person-tanya",
      metadata: {
        identity_classification: "named_person",
        eligible_for_canonical_person: true,
        eligible_for_committee: true,
      },
    },
  })

  assert(contact.aggregate_contactable_enrichment_cert === true, "verified email row should be contactable")
  assert(contact.aggregate_contactable_verified_email_promotion === true, "promotion row should accept verified")
  assert(contact.aggregate_sequence_ready === true, "should be sequence-ready with canonical person")
  assert(contact.scale5_blocker === null, "no Scale-5 blocker expected")
}

function testUnknownEmailStatusFailsPromotionPathOnly(): void {
  const contact = buildApolloContactableEligibilityAuditContact({
    full_name: "Scott Alexander",
    company_contact: {
      id: "cc-scott",
      full_name: "Scott Alexander",
      title: "Director",
      email: "scott@medicalequipmentsolutions.com",
      email_status: "unknown",
      phone: null,
      phone_status: "unknown",
      canonical_person_id: "person-scott",
      metadata: {
        identity_classification: "named_person",
        eligible_for_canonical_person: true,
        eligible_for_committee: true,
      },
    },
  })

  assert(contact.aggregate_contactable_enrichment_cert === true, "enrichment cert allows unknown email_status")
  assert(contact.aggregate_contactable_verified_email_promotion === false, "promotion row rejects unknown")
  const promotionTrace = contact.contactable_traces.find(
    (trace) => trace.evaluator === "isContactablePromotionRow_verified_email_promotion",
  )
  assert(promotionTrace?.first_failing_gate === "email_not_unknown", "should fail email_not_unknown")
  assert(contact.scale5_blocker === "not_contactable", "Scale-5 uses promotion path for blocker")
}

function testReportSummaries(): void {
  const contacts = APOLLO_SCALE_5A_VERIFIED_CONTACT_NAMES.map((full_name) =>
    buildApolloContactableEligibilityAuditContact({
      full_name,
      company_contact: {
        id: `cc-${full_name}`,
        full_name,
        title: "Owner",
        email: `${full_name.split(" ")[0]?.toLowerCase()}@medicalequipmentsolutions.com`,
        email_status: "verified",
        phone: null,
        phone_status: "unknown",
        canonical_person_id: `person-${full_name}`,
        metadata: {
          identity_classification: "named_person",
          eligible_for_canonical_person: true,
          eligible_for_committee: true,
        },
      },
    }),
  )

  const report = buildApolloContactableEligibilityAuditReport({
    company_name: "Medical Equipment Solutions",
    domain: "medicalequipmentsolutions.com",
    company_candidate_id: "mes-id",
    canonical_company_id: "canonical-mes",
    contacts,
  })

  assert(report.qa_marker === APOLLO_CONTACTABLE_ELIGIBILITY_AUDIT_QA_MARKER, "qa marker")
  assert(report.contacts.length === 4, "four verified contacts")
  assert(report.contactable_decision_trace_summary.length === 4, "contactable summary rows")
  assert(report.sequence_ready_decision_trace_summary.every((row) => row.sequence_ready), "all sequence ready")
}

function main(): void {
  testVerifiedEmailMissingOnCompanyContactRow()
  console.log("  ✓ missing company_contact.email fails contactable despite verified email_status")
  testVerifiedEmailStatusOnRowPassesEnrichmentCert()
  console.log("  ✓ verified email on company_contact passes all gates")
  testUnknownEmailStatusFailsPromotionPathOnly()
  console.log("  ✓ unknown email_status fails promotion path only")
  testReportSummaries()
  console.log("  ✓ blocker frequency + decision trace summaries")
  console.log("\nApollo-Scale-5A contactable eligibility audit checks passed.")
}

main()
