/** Apollo email persistence audit — trace where verified email is lost. Client-safe. */

import {
  APOLLO_SCALE_5A_VERIFIED_CONTACT_NAMES,
  buildApolloContactableEligibilityAuditContact,
} from "@/lib/growth/apollo/apollo-contactable-eligibility-audit"
import {
  buildApolloCompanyContactPromotionFields,
  readApolloEmailStatusFromCandidate,
  resolveApolloCandidatePromotedEmail,
} from "@/lib/growth/apollo/apollo-verified-email-promotion-evidence"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"
import type { ApolloPersonRecord } from "@/lib/growth/providers/apollo/apollo-types"
import { mapApolloPersonToContactDiscoveryRaw } from "@/lib/growth/providers/apollo/map-apollo-contact"

export const APOLLO_EMAIL_PERSISTENCE_AUDIT_QA_MARKER =
  "apollo-email-persistence-audit-v5b-v1" as const

export type ApolloEmailPersistenceStageId =
  | "apollo_raw_person"
  | "mapped_contact"
  | "contact_candidate"
  | "company_contact_promotion_fields"
  | "company_contact_row"

export type ApolloEmailPersistenceStageSnapshot = {
  stage: ApolloEmailPersistenceStageId
  email: string | null
  email_status: string | null
  verification_status: string | null
  email_lost_here: boolean
}

export type ApolloEmailPersistenceAuditContact = {
  full_name: string
  stages: ApolloEmailPersistenceStageSnapshot[]
  first_email_loss_stage: ApolloEmailPersistenceStageId | null
  before: {
    company_contact_email: string | null
    company_contact_email_status: string | null
    contactable: boolean
    sequence_ready: boolean
    blocker: string | null
  }
  after: {
    company_contact_email: string | null
    company_contact_email_status: string | null
    contactable: boolean
    sequence_ready: boolean
    blocker: string | null
  }
  blocker_delta: string[]
}

