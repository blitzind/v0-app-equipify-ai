/** Apollo-Scale-5A contactable eligibility audit — gate tracing, client-safe. */

import { isSequenceReadyCompanyContact } from "@/lib/growth/apollo/apollo-enrichment-cert-promotion-evidence"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"

export const APOLLO_CONTACTABLE_ELIGIBILITY_AUDIT_QA_MARKER =
  "apollo-contactable-eligibility-audit-v5a-v1" as const

export const APOLLO_SCALE_5A_VERIFIED_CONTACT_NAMES = [
  "Tanya Powell",
  "Jonathan Branch",
  "Scott Alexander",
  "Kimberly Woolsey",
] as const

export type EligibilityGateTrace = {
  gate: string
  pass: boolean
  blocker: string | null
  field_values: Record<string, unknown>
}

export type ContactableDecisionTrace = {
  evaluator: "isContactableCompanyContact_enrichment_cert" | "isContactablePromotionRow_verified_email_promotion"
  gates: EligibilityGateTrace[]
  contactable: boolean
  first_failing_gate: string | null
  blocker: string | null
}

export type SequenceReadyDecisionTrace = {
  evaluator: "isSequenceReadyCompanyContact_enrichment_cert"
  gates: EligibilityGateTrace[]
  sequence_ready: boolean
  first_failing_gate: string | null
  blocker: string | null
}

export type ApolloContactableEligibilityRowSnapshot = {
  email: string | null
  email_status: string | null
  phone: string | null
  phone_status: string | null
  linkedin_url: string | null
  contact_status: string | null
  verification_state: string | null
  bounce_status: string | null
  suppression_status: string | null
  canonical_person_id: string | null
  metadata: Record<string, unknown>
}

export type ApolloContactableEligibilityAuditContact = {
  full_name: string
  company_contact_id: string | null
  contact_candidate_id: string | null
  canonical_person_id: string | null
  company_contact: ApolloContactableEligibilityRowSnapshot | null
  contact_candidate: ApolloContactableEligibilityRowSnapshot | null
  canonical_person: ApolloContactableEligibilityRowSnapshot | null
  contactable_traces: ContactableDecisionTrace[]
  sequence_ready_trace: SequenceReadyDecisionTrace
  aggregate_contactable_enrichment_cert: boolean
  aggregate_contactable_verified_email_promotion: boolean
  aggregate_sequence_ready: boolean
  scale5_blocker: string | null
  first_failing_gate: string | null
  first_blocker: string | null
}

export type ApolloContactableEligibilityAuditReport = {
  qa_marker: typeof APOLLO_CONTACTABLE_ELIGIBILITY_AUDIT_QA_MARKER
  audited_at: string
  company_name: string
  domain: string
  company_candidate_id: string | null
  canonical_company_id: string | null
  contacts: ApolloContactableEligibilityAuditContact[]
  blocker_frequency: Record<string, number>
  contactable_decision_trace_summary: Array<{
    full_name: string
    enrichment_cert_contactable: boolean
    verified_email_promotion_contactable: boolean
    first_failing_gate: string | null
    blocker: string | null
  }>
  sequence_ready_decision_trace_summary: Array<{
    full_name: string
    sequence_ready: boolean
    first_failing_gate: string | null
    blocker: string | null
  }>
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readMetadata(row: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!row?.metadata || typeof row.metadata !== "object") return {}
  return row.metadata as Record<string, unknown>
}

function readBounceStatus(row: Record<string, unknown> | null | undefined): string | null {
  const metadata = readMetadata(row)
  return (
    asString(metadata.bounce_status) ||
    asString(metadata.last_bounce_status) ||
    asString(metadata.email_bounce_status) ||
    null
  )
}

function readSuppressionStatus(input: {
  contact_status?: string | null
  person_status?: string | null
  metadata?: Record<string, unknown>
}): string | null {
  if (asString(input.contact_status) === "suppressed") return "company_contact_suppressed"
  if (asString(input.person_status) === "suppressed") return "canonical_person_suppressed"
  const metadata = input.metadata ?? {}
  if (metadata.suppressed === true) return "metadata_suppressed"
  if (asString(metadata.suppression_reason)) return asString(metadata.suppression_reason)
  return null
}

export function snapshotCompanyContactRow(
  row: Record<string, unknown> | null | undefined,
): ApolloContactableEligibilityRowSnapshot | null {
  if (!row) return null
  const metadata = readMetadata(row)
  return {
    email: asString(row.email) || null,
    email_status: asString(row.email_status) || null,
    phone: asString(row.phone) || null,
    phone_status: asString(row.phone_status) || null,
    linkedin_url: asString(row.linkedin_url) || null,
    contact_status: asString(row.contact_status) || null,
    verification_state: asString(metadata.apollo_email_status) || asString(row.email_status) || null,
    bounce_status: readBounceStatus(row),
    suppression_status: readSuppressionStatus({
      contact_status: asString(row.contact_status) || null,
      metadata,
    }),
    canonical_person_id: asString(row.canonical_person_id) || null,
    metadata,
  }
}

