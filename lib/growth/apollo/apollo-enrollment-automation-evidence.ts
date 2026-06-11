/** Apollo Enrollment Automation evidence helpers — client-safe. */

import type {
  ApolloEnrollmentAttributionRecord,
  ApolloEnrollmentAutomationSourceAttribution,
  ApolloEnrollmentCandidateQueueSnapshot,
  ApolloEnrollmentCandidateRow,
  ApolloEnrollmentCandidateStatus,
} from "@/lib/growth/apollo/apollo-enrollment-automation-types"
import {
  APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER,
  APOLLO_ENROLLMENT_AUTOMATION_SOURCE_ATTRIBUTION,
} from "@/lib/growth/apollo/apollo-enrollment-automation-types"
import { buildApolloPipelineAttributionDisplay } from "@/lib/growth/apollo/apollo-pipeline-attribution-display"
import type { ApolloQueuePaginationMeta } from "@/lib/growth/apollo/apollo-queue-pagination"
import type { ApolloPrimaryContactOperatorReviewRow } from "@/lib/growth/apollo/apollo-primary-contact-operator-review-types"
import type { ApolloPrimaryContactOperatorReviewSnapshot } from "@/lib/growth/apollo/apollo-primary-contact-operator-review-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function buildApolloEnrollmentAttributionChain(): ApolloEnrollmentAutomationSourceAttribution[] {
  return [...APOLLO_ENROLLMENT_AUTOMATION_SOURCE_ATTRIBUTION]
}

export function buildApolloEnrollmentAttributionRecord(input: {
  apollo_search_tier?: string | null
  verified_email_source?: string | null
  enrichment_source?: string | null
}): ApolloEnrollmentAttributionRecord {
  return {
    apollo_source: "Apollo Primary Contact Acquisition",
    apollo_search_tier: input.apollo_search_tier ?? null,
    verified_email_source: input.verified_email_source ?? "apollo_search_verified_email",
    enrichment_source: input.enrichment_source ?? "apollo_enrichment_cert",
    qualification_source: "apollo_enrollment_qualification_engine",
    enrollment_source: "apollo_enrollment_automation",
    attribution_chain: buildApolloEnrollmentAttributionChain(),
  }
}

export function assertApolloEnrollmentAttributionPreserved(
  record: ApolloEnrollmentAttributionRecord | null | undefined,
): boolean {
  if (!record) return false
  const expected = APOLLO_ENROLLMENT_AUTOMATION_SOURCE_ATTRIBUTION
  return expected.every((entry) => record.attribution_chain.includes(entry))
}

export function buildApolloEnrollmentContactSnapshot(
  contact: ApolloPrimaryContactOperatorReviewRow,
  input?: { email?: string | null; phone?: string | null },
): Record<string, unknown> {
  return {
    full_name: contact.full_name,
    title: contact.title,
    company_name: contact.company_name,
    email: input?.email ?? null,
    phone: input?.phone ?? null,
    source: contact.source,
    enrichment_status: contact.enrichment_status,
    contactable: contact.contactable,
    sequence_ready: contact.sequence_ready,
    blockers: contact.blockers,
    channel_availability: contact.channel_availability,
    canonical_person_id: contact.canonical_person_id,
    company_contact_id: contact.company_contact_id,
    contact_candidate_id: contact.contact_candidate_id,
  }
}

