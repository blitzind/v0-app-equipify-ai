/** Mirrors `public.communication_events` — keep aligned with migration checks. */

export type CommunicationChannel = "email" | "sms" | "in_app" | "push" | "system"

export type CommunicationDirection = "outbound" | "inbound"

export type CommunicationAudience = "organization" | "customer_timeline" | "both"

export type CommunicationRecipientKind = "user" | "customer" | "external" | "none"

export type CommunicationDeliveryStatus =
  | "pending"
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced"
  | "skipped"

export type CommunicationProvider =
  | "manual"
  | "resend"
  | "twilio"
  | "supabase"
  | "web_push"
  | "apns"
  | "fcm"
  | "expo"

export type RelatedEntityType =
  | "work_order"
  | "quote"
  | "invoice"
  | "maintenance_plan"
  | "customer"
  | "equipment"
  | "organization"
  | "prospect"
  | "service_request"

export type CommunicationEventType =
  | "work_order_reminder"
  | "maintenance_reminder"
  | "quote_follow_up"
  | "invoice_reminder"
  | "email_outbound"
  | "sms_outbound"
  | "internal_notice"
  | "customer_inbound"
  | string

export type CommunicationEventRow = {
  id: string
  organization_id: string
  channel: CommunicationChannel
  direction: CommunicationDirection
  event_type: string
  title: string
  summary: string | null
  body: string | null
  audience: CommunicationAudience
  counts_toward_unread: boolean
  delivery_status: CommunicationDeliveryStatus
  recipient_kind: CommunicationRecipientKind
  recipient_user_id: string | null
  recipient_customer_id: string | null
  recipient_address: string | null
  related_entity_type: RelatedEntityType | null
  related_entity_id: string | null
  provider: CommunicationProvider
  provider_message_id: string | null
  metadata: Record<string, unknown>
  scheduled_reminder_key: string | null
  scheduled_at: string | null
  sent_at: string | null
  delivered_at: string | null
  failed_at: string | null
  error_message: string | null
  created_at: string
  created_by: string | null
}
