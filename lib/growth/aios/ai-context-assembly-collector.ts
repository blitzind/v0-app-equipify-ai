/** GE-AIOS-2J — Context bundle collector (client-safe). */

import type { AiDecisionEvidenceRef, AiDecisionRecord } from "@/lib/growth/aios/ai-decision-record-types"
import type { AiContextAssemblySourceKey } from "@/lib/growth/aios/ai-context-assembly-source-registry"
import type {
  AiContextDecisionSummary,
  AiContextEntityMetadata,
  AiContextEventSummary,
  AiContextMemoryReference,
  AiContextMissionSection,
  AiContextPackageContent,
  AiContextWorkOrderSection,
} from "@/lib/growth/aios/ai-context-assembly-types"
import { collectAiDecisionEngineEvidence } from "@/lib/growth/aios/ai-decision-engine-evidence-collector"
import type { AiOsEvent } from "@/lib/growth/aios/ai-event-types"
import type { AiMemoryRegistryEntry } from "@/lib/growth/aios/ai-memory-registry-types"
import type { AiWorkOrder } from "@/lib/growth/aios/ai-work-order-types"

export function buildAiContextWorkOrderSection(workOrder: AiWorkOrder): AiContextWorkOrderSection {
  return {
    workOrderId: workOrder.id,
    missionId: workOrder.missionId,
    workOrderType: workOrder.workOrderType,
    status: workOrder.status,
    ownerAgent: workOrder.ownerAgent,
    assignedAgent: workOrder.assignedAgent,
    entityType: workOrder.entityType,
    entityId: workOrder.entityId,
    priority: workOrder.priority,
    payload: workOrder.payload,
    decisionRecordIds: [...workOrder.decisionRecordIds],
    memoryRefIds: workOrder.memoryRefs.map((ref) => ref.memoryId),
  }
}

export function buildAiContextMissionSection(input: {
  missionId: string
  title: string
  objectiveType: string
  status: string
  currentValue: number
  targetValue: number
  autonomyLevel?: string | null
  safetyMode?: string | null
  currentStageId?: string | null
}): AiContextMissionSection {
  return {
    missionId: input.missionId,
    title: input.title,
    objectiveType: input.objectiveType,
    status: input.status,
    currentValue: input.currentValue,
    targetValue: input.targetValue,
    autonomyLevel: input.autonomyLevel ?? null,
    safetyMode: input.safetyMode ?? null,
    currentStageId: input.currentStageId ?? null,
    sourceTable: "growth.organization_growth_objectives",
  }
}

export function buildAiContextDecisionSummaries(
  records: AiDecisionRecord[],
): AiContextDecisionSummary[] {
  return records.map((record) => ({
    decisionRecordId: record.id,
    decisionKey: record.decisionKey,
    confidence: record.confidence,
    riskScore: record.riskScore,
    explanation: record.explanation.slice(0, 320),
    createdAt: record.createdAt,
    sourceTable: "growth.ai_decision_records",
  }))
}

export function buildAiContextMemoryReferences(
  entries: AiMemoryRegistryEntry[],
): AiContextMemoryReference[] {
  return entries.map((entry) => ({
    memoryRegistryId: entry.id,
    memoryType: entry.memoryType,
    sourceSystem: entry.sourceSystem,
    sourceTable: entry.sourceTable,
    sourceRecordId: entry.sourceRecordId,
    label: entry.label,
  }))
}

export function buildAiContextEventSummaries(events: AiOsEvent[]): AiContextEventSummary[] {
  return events.map((event) => ({
    eventId: event.id,
    eventType: event.eventType,
    category: event.category,
    occurredAt: event.occurredAt,
    producer: event.producer,
  }))
}

export function buildAiContextEvidenceBundle(input: {
  workOrderPayload: Record<string, unknown>
  memoryRefs: Array<{
    memoryType: string
    memoryId: string
    sourceSystem?: string | null
    sourceTable?: string | null
  }>
  decisionEvidence?: AiDecisionEvidenceRef[]
}): AiDecisionEvidenceRef[] {
  const base = collectAiDecisionEngineEvidence({
    workOrderPayload: input.workOrderPayload,
    memoryRefs: input.memoryRefs,
    additionalEvidence: input.decisionEvidence ?? [],
  })

  const seen = new Set<string>()
  return base.filter((ref) => {
    const key = `${ref.evidenceKey}:${ref.sourceKey ?? ""}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function assembleAiContextPackageContent(input: {
  contextVersion: string
  workOrder: AiWorkOrder
  missionContext: AiContextMissionSection | null
  decisionRecords: AiDecisionRecord[]
  memoryEntries: AiMemoryRegistryEntry[]
  relatedEvents: AiOsEvent[]
  entityMetadata: AiContextEntityMetadata | null
  sourceKeys: AiContextAssemblySourceKey[]
}): AiContextPackageContent {
  const memoryRefs = input.memoryEntries.map((entry) => ({
    memoryType: entry.memoryType,
    memoryId: entry.id,
    sourceSystem: entry.sourceSystem,
    sourceTable: entry.sourceTable,
  }))

  const decisionEvidence = input.decisionRecords.flatMap((record) =>
    record.evidenceBundle.slice(0, 5),
  )

  return {
    contextVersion: input.contextVersion,
    workOrderContext: buildAiContextWorkOrderSection(input.workOrder),
    missionContext: input.missionContext,
    decisionHistory: buildAiContextDecisionSummaries(input.decisionRecords),
    memoryReferences: buildAiContextMemoryReferences(input.memoryEntries),
    relatedEvents: buildAiContextEventSummaries(input.relatedEvents),
    evidenceBundle: buildAiContextEvidenceBundle({
      workOrderPayload: input.workOrder.payload,
      memoryRefs,
      decisionEvidence,
    }),
    entityMetadata: input.entityMetadata,
    sourceKeys: [...input.sourceKeys],
  }
}