export function mapApolloEnrollmentCandidateDbRow(
  row: Record<string, unknown>,
): ApolloEnrollmentCandidateRow {
  const contactSnapshot =
    row.contact_snapshot && typeof row.contact_snapshot === "object"
      ? (row.contact_snapshot as Record<string, unknown>)
      : {}
  const sourceAttribution =
    row.source_attribution && typeof row.source_attribution === "object"
      ? (row.source_attribution as ApolloEnrollmentAttributionRecord)
      : buildApolloEnrollmentAttributionRecord({})
  const operatorIntelligence =
    row.operator_intelligence && typeof row.operator_intelligence === "object"
      ? (row.operator_intelligence as ApolloEnrollmentCandidateRow["operator_intelligence"])
      : {
          why_selected: asString(row.qualification_reason) || "Pending operator review.",
          likely_decision_maker_role: null,
          company_summary: asString(contactSnapshot.company_name) || null,
          research_summary: null,
          buying_committee_summary: null,
          recommended_first_channel: "email" as const,
          recommended_sequence: null,
          apollo_evidence_summary: null,
        }
  const acquisitionEvidence =
    row.acquisition_evidence && typeof row.acquisition_evidence === "object"
      ? (row.acquisition_evidence as Record<string, unknown>)
      : {}

  return {
    candidate_id: asString(row.id),
    company_candidate_id: asString(row.company_candidate_id),
    company_contact_id: asString(row.company_contact_id) || null,
    contact_candidate_id: asString(row.contact_candidate_id) || null,
    growth_lead_id: asString(row.growth_lead_id) || null,
    prospect_id: asString(row.prospect_id) || null,
    status: (asString(row.status) as ApolloEnrollmentCandidateStatus) || "pending_enrollment_approval",
    company_name: asString(contactSnapshot.company_name) || "Unknown",
    full_name: asString(contactSnapshot.full_name) || "Unknown",
    title: asString(contactSnapshot.title) || null,
    email: asString(contactSnapshot.email) || null,
    phone: asString(contactSnapshot.phone) || null,
    qualified_for_enrollment: row.qualified_for_enrollment === true,
    qualification_reason: asString(row.qualification_reason) || null,
    qualification_score: asNumber(row.qualification_score) ?? 0,
    fit_score: asNumber(row.fit_score),
    research_score: asNumber(row.research_score),
    source_attribution: sourceAttribution,
    operator_intelligence: operatorIntelligence,
    acquisition_evidence: acquisitionEvidence,
    created_at: asString(row.created_at),
    enrollment_approved_at: asString(row.enrollment_approved_at) || null,
    enrollment_approved_email: asString(row.enrollment_approved_email) || null,
    attribution_display: buildApolloPipelineAttributionDisplay({
      source_attribution: sourceAttribution as unknown as Record<string, unknown>,
      approved_at: asString(row.enrollment_approved_at) || null,
      approved_email: asString(row.enrollment_approved_email) || null,
      approved_by: asString(row.enrollment_approved_by) || null,
      rejection_note: asString(row.enrollment_rejection_note) || null,
    }),
  }
}

export function buildApolloEnrollmentCandidateQueueSnapshot(input: {
  items: ApolloEnrollmentCandidateRow[]
  pagination?: ApolloQueuePaginationMeta
}): ApolloEnrollmentCandidateQueueSnapshot {
  const items = input.items
  return {
    qa_marker: APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER,
    queue_label: "Apollo Ready For Enrollment",
    items,
    summary: {
      total: items.length,
      pending: items.filter((row) => row.status === "pending_enrollment_approval").length,
      approved: items.filter((row) => row.status === "enrollment_approved").length,
      rejected: items.filter((row) => row.status === "enrollment_rejected").length,
      research_rerun: items.filter((row) => row.status === "research_rerun_requested").length,
      qualified: items.filter((row) => row.qualified_for_enrollment).length,
    },
    auto_enrollment: false,
    outreach_sent: false,
    pagination: input.pagination,
  }
}

export function summarizeApolloOperatorReviewForQualification(
  snapshot: ApolloPrimaryContactOperatorReviewSnapshot,
): {
  mapped_contacts: number
  verified_email_contacts: number
  contactable_contacts: number
  sequence_ready_contacts: number
} {
  const contacts = snapshot.contacts
  return {
    mapped_contacts: contacts.length,
    verified_email_contacts: contacts.filter(
      (row) => row.email_status === "verified" || row.channel_availability.email,
    ).length,
    contactable_contacts: contacts.filter((row) => row.contactable).length,
    sequence_ready_contacts: contacts.filter((row) => row.sequence_ready).length,
  }
}

export function evaluateApolloEnrollmentApprovalGate(input: {
  candidate: ApolloEnrollmentCandidateRow
}): { allowed: boolean; code: string | null } {
  if (input.candidate.status !== "pending_enrollment_approval") {
    return { allowed: false, code: "invalid_candidate_status" }
  }
  if (!input.candidate.qualified_for_enrollment) {
    return { allowed: false, code: "not_qualified_for_enrollment" }
  }
  return { allowed: true, code: null }
}

export function evaluateApolloEnrollmentReEnrollmentBlock(input: {
  existing_status: ApolloEnrollmentCandidateStatus | null
  growth_lead_id: string | null
  has_active_enrollment: boolean
}): { blocked: boolean; code: string | null } {
  if (input.existing_status === "enrollment_approved") {
    return { blocked: true, code: "already_enrollment_approved" }
  }
  if (input.has_active_enrollment) {
    return { blocked: true, code: "active_enrollment_exists" }
  }
  return { blocked: false, code: null }
}
