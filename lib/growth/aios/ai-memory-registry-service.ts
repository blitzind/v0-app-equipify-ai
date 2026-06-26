/** GE-AIOS-2F — Memory Registry service (server-only, infrastructure only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAiDecisionRecordById } from "@/lib/growth/aios/ai-decision-record-repository"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import {
  fetchAiMemoryRegistryById,
  fetchAiMemoryRegistryBySource,
  insertAiMemoryRegistryAuditEvent,
  insertAiMemoryRegistryEntry,
  listAiMemoryRegistryAuditEvents,
  listAiMemoryRegistryEntries,
  updateAiMemoryRegistryEntry,
} from "@/lib/growth/aios/ai-memory-registry-repository"
import type {
  AiMemoryRegistryArchiveInput,
  AiMemoryRegistryAuditEvent,
  AiMemoryRegistryEntry,
  AiMemoryRegistryLinkDecisionRecordInput,
  AiMemoryRegistryLinkWorkOrderInput,
  AiMemoryRegistryListFilter,
  AiMemoryRegistryReferenceInput,
  AiMemoryRegistryRegisterInput,
} from "@/lib/growth/aios/ai-memory-registry-types"
import { defaultOwnerAgentForMemoryType } from "@/lib/growth/aios/ai-memory-source-registry"
import {
  fetchAiWorkOrderById,
  updateAiWorkOrderRow,
} from "@/lib/growth/aios/ai-work-order-repository"
import type { AiWorkOrderMemoryRef } from "@/lib/growth/aios/ai-work-order-types"

function nowIso(): string {
  return new Date().toISOString()
}

async function publishMemoryRegistryEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    entry: AiMemoryRegistryEntry
    metadata?: Record<string, unknown>
    workOrderId?: string | null
    decisionRecordId?: string | null
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: input.eventType,
    category: "memory",
    producer: "ai_memory_registry",
    source: "ai_memory_registry_service",
    missionId: input.entry.missionId,
    workOrderId: input.workOrderId ?? null,
    agentOwner: input.entry.ownerAgent,
    entityType: input.entry.entityType,
    entityId: input.entry.entityId,
    correlationId: input.entry.id,
    payload: {
      memory_type: input.entry.memoryType,
      source_system: input.entry.sourceSystem,
      source_table: input.entry.sourceTable,
      source_record_id: input.entry.sourceRecordId,
      source_key: input.entry.sourceKey,
      lifecycle_status: input.entry.lifecycleStatus,
      ...(input.metadata ?? {}),
    },
    metadata: {
      memory_registry_id: input.entry.id,
      decision_record_id: input.decisionRecordId ?? null,
    },
  })
}

async function appendMemoryRefToWorkOrder(
  admin: SupabaseClient,
  input: { organizationId: string; workOrderId: string; entry: AiMemoryRegistryEntry },
): Promise<void> {
  const workOrder = await fetchAiWorkOrderById(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
  })
  if (!workOrder) throw new Error("ai_work_order_not_found")

  const memoryRefs: AiWorkOrderMemoryRef[] = [...workOrder.memoryRefs]
  const nextRef: AiWorkOrderMemoryRef = {
    memoryType: input.entry.memoryType,
    memoryId: input.entry.id,
    snapshotAt: nowIso(),
  }
  const exists = memoryRefs.some(
    (ref) => ref.memoryId === nextRef.memoryId && ref.memoryType === nextRef.memoryType,
  )
  if (!exists) memoryRefs.push(nextRef)

  await updateAiWorkOrderRow(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
    patch: { memory_refs: memoryRefs },
  })
}

export async function registerAiMemoryRegistryEntry(
  admin: SupabaseClient,
  input: AiMemoryRegistryRegisterInput,
): Promise<{ entry: AiMemoryRegistryEntry; auditEvent: AiMemoryRegistryAuditEvent; created: boolean }> {
  const ownerAgent = input.ownerAgent ?? defaultOwnerAgentForMemoryType(input.memoryType)

  const existing = await fetchAiMemoryRegistryBySource(admin, {
    organizationId: input.organizationId,
    sourceTable: input.sourceTable,
    sourceRecordId: input.sourceRecordId,
    sourceKey: input.sourceKey,
  })
  if (existing) {
    return {
      entry: existing,
      auditEvent: {
        id: existing.id,
        memoryRegistryId: existing.id,
        organizationId: existing.organizationId,
        eventType: "created",
        workOrderId: null,
        decisionRecordId: null,
        metadata: { deduplicated: true },
        createdAt: existing.createdAt,
      },
      created: false,
    }
  }

  const entry = await insertAiMemoryRegistryEntry(admin, { ...input, ownerAgent })

  const auditEvent = await insertAiMemoryRegistryAuditEvent(admin, {
    memoryRegistryId: entry.id,
    organizationId: entry.organizationId,
    eventType: "created",
    metadata: {
      memory_type: entry.memoryType,
      source_system: entry.sourceSystem,
      source_table: entry.sourceTable,
    },
  })

  await publishMemoryRegistryEvent(admin, {
    organizationId: input.organizationId,
    eventType: "memory.registered",
    entry,
  })

  return { entry, auditEvent, created: true }
}

export async function referenceAiMemoryRegistryEntry(
  admin: SupabaseClient,
  input: AiMemoryRegistryReferenceInput,
): Promise<{ entry: AiMemoryRegistryEntry; auditEvent: AiMemoryRegistryAuditEvent }> {
  const existing = await fetchAiMemoryRegistryById(admin, {
    organizationId: input.organizationId,
    memoryRegistryId: input.memoryRegistryId,
  })
  if (!existing) throw new Error("ai_memory_registry_not_found")
  if (existing.archivedAt) throw new Error("ai_memory_registry_archived")

  const entry = await updateAiMemoryRegistryEntry(admin, {
    organizationId: input.organizationId,
    memoryRegistryId: input.memoryRegistryId,
    patch: {
      lifecycle_status: "referenced",
      referenced_at: nowIso(),
    },
  })

  const auditEvent = await insertAiMemoryRegistryAuditEvent(admin, {
    memoryRegistryId: entry.id,
    organizationId: entry.organizationId,
    eventType: "referenced",
    workOrderId: input.workOrderId ?? null,
    decisionRecordId: input.decisionRecordId ?? null,
    metadata: input.metadata ?? {},
  })

  await publishMemoryRegistryEvent(admin, {
    organizationId: input.organizationId,
    eventType: "memory.referenced",
    entry,
    workOrderId: input.workOrderId,
    decisionRecordId: input.decisionRecordId,
    metadata: input.metadata,
  })

  return { entry, auditEvent }
}

export async function linkAiMemoryRegistryToWorkOrder(
  admin: SupabaseClient,
  input: AiMemoryRegistryLinkWorkOrderInput,
): Promise<{ entry: AiMemoryRegistryEntry; auditEvent: AiMemoryRegistryAuditEvent }> {
  const entry = await fetchAiMemoryRegistryById(admin, {
    organizationId: input.organizationId,
    memoryRegistryId: input.memoryRegistryId,
  })
  if (!entry) throw new Error("ai_memory_registry_not_found")

  const workOrder = await fetchAiWorkOrderById(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
  })
  if (!workOrder) throw new Error("ai_work_order_not_found")

  await appendMemoryRefToWorkOrder(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
    entry,
  })

  const auditEvent = await insertAiMemoryRegistryAuditEvent(admin, {
    memoryRegistryId: entry.id,
    organizationId: entry.organizationId,
    eventType: "linked",
    workOrderId: input.workOrderId,
    metadata: { linked_at: nowIso(), link_target: "work_order" },
  })

  const updated = await updateAiMemoryRegistryEntry(admin, {
    organizationId: input.organizationId,
    memoryRegistryId: entry.id,
    patch: {
      lifecycle_status: "referenced",
      referenced_at: nowIso(),
    },
  })

  await publishMemoryRegistryEvent(admin, {
    organizationId: input.organizationId,
    eventType: "memory.linked",
    entry: updated,
    workOrderId: input.workOrderId,
    metadata: { link_target: "work_order" },
  })

  return { entry: updated, auditEvent }
}

export async function linkAiMemoryRegistryToDecisionRecord(
  admin: SupabaseClient,
  input: AiMemoryRegistryLinkDecisionRecordInput,
): Promise<{ entry: AiMemoryRegistryEntry; auditEvent: AiMemoryRegistryAuditEvent }> {
  const entry = await fetchAiMemoryRegistryById(admin, {
    organizationId: input.organizationId,
    memoryRegistryId: input.memoryRegistryId,
  })
  if (!entry) throw new Error("ai_memory_registry_not_found")

  const decisionRecord = await fetchAiDecisionRecordById(admin, {
    organizationId: input.organizationId,
    decisionRecordId: input.decisionRecordId,
  })
  if (!decisionRecord) throw new Error("ai_decision_record_not_found")

  const auditEvent = await insertAiMemoryRegistryAuditEvent(admin, {
    memoryRegistryId: entry.id,
    organizationId: entry.organizationId,
    eventType: "linked",
    decisionRecordId: input.decisionRecordId,
    workOrderId: decisionRecord.workOrderId,
    metadata: { linked_at: nowIso(), link_target: "decision_record" },
  })

  const updated = await updateAiMemoryRegistryEntry(admin, {
    organizationId: input.organizationId,
    memoryRegistryId: entry.id,
    patch: {
      lifecycle_status: "referenced",
      referenced_at: nowIso(),
    },
  })

  await publishMemoryRegistryEvent(admin, {
    organizationId: input.organizationId,
    eventType: "memory.linked",
    entry: updated,
    workOrderId: decisionRecord.workOrderId,
    decisionRecordId: input.decisionRecordId,
    metadata: { link_target: "decision_record" },
  })

  return { entry: updated, auditEvent }
}

export async function archiveAiMemoryRegistryEntry(
  admin: SupabaseClient,
  input: AiMemoryRegistryArchiveInput,
): Promise<{ entry: AiMemoryRegistryEntry; auditEvent: AiMemoryRegistryAuditEvent }> {
  const existing = await fetchAiMemoryRegistryById(admin, {
    organizationId: input.organizationId,
    memoryRegistryId: input.memoryRegistryId,
  })
  if (!existing) throw new Error("ai_memory_registry_not_found")
  if (existing.retentionPolicy === "permanent") {
    throw new Error("ai_memory_registry_permanent_retention")
  }

  const entry = await updateAiMemoryRegistryEntry(admin, {
    organizationId: input.organizationId,
    memoryRegistryId: input.memoryRegistryId,
    patch: {
      lifecycle_status: "archived",
      archived_at: nowIso(),
    },
  })

  const auditEvent = await insertAiMemoryRegistryAuditEvent(admin, {
    memoryRegistryId: entry.id,
    organizationId: entry.organizationId,
    eventType: "archived",
    metadata: { reason: input.reason ?? "archived" },
  })

  await publishMemoryRegistryEvent(admin, {
    organizationId: input.organizationId,
    eventType: "memory.archived",
    entry,
    metadata: { reason: input.reason ?? "archived" },
  })

  return { entry, auditEvent }
}

export async function getAiMemoryRegistryEntry(
  admin: SupabaseClient,
  input: { organizationId: string; memoryRegistryId: string },
): Promise<AiMemoryRegistryEntry | null> {
  return fetchAiMemoryRegistryById(admin, input)
}

export async function queryAiMemoryRegistry(
  admin: SupabaseClient,
  filter: AiMemoryRegistryListFilter,
): Promise<AiMemoryRegistryEntry[]> {
  return listAiMemoryRegistryEntries(admin, filter)
}

export async function getAiMemoryRegistryAuditTrail(
  admin: SupabaseClient,
  input: { organizationId: string; memoryRegistryId: string; limit?: number },
): Promise<AiMemoryRegistryAuditEvent[]> {
  return listAiMemoryRegistryAuditEvents(admin, input)
}
