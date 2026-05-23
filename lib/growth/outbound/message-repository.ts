import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthOutboundMessage, GrowthOutboundMessageStatus } from "@/lib/growth/outbound/types"
import { GROWTH_OUTBOUND_BODY_PREVIEW_MAX } from "@/lib/growth/outbound/constants"

type MessageDbRow = {
  id: string
  connection_id: string
  contact_id: string
  lead_id: string
  campaign_id: string | null
  provider_message_id: string | null
  sequence_step: number | null
  subject: string | null
  body_preview: string | null
  sent_at: string | null
  delivered_at: string | null
  status: string
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

const SELECT =
  "id, connection_id, contact_id, lead_id, campaign_id, provider_message_id, sequence_step, subject, body_preview, sent_at, delivered_at, status, metadata, created_at, updated_at"

function messagesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("outbound_messages")
}

function mapRow(row: MessageDbRow): GrowthOutboundMessage {
  return {
    id: row.id,
    connectionId: row.connection_id,
    contactId: row.contact_id,
    leadId: row.lead_id,
    campaignId: row.campaign_id,
    providerMessageId: row.provider_message_id,
    sequenceStep: row.sequence_step,
    subject: row.subject,
    bodyPreview: row.body_preview,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    status: row.status as GrowthOutboundMessageStatus,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function preview(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  return value.trim().slice(0, GROWTH_OUTBOUND_BODY_PREVIEW_MAX)
}

export async function findGrowthOutboundMessageByProviderId(
  admin: SupabaseClient,
  connectionId: string,
  providerMessageId: string,
): Promise<GrowthOutboundMessage | null> {
  const { data, error } = await messagesTable(admin)
    .select(SELECT)
    .eq("connection_id", connectionId)
    .eq("provider_message_id", providerMessageId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as MessageDbRow) : null
}

export async function upsertGrowthOutboundMessage(
  admin: SupabaseClient,
  input: {
    connectionId: string
    contactId: string
    leadId: string
    campaignId?: string | null
    providerMessageId?: string | null
    sequenceStep?: number | null
    subject?: string | null
    bodyPreview?: string | null
    sentAt?: string | null
    deliveredAt?: string | null
    status?: GrowthOutboundMessageStatus
    metadata?: Record<string, unknown>
  },
): Promise<GrowthOutboundMessage> {
  if (input.providerMessageId) {
    const existing = await findGrowthOutboundMessageByProviderId(
      admin,
      input.connectionId,
      input.providerMessageId,
    )
    if (existing) {
      const patch: Record<string, unknown> = {}
      if (input.deliveredAt) patch.delivered_at = input.deliveredAt
      if (input.sentAt && !existing.sentAt) patch.sent_at = input.sentAt
      if (input.status) patch.status = input.status
      if (input.subject) patch.subject = preview(input.subject)
      if (input.bodyPreview) patch.body_preview = preview(input.bodyPreview)
      if (Object.keys(patch).length > 0) {
        const { data, error } = await messagesTable(admin)
          .update(patch)
          .eq("id", existing.id)
          .select(SELECT)
          .single()
        if (error) throw new Error(error.message)
        return mapRow(data as MessageDbRow)
      }
      return existing
    }
  }

  const { data, error } = await messagesTable(admin)
    .insert({
      connection_id: input.connectionId,
      contact_id: input.contactId,
      lead_id: input.leadId,
      campaign_id: input.campaignId ?? null,
      provider_message_id: input.providerMessageId ?? null,
      sequence_step: input.sequenceStep ?? null,
      subject: preview(input.subject),
      body_preview: preview(input.bodyPreview),
      sent_at: input.sentAt ?? null,
      delivered_at: input.deliveredAt ?? null,
      status: input.status ?? "pending",
      metadata: input.metadata ?? {},
    })
    .select(SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as MessageDbRow)
}

export async function listGrowthOutboundMessagesForLead(
  admin: SupabaseClient,
  leadId: string,
  limit = 20,
): Promise<GrowthOutboundMessage[]> {
  const { data, error } = await messagesTable(admin)
    .select(SELECT)
    .eq("lead_id", leadId)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as MessageDbRow[]).map(mapRow)
}

export async function touchGrowthOutboundMessageMetadata(
  admin: SupabaseClient,
  messageId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { data: existing } = await messagesTable(admin).select("metadata").eq("id", messageId).maybeSingle()
  const metadata = { ...(existing?.metadata as Record<string, unknown> | null), ...patch }
  const { error } = await messagesTable(admin).update({ metadata }).eq("id", messageId)
  if (error) throw new Error(error.message)
}
