import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { VoiceCallRecord } from "@/lib/voice/types"

export async function assignVoiceCallToUser(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    userId: string | null
  },
): Promise<VoiceCallRecord | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_calls")
    .update({ assigned_user_id: input.userId })
    .eq("organization_id", input.organizationId)
    .eq("id", input.voiceCallId)
    .select("*")
    .maybeSingle()

  if (error || !data) return null
  return {
    id: String(data.id),
    organizationId: String(data.organization_id),
    provider: data.provider,
    providerCallId: String(data.provider_call_id),
    direction: data.direction,
    status: data.status,
    fromNumber: String(data.from_number ?? ""),
    toNumber: String(data.to_number ?? ""),
    startedAt: data.started_at ? String(data.started_at) : null,
    answeredAt: data.answered_at ? String(data.answered_at) : null,
    endedAt: data.ended_at ? String(data.ended_at) : null,
    durationSeconds: Number(data.duration_seconds ?? 0),
    recordingAvailable: Boolean(data.recording_available),
    transcriptionAvailable: Boolean(data.transcription_available),
    transferred: Boolean(data.transferred),
    transferredTo: data.transferred_to ? String(data.transferred_to) : null,
    assignedUserId: data.assigned_user_id ? String(data.assigned_user_id) : null,
    voiceConversationId: data.voice_conversation_id ? String(data.voice_conversation_id) : null,
    relatedCustomerId: data.related_customer_id ? String(data.related_customer_id) : null,
    relatedProspectId: data.related_prospect_id ? String(data.related_prospect_id) : null,
    relatedOpportunityId: data.related_opportunity_id ? String(data.related_opportunity_id) : null,
    operatorDisposition: data.operator_disposition ?? null,
    costCurrency: String(data.cost_currency ?? "USD"),
    costAmount: data.cost_amount == null ? null : Number(data.cost_amount),
    metadataJson: (data.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
  }
}

export function resolveVoiceCallOwner(call: Pick<VoiceCallRecord, "assignedUserId">): string | null {
  return call.assignedUserId
}

export async function resolveVoiceCallOwnerFromId(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<string | null> {
  const { data } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("assigned_user_id")
    .eq("organization_id", organizationId)
    .eq("id", voiceCallId)
    .maybeSingle()
  return data?.assigned_user_id ? String(data.assigned_user_id) : null
}
