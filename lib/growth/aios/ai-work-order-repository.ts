/** GE-AIOS-2A — AI Work Order persistence (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  AI_WORK_ORDER_AGENTS,
  AI_WORK_ORDER_STATUSES,
  AI_WORK_ORDER_TYPES,
  GROWTH_AI_WORK_ORDER_QA_MARKER,
  clampAiWorkOrderPriority,
  isAiWorkOrderAgent,
  isAiWorkOrderStatus,
  isAiWorkOrderType,
  type AiWorkOrder,
  type AiWorkOrderCreateInput,
  type AiWorkOrderEvent,
  type AiWorkOrderEventSeverity,
  type AiWorkOrderListFilter,
  type AiWorkOrderMemoryRef,
  type AiWorkOrderStatus,
} from "@/lib/growth/aios/ai-work-order-types"

type WorkOrderRow = {
  id: string
  organization_id: string
  mission_id: string
  owner_agent: string
  assigned_agent: string
  work_order_type: string
  entity_type: string | null
  entity_id: string | null
  priority: number
  status: string
  decision_record_ids: string[] | null
  memory_refs: unknown
  payload: Record<string, unknown> | null
  depends_on: string[] | null
  retry_count: number
  max_retries: number
  timeout_at: string | null
  execution_window_start: string | null
  execution_window_end: string | null
  approval_id: string | null
  checkpoint: Record<string, unknown> | null
  requested_by: string | null
  result: Record<string, unknown> | null
  failure_reason: string | null
  audit_metadata: Record<string, unknown> | null
  issued_at: string
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  archived_at: string | null
  qa_marker: string
  created_at: string
  updated_at: string
}

type EventRow = {
  id: string
  work_order_id: string
  organization_id: string
  event_type: string
  from_status: string | null
  to_status: string | null
  severity: string
  title: string
  description: string
  metadata: Record<string, unknown> | null
  created_at: string
}

function workOrdersTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_work_orders")
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_work_order_events")
}

function normalizeAgent(value: unknown, fallback: AiWorkOrder["ownerAgent"] = "research"): AiWorkOrder["ownerAgent"] {
  return isAiWorkOrderAgent(value) ? value : fallback
}

function normalizeWorkOrderType(value: unknown): AiWorkOrder["workOrderType"] {
  return isAiWorkOrderType(value) ? value : "custom"
}

function normalizeStatus(value: unknown): AiWorkOrderStatus {
  return isAiWorkOrderStatus(value) ? value : "issued"
}

function normalizeMemoryRefs(value: unknown): AiWorkOrderMemoryRef[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const ref = row as Record<string, unknown>
      return {
        memoryType: String(ref.memoryType ?? ref.memory_type ?? ""),
        memoryId: String(ref.memoryId ?? ref.memory_id ?? ""),
        snapshotAt: ref.snapshotAt ? String(ref.snapshotAt) : ref.snapshot_at ? String(ref.snapshot_at) : null,
      }
    })
    .filter((row) => row.memoryType.length > 0 && row.memoryId.length > 0)
}

function mapWorkOrder(row: WorkOrderRow): AiWorkOrder {
  return {
    id: row.id,
    organizationId: row.organization_id,
    missionId: row.mission_id,
    ownerAgent: normalizeAgent(row.owner_agent),
    assignedAgent: normalizeAgent(row.assigned_agent),
    workOrderType: normalizeWorkOrderType(row.work_order_type),
    entityType: row.entity_type,
    entityId: row.entity_id,
    priority: clampAiWorkOrderPriority(row.priority),
    status: normalizeStatus(row.status),
    decisionRecordIds: Array.isArray(row.decision_record_ids) ? row.decision_record_ids.map(String) : [],
    memoryRefs: normalizeMemoryRefs(row.memory_refs),
    payload: row.payload ?? {},
    dependsOn: Array.isArray(row.depends_on) ? row.depends_on.map(String) : [],
    retryCount: row.retry_count ?? 0,
    maxRetries: row.max_retries ?? 3,
    timeoutAt: row.timeout_at,
    executionWindowStart: row.execution_window_start,
    executionWindowEnd: row.execution_window_end,
    approvalId: row.approval_id,
    checkpoint: row.checkpoint ?? null,
    requestedBy: row.requested_by,
    result: row.result ?? null,
    failureReason: row.failure_reason,
    auditMetadata: row.audit_metadata ?? {},
    issuedAt: row.issued_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    archivedAt: row.archived_at,
    qaMarker: row.qa_marker,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapEvent(row: EventRow): AiWorkOrderEvent {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    organizationId: row.organization_id,
    eventType: row.event_type,
    fromStatus: row.from_status ? normalizeStatus(row.from_status) : null,
    toStatus: row.to_status ? normalizeStatus(row.to_status) : null,
    severity: (row.severity as AiWorkOrderEventSeverity) ?? "info",
    title: row.title,
    description: row.description,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }
}

export async function insertAiWorkOrder(
  admin: SupabaseClient,
  input: AiWorkOrderCreateInput,
): Promise<AiWorkOrder> {
  const assignedAgent = input.assignedAgent ?? input.ownerAgent
  if (!isAiWorkOrderAgent(input.ownerAgent) || !isAiWorkOrderAgent(assignedAgent)) {
    throw new Error("ai_work_order_invalid_agent")
  }
  if (!isAiWorkOrderType(input.workOrderType)) {
    throw new Error("ai_work_order_invalid_type")
  }

  const row = {
    organization_id: input.organizationId,
    mission_id: input.missionId,
    owner_agent: input.ownerAgent,
    assigned_agent: assignedAgent,
    work_order_type: input.workOrderType,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    priority: clampAiWorkOrderPriority(input.priority ?? 500),
    status: "issued" satisfies AiWorkOrderStatus,
    decision_record_ids: input.decisionRecordIds ?? [],
    memory_refs: input.memoryRefs ?? [],
    payload: input.payload ?? {},
    depends_on: input.dependsOn ?? [],
    max_retries: input.maxRetries ?? 3,
    timeout_at: input.timeoutAt ?? null,
    execution_window_start: input.executionWindowStart ?? null,
    execution_window_end: input.executionWindowEnd ?? null,
    requested_by: input.requestedBy ?? null,
    audit_metadata: input.auditMetadata ?? {},
    qa_marker: GROWTH_AI_WORK_ORDER_QA_MARKER,
  }

  const { data, error } = await workOrdersTable(admin).insert(row).select("*").single()
  if (error) throw new Error(error.message)
  return mapWorkOrder(data as WorkOrderRow)
}

export async function fetchAiWorkOrderById(
  admin: SupabaseClient,
  input: { organizationId: string; workOrderId: string },
): Promise<AiWorkOrder | null> {
  const { data, error } = await workOrdersTable(admin)
    .select("*")
    .eq("id", input.workOrderId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapWorkOrder(data as WorkOrderRow) : null
}

export async function listAiWorkOrders(
  admin: SupabaseClient,
  filter: AiWorkOrderListFilter,
): Promise<AiWorkOrder[]> {
  let query = workOrdersTable(admin).select("*").eq("organization_id", filter.organizationId)

  if (filter.missionId) query = query.eq("mission_id", filter.missionId)
  if (filter.ownerAgent) query = query.eq("owner_agent", filter.ownerAgent)
  if (filter.workOrderType) query = query.eq("work_order_type", filter.workOrderType)
  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
    query = query.in("status", statuses)
  }
  if (filter.includeArchived !== true) {
    query = query.is("archived_at", null)
  }

  query = query.order("priority", { ascending: false }).order("created_at", { ascending: false })
  if (filter.limit) query = query.limit(filter.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapWorkOrder(row as WorkOrderRow))
}

export async function updateAiWorkOrderRow(
  admin: SupabaseClient,
  input: {
    organizationId: string
    workOrderId: string
    patch: Record<string, unknown>
  },
): Promise<AiWorkOrder> {
  const { data, error } = await workOrdersTable(admin)
    .update(input.patch)
    .eq("id", input.workOrderId)
    .eq("organization_id", input.organizationId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapWorkOrder(data as WorkOrderRow)
}

export async function insertAiWorkOrderEvent(
  admin: SupabaseClient,
  input: {
    workOrderId: string
    organizationId: string
    eventType: string
    fromStatus?: AiWorkOrderStatus | null
    toStatus?: AiWorkOrderStatus | null
    severity?: AiWorkOrderEventSeverity
    title?: string
    description?: string
    metadata?: Record<string, unknown>
  },
): Promise<AiWorkOrderEvent> {
  const row = {
    work_order_id: input.workOrderId,
    organization_id: input.organizationId,
    event_type: input.eventType,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    severity: input.severity ?? "info",
    title: input.title ?? "",
    description: input.description ?? "",
    metadata: input.metadata ?? {},
  }

  const { data, error } = await eventsTable(admin).insert(row).select("*").single()
  if (error) throw new Error(error.message)
  return mapEvent(data as EventRow)
}

export async function listAiWorkOrderEvents(
  admin: SupabaseClient,
  input: { organizationId: string; workOrderId: string; limit?: number },
): Promise<AiWorkOrderEvent[]> {
  let query = eventsTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("work_order_id", input.workOrderId)
    .order("created_at", { ascending: false })

  if (input.limit) query = query.limit(input.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapEvent(row as EventRow))
}

export function aiWorkOrderSchemaCatalog() {
  return {
    agents: [...AI_WORK_ORDER_AGENTS],
    statuses: [...AI_WORK_ORDER_STATUSES],
    types: [...AI_WORK_ORDER_TYPES],
    qaMarker: GROWTH_AI_WORK_ORDER_QA_MARKER,
  }
}
