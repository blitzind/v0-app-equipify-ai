import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthLiveGuidanceCandidate,
  GrowthLiveGuidanceEvent,
  GrowthLiveGuidanceEventType,
} from "@/lib/growth/live-guidance/live-guidance-types"

type GuidanceRow = {
  id: string
  organization_id: string | null
  lead_id: string
  realtime_call_session_id: string
  event_type: string
  severity: string
  title: string
  operator_prompt: string
  recommendation: string
  supporting_reason: string
  confidence_score: number
  surfaced_at: string
  dismissed_at: string | null
  accepted_at: string | null
  created_at: string
}

function table(admin: SupabaseClient) {
  return admin.schema("growth").from("live_guidance_events")
}

function mapRow(row: GuidanceRow): GrowthLiveGuidanceEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    leadId: row.lead_id,
    realtimeCallSessionId: row.realtime_call_session_id,
    eventType: row.event_type as GrowthLiveGuidanceEventType,
    severity: row.severity as GrowthLiveGuidanceEvent["severity"],
    title: row.title,
    operatorPrompt: row.operator_prompt,
    recommendation: row.recommendation,
    supportingReason: row.supporting_reason,
    confidenceScore: row.confidence_score,
    surfacedAt: row.surfaced_at,
    dismissedAt: row.dismissed_at,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
  }
}

export async function listActiveLiveGuidanceEvents(
  admin: SupabaseClient,
  sessionId: string,
): Promise<GrowthLiveGuidanceEvent[]> {
  const { data, error } = await table(admin)
    .select("*")
    .eq("realtime_call_session_id", sessionId)
    .is("dismissed_at", null)
    .is("accepted_at", null)
    .order("surfaced_at", { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as GuidanceRow[]).map(mapRow)
}

export async function listLiveGuidanceEventsForSession(
  admin: SupabaseClient,
  sessionId: string,
): Promise<GrowthLiveGuidanceEvent[]> {
  const { data, error } = await table(admin)
    .select("*")
    .eq("realtime_call_session_id", sessionId)
    .order("surfaced_at", { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as GuidanceRow[]).map(mapRow)
}

export async function insertLiveGuidanceEvent(
  admin: SupabaseClient,
  input: {
    organizationId?: string | null
    leadId: string
    sessionId: string
    candidate: GrowthLiveGuidanceCandidate
  },
): Promise<GrowthLiveGuidanceEvent> {
  const { data, error } = await table(admin)
    .insert({
      organization_id: input.organizationId ?? null,
      lead_id: input.leadId,
      realtime_call_session_id: input.sessionId,
      event_type: input.candidate.eventType,
      severity: input.candidate.severity,
      title: input.candidate.title,
      operator_prompt: input.candidate.operatorPrompt,
      recommendation: input.candidate.recommendation,
      supporting_reason: input.candidate.supportingReason,
      confidence_score: input.candidate.confidenceScore,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRow(data as GuidanceRow)
}

export async function updateLiveGuidanceEventAction(
  admin: SupabaseClient,
  eventId: string,
  action: "dismiss" | "accept",
): Promise<GrowthLiveGuidanceEvent> {
  const now = new Date().toISOString()
  const patch = action === "dismiss" ? { dismissed_at: now } : { accepted_at: now }
  const { data, error } = await table(admin).update(patch).eq("id", eventId).select("*").single()
  if (error) throw new Error(error.message)
  return mapRow(data as GuidanceRow)
}

export async function countAcceptedLiveGuidanceForSession(
  admin: SupabaseClient,
  sessionId: string,
): Promise<number> {
  const { count, error } = await table(admin)
    .select("id", { count: "exact", head: true })
    .eq("realtime_call_session_id", sessionId)
    .not("accepted_at", "is", null)
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function listRecentLiveGuidanceEvents(
  admin: SupabaseClient,
  limit = 200,
): Promise<GrowthLiveGuidanceEvent[]> {
  const { data, error } = await table(admin)
    .select("*")
    .order("surfaced_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as GuidanceRow[]).map(mapRow)
}
