import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthOutreachQueueEvent,
  GrowthOutreachQueueEventType,
  GrowthOutreachQueueItem,
  GrowthOutreachQueueItemWithLead,
  GrowthOutreachQueuePayloadSnapshot,
  GrowthOutreachQueuePriority,
  GrowthOutreachQueueStatus,
} from "@/lib/growth/outreach/outreach-queue-types"

type QueueRow = {
  id: string
  lead_id: string
  generation_id: string | null
  campaign_id: string | null
  channel: string
  status: string
  priority: string
  execution_confidence: number
  scheduled_for: string | null
  approved_at: string | null
  approved_by: string | null
  approval_note: string | null
  executed_at: string | null
  failed_at: string | null
  failure_reason: string | null
  provider_connection_id: string | null
  outbound_message_id: string | null
  payload_snapshot: Record<string, unknown> | null
  generation_version: number
  parent_queue_id: string | null
  created_by: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  created_at: string
  updated_at: string
}

type QueueEventRow = {
  id: string
  queue_id: string
  event_type: string
  actor_user_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

const QUEUE_SELECT =
  "id, lead_id, generation_id, campaign_id, channel, status, priority, execution_confidence, scheduled_for, approved_at, approved_by, approval_note, executed_at, failed_at, failure_reason, provider_connection_id, outbound_message_id, payload_snapshot, generation_version, parent_queue_id, created_by, cancelled_at, cancelled_by, created_at, updated_at"

function queueTable(admin: SupabaseClient) {
  return admin.schema("growth").from("outreach_queue")
}

function queueEventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("outreach_queue_events")
}

