import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  CommunicationAudience,
  CommunicationChannel,
  CommunicationDeliveryStatus,
  CommunicationDirection,
  CommunicationProvider,
  CommunicationRecipientKind,
  RelatedEntityType,
} from "@/lib/notifications/types"

export type LogCommunicationEventInput = {
  organizationId: string
  channel: CommunicationChannel
  direction?: CommunicationDirection
  eventType: string
  title: string
  summary?: string | null
  body?: string | null
  audience?: CommunicationAudience
  countsTowardUnread?: boolean
  deliveryStatus?: CommunicationDeliveryStatus
  recipientKind?: CommunicationRecipientKind
  recipientUserId?: string | null
  recipientCustomerId?: string | null
  recipientAddress?: string | null
  relatedEntityType?: RelatedEntityType | null
  relatedEntityId?: string | null
  provider?: CommunicationProvider
  providerMessageId?: string | null
  metadata?: Record<string, unknown>
  scheduledReminderKey?: string | null
  scheduledAt?: string | null
  sentAt?: string | null
  deliveredAt?: string | null
  failedAt?: string | null
  errorMessage?: string | null
  createdBy?: string | null
}

/** Persists a communication row (email/SMS sent, inbound reply, reminder, etc.). */
export async function logCommunicationEvent(
  supabase: SupabaseClient,
  input: LogCommunicationEventInput,
): Promise<{ id: string | null; error: string | null }> {
  const row = {
    organization_id: input.organizationId,
    channel: input.channel,
    direction: input.direction ?? "outbound",
    event_type: input.eventType,
    title: input.title,
    summary: input.summary ?? null,
    body: input.body ?? null,
    audience: input.audience ?? "organization",
    counts_toward_unread: input.countsTowardUnread ?? true,
    delivery_status: input.deliveryStatus ?? "sent",
    recipient_kind: input.recipientKind ?? "external",
    recipient_user_id: input.recipientUserId ?? null,
    recipient_customer_id: input.recipientCustomerId ?? null,
    recipient_address: input.recipientAddress ?? null,
    related_entity_type: input.relatedEntityType ?? null,
    related_entity_id: input.relatedEntityId ?? null,
    provider: input.provider ?? "internal",
    provider_message_id: input.providerMessageId ?? null,
    metadata: input.metadata ?? {},
    scheduled_reminder_key: input.scheduledReminderKey ?? null,
    scheduled_at: input.scheduledAt ?? null,
    sent_at: input.sentAt ?? null,
    delivered_at: input.deliveredAt ?? null,
    failed_at: input.failedAt ?? null,
    error_message: input.errorMessage ?? null,
    created_by: input.createdBy ?? null,
  }

  const { data, error } = await supabase.from("communication_events").insert(row).select("id").maybeSingle()

  if (error) {
    return { id: null, error: error.message }
  }
  const id = (data as { id: string } | null)?.id ?? null
  return { id, error: null }
}
