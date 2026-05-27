/** Client-safe Growth Engine provider webhook types (Phase 2G). */

import type { GrowthDeliveryProviderFamily } from "@/lib/growth/providers/provider-types"

export const GROWTH_PROVIDER_WEBHOOK_INGESTION_QA_MARKER = "growth-provider-webhook-ingestion-v1" as const

export const GROWTH_WEBHOOK_PRIVACY_NOTE =
  "Provider webhook ingestion owned by Growth Engine. Sanitized payloads only — no raw email bodies, headers, secrets, or provider tokens."

export const GROWTH_NORMALIZED_WEBHOOK_EVENT_TYPES = [
  "delivered",
  "deferred",
  "bounced",
  "complained",
  "unsubscribed",
  "opened",
  "clicked",
  "failed",
  "dropped",
  "unknown",
] as const

export type GrowthNormalizedWebhookEventType = (typeof GROWTH_NORMALIZED_WEBHOOK_EVENT_TYPES)[number]

export const GROWTH_WEBHOOK_PROCESSING_STATUSES = [
  "pending",
  "processed",
  "failed",
  "duplicate",
  "signature_failed",
] as const

export type GrowthWebhookProcessingStatus = (typeof GROWTH_WEBHOOK_PROCESSING_STATUSES)[number]

export const GROWTH_WEBHOOK_ENDPOINT_STATUSES = ["active", "disabled", "simulation"] as const
export type GrowthWebhookEndpointStatus = (typeof GROWTH_WEBHOOK_ENDPOINT_STATUSES)[number]

export const GROWTH_WEBHOOK_TIMELINE_EVENT_TYPES = [
  "provider_event_received",
  "provider_delivery_confirmed",
  "provider_delivery_failed",
  "provider_bounce_received",
  "provider_complaint_received",
  "provider_unsubscribe_received",
  "webhook_signature_failed",
] as const

export type GrowthWebhookTimelineEventType = (typeof GROWTH_WEBHOOK_TIMELINE_EVENT_TYPES)[number]

export const GROWTH_WEBHOOK_PROVIDER_FAMILIES = [
  "google",
  "microsoft",
  "ses",
  "resend",
  "smtp",
  "custom",
] as const

export type GrowthWebhookProviderFamily = (typeof GROWTH_WEBHOOK_PROVIDER_FAMILIES)[number]

export type GrowthProviderWebhookEndpoint = {
  id: string
  providerFamily: GrowthWebhookProviderFamily | GrowthDeliveryProviderFamily
  endpointSlug: string
  status: GrowthWebhookEndpointStatus
  lastReceivedAt: string | null
  lastSuccessAt: string | null
  failureCount: number
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type GrowthProviderDeliveryEvent = {
  id: string
  providerId: string | null
  providerFamily: string
  deliveryAttemptId: string | null
  providerMessageId: string | null
  eventType: string
  normalizedEventType: GrowthNormalizedWebhookEventType
  eventStatus: string
  leadId: string | null
  senderAccountId: string | null
  occurredAt: string
  payloadHash: string
  sanitizedPayload: Record<string, unknown>
  processedAt: string | null
  processingStatus: GrowthWebhookProcessingStatus
  processingError: string | null
  createdAt: string
}

export type GrowthProviderWebhookDashboard = {
  qa_marker: typeof GROWTH_PROVIDER_WEBHOOK_INGESTION_QA_MARKER
  received24h: number
  processed24h: number
  failed24h: number
  signatureFailures24h: number
  deliveryConfirmationRate: number
  lastProviderEventAt: string | null
  events: GrowthProviderDeliveryEvent[]
  endpoints: GrowthProviderWebhookEndpoint[]
}

export type GrowthNormalizedProviderEvent = {
  eventType: string
  normalizedEventType: GrowthNormalizedWebhookEventType
  eventStatus: string
  providerMessageId?: string | null
  recipientEmail?: string | null
  occurredAt?: string
  providerCode?: string | null
  providerReason?: string | null
  destinationUrl?: string | null
  bounceTypeHint?: string | null
}

export type GrowthWebhookIngestResult = {
  ok: boolean
  duplicate?: boolean
  signatureFailed?: boolean
  eventId?: string
  normalizedEventType?: GrowthNormalizedWebhookEventType
  processingStatus?: GrowthWebhookProcessingStatus
  message?: string
}
