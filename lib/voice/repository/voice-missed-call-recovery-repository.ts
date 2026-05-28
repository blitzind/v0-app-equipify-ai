import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  VoiceCallbackTaskPriority,
  VoiceCallbackTaskPublicView,
  VoiceCallbackTaskStatus,
  VoiceMissedCallRecoveryEventPublicView,
  VoiceMissedCallRecoveryStatus,
  VoiceMissedCallRecoveryType,
} from "@/lib/voice/missed-call-recovery/types"

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "42P01" || Boolean(error?.message?.includes("does not exist"))
}

type RecoveryRow = {
  id: string
  organization_id: string
  voice_call_id: string | null
  voice_conversation_id: string | null
  relationship_memory_profile_id: string | null
  phone_number: string
  caller_name: string | null
  recovery_status: VoiceMissedCallRecoveryStatus
  recovery_type: VoiceMissedCallRecoveryType
  recommended_action: string
  evidence_text: string
  created_at: string
  acknowledged_at: string | null
  dismissed_at: string | null
  resolved_at: string | null
  metadata_json: Record<string, unknown> | unknown
}

type CallbackRow = {
  id: string
  organization_id: string
  recovery_event_id: string | null
  voice_call_id: string | null
  assigned_owner_user_id: string | null
  phone_number: string
  contact_name: string | null
  priority: VoiceCallbackTaskPriority
  due_at: string | null
  preferred_window_start: string | null
  preferred_window_end: string | null
  handoff_summary: string | null
  relationship_context: string | null
  status: string
  metadata_json: Record<string, unknown> | unknown
  created_at: string
  updated_at: string
}

function mapRecovery(row: RecoveryRow): VoiceMissedCallRecoveryEventPublicView {
  return {
    id: row.id,
    organizationId: row.organization_id,
    voiceCallId: row.voice_call_id,
    voiceConversationId: row.voice_conversation_id,
    relationshipMemoryProfileId: row.relationship_memory_profile_id,
    phoneNumber: row.phone_number,
    callerName: row.caller_name,
    recoveryStatus: row.recovery_status,
    recoveryType: row.recovery_type,
    recommendedAction: row.recommended_action,
    evidenceText: row.evidence_text,
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
    dismissedAt: row.dismissed_at,
    resolvedAt: row.resolved_at,
    metadata:
      row.metadata_json && typeof row.metadata_json === "object"
        ? (row.metadata_json as Record<string, unknown>)
        : {},
  }
}

function mapCallback(row: CallbackRow): VoiceCallbackTaskPublicView {
  return {
    id: row.id,
    organizationId: row.organization_id,
    recoveryEventId: row.recovery_event_id,
    voiceCallId: row.voice_call_id,
    assignedOwnerUserId: row.assigned_owner_user_id,
    phoneNumber: row.phone_number,
    contactName: row.contact_name,
    priority: row.priority,
    dueAt: row.due_at,
    preferredWindowStart: row.preferred_window_start,
    preferredWindowEnd: row.preferred_window_end,
    handoffSummary: row.handoff_summary,
    relationshipContext: row.relationship_context,
    status: row.status as VoiceCallbackTaskStatus,
    metadata:
      row.metadata_json && typeof row.metadata_json === "object"
        ? (row.metadata_json as Record<string, unknown>)
        : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function createMissedCallRecoveryEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId?: string | null
    voiceConversationId?: string | null
    relationshipMemoryProfileId?: string | null
    phoneNumber: string
    callerName?: string | null
    recoveryType: VoiceMissedCallRecoveryType
    recommendedAction: string
    evidenceText: string
    metadata?: Record<string, unknown>
  },
): Promise<VoiceMissedCallRecoveryEventPublicView> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_missed_call_recovery_events")
    .insert({
      organization_id: input.organizationId,
      voice_call_id: input.voiceCallId ?? null,
      voice_conversation_id: input.voiceConversationId ?? null,
      relationship_memory_profile_id: input.relationshipMemoryProfileId ?? null,
      phone_number: input.phoneNumber,
      caller_name: input.callerName ?? null,
      recovery_type: input.recoveryType,
      recommended_action: input.recommendedAction,
      evidence_text: input.evidenceText,
      metadata_json: input.metadata ?? {},
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapRecovery(data as RecoveryRow)
}

export async function listActiveMissedCallRecoveries(
  admin: SupabaseClient,
  organizationId: string,
  limit = 20,
): Promise<VoiceMissedCallRecoveryEventPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_missed_call_recovery_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("recovery_status", "active")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapRecovery(row as RecoveryRow))
}

