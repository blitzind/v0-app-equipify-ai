import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { VoiceProviderId } from "@/lib/voice/types"
import { buildVoiceWebhookIdempotencyKey, voicePayloadSha256 } from "@/lib/voice/audit"

type WebhookReceiptRow = {
  id: string
  voice_call_id: string | null
}

export async function findVoiceWebhookReceipt(
  admin: SupabaseClient,
  provider: VoiceProviderId,
  idempotencyKey: string,
): Promise<WebhookReceiptRow | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_webhook_receipts")
    .select("id, voice_call_id")
    .eq("provider", provider)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()
  if (error || !data) return null
  return data as WebhookReceiptRow
}

export async function insertVoiceWebhookReceipt(
  admin: SupabaseClient,
  input: {
    organizationId: string
    provider: VoiceProviderId
    idempotencyKey: string
    rawBody: string
    voiceCallId: string | null
  },
): Promise<{ ok: true } | { ok: false; duplicate: boolean; voiceCallId: string | null }> {
  const payloadHash = voicePayloadSha256(input.rawBody)
  const { error } = await admin.schema("voice").from("voice_webhook_receipts").insert({
    organization_id: input.organizationId,
    provider: input.provider,
    idempotency_key: input.idempotencyKey,
    payload_hash: payloadHash,
    voice_call_id: input.voiceCallId,
  })
  if (error) {
    if (error.code === "23505") {
      const existing = await findVoiceWebhookReceipt(admin, input.provider, input.idempotencyKey)
      return { ok: false, duplicate: true, voiceCallId: existing?.voice_call_id ?? null }
    }
    return { ok: false, duplicate: false, voiceCallId: null }
  }
  return { ok: true }
}

export function buildVoiceEventIdempotencyKey(input: {
  provider: VoiceProviderId
  providerCallId: string
  eventType: string
  eventTimestamp: string
}): string {
  return buildVoiceWebhookIdempotencyKey(input)
}
