/**
 * Apollo-Scale-5 — verified Tier-2 Apollo email promotion regression checks.
 * Run: pnpm test:apollo-scale-5-verified-email-promotion
 */
import {
  apolloCandidateHasVerifiedPromotableChannel,
  buildApolloVerifiedEmailPromotionContactRow,
  countApolloVerifiedEmailCandidates,
  evaluateApolloVerifiedEmailPromotionBlocker,
  resolveApolloCandidateCompanyContactEmailStatus,
  selectApolloVerifiedEmailCandidatesForPromotion,
} from "../lib/growth/apollo/apollo-verified-email-promotion-evidence"
import { selectApolloCandidatesForPromotion } from "../lib/growth/apollo/apollo-enrichment-cert-promotion-evidence"
import type { GrowthContactCandidate } from "../lib/growth/contact-discovery/contact-discovery-types"

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function candidate(input: {
  full_name: string
  email?: string | null
  apollo_email_status?: string | null
  apollo_person_id?: string
  tier_used?: number
}): GrowthContactCandidate {
  return {
    id: `candidate-${input.full_name.toLowerCase().replace(/\s+/g, "-")}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    company_candidate_id: "mes-company",
    provider_name: "apollo",
    provider_type: "future_apollo",
    full_name: input.full_name,
    first_name: input.full_name.split(" ")[0] ?? null,
    last_name: input.full_name.split(" ").slice(1).join(" ") || null,
    job_title: "Owner",
    department: null,
    seniority: null,
    linkedin_url: null,
    email: input.email ?? null,
    phone: null,
    verification_state: "unverified",
    confidence: 0.85,
    source_attribution: [],
    evidence: [],
    dedupe_hash: `hash-${input.full_name}`,
    metadata: {
      apollo_person_id: input.apollo_person_id ?? `apollo-${input.full_name}`,
      apollo_email_status: input.apollo_email_status ?? null,
      apollo_tier_used: input.tier_used ?? 2,
      identity_classification: "named_person",
      eligible_for_canonical_person: true,
      eligible_for_committee: true,
    },
  }
}

function buildMedicalEquipmentSolutionsCohort(): GrowthContactCandidate[] {
  return [
    candidate({ full_name: "Tanya Powell", email: "tanya@medicalequipmentsolutions.com", apollo_email_status: "verified" }),
    candidate({ full_name: "Jonathan Branch", email: "jonathan@medicalequipmentsolutions.com", apollo_email_status: "verified" }),
    candidate({ full_name: "Scott Alexander", email: "scott@medicalequipmentsolutions.com", apollo_email_status: "verified" }),
    candidate({ full_name: "Kimberly Woolsey", email: "kimberly@medicalequipmentsolutions.com", apollo_email_status: "verified" }),
    candidate({ full_name: "No Email One", email: null, apollo_email_status: "unavailable" }),
    candidate({ full_name: "No Email Two", email: null, apollo_email_status: "unavailable" }),
    candidate({ full_name: "No Email Three", email: null, apollo_email_status: null }),
    candidate({ full_name: "No Email Four", email: null, apollo_email_status: "unavailable" }),
    candidate({ full_name: "Extrapolated One", email: "guess@medicalequipmentsolutions.com", apollo_email_status: "extrapolated" }),
  ]
}

function testMappedAndVerifiedCounts(): void {
  const cohort = buildMedicalEquipmentSolutionsCohort()
  assert(cohort.length === 9, "expected 9 mapped contacts")
  assert(countApolloVerifiedEmailCandidates(cohort) === 4, "expected 4 verified email contacts")
}

function testVerifiedContactsPromotable(): void {
  const cohort = buildMedicalEquipmentSolutionsCohort()
  const promotable = selectApolloVerifiedEmailCandidatesForPromotion(cohort)
  assert(promotable.length === 4, "expected 4 promotable verified-email contacts")
  assert(
    selectApolloCandidatesForPromotion(cohort).length === 4,
    "Apollo promotion selector should include verified-email contacts only",
  )
  for (const name of ["Tanya Powell", "Jonathan Branch", "Scott Alexander", "Kimberly Woolsey"]) {
    const row = promotable.find((item) => item.full_name === name)
    assert(Boolean(row), `missing promotable contact ${name}`)
    assert(!evaluateApolloVerifiedEmailPromotionBlocker(row!), `unexpected blocker for ${name}`)
  }
}

function testNonVerifiedBlocked(): void {
  const cohort = buildMedicalEquipmentSolutionsCohort()
  const blocked = cohort.filter((row) => !apolloCandidateHasVerifiedPromotableChannel(row))
  assert(blocked.length === 5, "expected 5 non-promotable contacts")
  for (const row of blocked) {
    const blocker = evaluateApolloVerifiedEmailPromotionBlocker(row)
    assert(Boolean(blocker), `expected blocker for ${row.full_name}`)
  }
}

function testVerifiedEmailStatusOnCompanyContact(): void {
  const kimberly = candidate({
    full_name: "Kimberly Woolsey",
    email: "kimberly@medicalequipmentsolutions.com",
    apollo_email_status: "verified",
  })
  assert(
    resolveApolloCandidateCompanyContactEmailStatus(kimberly) === "verified",
    "verified Apollo email should promote as verified company_contact email_status",
  )
  const extrapolated = candidate({
    full_name: "Extrapolated One",
    email: "guess@medicalequipmentsolutions.com",
    apollo_email_status: "extrapolated",
  })
  assert(
    resolveApolloCandidateCompanyContactEmailStatus(extrapolated) === "unknown",
    "extrapolated email must not become contactable",
  )
}

function testKimberlyCanonicalPersonResolvedAfterPromotion(): void {
  const kimberly = candidate({
    full_name: "Kimberly Woolsey",
    email: "kimberly@medicalequipmentsolutions.com",
    apollo_email_status: "verified",
  })
  const before = buildApolloVerifiedEmailPromotionContactRow({ candidate: kimberly })
  assert(before.blocker === null, "Kimberly should be promotable before sync")
  assert(before.sequence_ready === false, "Kimberly should not be sequence-ready without canonical person")

  const after = buildApolloVerifiedEmailPromotionContactRow({
    candidate: kimberly,
    company_contact: {
      full_name: kimberly.full_name,
      title: kimberly.job_title,
      email: kimberly.email,
      email_status: "verified",
      phone: null,
      phone_status: "unknown",
      linkedin_url: null,
      canonical_person_id: "person-kimberly",
      metadata: {
        identity_classification: "named_person",
        eligible_for_canonical_person: true,
        eligible_for_committee: true,
        apollo_tier_used: 2,
      },
    },
  })
  assert(after.canonical_person_id === "person-kimberly", "Kimberly canonical person should link")
  assert(after.sequence_ready === true, "Kimberly should be sequence-ready after canonical person linkage")
  assert(after.blocker === null, "Kimberly should have no blocker after canonical linkage")
}

function main(): void {
  testMappedAndVerifiedCounts()
  console.log("  ✓ 9 mapped / 4 verified email contacts")
  testVerifiedContactsPromotable()
  console.log("  ✓ verified-email contacts are promotable")
  testNonVerifiedBlocked()
  console.log("  ✓ non-verified contacts blocked correctly")
  testVerifiedEmailStatusOnCompanyContact()
  console.log("  ✓ verified email_status preserved on company_contact")
  testKimberlyCanonicalPersonResolvedAfterPromotion()
  console.log("  ✓ Kimberly canonical_person_id resolves sequence readiness")
  console.log("\nApollo-Scale-5 verified email promotion checks passed.")
}

main()