export function snapshotContactCandidateRow(
  row: Record<string, unknown> | null | undefined,
): ApolloContactableEligibilityRowSnapshot | null {
  if (!row) return null
  const metadata = readMetadata(row)
  return {
    email: asString(row.email) || null,
    email_status: asString(metadata.apollo_email_status) || null,
    phone: asString(row.phone) || null,
    phone_status: null,
    linkedin_url: asString(row.linkedin_url) || null,
    contact_status: null,
    verification_state: asString(row.verification_state) || null,
    bounce_status: readBounceStatus(row),
    suppression_status: readSuppressionStatus({ metadata }),
    canonical_person_id: null,
    metadata,
  }
}

export function snapshotCanonicalPersonRow(input: {
  person: Record<string, unknown> | null | undefined
  primary_email?: Record<string, unknown> | null
}): ApolloContactableEligibilityRowSnapshot | null {
  const person = input.person
  if (!person) return null
  const metadata = readMetadata(person)
  const emailRow = input.primary_email ?? null
  return {
    email: asString(emailRow?.email) || null,
    email_status: asString(emailRow?.verification_status) || null,
    phone: null,
    phone_status: null,
    linkedin_url: null,
    contact_status: asString(person.status) || null,
    verification_state: asString(emailRow?.verification_status) || null,
    bounce_status: readBounceStatus(emailRow),
    suppression_status: readSuppressionStatus({
      person_status: asString(person.status) || null,
      metadata,
    }),
    canonical_person_id: asString(person.id) || null,
    metadata,
  }
}

function gate(
  gateName: string,
  pass: boolean,
  blocker: string | null,
  field_values: Record<string, unknown>,
): EligibilityGateTrace {
  return { gate: gateName, pass, blocker: pass ? null : blocker, field_values }
}

function evaluateEnrichmentCertContactable(row: Record<string, unknown>): ContactableDecisionTrace {
  const email = asString(row.email)
  const email_status = asString(row.email_status)
  const phone = asString(row.phone)
  const phone_status = asString(row.phone_status)

  const hasEmailField = Boolean(email)
  const emailNotBlocked = email_status !== "blocked"
  const hasPhoneField = Boolean(phone)
  const phoneNotBlocked = phone_status !== "blocked"
  const hasEmailChannel = hasEmailField && emailNotBlocked
  const hasPhoneChannel = hasPhoneField && phoneNotBlocked
  const contactable = hasEmailChannel || hasPhoneChannel

  const gates: EligibilityGateTrace[] = [
    gate("has_email_field", hasEmailField, "missing_email_field", { email }),
    gate("email_not_blocked", !hasEmailField || emailNotBlocked, "email_status_blocked", {
      email,
      email_status,
    }),
    gate("has_phone_field", hasPhoneField, "missing_phone_field", { phone }),
    gate("phone_not_blocked", !hasPhoneField || phoneNotBlocked, "phone_status_blocked", {
      phone,
      phone_status,
    }),
    gate("contact_channel_present", contactable, "no_contactable_channel", {
      has_email_channel: hasEmailChannel,
      has_phone_channel: hasPhoneChannel,
    }),
  ]

  const firstFail = gates.find((item) => !item.pass) ?? null
  return {
    evaluator: "isContactableCompanyContact_enrichment_cert",
    gates,
    contactable,
    first_failing_gate: firstFail?.gate ?? null,
    blocker: firstFail?.blocker ?? null,
  }
}

function evaluateVerifiedEmailPromotionContactable(row: Record<string, unknown>): ContactableDecisionTrace {
  const email = asString(row.email)
  const email_status = asString(row.email_status)
  const phone = asString(row.phone)
  const phone_status = asString(row.phone_status)

  const hasEmailField = Boolean(email)
  const emailNotBlocked = email_status !== "blocked"
  const emailNotUnknown = email_status !== "unknown"
  const hasPhoneField = Boolean(phone)
  const phoneNotBlocked = phone_status !== "blocked"
  const hasEmailChannel = hasEmailField && emailNotBlocked && emailNotUnknown
  const hasPhoneChannel = hasPhoneField && phoneNotBlocked
  const contactable = hasEmailChannel || hasPhoneChannel

  const gates: EligibilityGateTrace[] = [
    gate("has_email_field", hasEmailField, "missing_email_field", { email }),
    gate("email_not_blocked", !hasEmailField || emailNotBlocked, "email_status_blocked", {
      email,
      email_status,
    }),
    gate("email_not_unknown", !hasEmailField || emailNotUnknown, "email_status_unknown", {
      email,
      email_status,
    }),
    gate("has_phone_field", hasPhoneField, "missing_phone_field", { phone }),
    gate("phone_not_blocked", !hasPhoneField || phoneNotBlocked, "phone_status_blocked", {
      phone,
      phone_status,
    }),
    gate("contact_channel_present", contactable, "no_contactable_channel", {
      has_email_channel: hasEmailChannel,
      has_phone_channel: hasPhoneChannel,
    }),
  ]

  const firstFail = gates.find((item) => !item.pass) ?? null
  return {
    evaluator: "isContactablePromotionRow_verified_email_promotion",
    gates,
    contactable,
    first_failing_gate: firstFail?.gate ?? null,
    blocker: firstFail?.blocker ?? null,
  }
}

