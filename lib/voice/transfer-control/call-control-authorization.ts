import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { VoiceCallRecord } from "@/lib/voice/types"

const ACTIVE_CALL_STATUSES = new Set(["queued", "initiated", "ringing", "in_progress"])
const SUPERVISOR_ROLES = new Set(["owner", "admin", "manager"])

export type VoiceCallControlAuthorizationResult =
  | { ok: true; call: VoiceCallRecord; isSupervisor: boolean }
  | { ok: false; code: string; message: string }

export async function authorizeVoiceCallControlAction(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    voiceCallId: string
    requireOwnership?: boolean
    allowSupervisor?: boolean
  },
): Promise<VoiceCallControlAuthorizationResult> {
  const { data: callRow, error } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("id", input.voiceCallId)
    .maybeSingle()

  if (error || !callRow) {
    return { ok: false, code: "call_not_found", message: "Voice call not found in this organization." }
  }

  const call: VoiceCallRecord = {
    id: String(callRow.id),
    organizationId: String(callRow.organization_id),
    provider: callRow.provider,
    providerCallId: String(callRow.provider_call_id),
    direction: callRow.direction,
    status: callRow.status,
    fromNumber: String(callRow.from_number ?? ""),
    toNumber: String(callRow.to_number ?? ""),
    startedAt: callRow.started_at ? String(callRow.started_at) : null,
    answeredAt: callRow.answered_at ? String(callRow.answered_at) : null,
    endedAt: callRow.ended_at ? String(callRow.ended_at) : null,
    durationSeconds: Number(callRow.duration_seconds ?? 0),
    recordingAvailable: Boolean(callRow.recording_available),
    transcriptionAvailable: Boolean(callRow.transcription_available),
    transferred: Boolean(callRow.transferred),
    transferredTo: callRow.transferred_to ? String(callRow.transferred_to) : null,
    assignedUserId: callRow.assigned_user_id ? String(callRow.assigned_user_id) : null,
    voiceConversationId: callRow.voice_conversation_id ? String(callRow.voice_conversation_id) : null,
    relatedCustomerId: callRow.related_customer_id ? String(callRow.related_customer_id) : null,
    relatedProspectId: callRow.related_prospect_id ? String(callRow.related_prospect_id) : null,
    relatedOpportunityId: callRow.related_opportunity_id ? String(callRow.related_opportunity_id) : null,
    operatorDisposition: callRow.operator_disposition ?? null,
    costCurrency: String(callRow.cost_currency ?? "USD"),
    costAmount: callRow.cost_amount == null ? null : Number(callRow.cost_amount),
    metadataJson: (callRow.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(callRow.created_at),
    updatedAt: String(callRow.updated_at),
  }

  if (!ACTIVE_CALL_STATUSES.has(call.status)) {
    return { ok: false, code: "call_not_active", message: "Call is not active — action unavailable." }
  }

  const isOwner = call.assignedUserId === input.userId
  const isSupervisor = await hasSupervisorRole(admin, input.organizationId, input.userId)

  if (input.requireOwnership && !isOwner && !(input.allowSupervisor && isSupervisor)) {
    return {
      ok: false,
      code: "forbidden",
      message: "Only the assigned operator or a supervisor may perform this action.",
    }
  }

  return { ok: true, call, isSupervisor }
}

export async function hasSupervisorRole(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle()

  return SUPERVISOR_ROLES.has(String(data?.role ?? ""))
}

export async function authorizeParticipantScope(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    participantId: string
  },
): Promise<
  | { ok: true; participantId: string }
  | { ok: false; code: string; message: string }
> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_conference_participants")
    .select("id, organization_id, voice_call_id, status")
    .eq("id", input.participantId)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, code: "participant_not_found", message: "Participant not found." }
  }

  if (String(data.organization_id) !== input.organizationId) {
    return { ok: false, code: "cross_org", message: "Participant belongs to a different organization." }
  }

  if (String(data.voice_call_id) !== input.voiceCallId) {
    return { ok: false, code: "participant_mismatch", message: "Participant is not on this call." }
  }

  if (data.status === "disconnected" || data.status === "failed") {
    return { ok: false, code: "participant_inactive", message: "Participant is no longer active on this call." }
  }

  return { ok: true, participantId: String(data.id) }
}
