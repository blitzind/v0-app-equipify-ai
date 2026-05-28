import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  VoiceUnifiedCommunicationChannel,
  VoiceUnifiedCommunicationEventPublicView,
  VoiceUnifiedCommunicationEventType,
  VoiceUnifiedCommunicationThreadPublicView,
  VoiceUnifiedCommunicationThreadState,
  VoiceUnifiedCommunicationThreadType,
} from "@/lib/voice/multi-channel-intelligence/types"

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "42P01" || Boolean(error?.message?.includes("does not exist"))
}

type ThreadRow = {
  id: string
  organization_id: string
  thread_type: VoiceUnifiedCommunicationThreadType
  relationship_memory_profile_id: string | null
  related_customer_id: string | null
  related_prospect_id: string | null
  related_opportunity_id: string | null
  primary_channel: VoiceUnifiedCommunicationChannel
  current_state: VoiceUnifiedCommunicationThreadState
  escalation_state: string | null
  last_channel_used: VoiceUnifiedCommunicationChannel | null
  preferred_channel: VoiceUnifiedCommunicationChannel | null
  communication_summary: string
  unresolved_issue_count: number
  last_interaction_at: string | null
  metadata_json: Record<string, unknown> | unknown
  created_at: string
  updated_at: string
}

type EventRow = {
  id: string
  organization_id: string
  thread_id: string
  event_type: VoiceUnifiedCommunicationEventType
  channel: VoiceUnifiedCommunicationChannel
  source_system: string
  evidence_text: string
  source_session_id: string | null
  source_call_id: string | null
  payload_json: Record<string, unknown> | unknown
  created_by: string | null
  created_at: string
}

function mapThread(row: ThreadRow): VoiceUnifiedCommunicationThreadPublicView {
  return {
    id: row.id,
    organizationId: row.organization_id,
    threadType: row.thread_type,
    relationshipMemoryProfileId: row.relationship_memory_profile_id,
    relatedCustomerId: row.related_customer_id,
    relatedProspectId: row.related_prospect_id,
    relatedOpportunityId: row.related_opportunity_id,
    primaryChannel: row.primary_channel,
    currentState: row.current_state,
    escalationState: row.escalation_state,
    lastChannelUsed: row.last_channel_used,
    preferredChannel: row.preferred_channel,
    communicationSummary: row.communication_summary,
    unresolvedIssueCount: row.unresolved_issue_count,
    lastInteractionAt: row.last_interaction_at,
    metadata:
      row.metadata_json && typeof row.metadata_json === "object"
        ? (row.metadata_json as Record<string, unknown>)
        : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapEvent(row: EventRow): VoiceUnifiedCommunicationEventPublicView {
  return {
    id: row.id,
    organizationId: row.organization_id,
    threadId: row.thread_id,
    eventType: row.event_type,
    channel: row.channel,
    sourceSystem: row.source_system,
    evidenceText: row.evidence_text,
    sourceSessionId: row.source_session_id,
    sourceCallId: row.source_call_id,
    payload:
      row.payload_json && typeof row.payload_json === "object"
        ? (row.payload_json as Record<string, unknown>)
        : {},
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

const ACTIVE_STATES: VoiceUnifiedCommunicationThreadState[] = [
  "active",
  "awaiting_customer",
  "awaiting_operator",
  "escalated",
  "stalled",
]

export async function createUnifiedCommunicationThread(
  admin: SupabaseClient,
  input: {
    organizationId: string
    threadType: VoiceUnifiedCommunicationThreadType
    primaryChannel?: VoiceUnifiedCommunicationChannel
    relationshipMemoryProfileId?: string | null
    relatedCustomerId?: string | null
    relatedProspectId?: string | null
    relatedOpportunityId?: string | null
    communicationSummary?: string
    metadata?: Record<string, unknown>
  },
): Promise<VoiceUnifiedCommunicationThreadPublicView> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_unified_communication_threads")
    .insert({
      organization_id: input.organizationId,
      thread_type: input.threadType,
      primary_channel: input.primaryChannel ?? "voice",
      relationship_memory_profile_id: input.relationshipMemoryProfileId ?? null,
      related_customer_id: input.relatedCustomerId ?? null,
      related_prospect_id: input.relatedProspectId ?? null,
      related_opportunity_id: input.relatedOpportunityId ?? null,
      communication_summary: input.communicationSummary ?? "",
      metadata_json: input.metadata ?? {},
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapThread(data as ThreadRow)
}

export async function getUnifiedCommunicationThread(
  admin: SupabaseClient,
  organizationId: string,
  threadId: string,
): Promise<VoiceUnifiedCommunicationThreadPublicView | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_unified_communication_threads")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", threadId)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return data ? mapThread(data as ThreadRow) : null
}

export async function updateUnifiedCommunicationThread(
  admin: SupabaseClient,
  input: {
    organizationId: string
    threadId: string
    patch: Partial<{
      currentState: VoiceUnifiedCommunicationThreadState
      escalationState: string | null
      lastChannelUsed: VoiceUnifiedCommunicationChannel | null
      preferredChannel: VoiceUnifiedCommunicationChannel | null
      communicationSummary: string
      unresolvedIssueCount: number
      lastInteractionAt: string | null
      metadata: Record<string, unknown>
    }>
  },
): Promise<VoiceUnifiedCommunicationThreadPublicView | null> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.patch.currentState) update.current_state = input.patch.currentState
  if (input.patch.escalationState !== undefined) update.escalation_state = input.patch.escalationState
  if (input.patch.lastChannelUsed !== undefined) update.last_channel_used = input.patch.lastChannelUsed
  if (input.patch.preferredChannel !== undefined) update.preferred_channel = input.patch.preferredChannel
  if (input.patch.communicationSummary) update.communication_summary = input.patch.communicationSummary
  if (input.patch.unresolvedIssueCount !== undefined) update.unresolved_issue_count = input.patch.unresolvedIssueCount
  if (input.patch.lastInteractionAt !== undefined) update.last_interaction_at = input.patch.lastInteractionAt
  if (input.patch.metadata) update.metadata_json = input.patch.metadata

  const { data, error } = await admin
    .schema("voice")
    .from("voice_unified_communication_threads")
    .update(update)
    .eq("organization_id", input.organizationId)
    .eq("id", input.threadId)
    .select("*")
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return data ? mapThread(data as ThreadRow) : null
}

export async function listActiveUnifiedCommunicationThreads(
  admin: SupabaseClient,
  organizationId: string,
  limit = 100,
): Promise<VoiceUnifiedCommunicationThreadPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_unified_communication_threads")
    .select("*")
    .eq("organization_id", organizationId)
    .in("current_state", ACTIVE_STATES)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapThread(row as ThreadRow))
}

export async function appendUnifiedCommunicationEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    threadId: string
    eventType: VoiceUnifiedCommunicationEventType
    channel: VoiceUnifiedCommunicationChannel
    sourceSystem?: string
    evidenceText: string
    sourceSessionId?: string | null
    sourceCallId?: string | null
    payload?: Record<string, unknown>
    createdBy?: string | null
  },
): Promise<VoiceUnifiedCommunicationEventPublicView> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_unified_communication_events")
    .insert({
      organization_id: input.organizationId,
      thread_id: input.threadId,
      event_type: input.eventType,
      channel: input.channel,
      source_system: input.sourceSystem ?? "multichannel_intelligence",
      evidence_text: input.evidenceText,
      source_session_id: input.sourceSessionId ?? null,
      source_call_id: input.sourceCallId ?? null,
      payload_json: input.payload ?? {},
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapEvent(data as EventRow)
}

export async function listUnifiedCommunicationEvents(
  admin: SupabaseClient,
  organizationId: string,
  threadId: string,
  limit = 50,
): Promise<VoiceUnifiedCommunicationEventPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_unified_communication_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapEvent(row as EventRow))
}

export async function listRecentUnifiedCommunicationEvents(
  admin: SupabaseClient,
  organizationId: string,
  limit = 30,
): Promise<VoiceUnifiedCommunicationEventPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_unified_communication_events")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapEvent(row as EventRow))
}

export async function archiveStaleCommunicationThreads(
  admin: SupabaseClient,
  organizationId: string,
  staleBeforeIso: string,
): Promise<number> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_unified_communication_threads")
    .update({
      current_state: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .in("current_state", ACTIVE_STATES)
    .lt("updated_at", staleBeforeIso)
    .select("id")

  if (error) {
    if (isMissingTableError(error)) return 0
    throw new Error(error.message)
  }
  return data?.length ?? 0
}
