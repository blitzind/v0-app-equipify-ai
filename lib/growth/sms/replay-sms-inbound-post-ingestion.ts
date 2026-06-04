import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  finalizeSmsProviderEvent,
  findSmsMessageByProviderId,
  getSmsConversationById,
} from "@/lib/growth/sms/sms-repository"
import {
  processSmsInboundReply,
  type ProcessSmsInboundReplyResult,
} from "@/lib/growth/sms/sms-reply-ingestion"

export type ReplaySmsInboundPostIngestionInput = {
  providerMessageId: string
  finalizeProviderEvent?: boolean
}

export type ReplaySmsInboundPostIngestionResult = ProcessSmsInboundReplyResult & {
  smsMessageId: string
  conversationId: string
  providerEventId: string | null
  providerEventFinalized: boolean
}

/**
 * Re-run reply intelligence + timeline + memory for an inbound SMS that was stored
 * but whose post-ingestion pipeline failed. Does not insert sms_messages or inbox_messages.
 */
export async function replaySmsInboundPostIngestion(
  admin: SupabaseClient,
  input: ReplaySmsInboundPostIngestionInput,
): Promise<ReplaySmsInboundPostIngestionResult> {
  const providerMessageId = input.providerMessageId.trim()
  if (!providerMessageId) throw new Error("providerMessageId is required.")

  const smsMessage = await findSmsMessageByProviderId(admin, {
    provider: "twilio",
    providerMessageId,
  })
  if (!smsMessage || smsMessage.direction !== "inbound") {
    throw new Error(`Inbound sms_messages row not found for provider SID ${providerMessageId}.`)
  }

  const conversation = await getSmsConversationById(admin, smsMessage.conversationId)
  if (!conversation) {
    throw new Error(`sms_conversations row not found for message ${smsMessage.id}.`)
  }

  const { data: inboxRow, error: inboxError } = await admin
    .schema("growth")
    .from("inbox_messages")
    .select("id")
    .eq("provider_message_id", providerMessageId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (inboxError) throw new Error(inboxError.message)

  const { data: providerEventRow, error: providerEventError } = await admin
    .schema("growth")
    .from("sms_provider_events")
    .select("id, processing_status, raw_payload")
    .eq("provider_message_id", providerMessageId)
    .eq("event_type", "inbound_message")
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (providerEventError) throw new Error(providerEventError.message)

  const rawPayload =
    providerEventRow &&
    typeof (providerEventRow as { raw_payload?: unknown }).raw_payload === "object"
      ? ((providerEventRow as { raw_payload: Record<string, unknown> }).raw_payload ?? {})
      : {}

  const replyResult = await processSmsInboundReply(admin, {
    conversation,
    body: smsMessage.body,
    fromE164: smsMessage.fromE164,
    toE164: smsMessage.toE164,
    providerMessageId,
    messageTimestamp: smsMessage.messageTimestamp,
    rawPayloadRef: rawPayload,
    skipInboxBridge: true,
    existingInboxMessageId: (inboxRow as { id?: string } | null)?.id ?? null,
  })

  let providerEventFinalized = false
  const providerEventId = (providerEventRow as { id?: string } | null)?.id ?? null
  const shouldFinalize = input.finalizeProviderEvent !== false

  if (shouldFinalize && providerEventId) {
    const status = (providerEventRow as { processing_status?: string } | null)?.processing_status
    if (status !== "processed" && status !== "duplicate") {
      await finalizeSmsProviderEvent(admin, providerEventId, {
        processingStatus: "processed",
        conversationId: conversation.id,
        messageId: smsMessage.id,
      })
      providerEventFinalized = true
    }
  }

  return {
    ...replyResult,
    smsMessageId: smsMessage.id,
    conversationId: conversation.id,
    providerEventId,
    providerEventFinalized,
    dedupedReplay: replyResult.ingestionEventId != null && !providerEventFinalized,
  }
}
