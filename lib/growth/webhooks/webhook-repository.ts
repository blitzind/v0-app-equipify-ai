import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_PROVIDER_WEBHOOK_INGESTION_QA_MARKER,
  type GrowthNormalizedWebhookEventType,
  type GrowthProviderDeliveryEvent,
  type GrowthProviderWebhookDashboard,
  type GrowthProviderWebhookEndpoint,
  type GrowthWebhookEndpointStatus,
  type GrowthWebhookProcessingStatus,
} from "@/lib/growth/webhooks/webhook-types"

type EventRow = {
  id: string
  provider_id: string | null
  provider_family: string
  delivery_attempt_id: string | null
  provider_message_id: string | null
  event_type: string
  normalized_event_type: string
  event_status: string
  lead_id: string | null
  sender_account_id: string | null
  occurred_at: string
  payload_hash: string
  sanitized_payload: Record<string, unknown>
  processed_at: string | null
  processing_status: string
  processing_error: string | null
  created_at: string
}

type EndpointRow = {
  id: string
  provider_family: string
  endpoint_slug: string
  status: string
  signing_secret_hash: string | null
  last_received_at: string | null
  last_success_at: string | null
  failure_count: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("provider_delivery_events")
}

function endpointsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("provider_webhook_endpoints")
}

function attemptsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("delivery_attempts")
}

function mapEvent(row: EventRow): GrowthProviderDeliveryEvent {
  return {
    id: row.id,
    providerId: row.provider_id,
    providerFamily: row.provider_family,
    deliveryAttemptId: row.delivery_attempt_id,
    providerMessageId: row.provider_message_id,
    eventType: row.event_type,
    normalizedEventType: row.normalized_event_type as GrowthNormalizedWebhookEventType,
    eventStatus: row.event_status,
    leadId: row.lead_id,
    senderAccountId: row.sender_account_id,
    occurredAt: row.occurred_at,
    payloadHash: row.payload_hash,
    sanitizedPayload: row.sanitized_payload ?? {},
    processedAt: row.processed_at,
    processingStatus: row.processing_status as GrowthWebhookProcessingStatus,
    processingError: row.processing_error,
    createdAt: row.created_at,
  }
}

