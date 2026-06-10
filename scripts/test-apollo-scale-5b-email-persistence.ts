/**
 * Apollo-Scale-5B — missing email persistence audit + fix regression checks.
 * Run: pnpm test:apollo-scale-5b-email-persistence
 */
import {
  APOLLO_EMAIL_PERSISTENCE_AUDIT_QA_MARKER,
  buildApolloEmailPersistenceAuditReport,
  buildApolloCompanyContactPromotionFields,
  buildMedicalEquipmentSolutionsEmailPersistenceFixtures,
  resolveApolloCandidatePromotedEmail,
} from "../lib/growth/apollo/apollo-email-persistence-audit"
import type { GrowthContactCandidate } from "../lib/growth/contact-discovery/contact-discovery-types"

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function verifiedCandidate(full_name: string, email: string): GrowthContactCandidate {
  return {
    id: `candidate-${full_name}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    company_candidate_id: "mes-company",
    provider_name: "apollo",
    provider_type: "future_apollo",
    full_name,
    first_name: full_name.split(" ")[0] ?? null,
    last_name: full_name.split(" ").slice(1).join(" ") || null,
    job_title: "Owner",
    department: null,
    seniority: null,
    linkedin_url: null,
    email,
    phone: null,
    verification_state: "unverified",
    confidence: 0.9,
    source_attribution: [],
    evidence: [],
    dedupe_hash: "hash",
    metadata: {
      apollo_email_status: "verified",
      apollo_person_id: `apollo-${full_name}`,
    },
  }
}

function testResolvePromotedEmailRequiresVerifiedStatus(): void {
  const verified = verifiedCandidate("Tanya Powell", "tanya@medicalequipmentsolutions.com")
  assert(
    resolveApolloCandidatePromotedEmail(verified) === "tanya@medicalequipmentsolutions.com",
    "verified email should persist",
  )

  const extrapolated = verifiedCandidate("Bad Contact", "guess@medicalequipmentsolutions.com")
  extrapolated.metadata = { apollo_email_status: "extrapolated" }
  assert(resolveApolloCandidatePromotedEmail(extrapolated) === null, "extrapolated email must not persist")
}

function testPromotionFieldsBackfillNullCompanyContactEmail(): void {
  const kimberly = verifiedCandidate(
    "Kimberly Woolsey",
    "kimberly@medicalequipmentsolutions.com",
  )
  const fields = buildApolloCompanyContactPromotionFields({
    candidate: kimberly,
    prior_email: null,
    prior_email_status: "verified",
  })
  assert(fields.email === "kimberly@medicalequipmentsolutions.com", "Kimberly email should backfill")
  assert(fields.email_status === "verified", "Kimberly email_status should remain verified")
}

function testMedicalEquipmentSolutionsBeforeAfterEvidence(): void {
  const contacts = buildMedicalEquipmentSolutionsEmailPersistenceFixtures()
  const report = buildApolloEmailPersistenceAuditReport({
    company_name: "Medical Equipment Solutions",
    domain: "medicalequipmentsolutions.com",
    contacts,
  })

  assert(report.qa_marker === APOLLO_EMAIL_PERSISTENCE_AUDIT_QA_MARKER, "qa marker")
  assert(contacts.length === 4, "four verified contacts")

  for (const contact of contacts) {
    assert(contact.before.company_contact_email === null, `${contact.full_name} before email null`)
    assert(Boolean(contact.after.company_contact_email), `${contact.full_name} after email populated`)
    assert(contact.after.contactable === true, `${contact.full_name} contactable after fix`)
    assert(contact.after.sequence_ready === true, `${contact.full_name} sequence-ready after fix`)
    assert(contact.before.blocker === "not_contactable", `${contact.full_name} before blocker`)
    assert(contact.after.blocker === null, `${contact.full_name} after blocker cleared`)
    assert(contact.blocker_delta.includes("cleared:not_contactable"), `${contact.full_name} blocker delta`)
  }
}

function main(): void {
  testResolvePromotedEmailRequiresVerifiedStatus()
  console.log("  ✓ verified-only email persistence policy preserved")
  testPromotionFieldsBackfillNullCompanyContactEmail()
  console.log("  ✓ promotion fields backfill null company_contact.email")
  testMedicalEquipmentSolutionsBeforeAfterEvidence()
  console.log("  ✓ MES before/after evidence + blocker deltas for four verified contacts")
  console.log("\nApollo-Scale-5B email persistence checks passed.")
}

main()
