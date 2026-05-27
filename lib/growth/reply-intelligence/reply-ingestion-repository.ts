import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthReplyIngestionSource } from "@/lib/growth/reply-intelligence/reply-intent-types"

export type ReplyIngestionEventRecord = {
  id: string
  source: GrowthReplyIngestionSource
  dedupeKey: string
  senderEmail: string | null
  recipientEmail: string | null
  subject: string | null
  bodyExcerpt: string | null
  receivedAt: string
  leadId: string | null
  outboundReplyId: string | null
  inboxMessageId: string | null
  mailboxConnectionId: string | null
  campaignId: string | null
  sequenceEnrollmentId: string | null
  deliveryAttemptId: string | null
  providerFamily: string | null
  providerMessageId: string | null
  processingStatus: string
  dedupedFromId: string | null
  createdAt: string
}

function ingestionTable(admin: SupabaseClient) {
  return admin.schema("growth").from("reply_ingestion_events")
}

function mapRow(row: Record<string, unknown>): ReplyIngestionEventRecord {
  return {
    id: String(row.id),
    source: row.source as GrowthReplyIngestionSource,
    dedupeKey: String(row.dedupe_key),
    senderEmail: (row.sender_email as string | null) ?? null,
    recipientEmail: (row.recipient_email as string | null) ?? null,
    subject: (row.subject as string | null) ?? null,
    bodyExcerpt: (row.body_excerpt as string | null) ?? null,
    receivedAt: String(row.received_at),
    leadId: (row.lead_id as string | null) ?? null,
    outboundReplyId: (row.outbound_reply_id as string | null) ?? null,
    inboxMessageId: (row.inbox_message_id as string | null) ?? null,
    mailboxConnectionId: (row.mailbox_connection_id as string | null) ?? null,
    campaignId: (row.campaign_id as string | null) ?? null,
    sequenceEnrollmentId: (row.sequence_enrollment_id as string | null) ?? null,
    deliveryAttemptId: (row.delivery_attempt_id as string | null) ?? null,
    providerFamily: (row.provider_family as string | null) ?? null,
    providerMessageId: (row.provider_message_id as string | null) ?? null,
    processingStatus: String(row.processing_status),
    dedupedFromId: (row.deduped_from_id as string | null) ?? null,
    createdAt: String(row.created_at),
  }
}

export async function findReplyIngestionByDedupeKey(
  admin: SupabaseClient,
  dedupeKey: string,
): Promise<ReplyIngestionEventRecord | null> {
  const { data, error } = await ingestionTable(admin).select("*").eq("dedupe_key", dedupeKey).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as Record<string, unknown>) : null
}

export async function insertReplyIngestionEvent(
  admin: SupabaseClient,
  input: {
    source: GrowthReplyIngestionSource
    dedupeKey: string
    senderEmail?: string | null
    recipientEmail?: string | null
    subject?: string | null
    bodyExcerpt?: string | null
    receivedAt: string
    leadId?: string | null
    outboundReplyId?: string | null
    inboxMessageId?: string | null
    mailboxConnectionId?: string | null
    campaignId?: string | null
    sequenceEnrollmentId?: string | null
    deliveryAttemptId?: string | null
    providerFamily?: string | null
    providerMessageId?: string | null
    rawPayloadRef?: Record<string, unknown>
    normalizedPayload?: Record<string, unknown>
    processingStatus?: string
    dedupedFromId?: string | null
  },
): Promise<ReplyIngestionEventRecord> {
  const { data, error } = await ingestionTable(admin)
    .insert({
      source: input.source,
      dedupe_key: input.dedupeKey,
      sender_email: input.senderEmail ?? null,
      recipient_email: input.recipientEmail ?? null,
      subject: input.subject ?? null,
      body_excerpt: input.bodyExcerpt?.trim().slice(0, 4000) ?? null,
      received_at: input.receivedAt,
      lead_id: input.leadId ?? null,
      outbound_reply_id: input.outboundReplyId ?? null,
      inbox_message_id: input.inboxMessageId ?? null,
      mailbox_connection_id: input.mailboxConnectionId ?? null,
      campaign_id: input.campaignId ?? null,
      sequence_enrollment_id: input.sequenceEnrollmentId ?? null,
      delivery_attempt_id: input.deliveryAttemptId ?? null,
      provider_family: input.providerFamily ?? null,
      provider_message_id: input.providerMessageId ?? null,
      raw_payload_ref: input.rawPayloadRef ?? {},
      normalized_payload: input.normalizedPayload ?? {},
      processing_status: input.processingStatus ?? "pending",
      deduped_from_id: input.dedupedFromId ?? null,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as Record<string, unknown>)
}

export async function markReplyIngestionProcessed(
  admin: SupabaseClient,
  ingestionEventId: string,
  input: { outboundReplyId?: string | null; processingStatus?: string },
): Promise<void> {
  const { error } = await ingestionTable(admin)
    .update({
      outbound_reply_id: input.outboundReplyId ?? null,
      processing_status: input.processingStatus ?? "processed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ingestionEventId)
  if (error) throw new Error(error.message)
}

export async function insertReplyWorkflowAction(
  admin: SupabaseClient,
  input: {
    replyId?: string | null
    ingestionEventId?: string | null
    leadId: string
    actionType: string
    actionStatus?: string
    severity?: string
    title: string
    summary: string
    evidence?: Record<string, unknown>
    actorUserId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<{ id: string }> {
  const { data, error } = await admin
    .schema("growth")
    .from("reply_workflow_actions")
    .insert({
      reply_id: input.replyId ?? null,
      ingestion_event_id: input.ingestionEventId ?? null,
      lead_id: input.leadId,
      action_type: input.actionType,
      action_status: input.actionStatus ?? "recorded",
      severity: input.severity ?? "info",
      title: input.title,
      summary: input.summary,
      evidence: input.evidence ?? {},
      actor_user_id: input.actorUserId ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return { id: String((data as { id: string }).id) }
}

export async function insertConversationTimelineEvent(
  admin: SupabaseClient,
  input: {
    leadId: string
    eventKind: string
    eventSource: string
    title: string
    summary: string
    evidenceExcerpt?: string | null
    occurredAt: string
    outboundReplyId?: string | null
    ingestionEventId?: string | null
    payload?: Record<string, unknown>
    displayRank?: number
  },
): Promise<void> {
  const { error } = await admin.schema("growth").from("conversation_timeline_events").insert({
    lead_id: input.leadId,
    event_kind: input.eventKind,
    event_source: input.eventSource,
    title: input.title,
    summary: input.summary,
    evidence_excerpt: input.evidenceExcerpt ?? null,
    occurred_at: input.occurredAt,
    outbound_reply_id: input.outboundReplyId ?? null,
    ingestion_event_id: input.ingestionEventId ?? null,
    payload: input.payload ?? {},
    display_rank: input.displayRank ?? 0,
  })
  if (error) throw new Error(error.message)
}

export async function countReplyWorkflowActionsForLead(
  admin: SupabaseClient,
  leadId: string,
  since?: string,
): Promise<number> {
  let query = admin
    .schema("growth")
    .from("reply_workflow_actions")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
  if (since) query = query.gte("created_at", since)
  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count ?? 0
}