function evaluateSequenceReady(row: Record<string, unknown>): SequenceReadyDecisionTrace {
  const contactableTrace = evaluateEnrichmentCertContactable(row)
  const metadata = readMetadata(row)
  const classification = asString(metadata.identity_classification)
  const canonicalPersonId = asString(row.canonical_person_id)

  const identity = classifyContactIdentity({
    full_name: asString(row.full_name),
    title: asString(row.title) || null,
    email: asString(row.email) || null,
    phone: asString(row.phone) || null,
    linkedin_url: asString(row.linkedin_url) || null,
    source_type: "public_record",
  })

  const gates: EligibilityGateTrace[] = [
    gate("contactable_enrichment_cert", contactableTrace.contactable, contactableTrace.blocker, {
      contactable: contactableTrace.contactable,
      first_failing_gate: contactableTrace.first_failing_gate,
    }),
    gate("canonical_person_present", Boolean(canonicalPersonId), "missing_canonical_person_id", {
      canonical_person_id: canonicalPersonId || null,
    }),
    gate(
      "identity_not_company_channel",
      classification !== "company_channel",
      "identity_company_channel",
      { identity_classification: classification || null },
    ),
    gate(
      "identity_not_generic_placeholder",
      classification !== "generic_placeholder",
      "identity_generic_placeholder",
      { identity_classification: classification || null },
    ),
    gate(
      "metadata_eligible_for_canonical_person",
      metadata.eligible_for_canonical_person !== false,
      "metadata_eligible_for_canonical_person_false",
      { eligible_for_canonical_person: metadata.eligible_for_canonical_person ?? null },
    ),
    gate(
      "classify_eligible_for_canonical_person",
      identity.eligible_for_canonical_person,
      `identity_${identity.classification}`,
      {
        classification: identity.classification,
        reasons: identity.reasons,
      },
    ),
    gate(
      "classify_eligible_for_committee",
      identity.eligible_for_committee !== false,
      "identity_not_eligible_for_committee",
      {
        classification: identity.classification,
        eligible_for_committee: identity.eligible_for_committee,
        reasons: identity.reasons,
      },
    ),
  ]

  const sequence_ready = isSequenceReadyCompanyContact(row)
  const firstFail = gates.find((item) => !item.pass) ?? null

  return {
    evaluator: "isSequenceReadyCompanyContact_enrichment_cert",
    gates,
    sequence_ready,
    first_failing_gate: firstFail?.gate ?? null,
    blocker: firstFail?.blocker ?? null,
  }
}

function resolveScale5Blocker(input: {
  companyContact: Record<string, unknown> | null
  enrichmentCertContactable: boolean
  verifiedEmailPromotionContactable: boolean
  sequenceReady: boolean
}): string | null {
  if (!input.companyContact) return "not_promoted_to_company_contacts"
  if (!asString(input.companyContact.canonical_person_id)) return "missing_canonical_person_id"
  if (!input.verifiedEmailPromotionContactable) return "not_contactable"
  if (!input.sequenceReady) return "not_sequence_ready"
  return null
}

