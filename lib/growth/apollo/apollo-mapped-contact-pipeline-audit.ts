/** Apollo mapped contact downstream pipeline audit — evidence only, client-safe. */

import { candidateHasObservedContactChannel } from "@/lib/growth/apollo/apollo-live-pilot-canonical-sync-evidence"
import { isSequenceReadyCompanyContact } from "@/lib/growth/apollo/apollo-enrichment-cert-promotion-evidence"
import { personOrganizationMatchesTarget } from "@/lib/growth/apollo/apollo-search-query-audit"
import type { GrowthContactDiscoveryProviderRawContact } from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"
import type { ApolloPersonRecord } from "@/lib/growth/providers/apollo/apollo-types"

export const APOLLO_MAPPED_CONTACT_PIPELINE_AUDIT_QA_MARKER =
  "apollo-mapped-contact-pipeline-audit-v1" as const

export const APOLLO_MAPPING_AUDIT_MEDICAL_EQUIPMENT_SOLUTIONS = {
  company_name: "Medical Equipment Solutions",
  domain: "medicalequipmentsolutions.com",
} as const

export type ApolloPipelineStageId =
  | "canonical_person_resolution"
  | "identity_confidence"
  | "company_match_validation"
  | "enrichment_eligibility"
  | "promotion_eligibility"
  | "contactable_eligibility"
  | "sequence_ready_eligibility"

export type ApolloPipelineStageResult = {
  stage: ApolloPipelineStageId
  result: "PASS" | "FAIL"
  blocker: string | null
}

export type ApolloMappedContactPipelineAuditRow = {
  apollo_person_id: string | null
  full_name: string | null
  title: string | null
  company: string | null
  linkedin_url: string | null
  email_status: string | null
  mapped_contact_id: string | null
  contact_candidate_id: string | null
  company_contact_id: string | null
  canonical_person_id: string | null
  stages: ApolloPipelineStageResult[]
  first_failure_stage: ApolloPipelineStageId | null
  first_failure_blocker: string | null
}

