import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { recordInboxSyncLeadEvent, recordSequenceExitCandidate, pauseSequenceEnrollmentOnInboundReply } from "@/lib/growth/inbox-sync/inbox-sync-events"
import type { GrowthInboxMessage } from "@/lib/growth/inbox/inbox-types"
import { finalizeIngestedReplyIntelligence } from "@/lib/growth/replies/finalize-ingested-reply-intelligence"
import { ingestGrowthReplyFromSmsWebhook } from "@/lib/growth/replies/reply-ingestion-pipeline"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type { GrowthSmsConversation } from "@/lib/growth/sms/sms-types"
import { appendSmsMessageToInboxBridge } from "@/lib/growth/sms/sms-threading"

export type ProcessSmsInboundReplyInput = {
  conversation: GrowthSmsConversation
  body: string
  fromE164: string
  toE164: string
  providerMessageId: string
  messageTimestamp: string
  rawPayloadRef?: Record<string, unknown>
}

export type ProcessSmsInboundReplyResult = {
  inboxMessageId: string | null
  ingestionEventId: string | null
  outboundReplyId: string | null
  sequenceEnrollmentId: string | null
}

async function findActiveSequenceEnrollmentForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id")
    .eq("lead_id", leadId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as { id?: string } | null)?.id ?? null
}

async function findLatestSmsDeliveryAttemptId(
  admin: SupabaseClient,
  leadId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("sms_delivery_attempts")
    .select("id")
    .eq("lead_id", leadId)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as { id?: string } | null)?.id ?? null
}

export async function processSmsInboundReply(
  admin: SupabaseClient,
  input: ProcessSmsInboundReplyInput,
): Promise<ProcessSmsInboundReplyResult> {
  let inboxMessage: GrowthInboxMessage | null = null

  if (input.conversation.inboxThreadId) {
    const bridged = await appendSmsMessageToInboxBridge(admin, {
      conversation: input.conversation,
      direction: "inbound",
      body: input.body,
      fromE164: input.fromE164,
      toE164: input.toE164,
      providerMessageId: input.providerMessageId,
      messageTimestamp: input.messageTimestamp,
    })
    inboxMessage = bridged?.message ?? null
  }

  const sequenceEnrollmentId = await findActiveSequenceEnrollmentForLead(admin, input.conversation.leadId)
  const smsDeliveryAttemptId = await findLatestSmsDeliveryAttemptId(admin, input.conversation.leadId)

  const ingestion = await ingestGrowthReplyFromSmsWebhook(admin, {
    leadId: input.conversation.leadId,
    senderPhone: input.fromE164,
    recipientPhone: input.toE164,
    subject: `SMS · ${input.conversation.participantE164}`,
    bodyExcerpt: input.body,
    receivedAt: input.messageTimestamp,
    inboxMessageId: inboxMessage?.id ?? null,
    providerFamily: "twilio_sms",
    providerMessageId: input.providerMessageId,
    providerReplyId: input.providerMessageId,
    sequenceEnrollmentId,
    deliveryAttemptId: smsDeliveryAttemptId,
    rawPayloadRef: input.rawPayloadRef ?? {},
  })

  if (!ingestion.deduped) {
    if (ingestion.outboundReply) {
      await finalizeIngestedReplyIntelligence(admin, {
        leadId: input.conversation.leadId,
        outboundReply: ingestion.outboundReply,
        bodyPreview: input.body,
        senderEmail: null,
        sequenceEnrollmentId,
        ingestionEventId: ingestion.ingestionEventId,
        deliveryAttemptId: smsDeliveryAttemptId,
      })
    } else {
      await appendGrowthLeadTimelineEvent(admin, {
        leadId: input.conversation.leadId,
        eventType: "reply_received",
        title: "SMS reply received",
        summary: input.body.slice(0, 120) || "Inbound SMS reply received.",
        payload: {
          ingestion_event_id: ingestion.ingestionEventId,
          inbox_message_id: inboxMessage?.id ?? null,
          source: "sms_provider_webhook",
          provider_message_id: input.providerMessageId,
          channel: "sms",
        },
      }).catch(() => undefined)
    }

    await recordInboxSyncLeadEvent(admin, {
      leadId: input.conversation.leadId,
      eventType: "inbox_reply_imported",
      title: "SMS reply imported",
      summary: "Inbound SMS synced into unified inbox.",
      payload: {
        thread_id: input.conversation.inboxThreadId,
        conversation_id: input.conversation.id,
        channel: "sms",
        matched_by: "twilio_inbound_webhook",
      },
    })

    if (sequenceEnrollmentId && input.conversation.inboxThreadId) {
      await recordSequenceExitCandidate(admin, {
        threadId: input.conversation.inboxThreadId,
        leadId: input.conversation.leadId,
        sequenceEnrollmentId,
        reason: "inbound_sms_reply_on_active_sequence",
      })
      await pauseSequenceEnrollmentOnInboundReply(admin, {
        leadId: input.conversation.leadId,
        sequenceEnrollmentId,
        reason: "inbound_sms_reply_on_active_sequence",
      })
    }
  }

  logGrowthEngine("sms_inbound_reply_processed", {
    leadId: input.conversation.leadId,
    conversationId: input.conversation.id,
    ingestionEventId: ingestion.ingestionEventId,
    outboundReplyId: ingestion.outboundReplyId,
    deduped: ingestion.deduped,
  })

  return {
    inboxMessageId: inboxMessage?.id ?? null,
    ingestionEventId: ingestion.ingestionEventId,
    outboundReplyId: ingestion.outboundReplyId,
    sequenceEnrollmentId,
  }
}