export function buildApolloContactableEligibilityAuditContact(input: {
  full_name: string
  company_contact?: Record<string, unknown> | null
  contact_candidate?: Record<string, unknown> | null
  canonical_person?: Record<string, unknown> | null
  canonical_person_primary_email?: Record<string, unknown> | null
  company_contact_id?: string | null
  contact_candidate_id?: string | null
}): ApolloContactableEligibilityAuditContact {
  const companyContactRow = input.company_contact ?? null
  const rowForEvaluation =
    companyContactRow ??
    ({
      full_name: input.full_name,
      title: asString(input.contact_candidate?.job_title) || null,
      email: asString(input.contact_candidate?.email) || null,
      phone: asString(input.contact_candidate?.phone) || null,
      email_status: asString(readMetadata(input.contact_candidate).apollo_email_status) || "unknown",
      phone_status: "unknown",
      linkedin_url: asString(input.contact_candidate?.linkedin_url) || null,
      canonical_person_id: null,
      metadata: readMetadata(input.contact_candidate),
    } satisfies Record<string, unknown>)

  const enrichmentCertTrace = evaluateEnrichmentCertContactable(rowForEvaluation)
  const verifiedEmailPromotionTrace = evaluateVerifiedEmailPromotionContactable(rowForEvaluation)
  const sequenceReadyTrace = evaluateSequenceReady(rowForEvaluation)

  const scale5_blocker = resolveScale5Blocker({
    companyContact: companyContactRow,
    enrichmentCertContactable: enrichmentCertTrace.contactable,
    verifiedEmailPromotionContactable: verifiedEmailPromotionTrace.contactable,
    sequenceReady: sequenceReadyTrace.sequence_ready,
  })

  const firstTrace =
    !verifiedEmailPromotionTrace.contactable
      ? verifiedEmailPromotionTrace
      : !sequenceReadyTrace.sequence_ready
        ? {
            first_failing_gate: sequenceReadyTrace.first_failing_gate,
            blocker: sequenceReadyTrace.blocker,
          }
        : null

  return {
    full_name: input.full_name,
    company_contact_id: input.company_contact_id ?? (asString(companyContactRow?.id) || null),
    contact_candidate_id: input.contact_candidate_id ?? (asString(input.contact_candidate?.id) || null),
    canonical_person_id:
      asString(companyContactRow?.canonical_person_id) ||
      asString(input.canonical_person?.id) ||
      null,
    company_contact: snapshotCompanyContactRow(companyContactRow),
    contact_candidate: snapshotContactCandidateRow(input.contact_candidate),
    canonical_person: snapshotCanonicalPersonRow({
      person: input.canonical_person,
      primary_email: input.canonical_person_primary_email,
    }),
    contactable_traces: [enrichmentCertTrace, verifiedEmailPromotionTrace],
    sequence_ready_trace: sequenceReadyTrace,
    aggregate_contactable_enrichment_cert: enrichmentCertTrace.contactable,
    aggregate_contactable_verified_email_promotion: verifiedEmailPromotionTrace.contactable,
    aggregate_sequence_ready: sequenceReadyTrace.sequence_ready,
    scale5_blocker,
    first_failing_gate: firstTrace?.first_failing_gate ?? null,
    first_blocker: firstTrace?.blocker ?? scale5_blocker,
  }
}

export function buildApolloContactableEligibilityAuditReport(input: {
  company_name: string
  domain: string
  company_candidate_id: string | null
  canonical_company_id: string | null
  contacts: ApolloContactableEligibilityAuditContact[]
  audited_at?: string
}): ApolloContactableEligibilityAuditReport {
  const blocker_frequency: Record<string, number> = {}
  const bump = (key: string | null | undefined) => {
    if (!key) return
    blocker_frequency[key] = (blocker_frequency[key] ?? 0) + 1
  }

  for (const contact of input.contacts) {
    bump(contact.first_blocker)
    bump(contact.scale5_blocker)
    for (const trace of contact.contactable_traces) bump(trace.blocker)
    bump(contact.sequence_ready_trace.blocker)
  }

  return {
    qa_marker: APOLLO_CONTACTABLE_ELIGIBILITY_AUDIT_QA_MARKER,
    audited_at: input.audited_at ?? new Date().toISOString(),
    company_name: input.company_name,
    domain: input.domain,
    company_candidate_id: input.company_candidate_id,
    canonical_company_id: input.canonical_company_id,
    contacts: input.contacts,
    blocker_frequency,
    contactable_decision_trace_summary: input.contacts.map((contact) => ({
      full_name: contact.full_name,
      enrichment_cert_contactable: contact.aggregate_contactable_enrichment_cert,
      verified_email_promotion_contactable: contact.aggregate_contactable_verified_email_promotion,
      first_failing_gate: contact.contactable_traces.find((trace) => !trace.contactable)?.first_failing_gate ?? null,
      blocker: contact.contactable_traces.find((trace) => !trace.contactable)?.blocker ?? null,
    })),
    sequence_ready_decision_trace_summary: input.contacts.map((contact) => ({
      full_name: contact.full_name,
      sequence_ready: contact.aggregate_sequence_ready,
      first_failing_gate: contact.sequence_ready_trace.first_failing_gate,
      blocker: contact.sequence_ready_trace.blocker,
    })),
  }
}

export function normalizeContactName(value: string): string {
  return value.trim().toLowerCase()
}

export function isScale5AVerifiedContactName(full_name: string): boolean {
  return APOLLO_SCALE_5A_VERIFIED_CONTACT_NAMES.some(
    (name) => normalizeContactName(name) === normalizeContactName(full_name),
  )
}
