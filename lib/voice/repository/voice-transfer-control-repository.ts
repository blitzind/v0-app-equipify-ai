import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"
import type {
  VoiceCallLegRecord,
  VoiceCallTransferPublicView,
  VoiceCallTransferRecord,
  VoiceConferenceParticipantPublicView,
  VoiceConferenceParticipantRecord,
  VoiceConferenceParticipantRole,
  VoiceConferenceRecord,
} from "@/lib/voice/transfer-control/types"

function mapLeg(row: Record<string, unknown>): VoiceCallLegRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    voiceCallId: String(row.voice_call_id),
    provider: String(row.provider),
    providerCallSid: String(row.provider_call_sid ?? ""),
    legType: row.leg_type as VoiceCallLegRecord["legType"],
    participantUserId: row.participant_user_id ? String(row.participant_user_id) : null,
    phoneNumber: String(row.phone_number ?? ""),
    clientIdentity: String(row.client_identity ?? ""),
    status: row.status as VoiceCallLegRecord["status"],
    startedAt: row.started_at ? String(row.started_at) : null,
    answeredAt: row.answered_at ? String(row.answered_at) : null,
    endedAt: row.ended_at ? String(row.ended_at) : null,
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapConference(row: Record<string, unknown>): VoiceConferenceRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    voiceCallId: String(row.voice_call_id),
    provider: String(row.provider),
    providerConferenceSid: String(row.provider_conference_sid ?? ""),
    friendlyName: String(row.friendly_name ?? ""),
    status: row.status as VoiceConferenceRecord["status"],
    startedAt: row.started_at ? String(row.started_at) : null,
    endedAt: row.ended_at ? String(row.ended_at) : null,
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapParticipant(row: Record<string, unknown>): VoiceConferenceParticipantRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    conferenceId: String(row.conference_id),
    voiceCallId: String(row.voice_call_id),
    callLegId: row.call_leg_id ? String(row.call_leg_id) : null,
    participantUserId: row.participant_user_id ? String(row.participant_user_id) : null,
    providerParticipantSid: String(row.provider_participant_sid ?? ""),
    participantRole: row.participant_role as VoiceConferenceParticipantRole,
    phoneNumber: String(row.phone_number ?? ""),
    clientIdentity: String(row.client_identity ?? ""),
    status: row.status as VoiceConferenceParticipantRecord["status"],
    isMuted: Boolean(row.is_muted),
    isOnHold: Boolean(row.is_on_hold),
    joinedAt: row.joined_at ? String(row.joined_at) : null,
    leftAt: row.left_at ? String(row.left_at) : null,
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapTransfer(row: Record<string, unknown>): VoiceCallTransferRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    voiceCallId: String(row.voice_call_id),
    initiatedByUserId: String(row.initiated_by_user_id),
    transferKind: row.transfer_kind as VoiceCallTransferRecord["transferKind"],
    status: row.status as VoiceCallTransferRecord["status"],
    targetPhoneNumber: String(row.target_phone_number ?? ""),
    targetUserId: row.target_user_id ? String(row.target_user_id) : null,
    targetClientIdentity: String(row.target_client_identity ?? ""),
    consultConferenceId: row.consult_conference_id ? String(row.consult_conference_id) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    canceledAt: row.canceled_at ? String(row.canceled_at) : null,
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function toTransferPublicView(transfer: VoiceCallTransferRecord): VoiceCallTransferPublicView {
  return {
    id: transfer.id,
    transferKind: transfer.transferKind,
    status: transfer.status,
    targetPhoneNumber: transfer.targetPhoneNumber,
    targetClientIdentity: transfer.targetClientIdentity,
    initiatedByUserId: transfer.initiatedByUserId,
  }
}

export function participantLabel(participant: VoiceConferenceParticipantRecord): string {
  if (participant.participantRole === "supervisor") return "Supervisor"
  if (participant.participantRole === "transfer_target") return "Transfer target"
  if (participant.participantRole === "customer") return "Customer"
  if (participant.participantRole === "consult") return "Consult"
  if (participant.clientIdentity) return participant.clientIdentity
  if (participant.phoneNumber) return participant.phoneNumber
  return "Participant"
}

export function toParticipantPublicView(
  participant: VoiceConferenceParticipantRecord,
): VoiceConferenceParticipantPublicView {
  return {
    id: participant.id,
    participantRole: participant.participantRole,
    participantUserId: participant.participantUserId,
    phoneNumber: participant.phoneNumber,
    clientIdentity: participant.clientIdentity,
    status: participant.status,
    isMuted: participant.isMuted,
    isOnHold: participant.isOnHold,
    joinedAt: participant.joinedAt,
    label: participantLabel(participant),
  }
}

