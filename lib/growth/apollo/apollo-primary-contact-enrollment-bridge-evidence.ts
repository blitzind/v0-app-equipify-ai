/** Apollo-Primary-3 enrollment bridge evidence helpers — client-safe. */

import {
  APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER,
  type ApolloEnrollmentBridgeHandoffGateResult,
  type ApolloPrimaryContactEnrollmentApprovalQueueSnapshot,
  type ApolloPrimaryContactEnrollmentQueueRow,
  type ApolloPrimaryContactEnrollmentQueueStatus,
} from "@/lib/growth/apollo/apollo-primary-contact-enrollment-bridge-types"
import type { ApolloPrimaryContactOperatorReviewRow } from "@/lib/growth/apollo/apollo-primary-contact-operator-review-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readContactRowFromSnapshot(snapshot: Record<string, unknown>): {
  full_name: string
  title: string | null
  company_name: string
  source: "Apollo"
  enrichment_status: ApolloPrimaryContactEnrollmentQueueRow["enrichment_status"]
  contactable: boolean
  sequence_ready: boolean
  blockers: string[]
} {
  return {
    full_name: asString(snapshot.full_name) || "Unknown",
    title: asString(snapshot.title) || null,
    company_name: asString(snapshot.company_name) || "Unknown",
    source: "Apollo",
    enrichment_status:
      (asString(snapshot.enrichment_status) as ApolloPrimaryContactEnrollmentQueueRow["enrichment_status"]) ||
      "not_enriched",
    contactable: snapshot.contactable === true,
    sequence_ready: snapshot.sequence_ready === true,
    blockers: Array.isArray(snapshot.blockers)
      ? snapshot.blockers.filter((value): value is string => typeof value === "string")
      : [],
  }
}

export function evaluateApolloEnrollmentBridgeHandoffGates(input: {
  contact_row: ApolloPrimaryContactOperatorReviewRow | null
}): ApolloEnrollmentBridgeHandoffGateResult {
  const row = input.contact_row
  if (!row) {
    return {
      allowed: false,
      code: "contact_not_found",
      reason: "Contact not found for enrollment handoff.",
      contact_row: null,
    }
  }

  if (row.operator_review_status !== "approved") {
    return {
      allowed: false,
      code: "operator_review_not_approved",
      reason: "Contact must be operator-approved before enrollment queue handoff.",
      contact_row: row,
    }
  }

  if (!row.outreach_ready) {
    return {
      allowed: false,
      code: "outreach_not_ready",
      reason: "Contact is not marked outreach-ready.",
      contact_row: row,
    }
  }

  if (!row.company_contact_id) {
    return {
      allowed: false,
      code: "missing_company_contact_id",
      reason: "Promoted company_contact_id is required for enrollment handoff.",
      contact_row: row,
    }
  }

  if (!row.sequence_ready) {
    return {
      allowed: false,
      code: "sequence_not_ready",
      reason: "Contact does not pass sequence readiness gates.",
      contact_row: row,
    }
  }

  if (row.blockers.length > 0) {
    return {
      allowed: false,
      code: "blockers_present",
      reason: `Sequence readiness blockers: ${row.blockers.join(", ")}`,
      contact_row: row,
    }
  }

  return {
    allowed: true,
    code: null,
    reason: null,
    contact_row: row,
  }
}

export function evaluateApolloEnrollmentApprovalGates(input: {
  queue_row: ApolloPrimaryContactEnrollmentQueueRow
}): { allowed: boolean; code: string | null; reason: string | null } {
  if (input.queue_row.status !== "pending_enrollment_approval") {
    return {
      allowed: false,
      code: "invalid_queue_status",
      reason: "Queue item is not pending enrollment approval.",
    }
  }

  if (!input.queue_row.sequence_ready_at_handoff) {
    return {
      allowed: false,
      code: "sequence_not_ready_at_handoff",
      reason: "Contact was not sequence-ready at handoff.",
    }
  }

  if (input.queue_row.blockers_at_handoff.length > 0) {
    return {
      allowed: false,
      code: "blockers_at_handoff",
      reason: `Handoff blockers: ${input.queue_row.blockers_at_handoff.join(", ")}`,
    }
  }

  if (!input.queue_row.contactable) {
    return {
      allowed: false,
      code: "not_contactable",
      reason: "Contact is not contactable.",
    }
  }

  return { allowed: true, code: null, reason: null }
}

export function mapEnrollmentQueueDbRow(row: Record<string, unknown>): ApolloPrimaryContactEnrollmentQueueRow {
  const snapshot =
    row.contact_snapshot && typeof row.contact_snapshot === "object"
      ? (row.contact_snapshot as Record<string, unknown>)
      : {}
  const contactFields = readContactRowFromSnapshot(snapshot)
  const blockersAtHandoff = Array.isArray(row.blockers_at_handoff)
    ? row.blockers_at_handoff.filter((value): value is string => typeof value === "string")
    : []

  return {
    queue_item_id: asString(row.id),
    company_candidate_id: asString(row.company_candidate_id),
    company_contact_id: asString(row.company_contact_id) || null,
    contact_candidate_id: asString(row.contact_candidate_id) || null,
    operator_review_id: asString(row.operator_review_id) || null,
    status: (asString(row.status) ||
      "pending_enrollment_approval") as ApolloPrimaryContactEnrollmentQueueStatus,
    ...contactFields,
    sequence_ready_at_handoff: row.sequence_ready_at_handoff === true,
    blockers_at_handoff: blockersAtHandoff,
    handoff_at: asString(row.created_at),
    enrollment_approved_at: asString(row.enrollment_approved_at) || null,
    enrollment_approved_email: asString(row.enrollment_approved_email) || null,
  }
}

export function buildApolloPrimaryContactEnrollmentApprovalQueueSnapshot(input: {
  items: ApolloPrimaryContactEnrollmentQueueRow[]
}): ApolloPrimaryContactEnrollmentApprovalQueueSnapshot {
  const pending = input.items.filter((row) => row.status === "pending_enrollment_approval")
  const approved = input.items.filter((row) => row.status === "enrollment_approved")
  const rejected = input.items.filter((row) => row.status === "enrollment_rejected")

  return {
    qa_marker: APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER,
    items: input.items,
    summary: {
      total: input.items.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      sequence_ready: input.items.filter((row) => row.sequence_ready).length,
      contactable: input.items.filter((row) => row.contactable).length,
    },
    auto_enrollment: false,
    outreach_sent: false,
  }
}

export function buildEnrollmentBridgeContactSnapshot(
  row: ApolloPrimaryContactOperatorReviewRow,
): Record<string, unknown> {
  return {
    qa_marker: APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER,
    full_name: row.full_name,
    title: row.title,
    company_name: row.company_name,
    source: row.source,
    enrichment_status: row.enrichment_status,
    contactable: row.contactable,
    sequence_ready: row.sequence_ready,
    blockers: row.blockers,
    operator_review_status: row.operator_review_status,
    outreach_ready: row.outreach_ready,
  }
}