export type ApolloEmailPersistenceAuditReport = {
  qa_marker: typeof APOLLO_EMAIL_PERSISTENCE_AUDIT_QA_MARKER
  audited_at: string
  company_name: string
  domain: string
  root_cause: string | null
  contacts: ApolloEmailPersistenceAuditContact[]
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function stageSnapshot(
  stage: ApolloEmailPersistenceStageId,
  input: {
    email: string | null
    email_status?: string | null
    verification_status?: string | null
  },
  previousEmail: string | null,
): ApolloEmailPersistenceStageSnapshot {
  return {
    stage,
    email: input.email,
    email_status: input.email_status ?? null,
    verification_status: input.verification_status ?? null,
    email_lost_here: Boolean(previousEmail) && !input.email,
  }
}

export function traceApolloEmailPersistenceForCandidate(input: {
  full_name: string
  apollo_person?: ApolloPersonRecord | null
  mapped_contact?: Record<string, unknown> | null
  contact_candidate?: GrowthContactCandidate | null
  company_contact_before?: Record<string, unknown> | null
}): ApolloEmailPersistenceAuditContact {
  const person = input.apollo_person ?? null
  const mapped =
    input.mapped_contact ??
    (person
      ? mapApolloPersonToContactDiscoveryRaw(person, {
          company_name: "Medical Equipment Solutions",
          domain: "medicalequipmentsolutions.com",
          mock: false,
        })
      : null)

  const candidate =
    input.contact_candidate ??
    (mapped
      ? ({
          id: "candidate-synthetic",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          company_candidate_id: "mes-company",
          provider_name: "apollo",
          provider_type: "future_apollo",
          full_name: asString(mapped.full_name),
          first_name: asString(mapped.first_name) || null,
          last_name: asString(mapped.last_name) || null,
          job_title: asString(mapped.job_title) || null,
          department: asString(mapped.department) || null,
          seniority: asString(mapped.seniority) || null,
          linkedin_url: asString(mapped.linkedin_url) || null,
          email: asString(mapped.email) || null,
          phone: asString(mapped.phone) || null,
          verification_state: "unverified",
          confidence: typeof mapped.confidence === "number" ? mapped.confidence : 0.85,
          source_attribution: [],
          evidence: [],
          dedupe_hash: "hash",
          metadata:
            mapped.metadata && typeof mapped.metadata === "object"
              ? (mapped.metadata as Record<string, unknown>)
              : {},
        } satisfies GrowthContactCandidate)
      : null)

  const stages: ApolloEmailPersistenceStageSnapshot[] = []
  let previousEmail: string | null = null

  stages.push(
    stageSnapshot(
      "apollo_raw_person",
      {
        email: asString(person?.email) || null,
        email_status: asString(person?.email_status) || null,
        verification_status: asString(person?.email_status) || null,
      },
      previousEmail,
    ),
  )
  previousEmail = stages.at(-1)?.email ?? null

  stages.push(
    stageSnapshot(
      "mapped_contact",
      {
        email: asString(mapped?.email) || null,
        email_status: asString(
          mapped?.metadata && typeof mapped.metadata === "object"
            ? (mapped.metadata as Record<string, unknown>).apollo_email_status
            : null,
        ),
        verification_status: asString(
          mapped?.metadata && typeof mapped.metadata === "object"
            ? (mapped.metadata as Record<string, unknown>).apollo_email_status
            : null,
        ),
      },
      previousEmail,
    ),
  )
  previousEmail = stages.at(-1)?.email ?? null

  stages.push(
    stageSnapshot(
      "contact_candidate",
      {
        email: candidate ? asString(candidate.email) || null : null,
        email_status: candidate ? readApolloEmailStatusFromCandidate(candidate) : null,
        verification_status: candidate ? asString(candidate.verification_state) || null : null,
      },
      previousEmail,
    ),
  )
  previousEmail = stages.at(-1)?.email ?? null

  const promotionFields = candidate
    ? buildApolloCompanyContactPromotionFields({
        candidate,
        prior_email: asString(input.company_contact_before?.email) || null,
        prior_email_status:
          (asString(input.company_contact_before?.email_status) as
            | "unknown"
            | "discovered"
            | "verified"
            | "risky"
            | "invalid"
            | "blocked"
            | null) ?? null,
      })
    : { email: null, email_status: "unknown" as const }

  stages.push(
    stageSnapshot(
      "company_contact_promotion_fields",
      {
        email: promotionFields.email,
        email_status: promotionFields.email_status,
        verification_status: promotionFields.email_status,
      },
      previousEmail,
    ),
  )
  previousEmail = stages.at(-1)?.email ?? null

  const companyContactAfter = candidate
    ? {
        id: asString(input.company_contact_before?.id) || "company-contact-after",
        full_name: candidate.full_name,
        title: candidate.job_title,
        email: promotionFields.email,
        email_status: promotionFields.email_status,
        phone: candidate.phone,
        phone_status: "unknown",
        linkedin_url: candidate.linkedin_url,
        canonical_person_id: asString(input.company_contact_before?.canonical_person_id) || "person-id",
        metadata: {
          identity_classification: "named_person",
          eligible_for_canonical_person: true,
          eligible_for_committee: true,
        },
      }
    : null

  stages.push(
    stageSnapshot(
      "company_contact_row",
      {
        email: asString(companyContactAfter?.email) || null,
        email_status: asString(companyContactAfter?.email_status) || null,
        verification_status: asString(companyContactAfter?.email_status) || null,
      },
      previousEmail,
    ),
  )

  const first_email_loss_stage = stages.find((row) => row.email_lost_here)?.stage ?? null

  const beforeAudit = buildApolloContactableEligibilityAuditContact({
    full_name: input.full_name,
    company_contact: input.company_contact_before ?? null,
    contact_candidate: candidate,
  })

  const afterAudit = buildApolloContactableEligibilityAuditContact({
    full_name: input.full_name,
    company_contact: companyContactAfter,
    contact_candidate: candidate,
  })

  const blocker_delta: string[] = []
  if (beforeAudit.scale5_blocker && !afterAudit.scale5_blocker) {
    blocker_delta.push(`cleared:${beforeAudit.scale5_blocker}`)
  } else if (beforeAudit.scale5_blocker !== afterAudit.scale5_blocker) {
    blocker_delta.push(`${beforeAudit.scale5_blocker ?? "none"}->${afterAudit.scale5_blocker ?? "none"}`)
  }

  return {
    full_name: input.full_name,
    stages,
    first_email_loss_stage,
    before: {
      company_contact_email: asString(input.company_contact_before?.email) || null,
      company_contact_email_status: asString(input.company_contact_before?.email_status) || null,
      contactable: beforeAudit.aggregate_contactable_verified_email_promotion,
      sequence_ready: beforeAudit.aggregate_sequence_ready,
      blocker: beforeAudit.scale5_blocker,
    },
    after: {
      company_contact_email: promotionFields.email,
      company_contact_email_status: promotionFields.email_status,
      contactable: afterAudit.aggregate_contactable_verified_email_promotion,
      sequence_ready: afterAudit.aggregate_sequence_ready,
      blocker: afterAudit.scale5_blocker,
    },
    blocker_delta,
  }
}

export function buildApolloEmailPersistenceAuditReport(input: {
  company_name: string
  domain: string
  contacts: ApolloEmailPersistenceAuditContact[]
  audited_at?: string
}): ApolloEmailPersistenceAuditReport {
  const lossCounts = new Map<string, number>()
  for (const contact of input.contacts) {
    if (contact.first_email_loss_stage) {
      lossCounts.set(
        contact.first_email_loss_stage,
        (lossCounts.get(contact.first_email_loss_stage) ?? 0) + 1,
      )
    }
  }

  const root_cause =
    lossCounts.size === 0
      ? null
      : [...lossCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ===
          "company_contact_promotion_fields"
        ? "company_contacts_update_missing_email_persistence"
        : "email_lost_before_company_contact_promotion"

  return {
    qa_marker: APOLLO_EMAIL_PERSISTENCE_AUDIT_QA_MARKER,
    audited_at: input.audited_at ?? new Date().toISOString(),
    company_name: input.company_name,
    domain: input.domain,
    root_cause,
    contacts: input.contacts,
  }
}

export function buildMedicalEquipmentSolutionsEmailPersistenceFixtures(): ApolloEmailPersistenceAuditContact[] {
  const verifiedPeople = APOLLO_SCALE_5A_VERIFIED_CONTACT_NAMES.map((full_name) => {
    const local = full_name.split(" ")[0]?.toLowerCase() ?? "contact"
    const email = `${local}@medicalequipmentsolutions.com`
    const person: ApolloPersonRecord = {
      id: `apollo-${local}`,
      name: full_name,
      first_name: full_name.split(" ")[0] ?? null,
      last_name: full_name.split(" ").slice(1).join(" ") || null,
      title: "Owner",
      email,
      email_status: "verified",
      organization: { name: "Medical Equipment Solutions", primary_domain: "medicalequipmentsolutions.com" },
    }

    return traceApolloEmailPersistenceForCandidate({
      full_name,
      apollo_person: person,
      company_contact_before: {
        id: `cc-${local}`,
        full_name,
        title: "Owner",
        email: null,
        email_status: "verified",
        canonical_person_id: `person-${local}`,
        metadata: {
          identity_classification: "named_person",
          eligible_for_canonical_person: true,
          eligible_for_committee: true,
        },
      },
    })
  })

  return verifiedPeople
}

export { resolveApolloCandidatePromotedEmail, buildApolloCompanyContactPromotionFields }
