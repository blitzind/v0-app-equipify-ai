import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthOutboundReply } from "@/lib/growth/outbound/types"
import { insertGrowthMessageEvent } from "@/lib/growth/outbound/event-repository"
import { insertGrowthOutboundReply } from "@/lib/growth/outbound/reply-repository"
import { classifyReplyIntentV2 } from "@/lib/growth/reply-intelligence/reply-intent-classifier-v2"
import type { GrowthReplyIngestionSource } from "@/lib/growth/reply-intelligence/reply-intent-types"
import { rebuildLeadMemoryProfile } from "@/lib/growth/lead-memory/dashboard"
import {
  findReplyIngestionByDedupeKey,
  insertReplyIngestionEvent,
  markReplyIngestionProcessed,
} from "@/lib/growth/reply-intelligence/reply-ingestion-repository"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"

export type NormalizedReplyIngestInput = {
  source: GrowthReplyIngestionSource
  senderEmail?: string | null
  recipientEmail?: string | null
  subject?: string | null
  bodyExcerpt?: string | null
  receivedAt: string
  leadId?: string | null
  connectionId?: string | null
  contactId?: string | null
  messageId?: string | null
  campaignId?: string | null
  sequenceEnrollmentId?: string | null
  deliveryAttemptId?: string | null
  mailboxConnectionId?: string | null
  inboxMessageId?: string | null
  providerFamily?: string | null
  providerMessageId?: string | null
  providerReplyId?: string | null
  senderPhone?: string | null
  recipientPhone?: string | null
  existingOutboundReplyId?: string | null
  existingMessageEventId?: string | null
  rawPayloadRef?: Record<string, unknown>
}

export type ReplyIngestionResult = {
  deduped: boolean
  ingestionEventId: string
  outboundReplyId: string | null
  outboundReply: GrowthOutboundReply | null
}

function buildDedupeKey(input: NormalizedReplyIngestInput): string {
  if (input.source === "sms_provider_webhook" && input.providerMessageId) {
    return `sms:${input.providerFamily ?? "twilio"}:${input.providerMessageId}`
  }
  if (input.connectionId && input.providerReplyId) {
    return `webhook:${input.connectionId}:${input.providerReplyId}`
  }
  if (input.mailboxConnectionId && input.providerMessageId) {
    return `inbox:${input.mailboxConnectionId}:${input.providerMessageId}`
  }
  const hash = createHash("sha256")
    .update(
      [
        input.source,
        input.senderEmail ?? "",
        input.recipientEmail ?? "",
        input.senderPhone ?? "",
        input.recipientPhone ?? "",
        input.subject ?? "",
        input.bodyExcerpt ?? "",
        input.receivedAt,
      ].join("|"),
    )
    .digest("hex")
  return `hash:${hash}`
}

async function resolveConnectionForLead(admin: SupabaseClient, leadId: string): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("outbound_messages")
    .select("connection_id")
    .eq("lead_id", leadId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as { connection_id?: string } | null)?.connection_id ?? null
}

async function finalizeReplyIngestionResult(
  admin: SupabaseClient,
  leadId: string | null | undefined,
  result: ReplyIngestionResult,
): Promise<ReplyIngestionResult> {
  if (!result.deduped && leadId) {
    await rebuildLeadMemoryProfile(admin, leadId).catch(() => undefined)
  }
  return result
}

