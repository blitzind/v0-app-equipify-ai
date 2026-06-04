import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { normalizeToE164 } from "@/lib/growth/sms/phone-normalization"
import {
  isTwilioInboundSmsPayload,
  isTwilioSmsStatusPayload,
  normalizeTwilioSmsStatus,
  parseTwilioFormBody,
} from "@/lib/growth/sms/providers/twilio-sms-payload"
import { createTwilioGrowthSmsProvider } from "@/lib/growth/sms/providers/twilio-sms-provider"
import {
  fetchGrowthSmsWorkspaceSettings,
  finalizeSmsProviderEvent,
  findLeadByPhone,
  findSmsDeliveryAttemptByProviderMessageId,
  findSmsMessageByProviderId,
  hashSmsProviderPayload,
  insertSmsMessage,
  insertSmsProviderEvent,
  updateSmsConversationActivity,
  updateSmsDeliveryAttempt,
} from "@/lib/growth/sms/sms-repository"
import { appendSmsMessageToInboxBridge, findOrCreateSmsConversation } from "@/lib/growth/sms/sms-threading"
import { processSmsInboundReply } from "@/lib/growth/sms/sms-reply-ingestion"

export type IngestTwilioSmsWebhookInput = {
  rawBody: string
  params: Record<string, string>
  signatureHeader: string | null
  requestUrl: string
  skipSignatureValidation?: boolean
}

export type IngestTwilioSmsWebhookResult = {
  ok: boolean
  duplicate?: boolean
  eventId?: string
  eventType?: string
  messageId?: string
  conversationId?: string
  signatureFailed?: boolean
  code?: string
  message?: string
}

function isInboundMessage(params: Record<string, string>): boolean {
  return isTwilioInboundSmsPayload(params)
}

function isStatusCallback(params: Record<string, string>): boolean {
  return isTwilioSmsStatusPayload(params)
}

export async function ingestTwilioSmsInboundWebhook(
  admin: SupabaseClient,
  input: IngestTwilioSmsWebhookInput,
): Promise<IngestTwilioSmsWebhookResult> {
  const provider = createTwilioGrowthSmsProvider()
  if (!input.skipSignatureValidation) {
    const validation = provider.validateWebhook({
      signatureHeader: input.signatureHeader,
      url: input.requestUrl,
      params: input.params,
    })
    if (!validation.ok) {
      return { ok: false, signatureFailed: true, code: "invalid_signature", message: validation.message }
    }
  }

  const payloadHash = hashSmsProviderPayload("twilio", input.params)
  const { event, duplicate } = await insertSmsProviderEvent(admin, {
    provider: "twilio",
    eventType: "inbound_message",
    providerMessageId: input.params.MessageSid ?? null,
    payloadHash,
    rawPayload: input.params,
    normalizedPayload: {
      from: input.params.From ?? null,
      to: input.params.To ?? null,
      body: input.params.Body ?? "",
      messageSid: input.params.MessageSid ?? null,
    },
  })

  if (duplicate) {
    await finalizeSmsProviderEvent(admin, event.id, { processingStatus: "duplicate" })
    return { ok: true, duplicate: true, eventId: event.id, eventType: "inbound_message" }
  }

  const fromE164 = normalizeToE164(input.params.From ?? "")
  const toE164 = normalizeToE164(input.params.To ?? "")
  const body = (input.params.Body ?? "").trim()
  const providerMessageId = input.params.MessageSid ?? null

  if (!fromE164 || !body || !providerMessageId) {
    await finalizeSmsProviderEvent(admin, event.id, { processingStatus: "ignored" })
    return { ok: true, eventId: event.id, eventType: "inbound_message", code: "ignored", message: "Missing required inbound fields." }
  }

  const existingMessage = await findSmsMessageByProviderId(admin, {
    provider: "twilio",
    providerMessageId,
  })
  if (existingMessage) {
    await finalizeSmsProviderEvent(admin, event.id, {
      processingStatus: "duplicate",
      messageId: existingMessage.id,
      conversationId: existingMessage.conversationId,
    })
    return { ok: true, duplicate: true, eventId: event.id, messageId: existingMessage.id }
  }

  const lead = await findLeadByPhone(admin, fromE164)
  if (!lead) {
    await finalizeSmsProviderEvent(admin, event.id, { processingStatus: "ignored" })
    logGrowthEngine("sms_inbound_lead_not_found", { fromE164, providerMessageId })
    return {
      ok: true,
      eventId: event.id,
      eventType: "inbound_message",
      code: "lead_not_found",
      message: "Inbound SMS stored — no matching lead for sender phone.",
    }
  }

  const settings = await fetchGrowthSmsWorkspaceSettings(admin)
  const conversation = await findOrCreateSmsConversation(admin, {
    leadId: lead.id,
    participantE164: fromE164,
    organizationId: lead.organizationId,
  })

  const now = new Date().toISOString()
  const message = await insertSmsMessage(admin, {
    conversationId: conversation.id,
    direction: "inbound",
    body,
    fromE164,
    toE164: toE164 ?? settings?.fromE164 ?? "",
    provider: "twilio",
    providerMessageId,
    status: "received",
    messageTimestamp: now,
    metadata: { source: "twilio_inbound_webhook" },
  })

  await updateSmsConversationActivity(admin, conversation.id, {
    bodyPreview: body,
    messageTimestamp: now,
  })

  try {
    const replyResult = await processSmsInboundReply(admin, {
      conversation,
      body,
      fromE164,
      toE164: toE164 ?? settings?.fromE164 ?? "",
      providerMessageId,
      messageTimestamp: now,
      rawPayloadRef: input.params,
    })

    await finalizeSmsProviderEvent(admin, event.id, {
      processingStatus: "processed",
      conversationId: conversation.id,
      messageId: message.id,
    })

    logGrowthEngine("sms_inbound_received", {
      leadId: lead.id,
      conversationId: conversation.id,
      messageId: message.id,
      providerMessageId,
      ingestionEventId: replyResult.ingestionEventId,
      outboundReplyId: replyResult.outboundReplyId,
    })

    return {
      ok: true,
      eventId: event.id,
      eventType: "inbound_message",
      messageId: message.id,
      conversationId: conversation.id,
    }
  } catch (processingError) {
    await finalizeSmsProviderEvent(admin, event.id, {
      processingStatus: "failed",
      conversationId: conversation.id,
      messageId: message.id,
    }).catch(() => undefined)

    const messageText =
      processingError instanceof Error ? processingError.message : String(processingError)
    logGrowthEngine("sms_inbound_post_ingestion_failed", {
      leadId: lead.id,
      conversationId: conversation.id,
      messageId: message.id,
      providerMessageId,
      error: messageText,
    })
    throw processingError
  }
}

