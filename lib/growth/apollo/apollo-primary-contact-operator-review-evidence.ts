/** Apollo-Primary-2 operator review evidence helpers — client-safe. */

import {
  isSequenceReadyCompanyContact,
} from "@/lib/growth/apollo/apollo-enrichment-cert-promotion-evidence"
import {
  APOLLO_PRIMARY_CONTACT_OPERATOR_REVIEW_QA_MARKER,
  type ApolloPrimaryContactChannelAvailability,
  type ApolloPrimaryContactEnrichmentStatus,
  type ApolloPrimaryContactOperatorReviewRow,
  type ApolloPrimaryContactOperatorReviewSnapshot,
  type ApolloPrimaryContactOperatorReviewStatus,
} from "@/lib/growth/apollo/apollo-primary-contact-operator-review-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function readApolloOperatorReviewStatus(
  metadata: Record<string, unknown> | null | undefined,
): ApolloPrimaryContactOperatorReviewStatus {
  const review =
    metadata?.apollo_operator_review && typeof metadata.apollo_operator_review === "object"
      ? (metadata.apollo_operator_review as Record<string, unknown>)
      : null
  const status = asString(review?.status)
  if (status === "approved" || status === "rejected") return status
  return "pending"
}

export function readApolloOperatorOutreachReady(metadata: Record<string, unknown> | null | undefined): boolean {
  const review =
    metadata?.apollo_operator_review && typeof metadata.apollo_operator_review === "object"
      ? (metadata.apollo_operator_review as Record<string, unknown>)
      : null
  return review?.outreach_ready === true
}

export function isApolloSourcedContactMetadata(metadata: Record<string, unknown>): boolean {
  if (asString(metadata.apollo_person_id)) return true
  if (asString(metadata.apollo_enriched_at)) return true
  if (metadata.apollo_acquired === true) return true
  const qa = asString(metadata.qa_marker)
  return qa.includes("apollo")
}

export function isApolloSourcedCompanyContactRow(row: Record<string, unknown>): boolean {
  const metadata =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}
  if (isApolloSourcedContactMetadata(metadata)) return true
  if (asString(row.source_type) === "public_record" && asString(metadata.apollo_person_id)) return true
  const providerType = asString(metadata.provider_type) || asString(metadata.discovery_provider)
  if (providerType.includes("apollo")) return true
  if (metadata.acquisition_sync === true && providerType.includes("apollo")) return true
  return false
}

export function isApolloBackedCompanyContactRow(
  row: Record<string, unknown>,
  apolloCandidateIds?: ReadonlySet<string>,
): boolean {
  if (isApolloSourcedCompanyContactRow(row)) return true
  const candidateId = asString(row.contact_candidate_id)
  if (candidateId && apolloCandidateIds?.has(candidateId)) return true
  return false
}

function normalizeReviewDedupeValue(value: string | null | undefined): string | null {
  const trimmed = asString(value).toLowerCase()
  return trimmed || null
}

export function buildApolloOperatorReviewDedupeKey(input: {
  company_contact_id?: string | null
  contact_candidate_id?: string | null
  canonical_person_id?: string | null
  email?: string | null
  linkedin_url?: string | null
  full_name?: string | null
}): string {
  const candidateId = normalizeReviewDedupeValue(input.contact_candidate_id)
  if (candidateId) return `candidate:${candidateId}`
  const personId = normalizeReviewDedupeValue(input.canonical_person_id)
  if (personId) return `person:${personId}`
  const email = normalizeReviewDedupeValue(input.email)
  if (email) return `email:${email}`
  const linkedin = normalizeReviewDedupeValue(input.linkedin_url)
  if (linkedin) return `linkedin:${linkedin}`
  const name = normalizeReviewDedupeValue(input.full_name)
  if (name) return `name:${name}`
  const companyContactId = normalizeReviewDedupeValue(input.company_contact_id)
  if (companyContactId) return `company_contact:${companyContactId}`
  return "unknown"
}

