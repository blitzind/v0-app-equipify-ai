/** GE-AIOS-2J — Context Assembly service (server-only, read-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { computeAiContextPackageChecksum } from "@/lib/growth/aios/ai-context-assembly-checksum"
import { assembleAiContextPackageContent, buildAiContextMissionSection } from "@/lib/growth/aios/ai-context-assembly-collector"
import {
  fetchAiContextAssemblyRuntime,
  fetchAiContextPackageByChecksum,
  incrementAiContextAssemblyRuntime,
  insertAiContextPackage,
} from "@/lib/growth/aios/ai-context-assembly-repository"
import { resolveAiContextEntityMetadata } from "@/lib/growth/aios/ai-context-assembly-resolver"
import type { AiContextAssemblySourceKey } from "@/lib/growth/aios/ai-context-assembly-source-registry"
import type {
  AiContextAssemblyInput,
  AiContextAssemblyResult,
} from "@/lib/growth/aios/ai-context-assembly-types"
import {
  AI_CONTEXT_PACKAGE_SCHEMA_VERSION,
} from "@/lib/growth/aios/ai-context-assembly-types"
import { validateAiContextPackage } from "@/lib/growth/aios/ai-context-assembly-validator"
import { fetchAiDecisionRecordsByIds, listAiDecisionRecords } from "@/lib/growth/aios/ai-decision-record-repository"
import { queryAiOsEvents } from "@/lib/growth/aios/ai-event-service"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import { fetchAiMemoryRegistryById } from "@/lib/growth/aios/ai-memory-registry-repository"
import { fetchAiWorkOrderById } from "@/lib/growth/aios/ai-work-order-repository"
import { getGrowthObjective } from "@/lib/growth/objectives/growth-objective-repository"

async function publishContextEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    missionId: string
    workOrderId: string
    contextPackageId?: string
    payload?: Record<string, unknown>
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: input.eventType,
    category: "memory",
    producer: "ai_context_assembly",
    source: "ai_context_assembly_service",
    missionId: input.missionId,
    workOrderId: input.workOrderId,
    correlationId: input.workOrderId,
    payload: {
      context_package_id: input.contextPackageId ?? null,
      ...(input.payload ?? {}),
    },
  })
}

async function resolveMemoryEntriesForWorkOrder(
  admin: SupabaseClient,
  input: { organizationId: string; memoryRefIds: string[] },
) {
  const entries = []
  for (const memoryId of input.memoryRefIds) {
    const entry = await fetchAiMemoryRegistryById(admin, {
      organizationId: input.organizationId,
      memoryRegistryId: memoryId,
    })
    if (entry) entries.push(entry)
  }
  return entries
}

export async function assembleAiContextForWorkOrder(
  admin: SupabaseClient,
  input: AiContextAssemblyInput,
): Promise<AiContextAssemblyResult> {
  const contextVersion = input.contextVersion ?? AI_CONTEXT_PACKAGE_SCHEMA_VERSION

  const workOrder = await fetchAiWorkOrderById(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
  })
  if (!workOrder) {
    await incrementAiContextAssemblyRuntime(admin, {
      organizationId: input.organizationId,
      validationFailureDelta: 1,
    }).catch(() => undefined)
    throw new Error("ai_context_assembly_work_order_not_found")
  }

  const sourceKeys: AiContextAssemblySourceKey[] = ["work_order"]

  const mission = await getGrowthObjective(admin, input.organizationId, workOrder.missionId)
  const missionContext = mission
    ? buildAiContextMissionSection({
        missionId: mission.id,
        title: mission.title,
        objectiveType: mission.objectiveType,
        status: mission.status,
        currentValue: mission.currentValue,
        targetValue: mission.targetValue,
        autonomyLevel: mission.autonomyLevel,
        safetyMode: mission.safetyMode,
        currentStageId: mission.runtime?.currentStageId ?? null,
      })
    : null
  if (missionContext) sourceKeys.push("mission")

  const decisionRecords =
    workOrder.decisionRecordIds.length > 0
      ? await fetchAiDecisionRecordsByIds(admin, {
          organizationId: input.organizationId,
          decisionRecordIds: workOrder.decisionRecordIds,
        })
      : await listAiDecisionRecords(admin, {
          organizationId: input.organizationId,
          workOrderId: workOrder.id,
          limit: 20,
        })
  if (decisionRecords.length > 0) sourceKeys.push("decision_records")

  const memoryEntries = await resolveMemoryEntriesForWorkOrder(admin, {
    organizationId: input.organizationId,
    memoryRefIds: workOrder.memoryRefs.map((ref) => ref.memoryId),
  })
  if (memoryEntries.length > 0) sourceKeys.push("memory_registry")

  const relatedEvents = await queryAiOsEvents(admin, {
    organizationId: input.organizationId,
    workOrderId: workOrder.id,
    limit: 50,
  })
  if (relatedEvents.length > 0) sourceKeys.push("related_events")

  const entityMetadata = await resolveAiContextEntityMetadata(admin, {
    organizationId: input.organizationId,
    entityType: workOrder.entityType,
    entityId: workOrder.entityId,
  })
  if (entityMetadata) sourceKeys.push("entity_metadata")

  const content = assembleAiContextPackageContent({
    contextVersion,
    workOrder,
    missionContext,
    decisionRecords,
    memoryEntries,
    relatedEvents,
    entityMetadata,
    sourceKeys,
  })

  const checksum = computeAiContextPackageChecksum(content)

  if (!input.forceReassemble) {
    const existing = await fetchAiContextPackageByChecksum(admin, {
      organizationId: input.organizationId,
      workOrderId: workOrder.id,
      contextVersion,
      checksum,
    })
    if (existing) {
      await incrementAiContextAssemblyRuntime(admin, {
        organizationId: input.organizationId,
        reuseDelta: 1,
      })
      await publishContextEvent(admin, {
        organizationId: input.organizationId,
        eventType: "context.reused",
        missionId: workOrder.missionId,
        workOrderId: workOrder.id,
        contextPackageId: existing.id,
        payload: {
          checksum,
          context_version: contextVersion,
          reused_from_package_id: existing.reusedFromPackageId,
        },
      })
      return { contextPackage: existing, reused: true }
    }
  }

  const validation = validateAiContextPackage({
    id: "pending",
    organizationId: input.organizationId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    checksum,
    reusedFromPackageId: null,
    qaMarker: "pending",
    createdAt: new Date().toISOString(),
    ...content,
  })

  if (!validation.valid) {
    await incrementAiContextAssemblyRuntime(admin, {
      organizationId: input.organizationId,
      validationFailureDelta: 1,
    })
    await publishContextEvent(admin, {
      organizationId: input.organizationId,
      eventType: "context.validation_failed",
      missionId: workOrder.missionId,
      workOrderId: workOrder.id,
      payload: {
        failure: validation.failure,
        detail: validation.detail,
        checksum,
      },
    })
    throw new Error(`ai_context_assembly_validation_failed:${validation.failure}`)
  }

  const contextPackage = await insertAiContextPackage(admin, {
    organizationId: input.organizationId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    content,
    checksum,
  })

  await incrementAiContextAssemblyRuntime(admin, {
    organizationId: input.organizationId,
    assemblyDelta: 1,
  })

  await publishContextEvent(admin, {
    organizationId: input.organizationId,
    eventType: "context.assembled",
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    contextPackageId: contextPackage.id,
    payload: {
      checksum,
      context_version: contextVersion,
      source_keys: content.sourceKeys,
      evidence_count: content.evidenceBundle.length,
      decision_count: content.decisionHistory.length,
      memory_count: content.memoryReferences.length,
      event_count: content.relatedEvents.length,
    },
  })

  return { contextPackage, reused: false }
}

export async function getAiContextAssemblyRuntimeSummary(
  admin: SupabaseClient,
  input: { organizationId: string },
) {
  const runtime = await fetchAiContextAssemblyRuntime(admin, input)
  return runtime ?? {
    organizationId: input.organizationId,
    assemblyCount: 0,
    reuseCount: 0,
    validationFailureCount: 0,
    lastAssembledAt: null,
  }
}
