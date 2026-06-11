/** Apollo Meeting Candidates queue — server-only actions, no schedule. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { proposeGrowthMeetingFromReply } from "@/lib/growth/meeting-intelligence/mutate-meeting"
import {
  buildApolloMeetingCandidateQueueSnapshot,
  evaluateApolloMeetingCandidateApprovalGate,
  mapApolloMeetingCandidateDbRow,
} from "@/lib/growth/apollo/apollo-meeting-bridge-evidence"
import type {
  ApolloMeetingCandidateActionResult,
  ApolloMeetingCandidateQueueSnapshot,
  ApolloMeetingCandidateStatus,
} from "@/lib/growth/apollo/apollo-meeting-bridge-types"
import { APOLLO_MEETING_BRIDGE_QA_MARKER } from "@/lib/growth/apollo/apollo-meeting-bridge-types"

export {
  APOLLO_MEETING_BRIDGE_QA_MARKER,
  type ApolloMeetingCandidateQueueSnapshot,
  type ApolloMeetingCandidateActionResult,
} from "@/lib/growth/apollo/apollo-meeting-bridge-types"

const TABLE = "meeting_candidates"

function emptyResult(
  action: ApolloMeetingCandidateActionResult["action"],
  error: string,
): ApolloMeetingCandidateActionResult {
  return {
    ok: false,
    action,
    candidate_id: null,
    status: null,
    growth_meeting_id: null,
    error,
    outreach_sent: false,
    calendar_written: false,
    meeting_scheduled: false,
  }
}

export async function loadApolloMeetingCandidateQueue(
  admin: SupabaseClient,
  input?: {
    lead_id?: string | null
    company_candidate_id?: string | null
    status?: ApolloMeetingCandidateStatus | "all"
    limit?: number
  },
): Promise<ApolloMeetingCandidateQueueSnapshot> {
  let query = admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 100)

  if (input?.lead_id?.trim()) {
    query = query.eq("lead_id", input.lead_id.trim())
  }
  if (input?.company_candidate_id?.trim()) {
    query = query.eq("company_candidate_id", input.company_candidate_id.trim())
  }

  const status = input?.status ?? "all"
  if (status !== "all") {
    query = query.eq("status", status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const items = ((data ?? []) as Record<string, unknown>[]).map(mapApolloMeetingCandidateDbRow)
  return buildApolloMeetingCandidateQueueSnapshot({ items })
}

export async function approveApolloMeetingCandidate(
  admin: SupabaseClient,
  input: {
    candidate_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<ApolloMeetingCandidateActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .eq("id", input.candidate_id)
    .maybeSingle()

  if (error) return emptyResult("approve_meeting_candidate", error.message)
  if (!data) return emptyResult("approve_meeting_candidate", "meeting_candidate_not_found")

  const candidate = mapApolloMeetingCandidateDbRow(data as Record<string, unknown>)
  const gate = evaluateApolloMeetingCandidateApprovalGate({ candidate })
  if (!gate.allowed) {
    return emptyResult("approve_meeting_candidate", gate.code ?? "approval_blocked")
  }

  const { data: leadRow } = await admin
    .schema("growth")
    .from("leads")
    .select("assigned_to")
    .eq("id", candidate.lead_id)
    .maybeSingle()

  let growthMeetingId = candidate.growth_meeting_id
  if (!growthMeetingId && candidate.outbound_reply_id) {
    const meeting = await proposeGrowthMeetingFromReply(admin, {
      leadId: candidate.lead_id,
      replyId: candidate.outbound_reply_id,
      companyName: candidate.company_name,
      ownerUserId:
        typeof leadRow?.assigned_to === "string"
          ? leadRow.assigned_to
          : input.approver_user_id ?? null,
    })
    growthMeetingId = meeting?.id ?? null
  }

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "approved",
      growth_meeting_id: growthMeetingId,
      approved_at: now,
      approved_by: input.approver_user_id ?? null,
      approved_email: input.approver_email ?? null,
      outreach_sent: false,
      calendar_written: false,
      meeting_scheduled: false,
      updated_at: now,
      metadata: {
        qa_marker: APOLLO_MEETING_BRIDGE_QA_MARKER,
        approval_note: input.note?.trim() || null,
        promoted_to_meeting_intelligence: true,
      },
    })
    .eq("id", input.candidate_id)

  if (updateError) return emptyResult("approve_meeting_candidate", updateError.message)

  await logGrowthEngine("apollo_meeting_candidate_approved", {
    candidate_id: candidate.candidate_id,
    lead_id: candidate.lead_id,
    growth_meeting_id: growthMeetingId,
    outreach_sent: false,
    calendar_written: false,
    meeting_scheduled: false,
  })

  return {
    ok: true,
    action: "approve_meeting_candidate",
    candidate_id: candidate.candidate_id,
    status: "approved",
    growth_meeting_id: growthMeetingId,
    outreach_sent: false,
    calendar_written: false,
    meeting_scheduled: false,
  }
}

export async function rejectApolloMeetingCandidate(
  admin: SupabaseClient,
  input: {
    candidate_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<ApolloMeetingCandidateActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("id, status")
    .eq("id", input.candidate_id)
    .maybeSingle()

  if (error) return emptyResult("reject_meeting_candidate", error.message)
  if (!data) return emptyResult("reject_meeting_candidate", "meeting_candidate_not_found")

  if (data.status !== "pending_review") {
    return emptyResult("reject_meeting_candidate", "invalid_candidate_status")
  }

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "rejected",
      rejection_note: input.note?.trim() || null,
      approved_by: input.approver_user_id ?? null,
      approved_email: input.approver_email ?? null,
      outreach_sent: false,
      calendar_written: false,
      meeting_scheduled: false,
      updated_at: now,
      metadata: {
        qa_marker: APOLLO_MEETING_BRIDGE_QA_MARKER,
      },
    })
    .eq("id", input.candidate_id)

  if (updateError) return emptyResult("reject_meeting_candidate", updateError.message)

  return {
    ok: true,
    action: "reject_meeting_candidate",
    candidate_id: input.candidate_id,
    status: "rejected",
    growth_meeting_id: null,
    outreach_sent: false,
    calendar_written: false,
    meeting_scheduled: false,
  }
}
