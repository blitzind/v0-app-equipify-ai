/** Apollo-Primary-4 enrollment draft evidence helpers — client-safe. */

import type { ApolloPrimaryContactEnrollmentQueueRow } from "@/lib/growth/apollo/apollo-primary-contact-enrollment-bridge-types"
import {
  APOLLO_PRIMARY_CONTACT_ENROLLMENT_DRAFT_QA_MARKER,
  APOLLO_PRIMARY_CONTACT_ENROLLMENT_SOURCE_ATTRIBUTION,
  type ApolloEnrollmentDraftGateResult,
  type ApolloPrimaryContactEnrollmentDraftEvidence,
  type ApolloPrimaryContactEnrollmentDraftQueueRow,
  type ApolloPrimaryContactEnrollmentDraftSnapshot,
  type ApolloPrimaryContactEnrollmentSourceAttribution,
} from "@/lib/growth/apollo/apollo-primary-contact-enrollment-draft-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function buildApolloEnrollmentSourceAttributionChain(): ApolloPrimaryContactEnrollmentSourceAttribution[] {
  return [...APOLLO_PRIMARY_CONTACT_ENROLLMENT_SOURCE_ATTRIBUTION]
}

export function readApolloEnrollmentDraftFromQueueMetadata(
  metadata: Record<string, unknown> | null | undefined,
): {
  growth_lead_id: string | null
  enrollment_draft_id: string | null
  draft_created_at: string | null
  draft_blockers: string[]
} {
  const draft =
    metadata?.apollo_enrollment_draft && typeof metadata.apollo_enrollment_draft === "object"
      ? (metadata.apollo_enrollment_draft as Record<string, unknown>)
      : null

  const blockers = Array.isArray(draft?.blockers)
    ? draft.blockers.filter((value): value is string => typeof value === "string")
    : []

  return {
    growth_lead_id: asString(draft?.growth_lead_id) || null,
    enrollment_draft_id: asString(draft?.enrollment_draft_id) || null,
    draft_created_at: asString(draft?.created_at) || null,
    draft_blockers: blockers,
  }
}

export function evaluateApolloEnrollmentDraftGates(input: {
  queue_row: ApolloPrimaryContactEnrollmentQueueRow
  growth_lead_id?: string | null
  enrollment_draft_id?: string | null
  preflight_code?: string | null
}): ApolloEnrollmentDraftGateResult {
  const blockers: string[] = []

  if (input.queue_row.status !== "enrollment_approved") {
    return {
      allowed: false,
      code: "enrollment_not_approved",
      reason: "Queue item must be enrollment-approved before creating a draft.",
      blockers: ["enrollment_not_approved"],
    }
  }

  if (!input.queue_row.company_contact_id) {
    blockers.push("missing_company_contact_id")
  }

  if (!input.queue_row.sequence_ready_at_handoff) {
    blockers.push("sequence_not_ready_at_handoff")
  }

  if (input.queue_row.blockers_at_handoff.length > 0) {
    blockers.push(...input.queue_row.blockers_at_handoff)
  }

  if (!input.queue_row.contactable) {
    blockers.push("not_contactable")
  }

  if (input.queue_row.blockers.length > 0) {
    blockers.push(...input.queue_row.blockers)
  }

  if (input.enrollment_draft_id) {
    blockers.push("draft_already_created")
  }

  if (input.preflight_code) {
    blockers.push(input.preflight_code)
  }

  if (blockers.length > 0) {
    return {
      allowed: false,
      code: blockers[0] ?? "draft_blocked",
      reason: `Draft creation blocked: ${blockers.join(", ")}`,
      blockers,
    }
  }

  return { allowed: true, code: null, reason: null, blockers: [] }
}

export function mapApolloEnrollmentDraftQueueRow(input: {
  queue_row: ApolloPrimaryContactEnrollmentQueueRow
  metadata?: Record<string, unknown> | null
  draft_blockers?: string[]
}): ApolloPrimaryContactEnrollmentDraftQueueRow {
  const draftFields = readApolloEnrollmentDraftFromQueueMetadata(input.metadata ?? null)
  const mergedBlockers = [
    ...new Set([...(input.draft_blockers ?? []), ...draftFields.draft_blockers]),
  ]

  const gate = evaluateApolloEnrollmentDraftGates({
    queue_row: input.queue_row,
    enrollment_draft_id: draftFields.enrollment_draft_id,
    preflight_code: mergedBlockers.includes("draft_already_created") ? null : undefined,
  })

  const draftable =
    input.queue_row.status === "enrollment_approved" &&
    !draftFields.enrollment_draft_id &&
    gate.blockers.filter((code) => code !== "draft_already_created").length === 0

  return {
    ...input.queue_row,
    source_attribution: buildApolloEnrollmentSourceAttributionChain(),
    growth_lead_id: draftFields.growth_lead_id,
    enrollment_draft_id: draftFields.enrollment_draft_id,
    draft_created_at: draftFields.draft_created_at,
    draft_blockers: mergedBlockers,
    draftable,
  }
}

export function buildApolloPrimaryContactEnrollmentDraftSnapshot(input: {
  items: ApolloPrimaryContactEnrollmentDraftQueueRow[]
}): ApolloPrimaryContactEnrollmentDraftSnapshot {
  const approved = input.items.filter((row) => row.status === "enrollment_approved")
  const draftable = input.items.filter((row) => row.draftable)
  const draftsCreated = input.items.filter((row) => Boolean(row.enrollment_draft_id))
  const blocked = input.items.filter(
    (row) =>
      row.status === "enrollment_approved" &&
      !row.enrollment_draft_id &&
      !row.draftable,
  )

  const evidence: ApolloPrimaryContactEnrollmentDraftEvidence = {
    queued_contacts: input.items.length,
    draftable_contacts: draftable.length,
    drafts_created: draftsCreated.length,
    blocked_contacts: blocked.length,
  }

  return {
    qa_marker: APOLLO_PRIMARY_CONTACT_ENROLLMENT_DRAFT_QA_MARKER,
    items: input.items,
    evidence,
    summary: {
      total: input.items.length,
      approved: approved.length,
      draftable: draftable.length,
      drafts_created: draftsCreated.length,
      blocked: blocked.length,
    },
    source_attribution_chain: buildApolloEnrollmentSourceAttributionChain(),
    auto_enrollment: false,
    outreach_sent: false,
  }
}
