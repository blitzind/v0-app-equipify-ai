import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  VoiceBuyingStage,
  VoiceMomentumDirection,
  VoiceRevenueIntelligenceEventPublicView,
  VoiceRevenueIntelligenceEventStatus,
  VoiceRevenueIntelligenceEventType,
} from "@/lib/voice/revenue-intelligence/types"

type RevenueEventRow = {
  id: string
  organization_id: string
  related_customer_id: string | null
  related_prospect_id: string | null
  related_opportunity_id: string | null
  relationship_memory_profile_id: string | null
  source_voice_call_id: string | null
  source_memory_event_id: string | null
  event_type: VoiceRevenueIntelligenceEventType
  buying_stage: VoiceBuyingStage
  momentum_direction: VoiceMomentumDirection
  confidence_score: number
  evidence_text: string
  recommended_operator_action: string | null
  status: VoiceRevenueIntelligenceEventStatus
  created_at: string
}

function mapEvent(row: RevenueEventRow): VoiceRevenueIntelligenceEventPublicView {
  return {
    id: row.id,
    organizationId: row.organization_id,
    relatedCustomerId: row.related_customer_id,
    relatedProspectId: row.related_prospect_id,
    relatedOpportunityId: row.related_opportunity_id,
    relationshipMemoryProfileId: row.relationship_memory_profile_id,
    sourceVoiceCallId: row.source_voice_call_id,
    sourceMemoryEventId: row.source_memory_event_id,
    eventType: row.event_type,
    buyingStage: row.buying_stage,
    momentumDirection: row.momentum_direction,
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

export async function listRevenueIntelligenceEvents(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    relationshipMemoryProfileId?: string | null
    relatedOpportunityId?: string | null
    limit?: number
  },
): Promise<VoiceRevenueIntelligenceEventPublicView[]> {
  const limit = input.limit ?? 30
  let query = admin
    .schema("voice")
    .from("voice_revenue_intelligence_events")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (input.relationshipMemoryProfileId) {
    query = query.eq("relationship_memory_profile_id", input.relationshipMemoryProfileId)
  }
  if (input.relatedOpportunityId) {
    query = query.eq("related_opportunity_id", input.relatedOpportunityId)
  }

  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data as RevenueEventRow[]).map(mapEvent)
}

export async function insertRevenueIntelligenceEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    relatedCustomerId?: string | null
    relatedProspectId?: string | null
    relatedOpportunityId?: string | null
    relationshipMemoryProfileId?: string | null
    sourceVoiceCallId?: string | null
    sourceMemoryEventId?: string | null
    eventType: VoiceRevenueIntelligenceEventType
    buyingStage: VoiceBuyingStage
    momentumDirection: VoiceMomentumDirection
    confidenceScore: number
    evidenceText: string
    recommendedOperatorAction?: string | null
  },
): Promise<VoiceRevenueIntelligenceEventPublicView | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_revenue_intelligence_events")
    .insert({
      organization_id: input.organizationId,
      related_customer_id: input.relatedCustomerId ?? null,
      related_prospect_id: input.relatedProspectId ?? null,
      related_opportunity_id: input.relatedOpportunityId ?? null,
      relationship_memory_profile_id: input.relationshipMemoryProfileId ?? null,
      source_voice_call_id: input.sourceVoiceCallId ?? null,
      source_memory_event_id: input.sourceMemoryEventId ?? null,
      event_type: input.eventType,
      buying_stage: input.buyingStage,
      momentum_direction: input.momentumDirection,
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
  return mapEvent(data as RevenueEventRow)
}

export async function updateRevenueIntelligenceEventStatus(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventId: string
    status: VoiceRevenueIntelligenceEventStatus
  },
): Promise<VoiceRevenueIntelligenceEventPublicView | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_revenue_intelligence_events")
    .update({ status: input.status })
    .eq("organization_id", input.organizationId)
    .eq("id", input.eventId)
    .select("*")
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return data ? mapEvent(data as RevenueEventRow) : null
}

export async function expireStaleRevenueIntelligenceEvents(
  admin: SupabaseClient,
  organizationId: string,
  staleBeforeIso: string,
): Promise<number> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_revenue_intelligence_events")
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

export async function countRevenueIntelligenceEventsByStatus(
  admin: SupabaseClient,
  organizationId: string,
  status: VoiceRevenueIntelligenceEventStatus,
): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_revenue_intelligence_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", status)

  if (error) {
    if (isMissingTableError(error)) return 0
    throw new Error(error.message)
  }
  return count ?? 0
}

export async function countRevenueIntelligenceEventsWithOpportunityLink(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ total: number; linked: number }> {
  const { count: total, error: totalError } = await admin
    .schema("voice")
    .from("voice_revenue_intelligence_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)

  if (totalError) {
    if (isMissingTableError(totalError)) return { total: 0, linked: 0 }
    throw new Error(totalError.message)
  }

  const { count: linked, error: linkedError } = await admin
    .schema("voice")
    .from("voice_revenue_intelligence_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .not("related_opportunity_id", "is", null)

  if (linkedError) {
    if (isMissingTableError(linkedError)) return { total: total ?? 0, linked: 0 }
    throw new Error(linkedError.message)
  }

  return { total: total ?? 0, linked: linked ?? 0 }
}

export async function resolveOpportunityIdForLead(
  admin: SupabaseClient,
  organizationId: string,
  leadId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("opportunities")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  return data?.id ? String(data.id) : null
}

export async function resolveOpportunityIdFromVoiceCall(
  admin: SupabaseClient,
  voiceCallId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("related_opportunity_id")
    .eq("id", voiceCallId)
    .maybeSingle()

  if (error) return null
  return data?.related_opportunity_id ? String(data.related_opportunity_id) : null
}
