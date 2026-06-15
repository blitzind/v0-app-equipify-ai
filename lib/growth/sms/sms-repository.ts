import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_SMS_PLATFORM_SETTINGS_ID } from "@/lib/growth/sms/schema-health"
import type {
  GrowthSmsConversation,
  GrowthSmsDeliveryAttempt,
  GrowthSmsDeliveryStatus,
  GrowthSmsMessage,
  GrowthSmsProviderEvent,
  GrowthSmsProviderEventProcessingStatus,
  GrowthSmsProviderEventType,
  GrowthSmsProviderKind,
  GrowthSmsWorkspaceSettings,
} from "@/lib/growth/sms/sms-types"

type Row = Record<string, unknown>

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function settingsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sms_workspace_settings")
}

function conversationsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sms_conversations")
}

function messagesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sms_messages")
}

function attemptsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sms_delivery_attempts")
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sms_provider_events")
}

function mapSettings(row: Row): GrowthSmsWorkspaceSettings {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id) || null,
    providerKind: asString(row.provider_kind) as GrowthSmsWorkspaceSettings["providerKind"],
    fromE164: asString(row.from_e164),
    messagingServiceSid: asString(row.messaging_service_sid) || null,
    status: asString(row.status) === "inactive" ? "inactive" : "active",
    metadata: asObject(row.metadata),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

function mapConversation(row: Row): GrowthSmsConversation {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id) || null,
    leadId: asString(row.lead_id),
    participantE164: asString(row.participant_e164),
    fromE164: asString(row.from_e164),
    inboxThreadId: asString(row.inbox_thread_id) || null,
    status: asString(row.status) as GrowthSmsConversation["status"],
    messageCount: Number(row.message_count ?? 0),
    lastMessageAt: asString(row.last_message_at) || null,
    lastMessagePreview: asString(row.last_message_preview),
    metadata: asObject(row.metadata),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

function mapMessage(row: Row): GrowthSmsMessage {
  return {
    id: asString(row.id),
    conversationId: asString(row.conversation_id),
    direction: asString(row.direction) as GrowthSmsMessage["direction"],
    body: asString(row.body),
    fromE164: asString(row.from_e164),
    toE164: asString(row.to_e164),
    provider: asString(row.provider) as GrowthSmsProviderKind,
    providerMessageId: asString(row.provider_message_id) || null,
    status: asString(row.status) as GrowthSmsMessage["status"],
    deliveryAttemptId: asString(row.delivery_attempt_id) || null,
    messageTimestamp: asString(row.message_timestamp),
    metadata: asObject(row.metadata),
    createdAt: asString(row.created_at),
  }
}

function mapAttempt(row: Row): GrowthSmsDeliveryAttempt {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id) || null,
    leadId: asString(row.lead_id) || null,
    conversationId: asString(row.conversation_id) || null,
    provider: asString(row.provider) as GrowthSmsProviderKind,
    fromE164: asString(row.from_e164),
    toE164: asString(row.to_e164),
    body: asString(row.body),
    status: asString(row.status) as GrowthSmsDeliveryStatus,
    providerMessageId: asString(row.provider_message_id) || null,
    idempotencyKey: asString(row.idempotency_key),
    failureReason: asString(row.failure_reason) || null,
    queuedAt: asString(row.queued_at),
    sentAt: asString(row.sent_at) || null,
    deliveredAt: asString(row.delivered_at) || null,
    failedAt: asString(row.failed_at) || null,
    metadata: asObject(row.metadata),
    createdAt: asString(row.created_at),
  }
}

function mapEvent(row: Row): GrowthSmsProviderEvent {
  return {
    id: asString(row.id),
    provider: asString(row.provider) as GrowthSmsProviderKind,
    eventType: asString(row.event_type) as GrowthSmsProviderEventType,
    providerMessageId: asString(row.provider_message_id) || null,
    deliveryAttemptId: asString(row.delivery_attempt_id) || null,
    conversationId: asString(row.conversation_id) || null,
    messageId: asString(row.message_id) || null,
    payloadHash: asString(row.payload_hash),
    rawPayload: asObject(row.raw_payload),
    normalizedPayload: asObject(row.normalized_payload),
    processingStatus: asString(row.processing_status) as GrowthSmsProviderEventProcessingStatus,
    receivedAt: asString(row.received_at),
    processedAt: asString(row.processed_at) || null,
  }
}

