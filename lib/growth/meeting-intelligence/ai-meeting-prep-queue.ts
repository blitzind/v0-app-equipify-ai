/** AI Meeting Prep queue — server-only review actions, no side effects. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  AI_MEETING_PREP_SAFETY_FLAGS,
  buildAiMeetingPrepQueueSnapshot,
  evaluateAiMeetingPrepApprovalGate,
  mapAiMeetingPrepDbRow,
  mapAiMeetingPrepRowToArtifacts,
} from "@/lib/growth/meeting-intelligence/ai-meeting-prep-evidence"
import { generateAndPersistAiMeetingPrep } from "@/lib/growth/meeting-intelligence/ai-meeting-prep-service"
import type {
  AiMeetingPrepActionResult,
  AiMeetingPrepQueueSnapshot,
  AiMeetingPrepStatus,
} from "@/lib/growth/meeting-intelligence/ai-meeting-prep-types"
import { AI_MEETING_PREP_QA_MARKER } from "@/lib/growth/meeting-intelligence/ai-meeting-prep-types"

export {
  AI_MEETING_PREP_QA_MARKER,
  type AiMeetingPrepQueueSnapshot,
  type AiMeetingPrepActionResult,
} from "@/lib/growth/meeting-intelligence/ai-meeting-prep-types"

const TABLE = "ai_meeting_preparations"

function emptyResult(
  action: AiMeetingPrepActionResult["action"],
  error: string,
): AiMeetingPrepActionResult {
  return {
    ok: false,
    action,
    prep_id: null,
    status: null,
    artifacts: null,
    error,
    ...AI_MEETING_PREP_SAFETY_FLAGS,
  }
}

export async function loadAiMeetingPrepQueue(
  admin: SupabaseClient,
  input?: {
    meeting_id?: string | null
    lead_id?: string | null
    status?: AiMeetingPrepStatus | "all"
    limit?: number
  },
): Promise<AiMeetingPrepQueueSnapshot> {
  let query = admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 100)

  if (input?.meeting_id?.trim()) {
    query = query.eq("meeting_id", input.meeting_id.trim())
  }
  if (input?.lead_id?.trim()) {
    query = query.eq("lead_id", input.lead_id.trim())
  }

  const status = input?.status ?? "all"
  if (status !== "all") {
    query = query.eq("status", status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const items = ((data ?? []) as Record<string, unknown>[]).map(mapAiMeetingPrepDbRow)
  return buildAiMeetingPrepQueueSnapshot({ items })
}

export async function approveAiMeetingPrep(
  admin: SupabaseClient,
  input: {
    prep_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<AiMeetingPrepActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .eq("id", input.prep_id)
    .maybeSingle()

  if (error) return emptyResult("approve_ai_meeting_prep", error.message)
  if (!data) return emptyResult("approve_ai_meeting_prep", "ai_meeting_prep_not_found")

  const prep = mapAiMeetingPrepDbRow(data as Record<string, unknown>)
  const gate = evaluateAiMeetingPrepApprovalGate({ prep })
  if (!gate.allowed) {
    return emptyResult("approve_ai_meeting_prep", gate.code ?? "approval_blocked")
  }

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "approved",
      approved_at: now,
      approved_by: input.approver_user_id ?? null,
      approved_email: input.approver_email ?? null,
      outreach_sent: false,
      calendar_written: false,
      meeting_scheduled: false,
      opportunity_created: false,
      autonomous_reply_sent: false,
      updated_at: now,
      metadata: {
        qa_marker: AI_MEETING_PREP_QA_MARKER,
        approval_note: input.note?.trim() || null,
      },
    })
    .eq("id", input.prep_id)

  if (updateError) return emptyResult("approve_ai_meeting_prep", updateError.message)

  await logGrowthEngine("ai_meeting_prep_approved", {
    prep_id: prep.prep_id,
    meeting_id: prep.meeting_id,
    ...AI_MEETING_PREP_SAFETY_FLAGS,
  })

  return {
    ok: true,
    action: "approve_ai_meeting_prep",
    prep_id: prep.prep_id,
    status: "approved",
    artifacts: mapAiMeetingPrepRowToArtifacts(prep),
    ...AI_MEETING_PREP_SAFETY_FLAGS,
  }
}

export async function rejectAiMeetingPrep(
  admin: SupabaseClient,
  input: {
    prep_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<AiMeetingPrepActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("id, status")
    .eq("id", input.prep_id)
    .maybeSingle()

  if (error) return emptyResult("reject_ai_meeting_prep", error.message)
  if (!data) return emptyResult("reject_ai_meeting_prep", "ai_meeting_prep_not_found")
  if (data.status !== "draft") {
    return emptyResult("reject_ai_meeting_prep", "invalid_prep_status")
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
      opportunity_created: false,
      autonomous_reply_sent: false,
      updated_at: now,
      metadata: { qa_marker: AI_MEETING_PREP_QA_MARKER },
    })
    .eq("id", input.prep_id)

  if (updateError) return emptyResult("reject_ai_meeting_prep", updateError.message)

  return {
    ok: true,
    action: "reject_ai_meeting_prep",
    prep_id: input.prep_id,
    status: "rejected",
    artifacts: null,
    ...AI_MEETING_PREP_SAFETY_FLAGS,
  }
}

export async function regenerateAiMeetingPrep(
  admin: SupabaseClient,
  input: {
    prep_id: string
    actor_user_id?: string | null
    actor_email?: string | null
  },
): Promise<AiMeetingPrepActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("id, meeting_id, status")
    .eq("id", input.prep_id)
    .maybeSingle()

  if (error) return emptyResult("regenerate_ai_meeting_prep", error.message)
  if (!data) return emptyResult("regenerate_ai_meeting_prep", "ai_meeting_prep_not_found")

  const meetingId = typeof data.meeting_id === "string" ? data.meeting_id : ""
  if (!meetingId) return emptyResult("regenerate_ai_meeting_prep", "meeting_id_missing")

  const generated = await generateAndPersistAiMeetingPrep(admin, {
    meeting_id: meetingId,
    actor_user_id: input.actor_user_id,
    actor_email: input.actor_email,
    regenerate: true,
  })

  if (!generated.ok || !generated.prep) {
    return emptyResult("regenerate_ai_meeting_prep", generated.error ?? "regeneration_failed")
  }

  return {
    ok: true,
    action: "regenerate_ai_meeting_prep",
    prep_id: generated.prep.prep_id,
    status: generated.prep.status,
    artifacts: generated.artifacts,
    ...AI_MEETING_PREP_SAFETY_FLAGS,
  }
}