function hydrateCompanyContactFromCandidate(
  contact: Record<string, unknown>,
  candidateById: Map<string, Record<string, unknown>>,
): Record<string, unknown> {
  const candidateId = asString(contact.contact_candidate_id)
  const candidate = candidateId ? candidateById.get(candidateId) : null
  if (!candidate) return contact

  const contactMetadata =
    contact.metadata && typeof contact.metadata === "object"
      ? (contact.metadata as Record<string, unknown>)
      : {}
  const candidateMetadata =
    candidate.metadata && typeof candidate.metadata === "object"
      ? (candidate.metadata as Record<string, unknown>)
      : {}

  return {
    ...contact,
    email: asString(contact.email) || asString(candidate.email) || null,
    phone: asString(contact.phone) || asString(candidate.phone) || null,
    linkedin_url: asString(contact.linkedin_url) || asString(candidate.linkedin_url) || null,
    title: asString(contact.title) || asString(candidate.job_title) || null,
    canonical_person_id: asString(contact.canonical_person_id) || null,
    metadata: {
      ...candidateMetadata,
      ...contactMetadata,
      provider_type:
        asString(contactMetadata.provider_type) ||
        asString(candidateMetadata.provider_type) ||
        asString(candidate.provider_type) ||
        null,
      apollo_person_id:
        asString(contactMetadata.apollo_person_id) || asString(candidateMetadata.apollo_person_id) || null,
      apollo_enriched_at:
        asString(contactMetadata.apollo_enriched_at) || asString(candidateMetadata.apollo_enriched_at) || null,
      identity_classification:
        asString(contactMetadata.identity_classification) ||
        asString(candidateMetadata.identity_classification) ||
        null,
      eligible_for_canonical_person:
        contactMetadata.eligible_for_canonical_person ??
        candidateMetadata.eligible_for_canonical_person,
    },
  }
}

export function isApolloSourcedCandidateRow(row: Record<string, unknown>): boolean {
  const providerType = asString(row.provider_type)
  if (providerType === "future_apollo" || providerType.includes("apollo")) return true
  const metadata =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}
  return isApolloSourcedContactMetadata(metadata)
}

function isContactableRow(row: Record<string, unknown>): boolean {
  const hasEmail = Boolean(asString(row.email)) && asString(row.email_status) !== "blocked"
  const hasPhone = Boolean(asString(row.phone)) && asString(row.phone_status) !== "blocked"
  return hasEmail || hasPhone
}

function resolveChannelAvailability(row: Record<string, unknown>): ApolloPrimaryContactChannelAvailability {
  return {
    email: Boolean(asString(row.email)),
    linkedin: Boolean(asString(row.linkedin_url)),
    phone: Boolean(asString(row.phone)),
  }
}

function resolveEnrichmentStatus(row: Record<string, unknown>): ApolloPrimaryContactEnrichmentStatus {
  const metadata =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}
  const channels = resolveChannelAvailability(row)
  const enrichedAt = asString(metadata.apollo_enriched_at)
  const emailStatus = asString(metadata.apollo_email_status) || asString(row.email_status)

  if (channels.email || channels.phone) return "channel_ready"
  if (channels.linkedin && enrichedAt) return "enriched"
  if (channels.linkedin) return "partial"
  if (enrichedAt || emailStatus === "verified" || emailStatus === "discovered") return "enriched"
  return "not_enriched"
}

export function buildApolloContactReviewBlockers(row: Record<string, unknown>): string[] {
  const blockers: string[] = []
  const metadata =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}

  if (asString(row.contact_status) === "suppressed") blockers.push("contact_suppressed")
  if (asString(row.email_status) === "blocked") blockers.push("email_blocked")
  if (asString(row.phone_status) === "blocked") blockers.push("phone_blocked")
  if (!isContactableRow(row)) blockers.push("not_contactable")
  if (!asString(row.canonical_person_id)) blockers.push("canonical_person_unlinked")
  if (metadata.eligible_for_canonical_person === false) blockers.push("identity_ineligible")
  if (asString(metadata.identity_classification) === "company_channel") blockers.push("company_channel_identity")
  if (asString(metadata.identity_classification) === "generic_placeholder") blockers.push("generic_placeholder_identity")

  if (!isSequenceReadyCompanyContact(row)) {
    if (blockers.length === 0) blockers.push("sequence_readiness_gates_failed")
  }

  return blockers
}