export async function ingestTwilioSmsStatusWebhook(
  admin: SupabaseClient,
  input: IngestTwilioSmsWebhookInput,
): Promise<IngestTwilioSmsWebhookResult> {
  const provider = createTwilioGrowthSmsProvider()
  if (!input.skipSignatureValidation) {
    const validation = provider.validateWebhook({
      signatureHeader: input.signatureHeader,
      url: input.requestUrl,
      params: input.params,
    })
    if (!validation.ok) {
      return { ok: false, signatureFailed: true, code: "invalid_signature", message: validation.message }
    }
  }

  const payloadHash = hashSmsProviderPayload("twilio", input.params)
  const { event, duplicate } = await insertSmsProviderEvent(admin, {
    provider: "twilio",
    eventType: "status_update",
    providerMessageId: input.params.MessageSid ?? null,
    payloadHash,
    rawPayload: input.params,
    normalizedPayload: {
      messageSid: input.params.MessageSid ?? null,
      messageStatus: input.params.MessageStatus ?? null,
      errorCode: input.params.ErrorCode ?? null,
    },
  })

  if (duplicate) {
    await finalizeSmsProviderEvent(admin, event.id, { processingStatus: "duplicate" })
    return { ok: true, duplicate: true, eventId: event.id, eventType: "status_update" }
  }

  const providerMessageId = input.params.MessageSid ?? null
  const normalizedStatus = normalizeTwilioSmsStatus(input.params.MessageStatus)
  if (!providerMessageId) {
    await finalizeSmsProviderEvent(admin, event.id, { processingStatus: "ignored" })
    return { ok: true, eventId: event.id, code: "ignored", message: "Missing MessageSid." }
  }

  const attempt = await findSmsDeliveryAttemptByProviderMessageId(admin, providerMessageId)
  const message = await findSmsMessageByProviderId(admin, { provider: "twilio", providerMessageId })
  const now = new Date().toISOString()

  if (attempt) {
    const status =
      normalizedStatus === "delivered"
        ? "delivered"
        : normalizedStatus === "undelivered"
          ? "undelivered"
          : normalizedStatus === "sent"
            ? "sent"
            : attempt.status

    await updateSmsDeliveryAttempt(admin, attempt.id, {
      status,
      deliveredAt: status === "delivered" ? now : attempt.deliveredAt,
      failedAt: status === "undelivered" || status === "failed" ? now : attempt.failedAt,
      failureReason:
        status === "undelivered" || status === "failed"
          ? input.params.ErrorMessage ?? input.params.ErrorCode ?? "Delivery failed"
          : attempt.failureReason,
    })
  }

  if (message && normalizedStatus === "delivered") {
    await admin
      .schema("growth")
      .from("sms_messages")
      .update({ status: "delivered" })
      .eq("id", message.id)
  }

  await finalizeSmsProviderEvent(admin, event.id, {
    processingStatus: "processed",
    deliveryAttemptId: attempt?.id ?? null,
    conversationId: attempt?.conversationId ?? message?.conversationId ?? null,
    messageId: message?.id ?? null,
  })

  logGrowthEngine("sms_status_update", {
    providerMessageId,
    normalizedStatus,
    deliveryAttemptId: attempt?.id ?? null,
  })

  return {
    ok: true,
    eventId: event.id,
    eventType: "status_update",
    messageId: message?.id,
    conversationId: attempt?.conversationId ?? message?.conversationId,
  }
}

export async function ingestTwilioSmsWebhook(
  admin: SupabaseClient,
  input: IngestTwilioSmsWebhookInput,
): Promise<IngestTwilioSmsWebhookResult> {
  if (isInboundMessage(input.params)) {
    return ingestTwilioSmsInboundWebhook(admin, input)
  }
  if (isStatusCallback(input.params)) {
    return ingestTwilioSmsStatusWebhook(admin, input)
  }
  return { ok: false, code: "unknown_event", message: "Unrecognized Twilio SMS webhook payload." }
}

export function parseTwilioSmsWebhookRequest(rawBody: string): Record<string, string> {
  return parseTwilioFormBody(rawBody)
}
