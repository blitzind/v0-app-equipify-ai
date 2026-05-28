import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  VoiceHealthDirection,
  VoiceRetentionIntelligenceEventPublicView,
  VoiceRetentionIntelligenceEventStatus,
  VoiceRetentionIntelligenceEventType,
} from "@/lib/voice/retention-intelligence/types"

type RetentionEventRow = {
  id: string
  organization_id: string
  related_customer_id: string | null
  related_prospect_id: string | null
  related_opportunity_id: string | null
  relationship_memory_profile_id: string | null
  source_voice_call_id: string | null
  source_memory_event_id: string | null
  source_revenue_event_id: string | null
  event_type: VoiceRetentionIntelligenceEventType
  health_direction: VoiceHealthDirection
  confidence_score: number
  evidence_text: string
  recommended_operator_action: string | null
  status: VoiceRetentionIntelligenceEventStatus
  created_at: string
}

function mapEvent(row: RetentionEventRow): VoiceRetentionIntelligenceEventPublicView {
  return {
    id: row.id,
    organizationId: row.organization_id,
    relatedCustomerId: row.related_customer_id,
    relatedProspectId: row.related_prospect_id,
    relatedOpportunityId: row.related_opportunity_id,
    relationshipMemoryProfileId: row.relationship_memory_profile_id,
    sourceVoiceCallId: row.source_voice_call_id,
    sourceMemoryEventId: row.source_memory_event_id,
    sourceRevenueEventId: row.source_revenue_event_id,
    eventType: row.event_type,
    healthDirection: row.health_direction,
    confidenceScore: Number(row.confidence_score),
    evidenceText: row.evidence_text,
    recommendedOperatorAction: row.recommended_operator_action,
    status: row.status,
    createdAt: row.created_at,
  }
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "42P01" || Boolean(error?.message?.includes("does not exist"))
}

export async function listRetentionIntelligenceEvents(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    relationshipMemoryProfileId?: string | null
    relatedCustomerId?: string | null
    limit?: number
  },
): Promise<VoiceRetentionIntelligenceEventPublicView[]> {
  const limit = input.limit ?? 30
  let query = admin
    .schema("voice")
    .from("voice_retention_intelligence_events")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (input.relationshipMemoryProfileId) {
    query = query.eq("relationship_memory_profile_id", input.relationshipMemoryProfileId)
  }
  if (input.relatedCustomerId) {
    query = query.eq("related_customer_id", input.relatedCustomerId)
  }

  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data as RetentionEventRow[]).map(mapEvent)
}

export async function insertRetentionIntelligenceEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    relatedCustomerId?: string | null
    relatedProspectId?: string | null
    relatedOpportunityId?: string | null
    relationshipMemoryProfileId?: string | null
    sourceVoiceCallId?: string | null
    sourceMemoryEventId?: string | null
    sourceRevenueEventId?: string | null
    eventType: VoiceRetentionIntelligenceEventType
    healthDirection: VoiceHealthDirection
    confidenceScore: number
    evidenceText: string
    recommendedOperatorAction?: string | null
  },
): Promise<VoiceRetentionIntelligenceEventPublicView | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_retention_intelligence_events")
    .insert({
      organization_id: input.organizationId,
      related_customer_id: input.relatedCustomerId ?? null,
      related_prospect_id: input.relatedProspectId ?? null,
      related_opportunity_id: input.relatedOpportunityId ?? null,
      relationship_memory_profile_id: input.relationshipMemoryProfileId ?? null,
      source_voice_call_id: input.sourceVoiceCallId ?? null,
      source_memory_event_id: input.sourceMemoryEventId ?? null,
      source_revenue_event_id: input.sourceRevenueEventId ?? null,
      event_type: input.eventType,
      health_direction: input.healthDirection,
      confidence_score: input.confidenceScore,
      evidence_text: input.evidenceText,
      recommended_operator_action: input.recommendedOperatorAction ?? null,
      status: "active",
    })
    .select("*")
    .single()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return mapEvent(data as RetentionEventRow)
}

export async function updateRetentionIntelligenceEventStatus(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventId: string
    status: VoiceRetentionIntelligenceEventStatus
  },
): Promise<VoiceRetentionIntelligenceEventPublicView | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_retention_intelligence_events")
    .update({ status: input.status })
    .eq("organization_id", input.organizationId)
    .eq("id", input.eventId)
    .select("*")
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return data ? mapEvent(data as RetentionEventRow) : null
}

export async function expireStaleRetentionIntelligenceEvents(
  admin: SupabaseClient,
  organizationId: string,
  staleBeforeIso: string,
): Promise<number> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_retention_intelligence_events")
    .update({ status: "expired" })
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .lt("created_at", staleBeforeIso)
    .select("id")

  if (error) {
    if (isMissingTableError(error)) return 0
    throw new Error(error.message)
  }
  return data?.length ?? 0
}

export async function countRetentionIntelligenceEventsByStatus(
  admin: SupabaseClient,
  organizationId: string,
  status: VoiceRetentionIntelligenceEventStatus,
): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_retention_intelligence_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", status)

  if (error) {
    if (isMissingTableError(error)) return 0
    throw new Error(error.message)
  }
  return count ?? 0
}
