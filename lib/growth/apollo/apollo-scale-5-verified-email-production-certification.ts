/** Apollo-Scale-5 verified-email promotion production certification — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isSequenceReadyCompanyContact } from "@/lib/growth/apollo/apollo-enrichment-cert-promotion-evidence"
import type { ApolloPrimaryContactAcquisitionCompanyEvidence } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-evidence"
import { runApolloPrimaryContactAcquisitionForCompany } from "@/lib/growth/apollo/apollo-primary-contact-acquisition"
import {
  APOLLO_SCALE_5_VERIFIED_CONTACT_NAMES,
  computeApolloScale5CertResult,
  type ApolloScale5CertResult,
} from "@/lib/growth/apollo/apollo-scale-5-production-route-gates"
import {
  buildApolloVerifiedEmailPromotionContactRow,
  evaluateApolloVerifiedEmailPromotionBlocker,
  isApolloVerifiedEmailStatus,
  readApolloEmailStatusFromCandidate,
} from "@/lib/growth/apollo/apollo-verified-email-promotion-evidence"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"

export const APOLLO_SCALE_5_PRODUCTION_CERT_QA_MARKER =
  "apollo-scale-5-verified-email-production-cert-v1" as const

export type ApolloScale5ContactEvidenceRow = {
  full_name: string
  title: string | null
  email_status: string | null
  tier_used: number | null
  contact_candidate_id: string | null
  company_contact_id: string | null
  canonical_person_id: string | null
  promoted: boolean
  contactable: boolean
  sequence_ready: boolean
  blockers: string[]
}

export type ApolloScale5VerifiedContactCheck = {
  full_name: string
  result: "PASS" | "FAIL"
  blocker: string | null
  title: string | null
  email_status: string | null
  canonical_person_id: string | null
  company_contact_id: string | null
  contactable: boolean
  sequence_ready: boolean
}

export type ApolloScale5VerifiedEmailProductionCertification = {
  qa_marker: typeof APOLLO_SCALE_5_PRODUCTION_CERT_QA_MARKER
  result: ApolloScale5CertResult
  certified_at: string
  safety: {
    auto_enrollment: false
    outreach_sent: false
    enrollment_confirmed: false
    execution_approved: false
    scheduler_ran: false
  }
  target: {
    company_name: string
    domain: string
    company_candidate_id: string
    canonical_company_id: string | null
  }
  search: {
    apollo_search_attempted: boolean
    apollo_search_skipped_reason: string | null
    tier_used: number | null
    contacts_found: number
    mapped_contacts: number
    credits_consumed: number
  }
  promotion: {
    verified_email_contacts: number
    canonical_person_created: number
    canonical_person_matched: number
    company_contacts_promoted: number
  }
  readiness: {
    contactable_contacts: number
    sequence_ready_contacts: number
    promoted_contacts: number
  }
  contacts: ApolloScale5ContactEvidenceRow[]
  verified_contact_checks: ApolloScale5VerifiedContactCheck[]
  blockers: string[]
  acquisition: ApolloPrimaryContactAcquisitionCompanyEvidence
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function isContactableCompanyContact(row: Record<string, unknown>): boolean {
  const hasEmail =
    Boolean(asString(row.email)) &&
    asString(row.email_status) !== "blocked" &&
    asString(row.email_status) !== "unknown"
  const hasPhone = Boolean(asString(row.phone)) && asString(row.phone_status) !== "blocked"
  return hasEmail || hasPhone
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

function resolveVerifiedContactBlocker(row: ApolloScale5ContactEvidenceRow): string | null {
  if (!row.promoted) return row.blockers[0] ?? "not_promoted_to_company_contacts"
  if (!row.canonical_person_id) return "missing_canonical_person_id"
  if (!row.contactable) return "not_contactable"
  if (!row.sequence_ready) return "not_sequence_ready"
  return null
}

async function loadApolloContactEvidence(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    canonical_company_id: string | null
  },
): Promise<{
  contacts: ApolloScale5ContactEvidenceRow[]
  mapped_contacts: number
  verified_email_contacts: number
}> {
  const { data: candidateRows } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select("*")
    .eq("company_candidate_id", input.company_candidate_id)
    .eq("provider_type", "future_apollo")
    .limit(200)

  const candidates = (candidateRows ?? []) as GrowthContactCandidate[]
  const contactsByCandidateId = new Map<string, Record<string, unknown>>()

  if (input.canonical_company_id) {
    const { data: companyContacts } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("*")
      .eq("company_id", input.canonical_company_id)
      .limit(200)

    for (const raw of companyContacts ?? []) {
      const row = raw as Record<string, unknown>
      const candidateId = asString(row.contact_candidate_id)
      if (candidateId) contactsByCandidateId.set(candidateId, row)
    }
  }

  let verified_email_contacts = 0
  const contacts: ApolloScale5ContactEvidenceRow[] = []

  for (const candidate of candidates) {
    const emailStatus = readApolloEmailStatusFromCandidate(candidate)
    if (isApolloVerifiedEmailStatus(emailStatus) && asString(candidate.email)) {
      verified_email_contacts += 1
    }

    const companyContact = contactsByCandidateId.get(candidate.id) ?? null
    const promotionRow = buildApolloVerifiedEmailPromotionContactRow({
      candidate,
      company_contact: companyContact,
    })

    const blockers: string[] = []
    const prePromotionBlocker = evaluateApolloVerifiedEmailPromotionBlocker(candidate)
    if (prePromotionBlocker) blockers.push(prePromotionBlocker)
    if (promotionRow.blocker && !blockers.includes(promotionRow.blocker)) {
      blockers.push(promotionRow.blocker)
    }

    contacts.push({
      full_name: candidate.full_name,
      title: candidate.job_title,
      email_status: emailStatus,
      tier_used: promotionRow.tier_used,
      contact_candidate_id: candidate.id,
      company_contact_id: asString(companyContact?.id) || null,
      canonical_person_id: promotionRow.canonical_person_id,
      promoted: promotionRow.promoted,
      contactable: companyContact ? isContactableCompanyContact(companyContact) : promotionRow.contactable,
      sequence_ready: companyContact
        ? isSequenceReadyCompanyContact(companyContact)
        : promotionRow.sequence_ready,
      blockers,
    })
  }

  return {
    contacts,
    mapped_contacts: candidates.length,
    verified_email_contacts,
  }
}

function buildVerifiedContactChecks(
  contacts: ApolloScale5ContactEvidenceRow[],
): ApolloScale5VerifiedContactCheck[] {
  return APOLLO_SCALE_5_VERIFIED_CONTACT_NAMES.map((full_name) => {
    const row = contacts.find((contact) => normalizeName(contact.full_name) === normalizeName(full_name))
    if (!row) {
      return {
        full_name,
        result: "FAIL" as const,
        blocker: "contact_not_mapped",
        title: null,
        email_status: null,
        canonical_person_id: null,
        company_contact_id: null,
        contactable: false,
        sequence_ready: false,
      }
    }

    const blocker = resolveVerifiedContactBlocker(row)
    return {
      full_name,
      result: blocker ? ("FAIL" as const) : ("PASS" as const),
      blocker,
      title: row.title,
      email_status: row.email_status,
      canonical_person_id: row.canonical_person_id,
      company_contact_id: row.company_contact_id,
      contactable: row.contactable,
      sequence_ready: row.sequence_ready,
    }
  })
}

export async function certifyApolloScale5VerifiedEmailPromotion(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    company_name: string
    domain: string
    contact_limit?: number
    created_by?: string | null
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloScale5VerifiedEmailProductionCertification> {
  const env = input.env ?? process.env
  const contact_limit = input.contact_limit ?? 25

  const acquisition = await runApolloPrimaryContactAcquisitionForCompany(admin, {
    company_candidate_id: input.company_candidate_id,
    contact_limit,
    created_by: input.created_by ?? null,
    env,
    skip_apollo_search_if_existing_contactable: false,
  })

  const contactEvidence = await loadApolloContactEvidence(admin, {
    company_candidate_id: input.company_candidate_id,
    canonical_company_id: acquisition.canonical_company_id,
  })

  const verified_email_promotion = acquisition.verified_email_promotion
  const verified_contact_checks = buildVerifiedContactChecks(contactEvidence.contacts)

  const readiness = {
    contactable_contacts: acquisition.contactable_contacts,
    sequence_ready_contacts: acquisition.sequence_ready_contacts,
    promoted_contacts: acquisition.promoted_contacts,
  }

  const result = computeApolloScale5CertResult({
    ...readiness,
    verified_contact_checks,
  })

  const blockers = [...acquisition.blockers]
  for (const check of verified_contact_checks) {
    if (check.result === "FAIL" && check.blocker && !blockers.includes(`${check.full_name}: ${check.blocker}`)) {
      blockers.push(`${check.full_name}: ${check.blocker}`)
    }
  }

  const searchStrategy = acquisition.search_strategy

  return {
    qa_marker: APOLLO_SCALE_5_PRODUCTION_CERT_QA_MARKER,
    result,
    certified_at: new Date().toISOString(),
    safety: {
      auto_enrollment: false,
      outreach_sent: false,
      enrollment_confirmed: false,
      execution_approved: false,
      scheduler_ran: false,
    },
    target: {
      company_name: input.company_name,
      domain: input.domain,
      company_candidate_id: input.company_candidate_id,
      canonical_company_id: acquisition.canonical_company_id,
    },
    search: {
      apollo_search_attempted: acquisition.apollo_search_attempted,
      apollo_search_skipped_reason: acquisition.apollo_search_skipped_reason,
      tier_used: searchStrategy?.tier_used ?? null,
      contacts_found: searchStrategy?.raw_contacts_returned ?? acquisition.apollo_people_found,
      mapped_contacts: searchStrategy?.mapped_contacts ?? contactEvidence.mapped_contacts,
      credits_consumed: acquisition.credits_consumed,
    },
    promotion: {
      verified_email_contacts:
        verified_email_promotion?.verified_email_contacts ?? contactEvidence.verified_email_contacts,
      canonical_person_created: verified_email_promotion?.canonical_person_created ?? 0,
      canonical_person_matched: verified_email_promotion?.canonical_person_matched ?? 0,
      company_contacts_promoted:
        verified_email_promotion?.company_contacts_promoted ?? acquisition.promoted_contacts,
    },
    readiness,
    contacts: contactEvidence.contacts,
    verified_contact_checks,
    blockers,
    acquisition,
  }
}