export async function listRecoveriesForCall(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<VoiceMissedCallRecoveryEventPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_missed_call_recovery_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("voice_call_id", voiceCallId)
    .order("created_at", { ascending: false })

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapRecovery(row as RecoveryRow))
}

export async function updateMissedCallRecoveryStatus(
  admin: SupabaseClient,
  input: {
    organizationId: string
    recoveryId: string
    status: VoiceMissedCallRecoveryStatus
    userId?: string | null
  },
): Promise<VoiceMissedCallRecoveryEventPublicView | null> {
  const now = new Date().toISOString()
  const patch: Record<string, string> = { recovery_status: input.status }
  if (input.status === "acknowledged") patch.acknowledged_at = now
  if (input.status === "dismissed") patch.dismissed_at = now
  if (input.status === "resolved") patch.resolved_at = now

  const { data, error } = await admin
    .schema("voice")
    .from("voice_missed_call_recovery_events")
    .update(patch)
    .eq("organization_id", input.organizationId)
    .eq("id", input.recoveryId)
    .select("*")
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return data ? mapRecovery(data as RecoveryRow) : null
}

export async function countActiveRecoveries(admin: SupabaseClient, organizationId: string): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_missed_call_recovery_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("recovery_status", "active")

  if (error) {
    if (isMissingTableError(error)) return 0
    throw new Error(error.message)
  }
  return count ?? 0
}

export async function createCallbackTask(
  admin: SupabaseClient,
  input: {
    organizationId: string
    recoveryEventId?: string | null
    voiceCallId?: string | null
    phoneNumber: string
    contactName?: string | null
    priority: VoiceCallbackTaskPriority
    dueAt?: string | null
    preferredWindowStart?: string | null
    preferredWindowEnd?: string | null
    handoffSummary?: string | null
    relationshipContext?: string | null
    assignedOwnerUserId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<VoiceCallbackTaskPublicView> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_callback_tasks")
    .insert({
      organization_id: input.organizationId,
      recovery_event_id: input.recoveryEventId ?? null,
      voice_call_id: input.voiceCallId ?? null,
      phone_number: input.phoneNumber,
      contact_name: input.contactName ?? null,
      priority: input.priority,
      due_at: input.dueAt ?? null,
      preferred_window_start: input.preferredWindowStart ?? null,
      preferred_window_end: input.preferredWindowEnd ?? null,
      handoff_summary: input.handoffSummary ?? null,
      relationship_context: input.relationshipContext ?? null,
      assigned_owner_user_id: input.assignedOwnerUserId ?? null,
      status: input.assignedOwnerUserId ? "assigned" : "recommended",
      metadata_json: input.metadata ?? {},
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapCallback(data as CallbackRow)
}

export async function listCallbackTasksForCall(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<VoiceCallbackTaskPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_callback_tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("voice_call_id", voiceCallId)
    .order("created_at", { ascending: false })

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapCallback(row as CallbackRow))
}

export async function listPendingCallbackTasks(
  admin: SupabaseClient,
  organizationId: string,
  limit = 20,
): Promise<VoiceCallbackTaskPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_callback_tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .in("status", ["recommended", "assigned"])
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapCallback(row as CallbackRow))
}

export async function countPendingCallbacks(admin: SupabaseClient, organizationId: string): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_callback_tasks")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", ["recommended", "assigned"])

  if (error) {
    if (isMissingTableError(error)) return 0
    throw new Error(error.message)
  }
  return count ?? 0
}

export async function isPhoneOptedOut(
  admin: SupabaseClient,
  organizationId: string,
  phoneNumber: string,
): Promise<boolean> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_opt_outs")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("phone_number", phoneNumber)
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return false
    return false
  }
  return Boolean(data)
}