export type ApolloMappedContactPipelineAuditReport = {
  qa_marker: typeof APOLLO_MAPPED_CONTACT_PIPELINE_AUDIT_QA_MARKER
  company_name: string
  domain: string
  company_candidate_id: string | null
  canonical_company_id: string | null
  tier_used: number
  apollo_people_returned: number
  apollo_people_mapped: number
  contacts: ApolloMappedContactPipelineAuditRow[]
  blocker_frequency: Record<string, number>
  stage_failure_frequency: Record<ApolloPipelineStageId, number>
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function isContactableCompanyContact(row: Record<string, unknown>): boolean {
  const hasEmail = Boolean(asString(row.email)) && asString(row.email_status) !== "blocked"
  const hasPhone = Boolean(asString(row.phone)) && asString(row.phone_status) !== "blocked"
  return hasEmail || hasPhone
}

function readApolloPersonIdFromMapped(
  contact: GrowthContactDiscoveryProviderRawContact,
): string | null {
  const metadata =
    contact.metadata && typeof contact.metadata === "object"
      ? (contact.metadata as Record<string, unknown>)
      : {}
  return asString(metadata.apollo_person_id) || asString(contact.external_provider_contact_id) || null
}

function readEmailStatus(
  person: ApolloPersonRecord,
  contact: GrowthContactDiscoveryProviderRawContact,
): string | null {
  const metadata =
    contact.metadata && typeof contact.metadata === "object"
      ? (contact.metadata as Record<string, unknown>)
      : {}
  return asString(metadata.apollo_email_status) || asString(person.email_status) || null
}

function buildCompanyContactRow(input: {
  contact: GrowthContactDiscoveryProviderRawContact
  canonical_person_id?: string | null
}): Record<string, unknown> {
  const identity = classifyContactIdentity({
    full_name: input.contact.full_name,
    title: input.contact.job_title,
    email: input.contact.email,
    phone: input.contact.phone,
    linkedin_url: input.contact.linkedin_url,
    source_type: "public_record",
  })

  return {
    full_name: input.contact.full_name,
    title: input.contact.job_title,
    email: input.contact.email,
    phone: input.contact.phone,
    email_status: asString(
      input.contact.metadata && typeof input.contact.metadata === "object"
        ? (input.contact.metadata as Record<string, unknown>).apollo_email_status
        : null,
    ),
    phone_status: null,
    linkedin_url: input.contact.linkedin_url,
    canonical_person_id: input.canonical_person_id ?? null,
    metadata: {
      identity_classification: identity.classification,
      eligible_for_canonical_person: identity.eligible_for_canonical_person,
      eligible_for_committee: identity.eligible_for_committee,
    },
  }
}

function stageResult(
  stage: ApolloPipelineStageId,
  pass: boolean,
  blocker: string | null,
): ApolloPipelineStageResult {
  return { stage, result: pass ? "PASS" : "FAIL", blocker: pass ? null : blocker }
}

export function evaluateApolloMappedContactPipelineStages(input: {
  person: ApolloPersonRecord
  contact: GrowthContactDiscoveryProviderRawContact
  target_company_name: string
  target_domain: string
  enrichment_enabled?: boolean
  canonical_person_id?: string | null
  persisted_has_channel?: boolean
}): ApolloPipelineStageResult[] {
  const enrichment_enabled = input.enrichment_enabled !== false
  const identity = classifyContactIdentity({
    full_name: input.contact.full_name,
    title: input.contact.job_title,
    email: input.contact.email,
    phone: input.contact.phone,
    linkedin_url: input.contact.linkedin_url,
    source_type: "public_record",
  })

  const apollo_person_id = readApolloPersonIdFromMapped(input.contact)
  const hasChannel =
    input.persisted_has_channel === true ||
    Boolean(asString(input.contact.email) || asString(input.contact.phone) || asString(input.contact.linkedin_url))

  const stages: ApolloPipelineStageResult[] = []

  stages.push(
    stageResult(
      "canonical_person_resolution",
      identity.eligible_for_canonical_person && asString(input.contact.full_name).length >= 2,
      !identity.eligible_for_canonical_person
        ? `identity_${identity.classification}`
        : asString(input.contact.full_name).length < 2
          ? "missing_full_name"
          : null,
    ),
  )

  stages.push(
    stageResult(
      "identity_confidence",
      identity.classification === "named_person" || identity.classification === "role_contact",
      identity.classification === "company_channel"
        ? "company_channel_identity"
        : identity.classification === "generic_placeholder"
          ? "generic_placeholder_identity"
          : `identity_${identity.classification}`,
    ),
  )

  const orgMatch = personOrganizationMatchesTarget(
    input.person,
    input.target_domain,
    input.target_company_name,
  )
  stages.push(
    stageResult(
      "company_match_validation",
      orgMatch === true,
      orgMatch === false
        ? "normalized_domain_mismatch"
        : orgMatch === null
          ? "organization_unknown"
          : null,
    ),
  )

  if (asString(input.contact.email)) {
    stages.push(stageResult("enrichment_eligibility", true, null))
  } else if (!apollo_person_id) {
    stages.push(stageResult("enrichment_eligibility", false, "no_apollo_person_id"))
  } else if (!enrichment_enabled) {
    stages.push(stageResult("enrichment_eligibility", false, "enrichment_gates_blocked"))
  } else {
    stages.push(stageResult("enrichment_eligibility", false, "no_email_available"))
  }

  stages.push(
    stageResult(
      "promotion_eligibility",
      hasChannel,
      hasChannel ? null : "missing_contact_channel",
    ),
  )

  const companyContactRow = buildCompanyContactRow({
    contact: input.contact,
    canonical_person_id: input.canonical_person_id,
  })
  stages.push(
    stageResult(
      "contactable_eligibility",
      isContactableCompanyContact(companyContactRow),
      isContactableCompanyContact(companyContactRow) ? null : "no_contactable_channel",
    ),
  )

  stages.push(
    stageResult(
      "sequence_ready_eligibility",
      isSequenceReadyCompanyContact(companyContactRow),
      !isContactableCompanyContact(companyContactRow)
        ? "not_contactable"
        : !asString(input.canonical_person_id)
          ? "missing_canonical_person_id"
          : !identity.eligible_for_canonical_person
            ? `identity_${identity.classification}`
            : identity.eligible_for_committee === false
              ? "not_eligible_for_committee"
              : "sequence_ready_gate_failed",
    ),
  )

  return stages
}

export function buildApolloMappedContactPipelineAuditRow(input: {
  person: ApolloPersonRecord
  contact: GrowthContactDiscoveryProviderRawContact
  target_company_name: string
  target_domain: string
  enrichment_enabled?: boolean
  mapped_contact_id?: string | null
  contact_candidate_id?: string | null
  company_contact_id?: string | null
  canonical_person_id?: string | null
  persisted_has_channel?: boolean
}): ApolloMappedContactPipelineAuditRow {
  const stages = evaluateApolloMappedContactPipelineStages(input)
  const firstFailure = stages.find((stage) => stage.result === "FAIL") ?? null

  return {
    apollo_person_id: readApolloPersonIdFromMapped(input.contact),
    full_name: asString(input.contact.full_name) || null,
    title: asString(input.contact.job_title) || null,
    company: asString(input.person.organization?.name) || null,
    linkedin_url: asString(input.contact.linkedin_url) || null,
    email_status: readEmailStatus(input.person, input.contact),
    mapped_contact_id:
      input.mapped_contact_id ??
      input.contact_candidate_id ??
      readApolloPersonIdFromMapped(input.contact),
    contact_candidate_id: input.contact_candidate_id ?? null,
    company_contact_id: input.company_contact_id ?? null,
    canonical_person_id: input.canonical_person_id ?? null,
    stages,
    first_failure_stage: firstFailure?.stage ?? null,
    first_failure_blocker: firstFailure?.blocker ?? null,
  }
}

export function buildApolloMappedContactPipelineBlockerFrequency(
  contacts: ApolloMappedContactPipelineAuditRow[],
): {
  blocker_frequency: Record<string, number>
  stage_failure_frequency: Record<ApolloPipelineStageId, number>
} {
  const blocker_frequency: Record<string, number> = {}
  const stage_failure_frequency: Record<ApolloPipelineStageId, number> = {
    canonical_person_resolution: 0,
    identity_confidence: 0,
    company_match_validation: 0,
    enrichment_eligibility: 0,
    promotion_eligibility: 0,
    contactable_eligibility: 0,
    sequence_ready_eligibility: 0,
  }

  for (const contact of contacts) {
    for (const stage of contact.stages) {
      if (stage.result !== "FAIL" || !stage.blocker) continue
      blocker_frequency[stage.blocker] = (blocker_frequency[stage.blocker] ?? 0) + 1
      stage_failure_frequency[stage.stage] = (stage_failure_frequency[stage.stage] ?? 0) + 1
    }
  }

  return { blocker_frequency, stage_failure_frequency }
}

export function buildApolloMappedContactPipelineAuditReport(input: {
  company_name: string
  domain: string
  company_candidate_id: string | null
  canonical_company_id: string | null
  tier_used: number
  apollo_people_returned: number
  apollo_people_mapped: number
  contacts: ApolloMappedContactPipelineAuditRow[]
}): ApolloMappedContactPipelineAuditReport {
  const frequencies = buildApolloMappedContactPipelineBlockerFrequency(input.contacts)
  return {
    qa_marker: APOLLO_MAPPED_CONTACT_PIPELINE_AUDIT_QA_MARKER,
    company_name: input.company_name,
    domain: input.domain,
    company_candidate_id: input.company_candidate_id,
    canonical_company_id: input.canonical_company_id,
    tier_used: input.tier_used,
    apollo_people_returned: input.apollo_people_returned,
    apollo_people_mapped: input.apollo_people_mapped,
    contacts: input.contacts,
    blocker_frequency: frequencies.blocker_frequency,
    stage_failure_frequency: frequencies.stage_failure_frequency,
  }
}

export function candidateHasObservedContactChannelForAudit(candidate: GrowthContactCandidate): boolean {
  return candidateHasObservedContactChannel(candidate)
}