export function hashSmsProviderPayload(provider: string, payload: Record<string, unknown>): string {
  return createHash("sha256").update(`${provider}:${JSON.stringify(payload)}`).digest("hex")
}

export async function fetchGrowthSmsWorkspaceSettings(
  admin: SupabaseClient,
): Promise<GrowthSmsWorkspaceSettings | null> {
  const { data, error } = await settingsTable(admin)
    .select("*")
    .eq("id", GROWTH_SMS_PLATFORM_SETTINGS_ID)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapSettings(data as Row) : null
}

export async function getSmsConversationById(
  admin: SupabaseClient,
  conversationId: string,
): Promise<GrowthSmsConversation | null> {
  const { data, error } = await conversationsTable(admin).select("*").eq("id", conversationId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapConversation(data as Row) : null
}

export async function findSmsConversationByLeadAndParticipant(
  admin: SupabaseClient,
  input: { leadId: string; participantE164: string },
): Promise<GrowthSmsConversation | null> {
  const { data, error } = await conversationsTable(admin)
    .select("*")
    .eq("lead_id", input.leadId)
    .eq("participant_e164", input.participantE164)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapConversation(data as Row) : null
}

export async function createSmsConversation(
  admin: SupabaseClient,
  input: {
    organizationId?: string | null
    leadId: string
    participantE164: string
    fromE164: string
    inboxThreadId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<GrowthSmsConversation> {
  const now = new Date().toISOString()
  const { data, error } = await conversationsTable(admin)
    .insert({
      organization_id: input.organizationId ?? null,
      lead_id: input.leadId,
      participant_e164: input.participantE164,
      from_e164: input.fromE164,
      inbox_thread_id: input.inboxThreadId ?? null,
      status: "open",
      message_count: 0,
      last_message_preview: "",
      metadata: input.metadata ?? {},
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapConversation(data as Row)
}

export async function updateSmsConversationActivity(
  admin: SupabaseClient,
  conversationId: string,
  input: { bodyPreview: string; messageTimestamp: string; incrementCount?: number },
): Promise<void> {
  const conversation = await getSmsConversationById(admin, conversationId)
  if (!conversation) return

  const { error } = await conversationsTable(admin)
    .update({
      message_count: conversation.messageCount + (input.incrementCount ?? 1),
      last_message_at: input.messageTimestamp,
      last_message_preview: input.bodyPreview.slice(0, 280),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
  if (error) throw new Error(error.message)
}

export async function linkSmsConversationInboxThread(
  admin: SupabaseClient,
  conversationId: string,
  inboxThreadId: string,
): Promise<void> {
  const { error } = await conversationsTable(admin)
    .update({ inbox_thread_id: inboxThreadId, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
  if (error) throw new Error(error.message)
}

export async function findUnlinkedSmsInboxThreadForLead(
  admin: SupabaseClient,
  input: { leadId: string; subject: string },
): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("inbox_threads")
    .select("id")
    .eq("lead_id", input.leadId)
    .eq("provider_family", "twilio_sms")
    .eq("subject", input.subject)
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const threadId = asString((row as Row).id)
    if (!threadId) continue

    const { data: linked, error: linkedError } = await conversationsTable(admin)
      .select("id")
      .eq("inbox_thread_id", threadId)
      .maybeSingle()
    if (linkedError) throw new Error(linkedError.message)
    if (!linked) return threadId
  }

  return null
}

export async function insertSmsMessage(
  admin: SupabaseClient,
  input: {
    conversationId: string
    direction: GrowthSmsMessage["direction"]
    body: string
    fromE164: string
    toE164: string
    provider: GrowthSmsProviderKind
    providerMessageId?: string | null
    status: GrowthSmsMessage["status"]
    deliveryAttemptId?: string | null
    messageTimestamp?: string
    metadata?: Record<string, unknown>
  },
): Promise<GrowthSmsMessage> {
  const now = input.messageTimestamp ?? new Date().toISOString()
  const { data, error } = await messagesTable(admin)
    .insert({
      conversation_id: input.conversationId,
      direction: input.direction,
      body: input.body,
      from_e164: input.fromE164,
      to_e164: input.toE164,
      provider: input.provider,
      provider_message_id: input.providerMessageId ?? null,
      status: input.status,
      delivery_attempt_id: input.deliveryAttemptId ?? null,
      message_timestamp: now,
      metadata: input.metadata ?? {},
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapMessage(data as Row)
}

export async function findSmsMessageByProviderId(
  admin: SupabaseClient,
  input: { provider: GrowthSmsProviderKind; providerMessageId: string },
): Promise<GrowthSmsMessage | null> {
  const { data, error } = await messagesTable(admin)
    .select("*")
    .eq("provider", input.provider)
    .eq("provider_message_id", input.providerMessageId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapMessage(data as Row) : null
}

export async function listSmsMessagesForConversation(
  admin: SupabaseClient,
  conversationId: string,
): Promise<GrowthSmsMessage[]> {
  const { data, error } = await messagesTable(admin)
    .select("*")
    .eq("conversation_id", conversationId)
    .order("message_timestamp", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapMessage(row as Row))
}

export async function createSmsDeliveryAttempt(
  admin: SupabaseClient,
  input: {
    organizationId?: string | null
    leadId?: string | null
    conversationId?: string | null
    provider: GrowthSmsProviderKind
    fromE164: string
    toE164: string
    body: string
    idempotencyKey: string
    sequenceEnrollmentId?: string | null
    sequenceEnrollmentStepId?: string | null
    sequenceExecutionJobId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<GrowthSmsDeliveryAttempt> {
  const now = new Date().toISOString()
  const { data, error } = await attemptsTable(admin)
    .insert({
      organization_id: input.organizationId ?? null,
      lead_id: input.leadId ?? null,
      conversation_id: input.conversationId ?? null,
      provider: input.provider,
      from_e164: input.fromE164,
      to_e164: input.toE164,
      body: input.body,
      status: "queued",
      idempotency_key: input.idempotencyKey,
      queued_at: now,
      sequence_enrollment_id: input.sequenceEnrollmentId ?? null,
      sequence_enrollment_step_id: input.sequenceEnrollmentStepId ?? null,
      sequence_execution_job_id: input.sequenceExecutionJobId ?? null,
      metadata: input.metadata ?? {},
      created_at: now,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapAttempt(data as Row)
}

export async function getSmsDeliveryAttemptByIdempotencyKey(
  admin: SupabaseClient,
  idempotencyKey: string,
): Promise<GrowthSmsDeliveryAttempt | null> {
  const { data, error } = await attemptsTable(admin)
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapAttempt(data as Row) : null
}

export async function findSmsDeliveryAttemptByProviderMessageId(
  admin: SupabaseClient,
  providerMessageId: string,
): Promise<GrowthSmsDeliveryAttempt | null> {
  const { data, error } = await attemptsTable(admin)
    .select("*")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapAttempt(data as Row) : null
}

export async function updateSmsDeliveryAttempt(
  admin: SupabaseClient,
  attemptId: string,
  updates: Partial<{
    status: GrowthSmsDeliveryStatus
    providerMessageId: string | null
    failureReason: string | null
    sentAt: string | null
    deliveredAt: string | null
    failedAt: string | null
    conversationId: string | null
    metadata: Record<string, unknown>
  }>,
): Promise<GrowthSmsDeliveryAttempt> {
  const row: Record<string, unknown> = {}
  if (updates.status) row.status = updates.status
  if (updates.providerMessageId !== undefined) row.provider_message_id = updates.providerMessageId
  if (updates.failureReason !== undefined) row.failure_reason = updates.failureReason
  if (updates.sentAt !== undefined) row.sent_at = updates.sentAt
  if (updates.deliveredAt !== undefined) row.delivered_at = updates.deliveredAt
  if (updates.failedAt !== undefined) row.failed_at = updates.failedAt
  if (updates.conversationId !== undefined) row.conversation_id = updates.conversationId
  if (updates.metadata) row.metadata = updates.metadata

  const { data, error } = await attemptsTable(admin).update(row).eq("id", attemptId).select("*").single()
  if (error) throw new Error(error.message)
  return mapAttempt(data as Row)
}

export async function insertSmsProviderEvent(
  admin: SupabaseClient,
  input: {
    provider: GrowthSmsProviderKind
    eventType: GrowthSmsProviderEventType
    providerMessageId?: string | null
    payloadHash: string
    rawPayload: Record<string, unknown>
    normalizedPayload: Record<string, unknown>
    processingStatus?: GrowthSmsProviderEventProcessingStatus
  },
): Promise<{ event: GrowthSmsProviderEvent; duplicate: boolean }> {
  const { data: existing } = await eventsTable(admin)
    .select("*")
    .eq("provider", input.provider)
    .eq("payload_hash", input.payloadHash)
    .maybeSingle()

  if (existing) {
    return { event: mapEvent(existing as Row), duplicate: true }
  }

  const { data, error } = await eventsTable(admin)
    .insert({
      provider: input.provider,
      event_type: input.eventType,
      provider_message_id: input.providerMessageId ?? null,
      payload_hash: input.payloadHash,
      raw_payload: input.rawPayload,
      normalized_payload: input.normalizedPayload,
      processing_status: input.processingStatus ?? "received",
      received_at: new Date().toISOString(),
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return { event: mapEvent(data as Row), duplicate: false }
}

export async function finalizeSmsProviderEvent(
  admin: SupabaseClient,
  eventId: string,
  input: {
    processingStatus: GrowthSmsProviderEventProcessingStatus
    deliveryAttemptId?: string | null
    conversationId?: string | null
    messageId?: string | null
  },
): Promise<void> {
  const { error } = await eventsTable(admin)
    .update({
      processing_status: input.processingStatus,
      delivery_attempt_id: input.deliveryAttemptId ?? null,
      conversation_id: input.conversationId ?? null,
      message_id: input.messageId ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventId)
  if (error) throw new Error(error.message)
}

export async function findLeadByPhone(
  admin: SupabaseClient,
  participantE164: string,
): Promise<{ id: string; organizationId: string | null; contactPhone: string | null } | null> {
  const { normalizeToE164, phoneLookupKeys } = await import("@/lib/growth/sms/phone-normalization")
  const normalized = normalizeToE164(participantE164)
  if (!normalized) return null

  const keys = phoneLookupKeys(normalized)
  for (const key of keys) {
    const { data } = await admin
      .schema("growth")
      .from("leads")
      .select("id, promoted_organization_id, contact_phone")
      .eq("contact_phone", key)
      .limit(1)
      .maybeSingle()
    if (data) {
      const row = data as Row
      return {
        id: asString(row.id),
        organizationId: asString(row.promoted_organization_id) || null,
        contactPhone: asString(row.contact_phone) || null,
      }
    }
  }

  const { data: ilikeData } = await admin
    .schema("growth")
    .from("leads")
    .select("id, promoted_organization_id, contact_phone")
    .ilike("contact_phone", `%${normalized.slice(-10)}%`)
    .limit(1)
    .maybeSingle()

  if (!ilikeData) return null
  const row = ilikeData as Row
  return {
    id: asString(row.id),
    organizationId: asString(row.promoted_organization_id) || null,
    contactPhone: asString(row.contact_phone) || null,
  }
}