export async function fetchActiveTransferForCall(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<VoiceCallTransferRecord | null> {
  const { data } = await admin
    .schema("voice")
    .from("voice_call_transfers")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("voice_call_id", voiceCallId)
    .in("status", ["starting", "consulting", "completing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? mapTransfer(data as Record<string, unknown>) : null
}

export async function fetchLatestTransferForCall(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<VoiceCallTransferRecord | null> {
  const { data } = await admin
    .schema("voice")
    .from("voice_call_transfers")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("voice_call_id", voiceCallId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? mapTransfer(data as Record<string, unknown>) : null
}

export async function listActiveParticipantsForCall(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<VoiceConferenceParticipantRecord[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_conference_participants")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("voice_call_id", voiceCallId)
    .in("status", ["queued", "connecting", "connected", "held", "muted"])
    .order("joined_at", { ascending: true })

  if (error || !data) return []
  return data.map((row) => mapParticipant(row as Record<string, unknown>))
}

export async function fetchParticipantById(
  admin: SupabaseClient,
  organizationId: string,
  participantId: string,
): Promise<VoiceConferenceParticipantRecord | null> {
  const { data } = await admin
    .schema("voice")
    .from("voice_conference_participants")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", participantId)
    .maybeSingle()
  return data ? mapParticipant(data as Record<string, unknown>) : null
}

export async function fetchConferenceById(
  admin: SupabaseClient,
  organizationId: string,
  conferenceId: string,
): Promise<VoiceConferenceRecord | null> {
  const { data } = await admin
    .schema("voice")
    .from("voice_conferences")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", conferenceId)
    .maybeSingle()
  return data ? mapConference(data as Record<string, unknown>) : null
}

export async function ensurePrimaryOperatorParticipant(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    userId: string
    provider: string
    providerCallSid: string
    phoneNumber?: string
    clientIdentity?: string
  },
): Promise<VoiceConferenceParticipantRecord | null> {
  const existing = await listActiveParticipantsForCall(admin, input.organizationId, input.voiceCallId)
  const operator = existing.find((p) => p.participantRole === "operator" && p.participantUserId === input.userId)
  if (operator) return operator

  const now = new Date().toISOString()
  let conference = await fetchActiveConferenceForCall(admin, input.organizationId, input.voiceCallId)
  if (!conference) {
    conference = await insertConference(admin, {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
      provider: input.provider,
      friendlyName: `call-${input.voiceCallId.slice(0, 8)}`,
      providerConferenceSid: `local_${input.voiceCallId.slice(0, 8)}`,
    })
  }
  if (!conference) return null

  const leg = await insertCallLeg(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    provider: input.provider,
    providerCallSid: input.providerCallSid,
    legType: input.clientIdentity ? "browser_client" : "outbound",
    participantUserId: input.userId,
    phoneNumber: input.phoneNumber ?? "",
    clientIdentity: input.clientIdentity ?? "",
    status: "in_progress",
    startedAt: now,
    answeredAt: now,
  })

  return insertParticipant(admin, {
    organizationId: input.organizationId,
    conferenceId: conference.id,
    voiceCallId: input.voiceCallId,
    callLegId: leg?.id ?? null,
    participantUserId: input.userId,
    participantRole: "operator",
    phoneNumber: input.phoneNumber ?? "",
    clientIdentity: input.clientIdentity ?? "",
    providerParticipantSid: input.providerCallSid,
    status: "connected",
    joinedAt: now,
  })
}

export async function fetchActiveConferenceForCall(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<VoiceConferenceRecord | null> {
  const { data } = await admin
    .schema("voice")
    .from("voice_conferences")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("voice_call_id", voiceCallId)
    .in("status", ["initiated", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? mapConference(data as Record<string, unknown>) : null
}

export async function insertConference(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    provider: string
    friendlyName: string
    providerConferenceSid: string
    status?: VoiceConferenceRecord["status"]
  },
): Promise<VoiceConferenceRecord | null> {
  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("voice")
    .from("voice_conferences")
    .insert({
      organization_id: input.organizationId,
      voice_call_id: input.voiceCallId,
      provider: input.provider,
      provider_conference_sid: input.providerConferenceSid,
      friendly_name: input.friendlyName,
      status: input.status ?? "in_progress",
      started_at: now,
      metadata_json: { source: "transfer_control_phase_1e" },
    })
    .select("*")
    .single()
  if (error || !data) return null
  return mapConference(data as Record<string, unknown>)
}

export async function insertCallLeg(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    provider: string
    providerCallSid: string
    legType: VoiceCallLegRecord["legType"]
    participantUserId?: string | null
    phoneNumber?: string
    clientIdentity?: string
    status?: VoiceCallLegRecord["status"]
    startedAt?: string | null
    answeredAt?: string | null
  },
): Promise<VoiceCallLegRecord | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_call_legs")
    .insert({
      organization_id: input.organizationId,
      voice_call_id: input.voiceCallId,
      provider: input.provider,
      provider_call_sid: input.providerCallSid,
      leg_type: input.legType,
      participant_user_id: input.participantUserId ?? null,
      phone_number: input.phoneNumber ?? "",
      client_identity: input.clientIdentity ?? "",
      status: input.status ?? "queued",
      started_at: input.startedAt ?? null,
      answered_at: input.answeredAt ?? null,
      metadata_json: {},
    })
    .select("*")
    .single()
  if (error || !data) return null
  return mapLeg(data as Record<string, unknown>)
}

export async function insertParticipant(
  admin: SupabaseClient,
  input: {
    organizationId: string
    conferenceId: string
    voiceCallId: string
    callLegId?: string | null
    participantUserId?: string | null
    participantRole: VoiceConferenceParticipantRole
    phoneNumber?: string
    clientIdentity?: string
    providerParticipantSid?: string
    status?: VoiceConferenceParticipantRecord["status"]
    joinedAt?: string | null
    isMuted?: boolean
    isOnHold?: boolean
  },
): Promise<VoiceConferenceParticipantRecord | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_conference_participants")
    .insert({
      organization_id: input.organizationId,
      conference_id: input.conferenceId,
      voice_call_id: input.voiceCallId,
      call_leg_id: input.callLegId ?? null,
      participant_user_id: input.participantUserId ?? null,
      participant_role: input.participantRole,
      phone_number: input.phoneNumber ?? "",
      client_identity: input.clientIdentity ?? "",
      provider_participant_sid: input.providerParticipantSid ?? "",
      status: input.status ?? "connecting",
      joined_at: input.joinedAt ?? null,
      is_muted: input.isMuted ?? false,
      is_on_hold: input.isOnHold ?? false,
      metadata_json: {},
    })
    .select("*")
    .single()
  if (error || !data) return null
  return mapParticipant(data as Record<string, unknown>)
}

export async function insertTransfer(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    initiatedByUserId: string
    transferKind: VoiceCallTransferRecord["transferKind"]
    targetPhoneNumber?: string
    targetUserId?: string | null
    targetClientIdentity?: string
    consultConferenceId?: string | null
    status?: VoiceCallTransferRecord["status"]
  },
): Promise<VoiceCallTransferRecord | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_call_transfers")
    .insert({
      organization_id: input.organizationId,
      voice_call_id: input.voiceCallId,
      initiated_by_user_id: input.initiatedByUserId,
      transfer_kind: input.transferKind,
      status: input.status ?? "starting",
      target_phone_number: normalizePhoneNumber(input.targetPhoneNumber) ?? input.targetPhoneNumber ?? "",
      target_user_id: input.targetUserId ?? null,
      target_client_identity: input.targetClientIdentity ?? "",
      consult_conference_id: input.consultConferenceId ?? null,
      metadata_json: {},
    })
    .select("*")
    .single()
  if (error || !data) return null
  return mapTransfer(data as Record<string, unknown>)
}

export async function updateTransferStatus(
  admin: SupabaseClient,
  input: {
    transferId: string
    organizationId: string
    status: VoiceCallTransferRecord["status"]
    completedAt?: string | null
    canceledAt?: string | null
  },
): Promise<VoiceCallTransferRecord | null> {
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  }
  if (input.completedAt !== undefined) patch.completed_at = input.completedAt
  if (input.canceledAt !== undefined) patch.canceled_at = input.canceledAt

  const { data, error } = await admin
    .schema("voice")
    .from("voice_call_transfers")
    .update(patch)
    .eq("id", input.transferId)
    .eq("organization_id", input.organizationId)
    .select("*")
    .single()
  if (error || !data) return null
  return mapTransfer(data as Record<string, unknown>)
}