export async function ingestGrowthReply(
  admin: SupabaseClient,
  input: NormalizedReplyIngestInput,
): Promise<ReplyIngestionResult> {
  const dedupeKey = buildDedupeKey(input)
  const existing = await findReplyIngestionByDedupeKey(admin, dedupeKey)
  if (existing) {
    return {
      deduped: true,
      ingestionEventId: existing.id,
      outboundReplyId: existing.outboundReplyId,
      outboundReply: null,
    }
  }

  const ingestionEvent = await insertReplyIngestionEvent(admin, {
    source: input.source,
    dedupeKey,
    senderEmail: input.senderEmail,
    recipientEmail: input.recipientEmail,
    subject: input.subject,
    bodyExcerpt: input.bodyExcerpt,
    receivedAt: input.receivedAt,
    leadId: input.leadId,
    outboundReplyId: input.existingOutboundReplyId,
    inboxMessageId: input.inboxMessageId,
    mailboxConnectionId: input.mailboxConnectionId,
    campaignId: input.campaignId,
    sequenceEnrollmentId: input.sequenceEnrollmentId,
    deliveryAttemptId: input.deliveryAttemptId,
    providerFamily: input.providerFamily,
    providerMessageId: input.providerMessageId,
    rawPayloadRef: input.rawPayloadRef ?? {},
    normalizedPayload: {
      sender: input.senderEmail ?? null,
      recipient: input.recipientEmail ?? null,
      subject: input.subject ?? null,
      body_excerpt: input.bodyExcerpt ?? null,
      attribution: {
        lead_id: input.leadId ?? null,
        campaign_id: input.campaignId ?? null,
        sequence_enrollment_id: input.sequenceEnrollmentId ?? null,
        mailbox_connection_id: input.mailboxConnectionId ?? null,
      },
    },
    processingStatus: input.existingOutboundReplyId ? "processed" : "pending",
  })

  if (input.leadId) {
    await appendGrowthLeadTimelineEvent(admin, {
      leadId: input.leadId,
      eventType: "reply_ingested",
      title: "Reply ingested",
      summary: `Canonical reply ingestion from ${input.source.replace(/_/g, " ")}.`,
      payload: {
        ingestion_event_id: ingestionEvent.id,
        source: input.source,
        subject: input.subject ?? null,
      },
    }).catch(() => undefined)
  }

  if (input.existingOutboundReplyId) {
    return finalizeReplyIngestionResult(admin, input.leadId, {
      deduped: false,
      ingestionEventId: ingestionEvent.id,
      outboundReplyId: input.existingOutboundReplyId,
      outboundReply: null,
    })
  }

  if (!input.leadId) {
    await markReplyIngestionProcessed(admin, ingestionEvent.id, { processingStatus: "skipped" })
    return { deduped: false, ingestionEventId: ingestionEvent.id, outboundReplyId: null, outboundReply: null }
  }

  const connectionId =
    input.connectionId ??
    (input.source === "sms_provider_webhook"
      ? await resolveSmsReplyConnectionId(admin)
      : await resolveConnectionForLead(admin, input.leadId))
  if (!connectionId) {
    await markReplyIngestionProcessed(admin, ingestionEvent.id, { processingStatus: "processed" })
    return finalizeReplyIngestionResult(admin, input.leadId, {
      deduped: false,
      ingestionEventId: ingestionEvent.id,
      outboundReplyId: null,
      outboundReply: null,
    })
  }

  const classified = classifyReplyIntentV2(input.bodyExcerpt)
  const providerEventId =
    input.providerReplyId ??
    input.providerMessageId ??
    `ingest:${ingestionEvent.id}`

  const messageEvent =
    input.existingMessageEventId
      ? { id: input.existingMessageEventId }
      : await insertGrowthMessageEvent(admin, {
          connectionId,
          leadId: input.leadId,
          contactId: input.contactId ?? null,
          messageId: input.messageId ?? null,
          eventType: "replied",
          provider: input.providerFamily ?? input.source,
          providerEventId,
          occurredAt: input.receivedAt,
          payload: {
            ingestion_source: input.source,
            ingestion_event_id: ingestionEvent.id,
            subject: input.subject ?? null,
            bodyPreview: input.bodyExcerpt ?? null,
          },
        })

  const outboundReply = await insertGrowthOutboundReply(admin, {
    connectionId,
    messageId: input.messageId ?? null,
    contactId: input.contactId ?? null,
    leadId: input.leadId,
    messageEventId: messageEvent.id,
    providerReplyId: input.providerReplyId ?? input.providerMessageId ?? null,
    receivedAt: input.receivedAt,
    bodyPreview: input.bodyExcerpt,
    classification: classified.classification,
    sentiment: classified.sentiment,
    confidence: classified.confidence,
    rawPayload: {
      ...(input.rawPayloadRef ?? {}),
      ingestion_event_id: ingestionEvent.id,
      ingestion_source: input.source,
    },
  })

  await admin
    .schema("growth")
    .from("outbound_replies")
    .update({
      ingestion_source: input.source,
      ingestion_event_id: ingestionEvent.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", outboundReply.id)

  await markReplyIngestionProcessed(admin, ingestionEvent.id, {
    outboundReplyId: outboundReply.id,
    processingStatus: "processed",
  })

  return finalizeReplyIngestionResult(admin, input.leadId, {
    deduped: false,
    ingestionEventId: ingestionEvent.id,
    outboundReplyId: outboundReply.id,
    outboundReply,
  })
}

export async function ingestGrowthReplyFromWebhook(
  admin: SupabaseClient,
  input: Omit<NormalizedReplyIngestInput, "source"> & {
    existingOutboundReplyId: string
    existingMessageEventId: string
  },
): Promise<ReplyIngestionResult> {
  return ingestGrowthReply(admin, { ...input, source: "provider_webhook" })
}

export async function ingestGrowthReplyFromInboxSync(
  admin: SupabaseClient,
  input: Omit<NormalizedReplyIngestInput, "source">,
): Promise<ReplyIngestionResult> {
  return ingestGrowthReply(admin, { ...input, source: "google_mailbox_sync" })
}

async function resolveSmsReplyConnectionId(admin: SupabaseClient): Promise<string | null> {
  const { GROWTH_SMS_REPLY_CONNECTION_ID } = await import("@/lib/growth/sms/schema-health")
  const { data, error } = await admin
    .schema("growth")
    .from("email_provider_connections")
    .select("id")
    .eq("id", GROWTH_SMS_REPLY_CONNECTION_ID)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as { id?: string } | null)?.id ?? GROWTH_SMS_REPLY_CONNECTION_ID
}

export async function ingestGrowthReplyFromSmsWebhook(
  admin: SupabaseClient,
  input: Omit<NormalizedReplyIngestInput, "source" | "connectionId"> & {
    connectionId?: string | null
  },
): Promise<ReplyIngestionResult> {
  const connectionId = input.connectionId ?? (await resolveSmsReplyConnectionId(admin))
  return ingestGrowthReply(admin, {
    ...input,
    source: "sms_provider_webhook",
    connectionId: connectionId ?? undefined,
    providerFamily: input.providerFamily ?? "twilio_sms",
  })
}