function buildReviewRowFromCompanyContact(input: {
  row: Record<string, unknown>
  company_name: string
}): ApolloPrimaryContactOperatorReviewRow {
  const metadata =
    input.row.metadata && typeof input.row.metadata === "object"
      ? (input.row.metadata as Record<string, unknown>)
      : {}
  const contactId = asString(input.row.id)
  const blockers = buildApolloContactReviewBlockers(input.row)

  return {
    row_id: contactId,
    company_contact_id: contactId,
    contact_candidate_id: asString(input.row.contact_candidate_id) || null,
    canonical_person_id: asString(input.row.canonical_person_id) || null,
    full_name: asString(input.row.full_name) || "Unknown",
    title: asString(input.row.title) || null,
    company_name: input.company_name,
    source: "Apollo",
    channel_availability: resolveChannelAvailability(input.row),
    enrichment_status: resolveEnrichmentStatus(input.row),
    contactable: isContactableRow(input.row),
    sequence_ready: isSequenceReadyCompanyContact(input.row),
    operator_review_status: readApolloOperatorReviewStatus(metadata),
    outreach_ready: readApolloOperatorOutreachReady(metadata),
    blockers,
    contact_status: asString(input.row.contact_status) || null,
    email_status: asString(input.row.email_status) || null,
    phone_status: asString(input.row.phone_status) || null,
  }
}

function buildReviewRowFromCandidate(input: {
  row: Record<string, unknown>
  company_name: string
}): ApolloPrimaryContactOperatorReviewRow {
  const metadata =
    input.row.metadata && typeof input.row.metadata === "object"
      ? (input.row.metadata as Record<string, unknown>)
      : {}
  const candidateId = asString(input.row.id)
  const pseudoRow = {
    full_name: asString(input.row.full_name),
    title: asString(input.row.job_title) || null,
    email: asString(input.row.email) || null,
    phone: asString(input.row.phone) || null,
    email_status: asString(metadata.apollo_email_status) || (asString(input.row.email) ? "discovered" : "unknown"),
    phone_status: asString(input.row.phone) ? "unknown" : "unknown",
    linkedin_url: asString(input.row.linkedin_url) || null,
    canonical_person_id: null,
    contact_status: "candidate",
    metadata,
  }

  const blockers = buildApolloContactReviewBlockers(pseudoRow)
  if (!blockers.includes("not_promoted")) blockers.unshift("not_promoted")

  return {
    row_id: `candidate:${candidateId}`,
    company_contact_id: null,
    contact_candidate_id: candidateId,
    canonical_person_id: null,
    full_name: asString(input.row.full_name) || "Unknown",
    title: asString(input.row.job_title) || null,
    company_name: input.company_name,
    source: "Apollo",
    channel_availability: resolveChannelAvailability(pseudoRow),
    enrichment_status: resolveEnrichmentStatus(pseudoRow),
    contactable: isContactableRow(pseudoRow),
    sequence_ready: false,
    operator_review_status: readApolloOperatorReviewStatus(metadata),
    outreach_ready: readApolloOperatorOutreachReady(metadata),
    blockers,
    contact_status: "candidate",
    email_status: pseudoRow.email_status,
    phone_status: pseudoRow.phone_status,
  }
}