export async function updateParticipantFlags(
  admin: SupabaseClient,
  input: {
    participantId: string
    organizationId: string
    isMuted?: boolean
    isOnHold?: boolean
    status?: VoiceConferenceParticipantRecord["status"]
    leftAt?: string | null
  },
): Promise<VoiceConferenceParticipantRecord | null> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.isMuted !== undefined) patch.is_muted = input.isMuted
  if (input.isOnHold !== undefined) patch.is_on_hold = input.isOnHold
  if (input.status !== undefined) patch.status = input.status
  if (input.leftAt !== undefined) patch.left_at = input.leftAt

  const { data, error } = await admin
    .schema("voice")
    .from("voice_conference_participants")
    .update(patch)
    .eq("id", input.participantId)
    .eq("organization_id", input.organizationId)
    .select("*")
    .single()
  if (error || !data) return null
  return mapParticipant(data as Record<string, unknown>)
}

export async function markVoiceCallTransferred(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    transferredTo: string
  },
): Promise<void> {
  await admin
    .schema("voice")
    .from("voice_calls")
    .update({
      transferred: true,
      transferred_to: input.transferredTo,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.voiceCallId)
}

export async function syncWorkspaceSessionFlags(
  admin: SupabaseClient,
  input: {
    voiceCallId: string
    muted?: boolean
    onHold?: boolean
    transferTarget?: string | null
  },
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.muted !== undefined) patch.muted = input.muted
  if (input.onHold !== undefined) patch.on_hold = input.onHold
  if (input.transferTarget !== undefined) patch.transfer_target = input.transferTarget

  await admin
    .schema("growth")
    .from("native_call_workspace_sessions")
    .update(patch)
    .eq("voice_call_id", input.voiceCallId)
}
