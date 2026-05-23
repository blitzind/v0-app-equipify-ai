import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { CanonicalOutboundEventType, GrowthMessageEvent } from "@/lib/growth/outbound/types"

type EventDbRow = {
  id: string
  connection_id: string
  lead_id: string | null
  contact_id: string | null
  message_id: string | null
  webhook_id: string | null
  event_type: string
  provider: string
  provider_event_id: string
  occurred_at: string
  payload: Record<string, unknown> | null
  created_at: string
}

const SELECT =
  "id, connection_id, lead_id, contact_id, message_id, webhook_id, event_type, provider, provider_event_id, occurred_at, payload, created_at"

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("message_events")
}

function mapRow(row: EventDbRow): GrowthMessageEvent {
  return {
    id: row.id,
    connectionId: row.connection_id,
    leadId: row.lead_id,
    contactId: row.contact_id,
    messageId: row.message_id,
    webhookId: row.webhook_id,
    eventType: row.event_type as CanonicalOutboundEventType,
    provider: row.provider,
    providerEventId: row.provider_event_id,
    occurredAt: row.occurred_at,
    payload: row.payload ?? {},
    createdAt: row.created_at,
  }
}

export async function findGrowthMessageEventByProviderId(
  admin: SupabaseClient,
  connectionId: string,
  providerEventId: string,
): Promise<GrowthMessageEvent | null> {
  const { data, error } = await eventsTable(admin)
    .select(SELECT)
    .eq("connection_id", connectionId)
    .eq("provider_event_id", providerEventId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as EventDbRow) : null
}

export async function insertGrowthMessageEvent(
  admin: SupabaseClient,
  input: {
    connectionId: string
    leadId?: string | null
    contactId?: string | null
    messageId?: string | null
    webhookId?: string | null
    eventType: CanonicalOutboundEventType
    provider: string
    providerEventId: string
    occurredAt: string
    payload?: Record<string, unknown>
  },
): Promise<GrowthMessageEvent> {
  const { data, error } = await eventsTable(admin)
    .insert({
      connection_id: input.connectionId,
      lead_id: input.leadId ?? null,
      contact_id: input.contactId ?? null,
      message_id: input.messageId ?? null,
      webhook_id: input.webhookId ?? null,
      event_type: input.eventType,
      provider: input.provider,
      provider_event_id: input.providerEventId,
      occurred_at: input.occurredAt,
      payload: input.payload ?? {},
    })
    .select(SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as EventDbRow)
}
