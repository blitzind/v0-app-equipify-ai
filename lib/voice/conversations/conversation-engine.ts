import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"
import type { VoiceCallDirection, VoiceConversationRecord } from "@/lib/voice/types"

function mapConversation(row: Record<string, unknown>): VoiceConversationRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    primaryPhoneNumber: String(row.primary_phone_number),
    contactName: String(row.contact_name ?? ""),
    relatedCustomerId: row.related_customer_id ? String(row.related_customer_id) : null,
    relatedProspectId: row.related_prospect_id ? String(row.related_prospect_id) : null,
    relatedOpportunityId: row.related_opportunity_id ? String(row.related_opportunity_id) : null,
    status: row.status as VoiceConversationRecord["status"],
    lastActivityAt: String(row.last_activity_at),
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function resolveConversationPhoneForCall(input: {
  direction: VoiceCallDirection
  fromNumber: string
  toNumber: string
}): string {
  const external =
    input.direction === "inbound"
      ? normalizePhoneNumber(input.fromNumber)
      : normalizePhoneNumber(input.toNumber)
  return external || normalizePhoneNumber(input.fromNumber) || normalizePhoneNumber(input.toNumber)
}

export async function resolveOrCreateVoiceConversation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    primaryPhoneNumber: string
    contactName?: string
    activityAt?: string
  },
): Promise<VoiceConversationRecord | null> {
  const phone = normalizePhoneNumber(input.primaryPhoneNumber)
  if (!phone) return null

  const { data: existing } = await admin
    .schema("voice")
    .from("voice_conversations")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("primary_phone_number", phone)
    .maybeSingle()

  if (existing) {
    const mapped = mapConversation(existing as Record<string, unknown>)
    if (mapped.status === "closed") {
      await admin
        .schema("voice")
        .from("voice_conversations")
        .update({
          status: "active",
          last_activity_at: input.activityAt ?? new Date().toISOString(),
        })
        .eq("id", mapped.id)
    } else {
      await admin
        .schema("voice")
        .from("voice_conversations")
        .update({ last_activity_at: input.activityAt ?? new Date().toISOString() })
        .eq("id", mapped.id)
    }
    return mapped
  }

  const { data, error } = await admin
    .schema("voice")
    .from("voice_conversations")
    .insert({
      organization_id: input.organizationId,
      primary_phone_number: phone,
      contact_name: input.contactName ?? "",
      status: "active",
      last_activity_at: input.activityAt ?? new Date().toISOString(),
      metadata_json: { source: "voice_webhook" },
    })
    .select("*")
    .single()

  if (error || !data) return null
  return mapConversation(data as Record<string, unknown>)
}

export async function attachCallToConversation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    voiceConversationId: string
    activityAt?: string
  },
): Promise<boolean> {
  const { error: callError } = await admin
    .schema("voice")
    .from("voice_calls")
    .update({ voice_conversation_id: input.voiceConversationId })
    .eq("organization_id", input.organizationId)
    .eq("id", input.voiceCallId)

  if (callError) return false

  await admin
    .schema("voice")
    .from("voice_conversations")
    .update({ last_activity_at: input.activityAt ?? new Date().toISOString() })
    .eq("organization_id", input.organizationId)
    .eq("id", input.voiceConversationId)

  return true
}
