import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthOutboundReply,
  GrowthOutboundReplyClassification,
  GrowthOutboundReplySentiment,
} from "@/lib/growth/outbound/types"
import { GROWTH_OUTBOUND_BODY_PREVIEW_MAX } from "@/lib/growth/outbound/constants"

type ReplyDbRow = {
  id: string
  connection_id: string
  message_id: string | null
  contact_id: string | null
  lead_id: string
  message_event_id: string
  provider_reply_id: string | null
  received_at: string
  body_preview: string | null
  classification: string
  sentiment: string
  confidence: number
  classification_locked: boolean
  classification_locked_by: string | null
  raw_payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

const SELECT =
  "id, connection_id, message_id, contact_id, lead_id, message_event_id, provider_reply_id, received_at, body_preview, classification, sentiment, confidence, classification_locked, classification_locked_by, raw_payload, created_at, updated_at"

function repliesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("outbound_replies")
}

function mapRow(row: ReplyDbRow): GrowthOutboundReply {
  return {
    id: row.id,
    connectionId: row.connection_id,
    messageId: row.message_id,
    contactId: row.contact_id,
    leadId: row.lead_id,
    messageEventId: row.message_event_id,
    providerReplyId: row.provider_reply_id,
    receivedAt: row.received_at,
    bodyPreview: row.body_preview,
    classification: row.classification as GrowthOutboundReplyClassification,
    sentiment: row.sentiment as GrowthOutboundReplySentiment,
    confidence: Number(row.confidence),
    classificationLocked: row.classification_locked,
    classificationLockedBy: row.classification_locked_by,
    rawPayload: row.raw_payload ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function insertGrowthOutboundReply(
  admin: SupabaseClient,
  input: {
    connectionId: string
    messageId?: string | null
    contactId?: string | null
    leadId: string
    messageEventId: string
    providerReplyId?: string | null
    receivedAt: string
    bodyPreview?: string | null
    classification: GrowthOutboundReplyClassification
    sentiment: GrowthOutboundReplySentiment
    confidence: number
    rawPayload?: Record<string, unknown>
  },
): Promise<GrowthOutboundReply> {
  const { data, error } = await repliesTable(admin)
    .insert({
      connection_id: input.connectionId,
      message_id: input.messageId ?? null,
      contact_id: input.contactId ?? null,
      lead_id: input.leadId,
      message_event_id: input.messageEventId,
      provider_reply_id: input.providerReplyId ?? null,
      received_at: input.receivedAt,
      body_preview: input.bodyPreview?.trim().slice(0, GROWTH_OUTBOUND_BODY_PREVIEW_MAX) ?? null,
      classification: input.classification,
      sentiment: input.sentiment,
      confidence: input.confidence,
      raw_payload: input.rawPayload ?? {},
    })
    .select(SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as ReplyDbRow)
}

export async function listGrowthOutboundRepliesForLead(
  admin: SupabaseClient,
  leadId: string,
  limit = 20,
): Promise<GrowthOutboundReply[]> {
  const { data, error } = await repliesTable(admin)
    .select(SELECT)
    .eq("lead_id", leadId)
    .order("received_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as ReplyDbRow[]).map(mapRow)
}

export async function overrideGrowthOutboundReplyClassification(
  admin: SupabaseClient,
  replyId: string,
  input: {
    classification: GrowthOutboundReplyClassification
    sentiment: GrowthOutboundReplySentiment
    lockedBy: string
  },
): Promise<GrowthOutboundReply | null> {
  const { data, error } = await repliesTable(admin)
    .update({
      classification: input.classification,
      sentiment: input.sentiment,
      classification_locked: true,
      classification_locked_by: input.lockedBy,
      confidence: 1,
    })
    .eq("id", replyId)
    .select(SELECT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapRow(data as ReplyDbRow) : null
}
