/** GE-AIOS-2B — AI OS Event persistence (server-only, insert-only events). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  AI_EVENT_CATEGORIES,
  AI_EVENT_DELIVERY_STATUSES,
  AI_EVENT_LIFECYCLES,
  GROWTH_AI_EVENT_QA_MARKER,
  clampAiEventPriority,
  isAiEventCategory,
  type AiEventCategory,
  type AiEventDeliveryStatus,
  type AiEventLifecycle,
  type AiOsEvent,
  type AiOsEventDelivery,
  type AiOsEventListFilter,
  type AiOsEventPublishInput,
  type AiOsEventReplayFilter,
  type AiOsEventSubscription,
  type AiOsEventSubscriptionInput,
} from "@/lib/growth/aios/ai-event-types"
import { isAiWorkOrderAgent, type AiWorkOrderAgent } from "@/lib/growth/aios/ai-work-order-types"

type EventRow = {
  id: string
  event_type: string
  event_version: number
  schema_version: string
  category: string
  organization_id: string
  mission_id: string | null
  work_order_id: string | null
  agent_owner: string | null
  entity_type: string | null
  entity_id: string | null
  correlation_id: string
  causation_id: string | null
  priority: number
  producer: string
  source: string
  payload: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  audit_metadata: Record<string, unknown> | null
  lifecycle: string
  replayable: boolean
  replay_key: string | null
  occurred_at: string
  created_at: string
  qa_marker: string
}

type SubscriptionRow = {
  id: string
  organization_id: string
  subscriber_id: string
  subscriber_kind: string
  categories: string[] | null
  event_type_prefixes: string[] | null
  enabled: boolean
  metadata: Record<string, unknown> | null
  qa_marker: string
  created_at: string
  updated_at: string
}

type DeliveryRow = {
  id: string
  event_id: string
  organization_id: string
  subscription_id: string
  subscriber_id: string
  status: string
  consumed_at: string | null
  archived_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_os_events")
}

function subscriptionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_os_event_subscriptions")
}

function deliveriesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_os_event_deliveries")
}

function archiveTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_os_event_archive_records")
}

function normalizeAgent(value: unknown): AiWorkOrderAgent | null {
  return isAiWorkOrderAgent(value) ? value : null
}

function normalizeCategory(value: unknown): AiEventCategory {
  return isAiEventCategory(value) ? value : "system"
}

function normalizeLifecycle(value: unknown): AiEventLifecycle {
  if (typeof value === "string" && (AI_EVENT_LIFECYCLES as readonly string[]).includes(value)) {
    return value as AiEventLifecycle
  }
  return "published"
}

function normalizeDeliveryStatus(value: unknown): AiEventDeliveryStatus {
  if (typeof value === "string" && (AI_EVENT_DELIVERY_STATUSES as readonly string[]).includes(value)) {
    return value as AiEventDeliveryStatus
  }
  return "pending"
}

function mapEvent(row: EventRow): AiOsEvent {
  return {
    id: row.id,
    eventType: row.event_type,
    eventVersion: row.event_version,
    schemaVersion: row.schema_version,
    category: normalizeCategory(row.category),
    organizationId: row.organization_id,
    missionId: row.mission_id,
    workOrderId: row.work_order_id,
    agentOwner: normalizeAgent(row.agent_owner),
    entityType: row.entity_type,
    entityId: row.entity_id,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    priority: clampAiEventPriority(row.priority),
    producer: row.producer,
    source: row.source,
    payload: row.payload ?? {},
    metadata: row.metadata ?? {},
    auditMetadata: row.audit_metadata ?? {},
    lifecycle: normalizeLifecycle(row.lifecycle),
    replayable: row.replayable !== false,
    replayKey: row.replay_key,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    qaMarker: row.qa_marker,
  }
}

function mapSubscription(row: SubscriptionRow): AiOsEventSubscription {
  const categories = (row.categories ?? []).filter(isAiEventCategory)
  return {
    id: row.id,
    organizationId: row.organization_id,
    subscriberId: row.subscriber_id,
    subscriberKind: (row.subscriber_kind as AiOsEventSubscription["subscriberKind"]) ?? "internal",
    categories,
    eventTypePrefixes: row.event_type_prefixes ?? [],
    enabled: row.enabled !== false,
    metadata: row.metadata ?? {},
    qaMarker: row.qa_marker,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapDelivery(row: DeliveryRow): AiOsEventDelivery {
  return {
    id: row.id,
    eventId: row.event_id,
    organizationId: row.organization_id,
    subscriptionId: row.subscription_id,
    subscriberId: row.subscriber_id,
    status: normalizeDeliveryStatus(row.status),
    consumedAt: row.consumed_at,
    archivedAt: row.archived_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }
}

export async function insertAiOsEvent(
  admin: SupabaseClient,
  input: AiOsEventPublishInput & { correlationId: string; lifecycle?: AiEventLifecycle },
): Promise<AiOsEvent> {
  if (!isAiEventCategory(input.category)) {
    throw new Error("ai_event_invalid_category")
  }

  const row = {
    event_type: input.eventType,
    event_version: input.eventVersion ?? 1,
    schema_version: input.schemaVersion ?? "1.0",
    category: input.category,
    organization_id: input.organizationId,
    mission_id: input.missionId ?? null,
    work_order_id: input.workOrderId ?? null,
    agent_owner: input.agentOwner ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    correlation_id: input.correlationId,
    causation_id: input.causationId ?? null,
    priority: clampAiEventPriority(input.priority ?? 500),
    producer: input.producer,
    source: input.source,
    payload: input.payload ?? {},
    metadata: input.metadata ?? {},
    audit_metadata: input.auditMetadata ?? {},
    lifecycle: input.lifecycle ?? "published",
    replayable: input.replayable !== false,
    replay_key: input.replayKey ?? null,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    qa_marker: GROWTH_AI_EVENT_QA_MARKER,
  }

  const { data, error } = await eventsTable(admin).insert(row).select("*").single()
  if (error) throw new Error(error.message)
  return mapEvent(data as EventRow)
}

export async function fetchAiOsEventById(
  admin: SupabaseClient,
  input: { organizationId: string; eventId: string },
): Promise<AiOsEvent | null> {
  const { data, error } = await eventsTable(admin)
    .select("*")
    .eq("id", input.eventId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapEvent(data as EventRow) : null
}

export async function listAiOsEvents(
  admin: SupabaseClient,
  filter: AiOsEventListFilter,
): Promise<AiOsEvent[]> {
  let query = eventsTable(admin).select("*").eq("organization_id", filter.organizationId)

  if (filter.category) {
    const categories = Array.isArray(filter.category) ? filter.category : [filter.category]
    query = query.in("category", categories)
  }
  if (filter.eventType) query = query.eq("event_type", filter.eventType)
  if (filter.missionId) query = query.eq("mission_id", filter.missionId)
  if (filter.workOrderId) query = query.eq("work_order_id", filter.workOrderId)
  if (filter.correlationId) query = query.eq("correlation_id", filter.correlationId)

  query = query.order("occurred_at", { ascending: false })
  if (filter.limit) query = query.limit(filter.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapEvent(row as EventRow))
}

export async function replayAiOsEvents(
  admin: SupabaseClient,
  filter: AiOsEventReplayFilter,
): Promise<AiOsEvent[]> {
  let query = eventsTable(admin)
    .select("*")
    .eq("organization_id", filter.organizationId)
    .eq("replayable", true)

  if (filter.correlationId) query = query.eq("correlation_id", filter.correlationId)
  if (filter.missionId) query = query.eq("mission_id", filter.missionId)
  if (filter.workOrderId) query = query.eq("work_order_id", filter.workOrderId)
  if (filter.since) query = query.gte("occurred_at", filter.since)
  if (filter.until) query = query.lte("occurred_at", filter.until)

  query = query.order("occurred_at", { ascending: true })
  if (filter.limit) query = query.limit(filter.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapEvent(row as EventRow))
}

export async function upsertAiOsEventSubscription(
  admin: SupabaseClient,
  input: AiOsEventSubscriptionInput,
): Promise<AiOsEventSubscription> {
  const row = {
    organization_id: input.organizationId,
    subscriber_id: input.subscriberId,
    subscriber_kind: input.subscriberKind ?? "internal",
    categories: input.categories ?? [],
    event_type_prefixes: input.eventTypePrefixes ?? [],
    enabled: input.enabled !== false,
    metadata: input.metadata ?? {},
    qa_marker: GROWTH_AI_EVENT_QA_MARKER,
  }

  const { data, error } = await subscriptionsTable(admin)
    .upsert(row, { onConflict: "organization_id,subscriber_id" })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapSubscription(data as SubscriptionRow)
}

export async function listAiOsEventSubscriptions(
  admin: SupabaseClient,
  input: { organizationId: string; enabledOnly?: boolean },
): Promise<AiOsEventSubscription[]> {
  let query = subscriptionsTable(admin).select("*").eq("organization_id", input.organizationId)
  if (input.enabledOnly) query = query.eq("enabled", true)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapSubscription(row as SubscriptionRow))
}

export async function insertAiOsEventDeliveries(
  admin: SupabaseClient,
  rows: Array<{
    eventId: string
    organizationId: string
    subscriptionId: string
    subscriberId: string
  }>,
): Promise<AiOsEventDelivery[]> {
  if (rows.length === 0) return []

  const payload = rows.map((row) => ({
    event_id: row.eventId,
    organization_id: row.organizationId,
    subscription_id: row.subscriptionId,
    subscriber_id: row.subscriberId,
    status: "pending",
  }))

  const { data, error } = await deliveriesTable(admin).insert(payload).select("*")
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapDelivery(row as DeliveryRow))
}

export async function listPendingAiOsEventDeliveries(
  admin: SupabaseClient,
  input: { organizationId: string; subscriberId: string; limit?: number },
): Promise<AiOsEventDelivery[]> {
  let query = deliveriesTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("subscriber_id", input.subscriberId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })

  if (input.limit) query = query.limit(input.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapDelivery(row as DeliveryRow))
}

export async function markAiOsEventDeliveryConsumed(
  admin: SupabaseClient,
  input: { deliveryId: string; organizationId: string; metadata?: Record<string, unknown> },
): Promise<AiOsEventDelivery> {
  const { data, error } = await deliveriesTable(admin)
    .update({
      status: "consumed",
      consumed_at: new Date().toISOString(),
      metadata: input.metadata ?? {},
    })
    .eq("id", input.deliveryId)
    .eq("organization_id", input.organizationId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapDelivery(data as DeliveryRow)
}

export async function appendAiOsEventArchiveRecord(
  admin: SupabaseClient,
  input: {
    eventId: string
    organizationId: string
    reason?: string
    archivedBy?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await archiveTable(admin).insert({
    event_id: input.eventId,
    organization_id: input.organizationId,
    reason: input.reason ?? "",
    archived_by: input.archivedBy ?? null,
    metadata: input.metadata ?? {},
  })
  if (error) throw new Error(error.message)
}

export function aiEventSchemaCatalog() {
  return {
    categories: [...AI_EVENT_CATEGORIES],
    lifecycles: [...AI_EVENT_LIFECYCLES],
    deliveryStatuses: [...AI_EVENT_DELIVERY_STATUSES],
    qaMarker: GROWTH_AI_EVENT_QA_MARKER,
  }
}