function mapEndpoint(row: EndpointRow): GrowthProviderWebhookEndpoint {
  return {
    id: row.id,
    providerFamily: row.provider_family,
    endpointSlug: row.endpoint_slug,
    status: row.status as GrowthWebhookEndpointStatus,
    lastReceivedAt: row.last_received_at,
    lastSuccessAt: row.last_success_at,
    failureCount: row.failure_count,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function findWebhookEventByPayloadHash(
  admin: SupabaseClient,
  payloadHash: string,
): Promise<GrowthProviderDeliveryEvent | null> {
  const { data, error } = await eventsTable(admin).select("*").eq("payload_hash", payloadHash).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapEvent(data as EventRow)
}

export async function insertProviderDeliveryEvent(
  admin: SupabaseClient,
  input: {
    providerId?: string | null
    providerFamily: string
    deliveryAttemptId?: string | null
    providerMessageId?: string | null
    eventType: string
    normalizedEventType: GrowthNormalizedWebhookEventType
    eventStatus: string
    leadId?: string | null
    senderAccountId?: string | null
    occurredAt: string
    payloadHash: string
    sanitizedPayload: Record<string, unknown>
    processingStatus: GrowthWebhookProcessingStatus
    processingError?: string | null
    processedAt?: string | null
  },
): Promise<GrowthProviderDeliveryEvent> {
  const now = new Date().toISOString()
  const { data, error } = await eventsTable(admin)
    .insert({
      provider_id: input.providerId ?? null,
      provider_family: input.providerFamily,
      delivery_attempt_id: input.deliveryAttemptId ?? null,
      provider_message_id: input.providerMessageId ?? null,
      event_type: input.eventType,
      normalized_event_type: input.normalizedEventType,
      event_status: input.eventStatus,
      lead_id: input.leadId ?? null,
      sender_account_id: input.senderAccountId ?? null,
      occurred_at: input.occurredAt,
      payload_hash: input.payloadHash,
      sanitized_payload: input.sanitizedPayload,
      processing_status: input.processingStatus,
      processing_error: input.processingError ?? null,
      processed_at: input.processedAt ?? null,
      created_at: now,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapEvent(data as EventRow)
}

export async function updateProviderDeliveryEventProcessing(
  admin: SupabaseClient,
  eventId: string,
  input: {
    processingStatus: GrowthWebhookProcessingStatus
    processingError?: string | null
    deliveryAttemptId?: string | null
    leadId?: string | null
    senderAccountId?: string | null
    providerId?: string | null
  },
): Promise<void> {
  const { error } = await eventsTable(admin)
    .update({
      processing_status: input.processingStatus,
      processing_error: input.processingError ?? null,
      processed_at: new Date().toISOString(),
      delivery_attempt_id: input.deliveryAttemptId,
      lead_id: input.leadId,
      sender_account_id: input.senderAccountId,
      provider_id: input.providerId,
    })
    .eq("id", eventId)
  if (error) throw new Error(error.message)
}

export async function findDeliveryAttemptByProviderMessageId(
  admin: SupabaseClient,
  providerMessageId: string,
): Promise<{
  id: string
  provider_id: string
  sender_account_id: string
  lead_id: string | null
  status: string
  metadata: Record<string, unknown>
} | null> {
  const { data, error } = await attemptsTable(admin)
    .select("id, provider_id, sender_account_id, lead_id, status, metadata")
    .eq("provider_message_id", providerMessageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    id: data.id as string,
    provider_id: data.provider_id as string,
    sender_account_id: data.sender_account_id as string,
    lead_id: (data.lead_id as string | null) ?? null,
    status: data.status as string,
    metadata: (data.metadata as Record<string, unknown>) ?? {},
  }
}

export async function listProviderWebhookEndpoints(admin: SupabaseClient): Promise<GrowthProviderWebhookEndpoint[]> {
  const { data, error } = await endpointsTable(admin).select("*").order("updated_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapEndpoint(row as EndpointRow))
}

export async function findWebhookEndpointByFamily(
  admin: SupabaseClient,
  providerFamily: string,
): Promise<(GrowthProviderWebhookEndpoint & { signingSecretHash: string | null }) | null> {
  const { data, error } = await endpointsTable(admin)
    .select("*")
    .eq("provider_family", providerFamily)
    .neq("status", "disabled")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as EndpointRow
  return { ...mapEndpoint(row), signingSecretHash: row.signing_secret_hash }
}

export async function findWebhookEndpointBySlug(
  admin: SupabaseClient,
  endpointSlug: string,
): Promise<(GrowthProviderWebhookEndpoint & { signingSecretHash: string | null }) | null> {
  const { data, error } = await endpointsTable(admin).select("*").eq("endpoint_slug", endpointSlug).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as EndpointRow
  return { ...mapEndpoint(row), signingSecretHash: row.signing_secret_hash }
}

export async function createProviderWebhookEndpoint(
  admin: SupabaseClient,
  input: {
    providerFamily: string
    endpointSlug: string
    status?: GrowthWebhookEndpointStatus
    signingSecretHash?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<GrowthProviderWebhookEndpoint> {
  const now = new Date().toISOString()
  const { data, error } = await endpointsTable(admin)
    .insert({
      provider_family: input.providerFamily,
      endpoint_slug: input.endpointSlug,
      status: input.status ?? "active",
      signing_secret_hash: input.signingSecretHash ?? null,
      metadata: input.metadata ?? {},
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapEndpoint(data as EndpointRow)
}

export async function updateProviderWebhookEndpoint(
  admin: SupabaseClient,
  endpointId: string,
  input: {
    status?: GrowthWebhookEndpointStatus
    signingSecretHash?: string | null
    metadata?: Record<string, unknown>
    lastReceivedAt?: string
    lastSuccessAt?: string
    incrementFailure?: boolean
  },
): Promise<GrowthProviderWebhookEndpoint> {
  const existing = await endpointsTable(admin).select("failure_count").eq("id", endpointId).maybeSingle()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.status) patch.status = input.status
  if (input.signingSecretHash !== undefined) patch.signing_secret_hash = input.signingSecretHash
  if (input.metadata) patch.metadata = input.metadata
  if (input.lastReceivedAt) patch.last_received_at = input.lastReceivedAt
  if (input.lastSuccessAt) patch.last_success_at = input.lastSuccessAt
  if (input.incrementFailure) {
    patch.failure_count = Number(existing.data?.failure_count ?? 0) + 1
  }

  const { data, error } = await endpointsTable(admin).update(patch).eq("id", endpointId).select("*").single()
  if (error) throw new Error(error.message)
  return mapEndpoint(data as EndpointRow)
}

export async function listRecentProviderDeliveryEvents(
  admin: SupabaseClient,
  limit = 50,
): Promise<GrowthProviderDeliveryEvent[]> {
  const { data, error } = await eventsTable(admin)
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapEvent(row as EventRow))
}

export async function fetchProviderWebhookDashboard(admin: SupabaseClient): Promise<GrowthProviderWebhookDashboard> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [eventsRes, endpoints, receivedRes, processedRes, failedRes, signatureRes, deliveredRes, sentRes] =
    await Promise.all([
      eventsTable(admin).select("*").order("occurred_at", { ascending: false }).limit(50),
      listProviderWebhookEndpoints(admin),
      eventsTable(admin).select("id", { count: "exact", head: true }).gte("occurred_at", since24h),
      eventsTable(admin)
        .select("id", { count: "exact", head: true })
        .eq("processing_status", "processed")
        .gte("occurred_at", since24h),
      eventsTable(admin)
        .select("id", { count: "exact", head: true })
        .eq("processing_status", "failed")
        .gte("occurred_at", since24h),
      eventsTable(admin)
        .select("id", { count: "exact", head: true })
        .eq("processing_status", "signature_failed")
        .gte("occurred_at", since24h),
      eventsTable(admin)
        .select("id", { count: "exact", head: true })
        .eq("normalized_event_type", "delivered")
        .eq("processing_status", "processed")
        .gte("occurred_at", since24h),
      attemptsTable(admin)
        .select("id", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("sent_at", since24h),
    ])

  if (eventsRes.error) throw new Error(eventsRes.error.message)

  const sentCount = sentRes.count ?? 0
  const deliveredCount = deliveredRes.count ?? 0
  const deliveryConfirmationRate = sentCount > 0 ? Math.round((deliveredCount / sentCount) * 1000) / 10 : 0

  const recentEvents = (eventsRes.data ?? []).map((row) => mapEvent(row as EventRow))

  return {
    qa_marker: GROWTH_PROVIDER_WEBHOOK_INGESTION_QA_MARKER,
    received24h: receivedRes.count ?? 0,
    processed24h: processedRes.count ?? 0,
    failed24h: failedRes.count ?? 0,
    signatureFailures24h: signatureRes.count ?? 0,
    deliveryConfirmationRate,
    lastProviderEventAt: recentEvents[0]?.occurredAt ?? null,
    events: recentEvents,
    endpoints,
  }
}