export function mergeApolloOperatorReviewRows(input: {
  company_contacts: Record<string, unknown>[]
  contact_candidates: Record<string, unknown>[]
  company_name: string
  apollo_candidate_ids?: ReadonlySet<string>
}): {
  contacts: ApolloPrimaryContactOperatorReviewRow[]
  promoted_company_contacts_loaded: number
  unpromoted_candidates_loaded: number
} {
  const candidateById = new Map<string, Record<string, unknown>>()
  for (const candidate of input.contact_candidates) {
    const candidateId = asString(candidate.id)
    if (candidateId) candidateById.set(candidateId, candidate)
  }

  const promotedRows: ApolloPrimaryContactOperatorReviewRow[] = []
  const fallbackRows: ApolloPrimaryContactOperatorReviewRow[] = []
  const dedupeKeys = new Set<string>()

  for (const rawContact of input.company_contacts) {
    if (!isApolloBackedCompanyContactRow(rawContact, input.apollo_candidate_ids)) continue
    const contact = hydrateCompanyContactFromCandidate(rawContact, candidateById)
    const row = buildReviewRowFromCompanyContact({ row: contact, company_name: input.company_name })
    const dedupeKey = buildApolloOperatorReviewDedupeKey({
      company_contact_id: row.company_contact_id,
      contact_candidate_id: row.contact_candidate_id,
      canonical_person_id: row.canonical_person_id,
      email: asString(contact.email),
      linkedin_url: asString(contact.linkedin_url),
      full_name: row.full_name,
    })
    if (dedupeKeys.has(dedupeKey)) continue
    dedupeKeys.add(dedupeKey)
    promotedRows.push(row)
  }

  for (const candidate of input.contact_candidates) {
    if (!isApolloSourcedCandidateRow(candidate)) continue
    const row = buildReviewRowFromCandidate({ row: candidate, company_name: input.company_name })
    const dedupeKey = buildApolloOperatorReviewDedupeKey({
      company_contact_id: row.company_contact_id,
      contact_candidate_id: row.contact_candidate_id,
      canonical_person_id: row.canonical_person_id,
      email: asString(candidate.email),
      linkedin_url: asString(candidate.linkedin_url),
      full_name: row.full_name,
    })
    if (dedupeKeys.has(dedupeKey)) continue
    dedupeKeys.add(dedupeKey)
    fallbackRows.push(row)
  }

  const contacts = [...promotedRows, ...fallbackRows].sort((a, b) => {
    if (a.company_contact_id && !b.company_contact_id) return -1
    if (!a.company_contact_id && b.company_contact_id) return 1
    if (a.sequence_ready !== b.sequence_ready) return a.sequence_ready ? -1 : 1
    if (a.contactable !== b.contactable) return a.contactable ? -1 : 1
    return a.full_name.localeCompare(b.full_name)
  })

  return {
    contacts,
    promoted_company_contacts_loaded: promotedRows.length,
    unpromoted_candidates_loaded: fallbackRows.length,
  }
}

export function buildApolloPrimaryContactOperatorReviewSnapshot(input: {
  company_candidate_id: string
  company_name: string
  canonical_company_id: string | null
  company_contacts: Record<string, unknown>[]
  contact_candidates: Record<string, unknown>[]
}): ApolloPrimaryContactOperatorReviewSnapshot {
  const apolloCandidateIds = new Set(
    input.contact_candidates
      .filter((candidate) => isApolloSourcedCandidateRow(candidate))
      .map((candidate) => asString(candidate.id))
      .filter(Boolean),
  )

  const merged = mergeApolloOperatorReviewRows({
    company_contacts: input.company_contacts,
    contact_candidates: input.contact_candidates,
    company_name: input.company_name,
    apollo_candidate_ids: apolloCandidateIds,
  })
  const contacts = merged.contacts

  const pending = contacts.filter((row) => row.operator_review_status === "pending")
  const approved = contacts.filter((row) => row.operator_review_status === "approved")
  const rejected = contacts.filter((row) => row.operator_review_status === "rejected")
  const sequenceReadyPending = pending.filter((row) => row.sequence_ready)
  const contactableContacts = contacts.filter((row) => row.contactable).length
  const sequenceReadyContacts = contacts.filter((row) => row.sequence_ready).length

  return {
    qa_marker: APOLLO_PRIMARY_CONTACT_OPERATOR_REVIEW_QA_MARKER,
    company_candidate_id: input.company_candidate_id,
    company_name: input.company_name,
    canonical_company_id: input.canonical_company_id,
    contacts,
    summary: {
      total: contacts.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      contactable: contactableContacts,
      sequence_ready: sequenceReadyContacts,
      sequence_ready_pending_approval: sequenceReadyPending.length,
    },
    evidence: {
      promoted_company_contacts_loaded: merged.promoted_company_contacts_loaded,
      unpromoted_candidates_loaded: merged.unpromoted_candidates_loaded,
      sequence_ready_contacts: sequenceReadyContacts,
      contactable_contacts: contactableContacts,
      missing_company_contact_id_count: contacts.filter((row) => !row.company_contact_id).length,
    },
    auto_enrollment: false,
    outreach_sent: false,
  }
}

export function buildApolloOperatorReviewMetadataPatch(input: {
  status: "approved" | "rejected"
  reviewed_at: string
  reviewed_by: string | null
  note?: string | null
  outreach_ready?: boolean
}): Record<string, unknown> {
  return {
    apollo_operator_review: {
      qa_marker: APOLLO_PRIMARY_CONTACT_OPERATOR_REVIEW_QA_MARKER,
      status: input.status,
      reviewed_at: input.reviewed_at,
      reviewed_by: input.reviewed_by,
      note: input.note?.trim() || null,
      outreach_ready: input.outreach_ready === true,
    },
  }
}
