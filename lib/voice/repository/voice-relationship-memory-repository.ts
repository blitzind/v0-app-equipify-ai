import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  VoiceRelationshipMemoryEventPublicView,
  VoiceRelationshipMemoryProfilePublicView,
  VoiceRelationshipMemoryType,
  VoiceRelationshipSentimentTrend,
  VoiceRelationshipStatus,
} from "@/lib/voice/relationship-memory/types"
import type { VoiceMemoryDraftStatus } from "@/lib/voice/intelligence/types"

function mapProfile(row: Record<string, unknown>): VoiceRelationshipMemoryProfilePublicView {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    relatedCustomerId: (row.related_customer_id as string | null) ?? null,
    relatedProspectId: (row.related_prospect_id as string | null) ?? null,
    primaryContactName: (row.primary_contact_name as string | null) ?? null,
    primaryPhoneNumber: (row.primary_phone_number as string) ?? "",
    relationshipStatus: row.relationship_status as VoiceRelationshipStatus,
    firstInteractionAt: (row.first_interaction_at as string | null) ?? null,
    lastInteractionAt: (row.last_interaction_at as string | null) ?? null,
    totalCallCount: Number(row.total_call_count ?? 0),
    totalTalkTimeSeconds: Number(row.total_talk_time_seconds ?? 0),
    objectionCount: Number(row.objection_count ?? 0),
    buyingSignalCount: Number(row.buying_signal_count ?? 0),
    escalationCount: Number(row.escalation_count ?? 0),
    sentimentTrend: row.sentiment_trend as VoiceRelationshipSentimentTrend,
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapEvent(row: Record<string, unknown>): VoiceRelationshipMemoryEventPublicView {
  return {
    id: row.id as string,
    memoryProfileId: row.memory_profile_id as string,
    sourceVoiceCallId: (row.source_voice_call_id as string | null) ?? null,
    sourceTranscriptSegmentId: (row.source_transcript_segment_id as string | null) ?? null,
    memoryType: row.memory_type as VoiceRelationshipMemoryType,
    evidenceText: row.evidence_text as string,
    confidenceScore: Number(row.confidence_score),
    eventStatus: row.event_status as VoiceRelationshipMemoryEventPublicView["eventStatus"],
    createdBySource: row.created_by_source as string,
    createdAt: row.created_at as string,
  }
}

const RELATIONSHIP_MEMORY_PROFILE_SELECT =
  "id, organization_id, related_customer_id, related_prospect_id, primary_contact_name, primary_phone_number, relationship_status, first_interaction_at, last_interaction_at, total_call_count, total_talk_time_seconds, objection_count, buying_signal_count, escalation_count, sentiment_trend, metadata_json, created_at, updated_at"
const RELATIONSHIP_MEMORY_EVENT_SELECT =
  "id, organization_id, memory_profile_id, source_voice_call_id, source_transcript_segment_id, memory_type, evidence_text, confidence_score, event_status, created_by_source, created_at"
const VOICE_MEMORY_DRAFT_SELECT =
  "id, organization_id, voice_call_id, transcript_segment_id, draft_kind, draft_label, draft_value, evidence_text, confidence_score, status, operator_notes, expires_at, created_at"

export type VoiceMemoryDraftRow = {
  id: string
  organizationId: string
  voiceCallId: string
  transcriptSegmentId: string
  draftKind: string
  draftLabel: string
  draftValue: string
  evidenceText: string
  confidenceScore: number
  status: VoiceMemoryDraftStatus
  operatorNotes: string | null
  expiresAt: string | null
  createdAt: string
}

function mapDraftRow(row: Record<string, unknown>): VoiceMemoryDraftRow {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    voiceCallId: row.voice_call_id as string,
    transcriptSegmentId: row.transcript_segment_id as string,
    draftKind: row.draft_kind as string,
    draftLabel: row.draft_label as string,
    draftValue: row.draft_value as string,
    evidenceText: row.evidence_text as string,
    confidenceScore: Number(row.confidence_score),
    status: row.status as VoiceMemoryDraftStatus,
    operatorNotes: (row.operator_notes as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

export async function findRelationshipMemoryProfileByPhone(
  admin: SupabaseClient,
  organizationId: string,
  phoneNumber: string,
): Promise<VoiceRelationshipMemoryProfilePublicView | null> {
  if (!phoneNumber.trim()) return null
  const { data, error } = await admin
    .schema("voice")
    .from("voice_relationship_memory_profiles")
    .select(RELATIONSHIP_MEMORY_PROFILE_SELECT)
    .eq("organization_id", organizationId)
    .eq("primary_phone_number", phoneNumber)
    .maybeSingle()
  if (error) {
    if (error.code === "42P01") return null
    throw new Error(error.message)
  }
  return data ? mapProfile(data as Record<string, unknown>) : null
}

export async function createRelationshipMemoryProfile(
  admin: SupabaseClient,
  input: {
    organizationId: string
    primaryPhoneNumber: string
    primaryContactName?: string | null
    relatedCustomerId?: string | null
    relatedProspectId?: string | null
    metadataJson?: Record<string, unknown>
  },
): Promise<VoiceRelationshipMemoryProfilePublicView> {
  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("voice")
    .from("voice_relationship_memory_profiles")
    .insert({
      organization_id: input.organizationId,
      primary_phone_number: input.primaryPhoneNumber,
      primary_contact_name: input.primaryContactName ?? null,
      related_customer_id: input.relatedCustomerId ?? null,
      related_prospect_id: input.relatedProspectId ?? null,
      first_interaction_at: now,
      last_interaction_at: now,
      metadata_json: input.metadataJson ?? {},
      updated_at: now,
    })
    .select(RELATIONSHIP_MEMORY_PROFILE_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapProfile(data as Record<string, unknown>)
}

export async function resolveRelationshipMemoryProfile(
  admin: SupabaseClient,
  input: {
    organizationId: string
    primaryPhoneNumber: string
    primaryContactName?: string | null
    relatedCustomerId?: string | null
    relatedProspectId?: string | null
    leadId?: string | null
  },
): Promise<VoiceRelationshipMemoryProfilePublicView> {
  const existing = await findRelationshipMemoryProfileByPhone(admin, input.organizationId, input.primaryPhoneNumber)
  if (existing) {
    if (input.leadId && !existing.metadataJson.leadId) {
      const { data, error } = await admin
        .schema("voice")
        .from("voice_relationship_memory_profiles")
        .update({
          metadata_json: { ...existing.metadataJson, leadId: input.leadId },
          primary_contact_name: existing.primaryContactName ?? input.primaryContactName ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select(RELATIONSHIP_MEMORY_PROFILE_SELECT)
        .single()
      if (error) throw new Error(error.message)
      return mapProfile(data as Record<string, unknown>)
    }
    return existing
  }
  return createRelationshipMemoryProfile(admin, {
    organizationId: input.organizationId,
    primaryPhoneNumber: input.primaryPhoneNumber,
    primaryContactName: input.primaryContactName,
    relatedCustomerId: input.relatedCustomerId,
    relatedProspectId: input.relatedProspectId,
    metadataJson: input.leadId ? { leadId: input.leadId } : {},
  })
}

export async function getRelationshipMemoryProfile(
  admin: SupabaseClient,
  organizationId: string,
  profileId: string,
): Promise<VoiceRelationshipMemoryProfilePublicView | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_relationship_memory_profiles")
    .select(RELATIONSHIP_MEMORY_PROFILE_SELECT)
    .eq("organization_id", organizationId)
    .eq("id", profileId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapProfile(data as Record<string, unknown>) : null
}

export async function listRelationshipMemoryProfiles(
  admin: SupabaseClient,
  organizationId: string,
  input?: { query?: string; limit?: number },
): Promise<VoiceRelationshipMemoryProfilePublicView[]> {
  let query = admin
    .schema("voice")
    .from("voice_relationship_memory_profiles")
    .select(RELATIONSHIP_MEMORY_PROFILE_SELECT)
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(input?.limit ?? 20)

  if (input?.query?.trim()) {
    const q = input.query.trim()
    query = query.or(`primary_contact_name.ilike.%${q}%,primary_phone_number.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapProfile(row as Record<string, unknown>))
}

export async function listRelationshipMemoryEvents(
  admin: SupabaseClient,
  organizationId: string,
  profileId: string,
  limit = 40,
): Promise<VoiceRelationshipMemoryEventPublicView[]> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_relationship_memory_events")
    .select(RELATIONSHIP_MEMORY_EVENT_SELECT)
    .eq("organization_id", organizationId)
    .eq("memory_profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapEvent(row as Record<string, unknown>))
}

export async function insertRelationshipMemoryEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    memoryProfileId: string
    memoryType: VoiceRelationshipMemoryType
    evidenceText: string
    confidenceScore: number
    sourceVoiceCallId?: string | null
    sourceTranscriptSegmentId?: string | null
    createdBySource?: string
  },
): Promise<VoiceRelationshipMemoryEventPublicView> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_relationship_memory_events")
    .insert({
      organization_id: input.organizationId,
      memory_profile_id: input.memoryProfileId,
      memory_type: input.memoryType,
      evidence_text: input.evidenceText,
      confidence_score: input.confidenceScore,
      source_voice_call_id: input.sourceVoiceCallId ?? null,
      source_transcript_segment_id: input.sourceTranscriptSegmentId ?? null,
      created_by_source: input.createdBySource ?? "draft_accept",
    })
    .select(RELATIONSHIP_MEMORY_EVENT_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapEvent(data as Record<string, unknown>)
}

export async function refreshRelationshipMemoryProfileRollup(
  admin: SupabaseClient,
  input: {
    organizationId: string
    profileId: string
    metrics: {
      objectionCount: number
      buyingSignalCount: number
      escalationCount: number
      sentimentTrend: VoiceRelationshipSentimentTrend
      relationshipStatus: VoiceRelationshipStatus
      totalCallCount?: number
      totalTalkTimeSeconds?: number
      lastInteractionAt?: string | null
    }
  },
): Promise<VoiceRelationshipMemoryProfilePublicView> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_relationship_memory_profiles")
    .update({
      objection_count: input.metrics.objectionCount,
      buying_signal_count: input.metrics.buyingSignalCount,
      escalation_count: input.metrics.escalationCount,
      sentiment_trend: input.metrics.sentimentTrend,
      relationship_status: input.metrics.relationshipStatus,
      ...(input.metrics.totalCallCount != null ? { total_call_count: input.metrics.totalCallCount } : {}),
      ...(input.metrics.totalTalkTimeSeconds != null
        ? { total_talk_time_seconds: input.metrics.totalTalkTimeSeconds }
        : {}),
      ...(input.metrics.lastInteractionAt ? { last_interaction_at: input.metrics.lastInteractionAt } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.profileId)
    .select(RELATIONSHIP_MEMORY_PROFILE_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapProfile(data as Record<string, unknown>)
}

export async function getMemoryDraftById(
  admin: SupabaseClient,
  organizationId: string,
  draftId: string,
): Promise<VoiceMemoryDraftRow | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_conversation_memory_drafts")
    .select(VOICE_MEMORY_DRAFT_SELECT)
    .eq("organization_id", organizationId)
    .eq("id", draftId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapDraftRow(data as Record<string, unknown>) : null
}

export async function updateMemoryDraftReview(
  admin: SupabaseClient,
  input: {
    organizationId: string
    draftId: string
    status: VoiceMemoryDraftStatus
    reviewedByUserId: string
    operatorNotes?: string | null
    mergedMemoryEventId?: string | null
  },
): Promise<VoiceMemoryDraftRow> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_conversation_memory_drafts")
    .update({
      status: input.status,
      reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: input.reviewedByUserId,
      operator_notes: input.operatorNotes ?? null,
      merged_memory_event_id: input.mergedMemoryEventId ?? null,
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.draftId)
    .select(VOICE_MEMORY_DRAFT_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapDraftRow(data as Record<string, unknown>)
}

export async function countMemoryDraftsByStatus(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ pending: number; accepted: number; rejected: number }> {
  const statuses = ["pending_review", "accepted", "rejected"] as const
  const counts = { pending: 0, accepted: 0, rejected: 0 }
  for (const status of statuses) {
    const { count, error } = await admin
      .schema("voice")
      .from("voice_conversation_memory_drafts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", status)
    if (error) {
      if (error.code === "42P01") return counts
      throw new Error(error.message)
    }
    if (status === "pending_review") counts.pending = count ?? 0
    if (status === "accepted") counts.accepted = count ?? 0
    if (status === "rejected") counts.rejected = count ?? 0
  }
  return counts
}

export async function listCallsForPhoneProfile(
  admin: SupabaseClient,
  organizationId: string,
  phoneNumber: string,
  limit = 12,
): Promise<
  Array<{
    voiceCallId: string
    startedAt: string | null
    endedAt: string | null
    direction: string
    durationSeconds: number
  }>
> {
  const normalized = phoneNumber.replace(/\s/g, "")
  const { data, error } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("id, started_at, ended_at, direction, duration_seconds, from_number, to_number")
    .eq("organization_id", organizationId)
    .or(`from_number.eq.${normalized},to_number.eq.${normalized}`)
    .order("started_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    voiceCallId: row.id as string,
    startedAt: (row.started_at as string | null) ?? null,
    endedAt: (row.ended_at as string | null) ?? null,
    direction: row.direction as string,
    durationSeconds: Number(row.duration_seconds ?? 0),
  }))
}

export async function countPendingDraftsForCall(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_conversation_memory_drafts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("voice_call_id", voiceCallId)
    .eq("status", "pending_review")
  if (error) return 0
  return count ?? 0
}
