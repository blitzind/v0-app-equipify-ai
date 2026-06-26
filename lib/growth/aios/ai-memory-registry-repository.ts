/** GE-AIOS-2F — Memory Registry persistence (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  AI_MEMORY_REGISTRY_LIFECYCLE_EVENTS,
  AI_MEMORY_REGISTRY_LIFECYCLE_STATUSES,
  AI_MEMORY_REGISTRY_TYPES,
  AI_MEMORY_PRIVACY_SCOPES,
  AI_MEMORY_RETENTION_POLICIES,
  GROWTH_AI_MEMORY_REGISTRY_QA_MARKER,
  AI_MEMORY_REGISTRY_SCHEMA_VERSION,
  isAiMemoryOwnerAgent,
  isAiMemoryRegistryType,
  type AiMemoryRegistryAuditEvent,
  type AiMemoryRegistryEntry,
  type AiMemoryRegistryLifecycleEvent,
  type AiMemoryRegistryLifecycleStatus,
  type AiMemoryRegistryListFilter,
  type AiMemoryRegistryRegisterInput,
} from "@/lib/growth/aios/ai-memory-registry-types"
import type { AiWorkOrderAgent } from "@/lib/growth/aios/ai-work-order-types"

type RegistryRow = {
  id: string
  organization_id: string
  mission_id: string | null
  memory_type: string
  owner_agent: string
  entity_type: string | null
  entity_id: string | null
  source_system: string
  source_table: string
  source_record_id: string | null
  source_key: string | null
  label: string
  description: string
  lifecycle_status: string
  retention_policy: string
  privacy_scope: string
  schema_version: string
  audit_metadata: Record<string, unknown> | null
  qa_marker: string
  created_at: string
  updated_at: string
  referenced_at: string | null
  archived_at: string | null
}

type AuditRow = {
  id: string
  memory_registry_id: string
  organization_id: string
  event_type: string
  work_order_id: string | null
  decision_record_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

function registryTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_memory_registry")
}

function auditTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_memory_registry_events")
}

function normalizeLifecycleStatus(value: unknown): AiMemoryRegistryLifecycleStatus {
  if (typeof value === "string" && (AI_MEMORY_REGISTRY_LIFECYCLE_STATUSES as readonly string[]).includes(value)) {
    return value as AiMemoryRegistryLifecycleStatus
  }
  return "created"
}

function normalizeLifecycleEvent(value: unknown): AiMemoryRegistryLifecycleEvent {
  if (typeof value === "string" && (AI_MEMORY_REGISTRY_LIFECYCLE_EVENTS as readonly string[]).includes(value)) {
    return value as AiMemoryRegistryLifecycleEvent
  }
  return "created"
}

function mapRegistry(row: RegistryRow): AiMemoryRegistryEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    missionId: row.mission_id,
    memoryType: (isAiMemoryRegistryType(row.memory_type) ? row.memory_type : "research") as AiMemoryRegistryEntry["memoryType"],
    ownerAgent: (isAiMemoryOwnerAgent(row.owner_agent) ? row.owner_agent : "research") as AiWorkOrderAgent,
    entityType: row.entity_type,
    entityId: row.entity_id,
    sourceSystem: row.source_system,
    sourceTable: row.source_table,
    sourceRecordId: row.source_record_id,
    sourceKey: row.source_key,
    label: row.label ?? "",
    description: row.description ?? "",
    lifecycleStatus: normalizeLifecycleStatus(row.lifecycle_status),
    retentionPolicy: (AI_MEMORY_RETENTION_POLICIES as readonly string[]).includes(row.retention_policy)
      ? (row.retention_policy as AiMemoryRegistryEntry["retentionPolicy"])
      : "standard",
    privacyScope: (AI_MEMORY_PRIVACY_SCOPES as readonly string[]).includes(row.privacy_scope)
      ? (row.privacy_scope as AiMemoryRegistryEntry["privacyScope"])
      : "mission",
    schemaVersion: row.schema_version,
    auditMetadata: row.audit_metadata ?? {},
    qaMarker: row.qa_marker,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    referencedAt: row.referenced_at,
    archivedAt: row.archived_at,
  }
}

function mapAudit(row: AuditRow): AiMemoryRegistryAuditEvent {
  return {
    id: row.id,
    memoryRegistryId: row.memory_registry_id,
    organizationId: row.organization_id,
    eventType: normalizeLifecycleEvent(row.event_type),
    workOrderId: row.work_order_id,
    decisionRecordId: row.decision_record_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }
}

export async function fetchAiMemoryRegistryById(
  admin: SupabaseClient,
  input: { organizationId: string; memoryRegistryId: string },
): Promise<AiMemoryRegistryEntry | null> {
  const { data, error } = await registryTable(admin)
    .select("*")
    .eq("id", input.memoryRegistryId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRegistry(data as RegistryRow) : null
}

export async function fetchAiMemoryRegistryBySource(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sourceTable: string
    sourceRecordId?: string | null
    sourceKey?: string | null
  },
): Promise<AiMemoryRegistryEntry | null> {
  let query = registryTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("source_table", input.sourceTable)

  if (input.sourceRecordId) {
    query = query.eq("source_record_id", input.sourceRecordId)
  } else if (input.sourceKey) {
    query = query.eq("source_key", input.sourceKey).is("source_record_id", null)
  } else {
    return null
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRegistry(data as RegistryRow) : null
}

export async function insertAiMemoryRegistryEntry(
  admin: SupabaseClient,
  input: AiMemoryRegistryRegisterInput & { ownerAgent: AiWorkOrderAgent },
): Promise<AiMemoryRegistryEntry> {
  if (!isAiMemoryRegistryType(input.memoryType)) throw new Error("ai_memory_invalid_type")
  if (!input.sourceRecordId && !input.sourceKey) throw new Error("ai_memory_source_ref_required")

  const row = {
    organization_id: input.organizationId,
    mission_id: input.missionId ?? null,
    memory_type: input.memoryType,
    owner_agent: input.ownerAgent,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    source_system: input.sourceSystem,
    source_table: input.sourceTable,
    source_record_id: input.sourceRecordId ?? null,
    source_key: input.sourceKey ?? null,
    label: input.label ?? "",
    description: input.description ?? "",
    lifecycle_status: input.lifecycleStatus ?? "created",
    retention_policy: input.retentionPolicy ?? (input.memoryType === "decision" ? "permanent" : "standard"),
    privacy_scope: input.privacyScope ?? "mission",
    schema_version: AI_MEMORY_REGISTRY_SCHEMA_VERSION,
    audit_metadata: input.auditMetadata ?? {},
    qa_marker: GROWTH_AI_MEMORY_REGISTRY_QA_MARKER,
  }

  const { data, error } = await registryTable(admin).insert(row).select("*").single()
  if (error) throw new Error(error.message)
  return mapRegistry(data as RegistryRow)
}

export async function updateAiMemoryRegistryEntry(
  admin: SupabaseClient,
  input: {
    organizationId: string
    memoryRegistryId: string
    patch: Record<string, unknown>
  },
): Promise<AiMemoryRegistryEntry> {
  const { data, error } = await registryTable(admin)
    .update({ ...input.patch, updated_at: new Date().toISOString() })
    .eq("id", input.memoryRegistryId)
    .eq("organization_id", input.organizationId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRegistry(data as RegistryRow)
}

export async function listAiMemoryRegistryEntries(
  admin: SupabaseClient,
  filter: AiMemoryRegistryListFilter,
): Promise<AiMemoryRegistryEntry[]> {
  let query = registryTable(admin).select("*").eq("organization_id", filter.organizationId)

  if (filter.missionId) query = query.eq("mission_id", filter.missionId)
  if (filter.memoryType) query = query.eq("memory_type", filter.memoryType)
  if (filter.ownerAgent) query = query.eq("owner_agent", filter.ownerAgent)
  if (filter.entityType) query = query.eq("entity_type", filter.entityType)
  if (filter.entityId) query = query.eq("entity_id", filter.entityId)
  if (filter.sourceSystem) query = query.eq("source_system", filter.sourceSystem)
  if (filter.sourceTable) query = query.eq("source_table", filter.sourceTable)
  if (filter.lifecycleStatus) {
    const statuses = Array.isArray(filter.lifecycleStatus) ? filter.lifecycleStatus : [filter.lifecycleStatus]
    query = query.in("lifecycle_status", statuses)
  }

  query = query.order("created_at", { ascending: false })
  if (filter.limit) query = query.limit(filter.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRegistry(row as RegistryRow))
}

export async function insertAiMemoryRegistryAuditEvent(
  admin: SupabaseClient,
  input: {
    memoryRegistryId: string
    organizationId: string
    eventType: AiMemoryRegistryLifecycleEvent
    workOrderId?: string | null
    decisionRecordId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<AiMemoryRegistryAuditEvent> {
  const row = {
    memory_registry_id: input.memoryRegistryId,
    organization_id: input.organizationId,
    event_type: input.eventType,
    work_order_id: input.workOrderId ?? null,
    decision_record_id: input.decisionRecordId ?? null,
    metadata: input.metadata ?? {},
  }

  const { data, error } = await auditTable(admin).insert(row).select("*").single()
  if (error) throw new Error(error.message)
  return mapAudit(data as AuditRow)
}

export async function listAiMemoryRegistryAuditEvents(
  admin: SupabaseClient,
  input: { organizationId: string; memoryRegistryId: string; limit?: number },
): Promise<AiMemoryRegistryAuditEvent[]> {
  let query = auditTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("memory_registry_id", input.memoryRegistryId)
    .order("created_at", { ascending: false })

  if (input.limit) query = query.limit(input.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapAudit(row as AuditRow))
}

export function aiMemoryRegistrySchemaCatalog() {
  return {
    memoryTypes: [...AI_MEMORY_REGISTRY_TYPES],
    lifecycleStatuses: [...AI_MEMORY_REGISTRY_LIFECYCLE_STATUSES],
    schemaVersion: AI_MEMORY_REGISTRY_SCHEMA_VERSION,
    qaMarker: GROWTH_AI_MEMORY_REGISTRY_QA_MARKER,
  }
}
