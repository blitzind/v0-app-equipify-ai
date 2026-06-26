/** GE-AIOS-2D — Decision Record service (server-only, infrastructure only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import {
  fetchAiDecisionRecordById,
  insertAiDecisionRecord,
  insertAiDecisionRecordAuditEvent,
  listAiDecisionRecordAuditEvents,
  listAiDecisionRecords,
} from "@/lib/growth/aios/ai-decision-record-repository"
import type {
  AiDecisionRecord,
  AiDecisionRecordAuditEvent,
  AiDecisionRecordCreateInput,
  AiDecisionRecordLinkInput,
  AiDecisionRecordListFilter,
  AiDecisionRecordSupersedeInput,
} from "@/lib/growth/aios/ai-decision-record-types"
import {
  fetchAiWorkOrderById,
  updateAiWorkOrderRow,
} from "@/lib/growth/aios/ai-work-order-repository"

async function publishDecisionEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    decisionRecord: AiDecisionRecord
    metadata?: Record<string, unknown>
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: input.eventType,
    category: "decision",
    producer: "ai_decision_record_service",
    source: "ai_decision_record_service",
    missionId: input.decisionRecord.missionId,
    workOrderId: input.decisionRecord.workOrderId,
    agentOwner: input.decisionRecord.ownerAgent,
    entityType: input.decisionRecord.entityType,
    entityId: input.decisionRecord.entityId,
    correlationId: input.decisionRecord.id,
    causationId: input.decisionRecord.supersedesDecisionId,
    payload: {
      decision_key: input.decisionRecord.decisionKey,
      confidence: input.decisionRecord.confidence,
      risk_score: input.decisionRecord.riskScore,
      ...(input.metadata ?? {}),
    },
    metadata: {
      decision_record_id: input.decisionRecord.id,
    },
  })
}

async function appendDecisionRecordToWorkOrder(
  admin: SupabaseClient,
  input: { organizationId: string; workOrderId: string; decisionRecordId: string },
): Promise<void> {
  const workOrder = await fetchAiWorkOrderById(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
  })
  if (!workOrder) throw new Error("ai_work_order_not_found")

  const decisionRecordIds = [...workOrder.decisionRecordIds]
  if (!decisionRecordIds.includes(input.decisionRecordId)) {
    decisionRecordIds.push(input.decisionRecordId)
  }

  await updateAiWorkOrderRow(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
    patch: { decision_record_ids: decisionRecordIds },
  })
}

export async function createAiDecisionRecord(
  admin: SupabaseClient,
  input: AiDecisionRecordCreateInput,
): Promise<{ decisionRecord: AiDecisionRecord; auditEvent: AiDecisionRecordAuditEvent }> {
  const decisionRecord = await insertAiDecisionRecord(admin, input)

  const auditEvent = await insertAiDecisionRecordAuditEvent(admin, {
    decisionRecordId: decisionRecord.id,
    organizationId: decisionRecord.organizationId,
    eventType: "created",
    workOrderId: decisionRecord.workOrderId,
    metadata: { decision_key: decisionRecord.decisionKey },
  })

  if (input.linkToWorkOrder !== false && decisionRecord.workOrderId) {
    await linkAiDecisionRecordToWorkOrder(admin, {
      organizationId: input.organizationId,
      decisionRecordId: decisionRecord.id,
      workOrderId: decisionRecord.workOrderId,
    })
  }

  await publishDecisionEvent(admin, {
    organizationId: input.organizationId,
    eventType: "decision.recorded",
    decisionRecord,
  })

  return { decisionRecord, auditEvent }
}

export async function supersedeAiDecisionRecord(
  admin: SupabaseClient,
  input: AiDecisionRecordSupersedeInput,
): Promise<{ decisionRecord: AiDecisionRecord; auditEvent: AiDecisionRecordAuditEvent }> {
  const original = await fetchAiDecisionRecordById(admin, {
    organizationId: input.organizationId,
    decisionRecordId: input.originalDecisionId,
  })
  if (!original) throw new Error("ai_decision_record_not_found")

  const decisionRecord = await insertAiDecisionRecord(admin, {
    ...input.updates,
    organizationId: input.organizationId,
    missionId: input.updates.missionId ?? original.missionId,
    workOrderId: input.updates.workOrderId ?? original.workOrderId,
    supersedesDecisionId: original.id,
    auditMetadata: {
      ...(input.updates.auditMetadata ?? {}),
      supersedes_decision_id: original.id,
    },
  })

  await insertAiDecisionRecordAuditEvent(admin, {
    decisionRecordId: original.id,
    organizationId: original.organizationId,
    eventType: "superseded",
    workOrderId: original.workOrderId,
    metadata: { superseded_by: decisionRecord.id },
  })

  const auditEvent = await insertAiDecisionRecordAuditEvent(admin, {
    decisionRecordId: decisionRecord.id,
    organizationId: decisionRecord.organizationId,
    eventType: "created",
    workOrderId: decisionRecord.workOrderId,
    metadata: { supersedes_decision_id: original.id },
  })

  if (input.updates.linkToWorkOrder !== false && decisionRecord.workOrderId) {
    await linkAiDecisionRecordToWorkOrder(admin, {
      organizationId: input.organizationId,
      decisionRecordId: decisionRecord.id,
      workOrderId: decisionRecord.workOrderId,
    })
  }

  await publishDecisionEvent(admin, {
    organizationId: input.organizationId,
    eventType: "decision.superseded",
    decisionRecord,
    metadata: { original_decision_id: original.id },
  })

  await publishDecisionEvent(admin, {
    organizationId: input.organizationId,
    eventType: "decision.recorded",
    decisionRecord,
  })

  return { decisionRecord, auditEvent }
}

export async function linkAiDecisionRecordToWorkOrder(
  admin: SupabaseClient,
  input: AiDecisionRecordLinkInput,
): Promise<{ decisionRecord: AiDecisionRecord; auditEvent: AiDecisionRecordAuditEvent }> {
  const decisionRecord = await fetchAiDecisionRecordById(admin, {
    organizationId: input.organizationId,
    decisionRecordId: input.decisionRecordId,
  })
  if (!decisionRecord) throw new Error("ai_decision_record_not_found")

  const workOrder = await fetchAiWorkOrderById(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
  })
  if (!workOrder) throw new Error("ai_work_order_not_found")

  await appendDecisionRecordToWorkOrder(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
    decisionRecordId: decisionRecord.id,
  })

  const auditEvent = await insertAiDecisionRecordAuditEvent(admin, {
    decisionRecordId: decisionRecord.id,
    organizationId: decisionRecord.organizationId,
    eventType: "linked",
    workOrderId: input.workOrderId,
    metadata: { linked_at: new Date().toISOString() },
  })

  await publishDecisionEvent(admin, {
    organizationId: input.organizationId,
    eventType: "decision.linked",
    decisionRecord: { ...decisionRecord, workOrderId: input.workOrderId },
    metadata: { work_order_id: input.workOrderId },
  })

  return {
    decisionRecord: { ...decisionRecord, workOrderId: input.workOrderId },
    auditEvent,
  }
}

export async function getAiDecisionRecord(
  admin: SupabaseClient,
  input: { organizationId: string; decisionRecordId: string },
): Promise<AiDecisionRecord | null> {
  return fetchAiDecisionRecordById(admin, input)
}

export async function queryAiDecisionRecords(
  admin: SupabaseClient,
  filter: AiDecisionRecordListFilter,
): Promise<AiDecisionRecord[]> {
  return listAiDecisionRecords(admin, filter)
}

export async function getAiDecisionRecordAuditTrail(
  admin: SupabaseClient,
  input: { organizationId: string; decisionRecordId: string; limit?: number },
): Promise<AiDecisionRecordAuditEvent[]> {
  return listAiDecisionRecordAuditEvents(admin, input)
}
