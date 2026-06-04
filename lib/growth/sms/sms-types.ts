/** Client-safe Growth Engine SMS types (Phase 5.1). */

import { GROWTH_SMS_INFRASTRUCTURE_QA_MARKER } from "@/lib/growth/sms/sms-architecture-audit"

export { GROWTH_SMS_INFRASTRUCTURE_QA_MARKER }

export const GROWTH_SMS_PROVIDER_KINDS = ["twilio", "telnyx", "signalwire", "noop"] as const
export type GrowthSmsProviderKind = (typeof GROWTH_SMS_PROVIDER_KINDS)[number]

export const GROWTH_SMS_DELIVERY_STATUSES = [
  "queued",
  "sent",
  "delivered",
  "failed",
  "undelivered",
  "cancelled",
] as const
export type GrowthSmsDeliveryStatus = (typeof GROWTH_SMS_DELIVERY_STATUSES)[number]

export const GROWTH_SMS_MESSAGE_DIRECTIONS = ["inbound", "outbound"] as const
export type GrowthSmsMessageDirection = (typeof GROWTH_SMS_MESSAGE_DIRECTIONS)[number]

export const GROWTH_SMS_CONVERSATION_STATUSES = ["open", "waiting", "resolved", "archived"] as const
export type GrowthSmsConversationStatus = (typeof GROWTH_SMS_CONVERSATION_STATUSES)[number]

export const GROWTH_SMS_PROVIDER_EVENT_TYPES = [
  "inbound_message",
  "status_update",
  "delivery_receipt",
  "unknown",
] as const
export type GrowthSmsProviderEventType = (typeof GROWTH_SMS_PROVIDER_EVENT_TYPES)[number]

export const GROWTH_SMS_PROVIDER_EVENT_PROCESSING_STATUSES = [
  "received",
  "processed",
  "duplicate",
  "failed",
  "ignored",
] as const
export type GrowthSmsProviderEventProcessingStatus =
  (typeof GROWTH_SMS_PROVIDER_EVENT_PROCESSING_STATUSES)[number]

export type GrowthSmsWorkspaceSettings = {
  id: string
  organizationId: string | null
  providerKind: GrowthSmsProviderKind
  fromE164: string
  messagingServiceSid: string | null
  status: "active" | "inactive"
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type GrowthSmsConversation = {
  id: string
  organizationId: string | null
  leadId: string
  participantE164: string
  fromE164: string
  inboxThreadId: string | null
  status: GrowthSmsConversationStatus
  messageCount: number
  lastMessageAt: string | null
  lastMessagePreview: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type GrowthSmsMessage = {
  id: string
  conversationId: string
  direction: GrowthSmsMessageDirection
  body: string
  fromE164: string
  toE164: string
  provider: GrowthSmsProviderKind
  providerMessageId: string | null
  status: GrowthSmsDeliveryStatus | "received"
  deliveryAttemptId: string | null
  messageTimestamp: string
  metadata: Record<string, unknown>
  createdAt: string
}

export type GrowthSmsDeliveryAttempt = {
  id: string
  organizationId: string | null
  leadId: string | null
  conversationId: string | null
  provider: GrowthSmsProviderKind
  fromE164: string
  toE164: string
  body: string
  status: GrowthSmsDeliveryStatus
  providerMessageId: string | null
  idempotencyKey: string
  failureReason: string | null
  queuedAt: string
  sentAt: string | null
  deliveredAt: string | null
  failedAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type GrowthSmsProviderEvent = {
  id: string
  provider: GrowthSmsProviderKind
  eventType: GrowthSmsProviderEventType
  providerMessageId: string | null
  deliveryAttemptId: string | null
  conversationId: string | null
  messageId: string | null
  payloadHash: string
  rawPayload: Record<string, unknown>
  normalizedPayload: Record<string, unknown>
  processingStatus: GrowthSmsProviderEventProcessingStatus
  receivedAt: string
  processedAt: string | null
}

export type GrowthSmsSendInput = {
  leadId: string
  toE164: string
  body: string
  idempotencyKey?: string
  actingUserId?: string | null
  metadata?: Record<string, unknown>
}

export type GrowthSmsSendResult =
  | {
      ok: true
      deliveryAttemptId: string
      conversationId: string
      messageId: string
      providerMessageId: string | null
      status: GrowthSmsDeliveryStatus
    }
  | { ok: false; code: string; message: string }
