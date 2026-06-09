/** Apollo-Primary-3 enrollment approval bridge — server-only, no enrollment/outreach execution. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildApolloPrimaryContactEnrollmentApprovalQueueSnapshot,
  buildEnrollmentBridgeContactSnapshot,
  evaluateApolloEnrollmentApprovalGates,
  evaluateApolloEnrollmentBridgeHandoffGates,
  mapEnrollmentQueueDbRow,
} from "@/lib/growth/apollo/apollo-primary-contact-enrollment-bridge-evidence"
import {
  APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER,
  type ApolloPrimaryContactEnrollmentApprovalQueueSnapshot,
  type ApolloPrimaryContactEnrollmentBridgeActionResult,
  type ApolloPrimaryContactEnrollmentHandoffEvidence,
  type ApolloPrimaryContactEnrollmentQueueStatus,
} from "@/lib/growth/apollo/apollo-primary-contact-enrollment-bridge-types"
import { loadApolloPrimaryContactOperatorReviewSnapshot } from "@/lib/growth/apollo/apollo-primary-contact-operator-review"

export {
  APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER,
  type ApolloPrimaryContactEnrollmentApprovalQueueSnapshot,
  type ApolloPrimaryContactEnrollmentBridgeActionResult,
  type ApolloPrimaryContactEnrollmentHandoffEvidence,
} from "@/lib/growth/apollo/apollo-primary-contact-enrollment-bridge-types"

export {
  buildApolloPrimaryContactEnrollmentApprovalQueueSnapshot,
  evaluateApolloEnrollmentBridgeHandoffGates,
  evaluateApolloEnrollmentApprovalGates,
} from "@/lib/growth/apollo/apollo-primary-contact-enrollment-bridge-evidence"

const QUEUE_TABLE = "apollo_primary_contact_enrollment_queue"
const HANDOFF_TABLE = "apollo_primary_contact_enrollment_handoffs"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function emptyActionResult(
  action: ApolloPrimaryContactEnrollmentBridgeActionResult["action"],
  error: string,
): ApolloPrimaryContactEnrollmentBridgeActionResult {
  return {
    ok: false,
    action,
    queue_item_id: null,
    queue_item_ids: [],
    status: null,
    error,
    handoff: null,
    auto_enrollment: false,
    outreach_sent: false,
    enrolled_count: 0,
    outreach_count: 0,
  }
}

async function findExistingPendingQueueItem(
  admin: SupabaseClient,
  input: {
    company_contact_id: string | null
    contact_candidate_id: string | null
  },
): Promise<Record<string, unknown> | null> {
  if (input.company_contact_id) {
    const { data } = await admin
      .schema("growth")
      .from(QUEUE_TABLE)
      .select("*")
      .eq("company_contact_id", input.company_contact_id)
      .eq("status", "pending_enrollment_approval")
      .maybeSingle()
    if (data) return data as Record<string, unknown>
  }

  if (input.contact_candidate_id) {
    const { data } = await admin
      .schema("growth")
      .from(QUEUE_TABLE)
      .select("*")
      .eq("contact_candidate_id", input.contact_candidate_id)
      .eq("status", "pending_enrollment_approval")
      .maybeSingle()
    if (data) return data as Record<string, unknown>
  }

  return null
}

async function insertHandoffEvidence(
  admin: SupabaseClient,
  input: {
    queue_item_id: string
    operator_review_id: string | null
    company_candidate_id: string
    company_contact_id: string | null
    contact_candidate_id: string | null
    contact_snapshot: Record<string, unknown>
    sequence_ready_at_handoff: boolean
    blockers_at_handoff: string[]
  },
): Promise<ApolloPrimaryContactEnrollmentHandoffEvidence> {
  const { data, error } = await admin
    .schema("growth")
    .from(HANDOFF_TABLE)
    .insert({
      queue_item_id: input.queue_item_id,
      operator_review_id: input.operator_review_id,
      company_candidate_id: input.company_candidate_id,
      company_contact_id: input.company_contact_id,
      contact_candidate_id: input.contact_candidate_id,
      handoff_reason: "operator_review_approved",
      contact_snapshot: input.contact_snapshot,
      sequence_ready_at_handoff: input.sequence_ready_at_handoff,
      blockers_at_handoff: input.blockers_at_handoff,
      auto_enrollment_attempted: false,
      outreach_sent: false,
      metadata: { qa_marker: APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER },
    })
    .select("id, created_at")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "Could not record enrollment handoff evidence.")
  }

  return {
    qa_marker: APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER,
    handoff_id: asString(data.id),
    queue_item_id: input.queue_item_id,
    operator_review_id: input.operator_review_id,
    company_candidate_id: input.company_candidate_id,
    company_contact_id: input.company_contact_id,
    contact_candidate_id: input.contact_candidate_id,
    sequence_ready_at_handoff: input.sequence_ready_at_handoff,
    blockers_at_handoff: input.blockers_at_handoff,
    auto_enrollment: false,
    outreach_sent: false,
    recorded_at: asString(data.created_at),
  }
}

export async function loadApolloPrimaryContactEnrollmentApprovalQueue(
  admin: SupabaseClient,
  input?: {
    company_candidate_id?: string | null
    status?: ApolloPrimaryContactEnrollmentQueueStatus | "all"
    limit?: number
  },
): Promise<ApolloPrimaryContactEnrollmentApprovalQueueSnapshot> {
  let query = admin
    .schema("growth")
    .from(QUEUE_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 100)

  const companyCandidateId = asString(input?.company_candidate_id)
  if (companyCandidateId) {
    query = query.eq("company_candidate_id", companyCandidateId)
  }

  const status = input?.status ?? "all"
  if (status !== "all") {
    query = query.eq("status", status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const items = ((data ?? []) as Record<string, unknown>[]).map(mapEnrollmentQueueDbRow)
  return buildApolloPrimaryContactEnrollmentApprovalQueueSnapshot({ items })
}

export async function handoffApprovedApolloContactToEnrollmentQueue(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    company_contact_id?: string | null
    contact_candidate_id?: string | null
    operator_review_id?: string | null
  },
): Promise<ApolloPrimaryContactEnrollmentBridgeActionResult> {
  const snapshot = await loadApolloPrimaryContactOperatorReviewSnapshot(admin, input.company_candidate_id)
  if (!snapshot) {
    return emptyActionResult("handoff", "company_candidate_not_found")
  }

  const contactRow = snapshot.contacts.find((row) => {
    if (input.company_contact_id && row.company_contact_id === input.company_contact_id) return true
    if (input.contact_candidate_id && row.contact_candidate_id === input.contact_candidate_id) return true
    return false
  })

  const gate = evaluateApolloEnrollmentBridgeHandoffGates({ contact_row: contactRow ?? null })
  if (!gate.allowed || !gate.contact_row) {
    return emptyActionResult("handoff", gate.code ?? "handoff_blocked")
  }

  const existing = await findExistingPendingQueueItem(admin, {
    company_contact_id: gate.contact_row.company_contact_id,
    contact_candidate_id: gate.contact_row.contact_candidate_id,
  })

  if (existing) {
    const mapped = mapEnrollmentQueueDbRow(existing)
    return {
      ok: true,
      action: "handoff",
      queue_item_id: mapped.queue_item_id,
      queue_item_ids: [mapped.queue_item_id],
      status: mapped.status,
      handoff: null,
      auto_enrollment: false,
      outreach_sent: false,
      enrolled_count: 0,
      outreach_count: 0,
    }
  }

  const contactSnapshot = buildEnrollmentBridgeContactSnapshot(gate.contact_row)
  const now = new Date().toISOString()

  const { data, error } = await admin
    .schema("growth")
    .from(QUEUE_TABLE)
    .insert({
      company_candidate_id: input.company_candidate_id,
      company_contact_id: gate.contact_row.company_contact_id,
      contact_candidate_id: gate.contact_row.contact_candidate_id,
      operator_review_id: input.operator_review_id ?? null,
      status: "pending_enrollment_approval",
      contact_snapshot: contactSnapshot,
      sequence_ready_at_handoff: gate.contact_row.sequence_ready,
      blockers_at_handoff: gate.contact_row.blockers,
      auto_enrollment_attempted: false,
      outreach_sent: false,
      updated_at: now,
      metadata: { qa_marker: APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER },
    })
    .select("id")
    .single()

  if (error || !data) {
    return emptyActionResult("handoff", error?.message ?? "queue_insert_failed")
  }

  const queueItemId = asString(data.id)
  const handoff = await insertHandoffEvidence(admin, {
    queue_item_id: queueItemId,
    operator_review_id: input.operator_review_id ?? null,
    company_candidate_id: input.company_candidate_id,
    company_contact_id: gate.contact_row.company_contact_id,
    contact_candidate_id: gate.contact_row.contact_candidate_id,
    contact_snapshot: contactSnapshot,
    sequence_ready_at_handoff: gate.contact_row.sequence_ready,
    blockers_at_handoff: gate.contact_row.blockers,
  })

  return {
    ok: true,
    action: "handoff",
    queue_item_id: queueItemId,
    queue_item_ids: [queueItemId],
    status: "pending_enrollment_approval",
    handoff,
    auto_enrollment: false,
    outreach_sent: false,
    enrolled_count: 0,
    outreach_count: 0,
  }
}

export async function approveApolloPrimaryContactEnrollmentQueueItem(
  admin: SupabaseClient,
  input: {
    queue_item_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<ApolloPrimaryContactEnrollmentBridgeActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(QUEUE_TABLE)
    .select("*")
    .eq("id", input.queue_item_id)
    .maybeSingle()

  if (error) return emptyActionResult("approve_enrollment", error.message)
  if (!data) return emptyActionResult("approve_enrollment", "queue_item_not_found")

  const queueRow = mapEnrollmentQueueDbRow(data as Record<string, unknown>)
  const gate = evaluateApolloEnrollmentApprovalGates({ queue_row: queueRow })
  if (!gate.allowed) {
    return emptyActionResult("approve_enrollment", gate.code ?? "approval_blocked")
  }

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .schema("growth")
    .from(QUEUE_TABLE)
    .update({
      status: "enrollment_approved",
      enrollment_approved_at: now,
      enrollment_approved_by: input.approver_user_id ?? null,
      enrollment_approved_email: input.approver_email ?? null,
      auto_enrollment_attempted: false,
      outreach_sent: false,
      updated_at: now,
      metadata: {
        qa_marker: APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER,
        enrollment_approval_note: input.note?.trim() || null,
      },
    })
    .eq("id", input.queue_item_id)

  if (updateError) {
    return emptyActionResult("approve_enrollment", updateError.message)
  }

  return {
    ok: true,
    action: "approve_enrollment",
    queue_item_id: input.queue_item_id,
    queue_item_ids: [input.queue_item_id],
    status: "enrollment_approved",
    handoff: null,
    auto_enrollment: false,
    outreach_sent: false,
    enrolled_count: 0,
    outreach_count: 0,
  }
}

export async function rejectApolloPrimaryContactEnrollmentQueueItem(
  admin: SupabaseClient,
  input: {
    queue_item_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<ApolloPrimaryContactEnrollmentBridgeActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(QUEUE_TABLE)
    .select("*")
    .eq("id", input.queue_item_id)
    .maybeSingle()

  if (error) return emptyActionResult("reject_enrollment", error.message)
  if (!data) return emptyActionResult("reject_enrollment", "queue_item_not_found")

  const queueRow = mapEnrollmentQueueDbRow(data as Record<string, unknown>)
  if (queueRow.status !== "pending_enrollment_approval") {
    return emptyActionResult("reject_enrollment", "invalid_queue_status")
  }

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .schema("growth")
    .from(QUEUE_TABLE)
    .update({
      status: "enrollment_rejected",
      enrollment_approved_by: input.approver_user_id ?? null,
      enrollment_approved_email: input.approver_email ?? null,
      enrollment_rejection_note: input.note?.trim() || null,
      auto_enrollment_attempted: false,
      outreach_sent: false,
      updated_at: now,
      metadata: { qa_marker: APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER },
    })
    .eq("id", input.queue_item_id)

  if (updateError) {
    return emptyActionResult("reject_enrollment", updateError.message)
  }

  return {
    ok: true,
    action: "reject_enrollment",
    queue_item_id: input.queue_item_id,
    queue_item_ids: [input.queue_item_id],
    status: "enrollment_rejected",
    handoff: null,
    auto_enrollment: false,
    outreach_sent: false,
    enrolled_count: 0,
    outreach_count: 0,
  }
}

export async function bulkHandoffApprovedApolloContactsToEnrollmentQueue(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    operator_review_ids?: string[]
    contact_ids?: Array<{ company_contact_id?: string | null; contact_candidate_id?: string | null }>
  },
): Promise<ApolloPrimaryContactEnrollmentBridgeActionResult> {
  const snapshot = await loadApolloPrimaryContactOperatorReviewSnapshot(admin, input.company_candidate_id)
  if (!snapshot) {
    return emptyActionResult("bulk_handoff", "company_candidate_not_found")
  }

  const targets = snapshot.contacts.filter(
    (row) =>
      row.operator_review_status === "approved" &&
      row.sequence_ready &&
      row.outreach_ready &&
      row.blockers.length === 0,
  )

  const queue_item_ids: string[] = []
  let firstHandoff: ApolloPrimaryContactEnrollmentHandoffEvidence | null = null

  for (const row of targets) {
    const result = await handoffApprovedApolloContactToEnrollmentQueue(admin, {
      company_candidate_id: input.company_candidate_id,
      company_contact_id: row.company_contact_id,
      contact_candidate_id: row.contact_candidate_id,
    })
    if (result.ok && result.queue_item_id) {
      queue_item_ids.push(result.queue_item_id)
      if (!firstHandoff && result.handoff) firstHandoff = result.handoff
    }
  }

  return {
    ok: true,
    action: "bulk_handoff",
    queue_item_id: queue_item_ids[0] ?? null,
    queue_item_ids,
    status: queue_item_ids.length ? "pending_enrollment_approval" : null,
    handoff: firstHandoff,
    auto_enrollment: false,
    outreach_sent: false,
    enrolled_count: 0,
    outreach_count: 0,
  }
}
