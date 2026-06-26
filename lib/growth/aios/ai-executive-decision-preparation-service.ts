/** GE-AIOS-3C — Executive Decision Preparation (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runAiDecisionEngineForWorkOrder } from "@/lib/growth/aios/ai-decision-engine-service"
import type {
  AiExecutiveDecisionPreparationInput,
  AiExecutiveDecisionPreparationResult,
} from "@/lib/growth/aios/ai-executive-decision-preparation-types"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"

async function publishPreparationEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    missionId: string
    workOrderId: string
    executiveRuntimeId: string
    payload?: Record<string, unknown>
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: input.eventType,
    category: "executive",
    producer: "executive_brain",
    source: "ai_executive_decision_preparation_service",
    agentOwner: "executive_brain",
    missionId: input.missionId,
    workOrderId: input.workOrderId,
    correlationId: input.workOrderId,
    payload: {
      executive_runtime_id: input.executiveRuntimeId,
      ...(input.payload ?? {}),
    },
  })
}

export async function prepareExecutiveDecisionForWorkOrder(
  admin: SupabaseClient,
  input: AiExecutiveDecisionPreparationInput,
): Promise<AiExecutiveDecisionPreparationResult> {
  await publishPreparationEvent(admin, {
    organizationId: input.organizationId,
    eventType: "executive.decision_preparation_started",
    missionId: input.missionId,
    workOrderId: input.workOrderId,
    executiveRuntimeId: input.executiveRuntimeId,
    payload: {
      enable_ai_evidence: input.enableAiEvidence ?? false,
      source: input.source ?? "ai_executive_decision_preparation_service",
    },
  })

  try {
    const engineResult = await runAiDecisionEngineForWorkOrder(admin, {
      organizationId: input.organizationId,
      workOrderId: input.workOrderId,
      decisionKey: input.decisionKey,
      enableAiEvidence: input.enableAiEvidence ?? false,
      metadata: {
        executive_decision_preparation: true,
        executive_runtime_id: input.executiveRuntimeId,
      },
    })

    const evaluationMeta = engineResult.evaluation.evaluation as Record<string, unknown>
    const aiEnrichmentUsed = Boolean(evaluationMeta?.ai_enrichment_used)

    await publishPreparationEvent(admin, {
      organizationId: input.organizationId,
      eventType: "executive.decision_prepared",
      missionId: input.missionId,
      workOrderId: input.workOrderId,
      executiveRuntimeId: input.executiveRuntimeId,
      payload: {
        decision_record_id: engineResult.decisionRecord.id,
        decision_key: engineResult.evaluation.decisionKey,
        request_status: engineResult.evaluation.requestStatus,
        ai_enrichment_used: aiEnrichmentUsed,
      },
    })

    return {
      prepared: true,
      decisionRecordId: engineResult.decisionRecord.id,
      decisionKey: engineResult.evaluation.decisionKey,
      requestStatus: engineResult.evaluation.requestStatus,
      aiEnrichmentUsed,
    }
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : String(error)

    await publishPreparationEvent(admin, {
      organizationId: input.organizationId,
      eventType: "executive.decision_preparation_failed",
      missionId: input.missionId,
      workOrderId: input.workOrderId,
      executiveRuntimeId: input.executiveRuntimeId,
      payload: {
        detail: failureReason,
        source: input.source ?? "ai_executive_decision_preparation_service",
      },
    })

    return {
      prepared: false,
      failureReason,
    }
  }
}
