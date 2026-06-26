/** GE-AIOS-2H — Decision Engine service (server-only, infrastructure only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createAiDecisionRecord } from "@/lib/growth/aios/ai-decision-record-service"
import { lookupAiDecisionRegistryEntry } from "@/lib/growth/aios/ai-decision-record-registry"
import { evaluateAiDecisionEngineRules } from "@/lib/growth/aios/ai-decision-engine-evaluator"
import {
  fetchAiDecisionEngineRuntime,
  insertAiDecisionEngineRequest,
  listAiDecisionEngineRequestsForWorkOrder,
  upsertAiDecisionEngineRuntime,
} from "@/lib/growth/aios/ai-decision-engine-repository"
import type { AiDecisionEngineEvaluateInput } from "@/lib/growth/aios/ai-decision-engine-types"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import { fetchAiMemoryRegistryById } from "@/lib/growth/aios/ai-memory-registry-repository"
import { fetchAiWorkOrderById } from "@/lib/growth/aios/ai-work-order-repository"
import type { AiWorkOrderAgent } from "@/lib/growth/aios/ai-work-order-types"

function nowIso(): string {
  return new Date().toISOString()
}

async function publishDecisionEngineEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    missionId: string
    workOrderId: string
    ownerAgent: AiWorkOrderAgent
    correlationId?: string
    payload?: Record<string, unknown>
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: input.eventType,
    category: "decision",
    producer: "ai_decision_engine",
    source: "ai_decision_engine_service",
    missionId: input.missionId,
    workOrderId: input.workOrderId,
    agentOwner: input.ownerAgent,
    correlationId: input.correlationId ?? input.workOrderId,
    payload: input.payload ?? {},
  })
}

async function resolveMemoryRefsForWorkOrder(
  admin: SupabaseClient,
  input: {
    organizationId: string
    workOrder: { memoryRefs: Array<{ memoryType: string; memoryId: string }> }
    memoryRegistryIds?: string[]
  },
) {
  const ids = new Set<string>()
  for (const ref of input.workOrder.memoryRefs) ids.add(ref.memoryId)
  for (const id of input.memoryRegistryIds ?? []) ids.add(id)

  const memoryRefs = []
  for (const memoryId of ids) {
    const entry = await fetchAiMemoryRegistryById(admin, {
      organizationId: input.organizationId,
      memoryRegistryId: memoryId,
    })
    if (entry) {
      memoryRefs.push({
        memoryType: entry.memoryType,
        memoryId: entry.id,
        sourceSystem: entry.sourceSystem,
        sourceTable: entry.sourceTable,
      })
    }
  }
  return memoryRefs
}

export async function runAiDecisionEngineForWorkOrder(
  admin: SupabaseClient,
  input: AiDecisionEngineEvaluateInput,
) {
  const workOrder = await fetchAiWorkOrderById(admin, {
    organizationId: input.organizationId,
    workOrderId: input.workOrderId,
  })
  if (!workOrder) throw new Error("ai_work_order_not_found")

  let runtime = await fetchAiDecisionEngineRuntime(admin, { organizationId: input.organizationId })
  if (!runtime) {
    runtime = await upsertAiDecisionEngineRuntime(admin, { organizationId: input.organizationId })
  }

  await publishDecisionEngineEvent(admin, {
    organizationId: input.organizationId,
    eventType: "decision.requested",
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    ownerAgent: workOrder.ownerAgent,
    payload: {
      decision_key: input.decisionKey ?? null,
      work_order_type: workOrder.workOrderType,
    },
  })

  const memoryRefs = await resolveMemoryRefsForWorkOrder(admin, {
    organizationId: input.organizationId,
    workOrder,
    memoryRegistryIds: input.memoryRegistryIds,
  })

  const { collectOptionalAiDecisionEvidence } = await import(
    "@/lib/growth/aios/ai-decision-intelligence-bridge-service"
  )
  const aiEnrichment = await collectOptionalAiDecisionEvidence(admin, {
    organizationId: input.organizationId,
    workOrderId: workOrder.id,
    missionId: workOrder.missionId,
    ownerAgent: workOrder.ownerAgent,
    enabled: input.enableAiEvidence ?? false,
    preferredProvider: input.preferredAiProvider,
    source: "ai_decision_engine_service",
  })

  const evaluation = evaluateAiDecisionEngineRules({
    workOrder,
    decisionKey: input.decisionKey,
    evidenceInput: {
      workOrderPayload: workOrder.payload,
      memoryRefs,
      additionalEvidence: [
        ...(input.additionalEvidence ?? []),
        ...aiEnrichment.aiEvidence,
      ],
    },
    degradedMode: runtime.degraded,
  })

  const registry = lookupAiDecisionRegistryEntry(evaluation.decisionKey)
  const ownerAgent = (registry?.ownerAgent ?? workOrder.assignedAgent) as AiWorkOrderAgent

  const { decisionRecord } = await createAiDecisionRecord(admin, {
    organizationId: input.organizationId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    decisionKey: evaluation.decisionKey,
    ownerAgent,
    entityType: workOrder.entityType,
    entityId: workOrder.entityId,
    evidenceBundle: evaluation.evidenceBundle,
    confidence: evaluation.confidence,
    riskScore: evaluation.riskScore,
    expectedCostUsd: evaluation.expectedCostUsd,
    expectedValueUsd: evaluation.expectedValueUsd,
    explanation: evaluation.recommendation.explanation,
    chosenAction: evaluation.recommendation.chosenAction,
    rejectedActions: evaluation.recommendation.rejectedActions,
    auditMetadata: {
      decision_engine: true,
      confidence_band: evaluation.recommendation.confidenceBand,
      proceed: evaluation.recommendation.proceed,
      ai_enrichment_used: aiEnrichment.used,
      ai_enrichment_failed: aiEnrichment.failed,
      ...(input.metadata ?? {}),
    },
    linkToWorkOrder: true,
  })

  const request = await insertAiDecisionEngineRequest(admin, {
    organizationId: input.organizationId,
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    decisionKey: evaluation.decisionKey,
    requestStatus: evaluation.requestStatus,
    evidenceBundle: evaluation.evidenceBundle,
    evaluation: {
      ...evaluation.evaluation,
      ai_enrichment_used: aiEnrichment.used,
      ai_enrichment_failed: aiEnrichment.failed,
      ai_context_package_id: aiEnrichment.contextPackageId,
      ai_provider_request_id: aiEnrichment.providerRequestId,
    },
    recommendation: evaluation.recommendation,
    confidence: evaluation.confidence,
    riskScore: evaluation.riskScore,
    expectedCostUsd: evaluation.expectedCostUsd,
    decisionRecordId: decisionRecord.id,
    degradedMode: runtime.degraded,
  })

  const insufficient = evaluation.requestStatus === "insufficient_evidence"
  await upsertAiDecisionEngineRuntime(admin, {
    organizationId: input.organizationId,
    patch: {
      evaluation_count: runtime.evaluationCount + 1,
      insufficient_evidence_count: runtime.insufficientEvidenceCount + (insufficient ? 1 : 0),
      last_evaluation_at: nowIso(),
      last_success_at: insufficient ? runtime.lastSuccessAt : nowIso(),
      degraded: insufficient && runtime.insufficientEvidenceCount + 1 >= 5 ? true : runtime.degraded,
      degraded_reason:
        insufficient && runtime.insufficientEvidenceCount + 1 >= 5
          ? "excessive_insufficient_evidence"
          : runtime.degradedReason,
    },
  })

  await publishDecisionEngineEvent(admin, {
    organizationId: input.organizationId,
    eventType: "decision.evaluated",
    missionId: workOrder.missionId,
    workOrderId: workOrder.id,
    ownerAgent,
    correlationId: request.id,
    payload: {
      decision_record_id: decisionRecord.id,
      decision_key: evaluation.decisionKey,
      confidence: evaluation.confidence,
      risk_score: evaluation.riskScore,
      request_status: evaluation.requestStatus,
      proceed: evaluation.recommendation.proceed,
    },
  })

  if (runtime.degraded) {
    await publishDecisionEngineEvent(admin, {
      organizationId: input.organizationId,
      eventType: "decision.engine_degraded",
      missionId: workOrder.missionId,
      workOrderId: workOrder.id,
      ownerAgent,
      payload: { degraded_reason: runtime.degradedReason },
    })
  }

  return { workOrder, evaluation, decisionRecord, request }
}

export async function getAiDecisionEngineRequestsForWorkOrder(
  admin: SupabaseClient,
  input: { organizationId: string; workOrderId: string; limit?: number },
) {
  return listAiDecisionEngineRequestsForWorkOrder(admin, input)
}

export async function getAiDecisionEngineRuntimeState(
  admin: SupabaseClient,
  input: { organizationId: string },
) {
  return fetchAiDecisionEngineRuntime(admin, input)
}

export async function setAiDecisionEngineDegradedMode(
  admin: SupabaseClient,
  input: { organizationId: string; degraded: boolean; reason?: string | null },
) {
  const runtime = await upsertAiDecisionEngineRuntime(admin, {
    organizationId: input.organizationId,
    patch: {
      degraded: input.degraded,
      degraded_reason: input.reason ?? null,
    },
  })

  if (input.degraded) {
    await publishAiOsEvent(admin, {
      organizationId: input.organizationId,
      eventType: "decision.engine_degraded",
      category: "decision",
      producer: "ai_decision_engine",
      source: "ai_decision_engine_service",
      payload: { reason: input.reason ?? "manual_degraded" },
    })
  }

  return runtime
}
