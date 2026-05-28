import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  VoiceAiCopilotProviderId,
  VoiceAiCopilotSuggestionPublicView,
  VoiceAiCopilotSuggestionStatus,
  VoiceAiCopilotSuggestionType,
} from "@/lib/voice/ai-copilot/types"

type SuggestionRow = {
  id: string
  organization_id: string
  voice_call_id: string
  relationship_memory_profile_id: string | null
  related_customer_id: string | null
  related_prospect_id: string | null
  related_opportunity_id: string | null
  suggestion_type: VoiceAiCopilotSuggestionType
  priority: number
  title: string
  body: string
  evidence_text: string
  source_event_ids_json: string[] | unknown
  status: VoiceAiCopilotSuggestionStatus
  generated_by_provider: VoiceAiCopilotProviderId
  created_at: string
  acknowledged_at: string | null
  dismissed_at: string | null
  copied_at: string | null
}

function parseSourceEventIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string")
  return []
}

function mapSuggestion(row: SuggestionRow): VoiceAiCopilotSuggestionPublicView {
  return {
    id: row.id,
    organizationId: row.organization_id,
    voiceCallId: row.voice_call_id,
    relationshipMemoryProfileId: row.relationship_memory_profile_id,
    relatedCustomerId: row.related_customer_id,
    relatedProspectId: row.related_prospect_id,
    relatedOpportunityId: row.related_opportunity_id,
    suggestionType: row.suggestion_type,
    priority: row.priority,
    title: row.title,
    body: row.body,
    evidenceText: row.evidence_text,
    sourceEventIds: parseSourceEventIds(row.source_event_ids_json),
    status: row.status,
    generatedByProvider: row.generated_by_provider,
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
    dismissedAt: row.dismissed_at,
    copiedAt: row.copied_at,
  }
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "42P01" || Boolean(error?.message?.includes("does not exist"))
}

export async function listAiCopilotSuggestions(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
  input?: { status?: VoiceAiCopilotSuggestionStatus; limit?: number },
): Promise<VoiceAiCopilotSuggestionPublicView[]> {
  const limit = input?.limit ?? 30
  let query = admin
    .schema("voice")
    .from("voice_ai_copilot_suggestions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("voice_call_id", voiceCallId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)

  if (input?.status) {
    query = query.eq("status", input.status)
  }

  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data as SuggestionRow[]).map(mapSuggestion)
}

export async function insertAiCopilotSuggestion(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    relationshipMemoryProfileId?: string | null
    relatedCustomerId?: string | null
    relatedProspectId?: string | null
    relatedOpportunityId?: string | null
    suggestionType: VoiceAiCopilotSuggestionType
    priority: number
    title: string
    body: string
    evidenceText: string
    sourceEventIds?: string[]
    generatedByProvider: VoiceAiCopilotProviderId
  },
): Promise<VoiceAiCopilotSuggestionPublicView | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_copilot_suggestions")
    .insert({
      organization_id: input.organizationId,
      voice_call_id: input.voiceCallId,
      relationship_memory_profile_id: input.relationshipMemoryProfileId ?? null,
      related_customer_id: input.relatedCustomerId ?? null,
      related_prospect_id: input.relatedProspectId ?? null,
      related_opportunity_id: input.relatedOpportunityId ?? null,
      suggestion_type: input.suggestionType,
      priority: input.priority,
      title: input.title,
      body: input.body,
      evidence_text: input.evidenceText,
      source_event_ids_json: input.sourceEventIds ?? [],
      status: "active",
      generated_by_provider: input.generatedByProvider,
    })
    .select("*")
    .single()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return mapSuggestion(data as SuggestionRow)
}

export async function updateAiCopilotSuggestionStatus(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    suggestionId: string
    status: VoiceAiCopilotSuggestionStatus
    timestampField?: "acknowledged_at" | "dismissed_at" | "copied_at"
  },
): Promise<VoiceAiCopilotSuggestionPublicView | null> {
  const patch: Record<string, unknown> = { status: input.status }
  if (input.timestampField) {
    patch[input.timestampField] = new Date().toISOString()
  }

  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_copilot_suggestions")
    .update(patch)
    .eq("organization_id", input.organizationId)
    .eq("voice_call_id", input.voiceCallId)
    .eq("id", input.suggestionId)
    .select("*")
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return data ? mapSuggestion(data as SuggestionRow) : null
}

export async function expireStaleAiCopilotSuggestions(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
  staleBeforeIso: string,
): Promise<number> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_copilot_suggestions")
    .update({ status: "expired" })
    .eq("organization_id", organizationId)
    .eq("voice_call_id", voiceCallId)
    .eq("status", "active")
    .lt("created_at", staleBeforeIso)
    .select("id")

  if (error) {
    if (isMissingTableError(error)) return 0
    throw new Error(error.message)
  }
  return data?.length ?? 0
}

export async function countActiveAiCopilotSuggestions(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_ai_copilot_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("voice_call_id", voiceCallId)
    .eq("status", "active")

  if (error) {
    if (isMissingTableError(error)) return 0
    throw new Error(error.message)
  }
  return count ?? 0
}

export async function getLatestAiCopilotGenerationAt(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_copilot_suggestions")
    .select("created_at")
    .eq("organization_id", organizationId)
    .eq("voice_call_id", voiceCallId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return (data?.created_at as string | undefined) ?? null
}

export async function countAiCopilotSuggestionsByStatus(
  admin: SupabaseClient,
  organizationId: string,
  status: VoiceAiCopilotSuggestionStatus,
): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_ai_copilot_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", status)

  if (error) {
    if (isMissingTableError(error)) return 0
    throw new Error(error.message)
  }
  return count ?? 0
}