function mapQueueRow(row: QueueRow): GrowthOutreachQueueItem {
  return {
    id: row.id,
    leadId: row.lead_id,
    generationId: row.generation_id,
    campaignId: row.campaign_id,
    channel: row.channel as GrowthOutreachQueueItem["channel"],
    status: row.status as GrowthOutreachQueueStatus,
    priority: row.priority as GrowthOutreachQueuePriority,
    executionConfidence: row.execution_confidence,
    scheduledFor: row.scheduled_for,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    approvalNote: row.approval_note,
    executedAt: row.executed_at,
    failedAt: row.failed_at,
    failureReason: row.failure_reason,
    providerConnectionId: row.provider_connection_id,
    outboundMessageId: row.outbound_message_id,
    payloadSnapshot: (row.payload_snapshot ?? {}) as GrowthOutreachQueuePayloadSnapshot,
    generationVersion: row.generation_version,
    parentQueueId: row.parent_queue_id,
    createdBy: row.created_by,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapEventRow(row: QueueEventRow): GrowthOutreachQueueEvent {
  return {
    id: row.id,
    queueId: row.queue_id,
    eventType: row.event_type as GrowthOutreachQueueEventType,
    actorUserId: row.actor_user_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }
}

export async function insertGrowthOutreachQueueItem(
  admin: SupabaseClient,
  input: {
    leadId: string
    generationId?: string | null
    campaignId?: string | null
    channel: GrowthOutreachQueueItem["channel"]
    status?: GrowthOutreachQueueStatus
    priority: GrowthOutreachQueuePriority
    executionConfidence: number
    scheduledFor?: string | null
    providerConnectionId?: string | null
    payloadSnapshot: GrowthOutreachQueuePayloadSnapshot
    generationVersion?: number
    parentQueueId?: string | null
    createdBy?: string | null
  },
): Promise<GrowthOutreachQueueItem> {
  const { data, error } = await queueTable(admin)
    .insert({
      lead_id: input.leadId,
      generation_id: input.generationId ?? null,
      campaign_id: input.campaignId ?? null,
      channel: input.channel,
      status: input.status ?? "pending_approval",
      priority: input.priority,
      execution_confidence: input.executionConfidence,
      scheduled_for: input.scheduledFor ?? null,
      provider_connection_id: input.providerConnectionId ?? null,
      payload_snapshot: input.payloadSnapshot,
      generation_version: input.generationVersion ?? 1,
      parent_queue_id: input.parentQueueId ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(QUEUE_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapQueueRow(data as QueueRow)
}

export async function fetchGrowthOutreachQueueItem(
  admin: SupabaseClient,
  queueId: string,
): Promise<GrowthOutreachQueueItem | null> {
  const { data, error } = await queueTable(admin).select(QUEUE_SELECT).eq("id", queueId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapQueueRow(data as QueueRow) : null
}

export async function updateGrowthOutreachQueueItem(
  admin: SupabaseClient,
  queueId: string,
  patch: Partial<{
    status: GrowthOutreachQueueStatus
    priority: GrowthOutreachQueuePriority
    executionConfidence: number
    scheduledFor: string | null
    approvedAt: string | null
    approvedBy: string | null
    approvalNote: string | null
    executedAt: string | null
    failedAt: string | null
    failureReason: string | null
    providerConnectionId: string | null
    outboundMessageId: string | null
    payloadSnapshot: GrowthOutreachQueuePayloadSnapshot
    cancelledAt: string | null
    cancelledBy: string | null
  }>,
): Promise<GrowthOutreachQueueItem> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status !== undefined) row.status = patch.status
  if (patch.priority !== undefined) row.priority = patch.priority
  if (patch.executionConfidence !== undefined) row.execution_confidence = patch.executionConfidence
  if (patch.scheduledFor !== undefined) row.scheduled_for = patch.scheduledFor
  if (patch.approvedAt !== undefined) row.approved_at = patch.approvedAt
  if (patch.approvedBy !== undefined) row.approved_by = patch.approvedBy
  if (patch.approvalNote !== undefined) row.approval_note = patch.approvalNote
  if (patch.executedAt !== undefined) row.executed_at = patch.executedAt
  if (patch.failedAt !== undefined) row.failed_at = patch.failedAt
  if (patch.failureReason !== undefined) row.failure_reason = patch.failureReason
  if (patch.providerConnectionId !== undefined) row.provider_connection_id = patch.providerConnectionId
  if (patch.outboundMessageId !== undefined) row.outbound_message_id = patch.outboundMessageId
  if (patch.payloadSnapshot !== undefined) row.payload_snapshot = patch.payloadSnapshot
  if (patch.cancelledAt !== undefined) row.cancelled_at = patch.cancelledAt
  if (patch.cancelledBy !== undefined) row.cancelled_by = patch.cancelledBy

  const { data, error } = await queueTable(admin).update(row).eq("id", queueId).select(QUEUE_SELECT).single()
  if (error) throw new Error(error.message)
  return mapQueueRow(data as QueueRow)
}

export async function listGrowthOutreachQueueItems(
  admin: SupabaseClient,
  input: {
    status?: GrowthOutreachQueueStatus | GrowthOutreachQueueStatus[]
    leadId?: string
    generationId?: string
    limit?: number
  } = {},
): Promise<GrowthOutreachQueueItem[]> {
  let query = queueTable(admin).select(QUEUE_SELECT).order("created_at", { ascending: false })
  if (input.leadId) query = query.eq("lead_id", input.leadId)
  if (input.generationId) query = query.eq("generation_id", input.generationId)
  if (input.status) {
    const statuses = Array.isArray(input.status) ? input.status : [input.status]
    query = query.in("status", statuses)
  }
  query = query.limit(input.limit ?? 100)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as QueueRow[]).map(mapQueueRow)
}

export async function listGrowthOutreachQueueItemsWithLead(
  admin: SupabaseClient,
  input: {
    statuses?: GrowthOutreachQueueStatus[]
    channel?: string
    owner?: string
    sourceVendor?: string
    priorityTier?: string
    limit?: number
  } = {},
): Promise<GrowthOutreachQueueItemWithLead[]> {
  let query = admin
    .schema("growth")
    .from("outreach_queue")
    .select(
      `${QUEUE_SELECT}, leads!inner(company_name, executive_owner, call_priority_tier, executive_priority_tier, source_vendor)`,
    )
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 200)

  if (input.statuses?.length) query = query.in("status", input.statuses)
  if (input.channel) query = query.eq("channel", input.channel)
  if (input.owner) query = query.eq("leads.executive_owner", input.owner)
  if (input.sourceVendor) query = query.eq("leads.source_vendor", input.sourceVendor)
  if (input.priorityTier) query = query.eq("leads.call_priority_tier", input.priorityTier)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return ((data ?? []) as Array<QueueRow & { leads: Record<string, unknown> }>).map((row) => ({
    ...mapQueueRow(row),
    companyName: String(row.leads.company_name ?? "—"),
    executiveOwner: (row.leads.executive_owner as string | null) ?? null,
    callPriorityTier: (row.leads.call_priority_tier as string | null) ?? null,
    executivePriorityTier: (row.leads.executive_priority_tier as string | null) ?? null,
    sourceVendor: (row.leads.source_vendor as string | null) ?? null,
  }))
}

export async function listDueScheduledOutreachQueueItems(
  admin: SupabaseClient,
  limit = 25,
): Promise<GrowthOutreachQueueItem[]> {
  const now = new Date().toISOString()
  const { data, error } = await queueTable(admin)
    .select(QUEUE_SELECT)
    .eq("status", "scheduled")
    .not("approved_at", "is", null)
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as QueueRow[]).map(mapQueueRow)
}

export async function insertGrowthOutreachQueueEvent(
  admin: SupabaseClient,
  input: {
    queueId: string
    eventType: GrowthOutreachQueueEventType
    actorUserId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<GrowthOutreachQueueEvent> {
  const { data, error } = await queueEventsTable(admin)
    .insert({
      queue_id: input.queueId,
      event_type: input.eventType,
      actor_user_id: input.actorUserId ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id, queue_id, event_type, actor_user_id, metadata, created_at")
    .single()
  if (error) throw new Error(error.message)
  return mapEventRow(data as QueueEventRow)
}

export async function listGrowthOutreachQueueEvents(
  admin: SupabaseClient,
  queueId: string,
): Promise<GrowthOutreachQueueEvent[]> {
  const { data, error } = await queueEventsTable(admin)
    .select("id, queue_id, event_type, actor_user_id, metadata, created_at")
    .eq("queue_id", queueId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as QueueEventRow[]).map(mapEventRow)
}

export async function listGrowthOutreachQueueItemsSince(
  admin: SupabaseClient,
  sinceIso: string,
  limit = 500,
): Promise<GrowthOutreachQueueItem[]> {
  const { data, error } = await queueTable(admin)
    .select(QUEUE_SELECT)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as QueueRow[]).map(mapQueueRow)
}
