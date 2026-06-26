/** GE-AIOS-3B — Decision Intelligence Bridge (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assembleAiContextForWorkOrder } from "@/lib/growth/aios/ai-context-assembly-service"
import {
  AI_DECISION_INTELLIGENCE_PURPOSE,
  buildAiDecisionEvidenceFromProviderResponse,
  type AiDecisionIntelligenceBridgeInput,
  type AiDecisionIntelligenceBridgeResult,
} from "@/lib/growth/aios/ai-decision-intelligence-bridge-types"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import { invokeAiOsProviderWithContextPackage } from "@/lib/growth/aios/ai-provider-service"
import type { AiWorkOrderAgent } from "@/lib/growth/aios/ai-work-order-types"

async function publishBridgeEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    missionId: string
    workOrderId: string
    ownerAgent: AiWorkOrderAgent
    source?: string
    payload?: Record<string, unknown>
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: input.eventType,
    category: "decision",
    producer: "ai_decision_intelligence_bridge",
    source: input.source ?? "ai_decision_intelligence_bridge_service",
    missionId: input.missionId,
    workOrderId: input.workOrderId,
    agentOwner: input.ownerAgent,
    correlationId: input.workOrderId,
    payload: input.payload ?? {},
  })
}

const EMPTY_RESULT: AiDecisionIntelligenceBridgeResult = {
  aiEvidence: [],
  used: false,
  failed: false,
  contextPackageId: null,
  providerRequestId: null,
  failureReason: null,
}

export async function collectOptionalAiDecisionEvidence(
  admin: SupabaseClient,
  input: AiDecisionIntelligenceBridgeInput & { ownerAgent: AiWorkOrderAgent },
): Promise<AiDecisionIntelligenceBridgeResult> {
  if (!input.enabled) {
    return { ...EMPTY_RESULT }
  }

  await publishBridgeEvent(admin, {
    organizationId: input.organizationId,
    eventType: "decision.ai_context_requested",
    missionId: input.missionId,
    workOrderId: input.workOrderId,
    ownerAgent: input.ownerAgent,
    source: input.source,
    payload: {
      purpose: AI_DECISION_INTELLIGENCE_PURPOSE,
      source: input.source ?? "ai_decision_intelligence_bridge_service",
    },
  })

  try {
    const assembly = await assembleAiContextForWorkOrder(admin, {
      organizationId: input.organizationId,
      workOrderId: input.workOrderId,
      source: input.source ?? "ai_decision_intelligence_bridge_service",
    })

    const providerResult = await invokeAiOsProviderWithContextPackage(admin, {
      organizationId: input.organizationId,
      contextPackage: assembly.contextPackage,
      purpose: AI_DECISION_INTELLIGENCE_PURPOSE,
      preferredProvider: input.preferredProvider,
      source: input.source ?? "ai_decision_intelligence_bridge_service",
    })

    const aiEvidence = buildAiDecisionEvidenceFromProviderResponse({
      response: providerResult.response,
      contextPackageId: assembly.contextPackage.id,
      providerRequestId: providerResult.requestId,
    })

    await publishBridgeEvent(admin, {
      organizationId: input.organizationId,
      eventType: "decision.ai_evidence_added",
      missionId: input.missionId,
      workOrderId: input.workOrderId,
      ownerAgent: input.ownerAgent,
      source: input.source,
      payload: {
        context_package_id: assembly.contextPackage.id,
        provider_request_id: providerResult.requestId,
        provider_id: providerResult.response.providerId,
        model_id: providerResult.response.modelId,
        evidence_count: aiEvidence.length,
        context_reused: assembly.reused,
      },
    })

    return {
      aiEvidence,
      used: aiEvidence.length > 0,
      failed: false,
      contextPackageId: assembly.contextPackage.id,
      providerRequestId: providerResult.requestId,
      failureReason: null,
    }
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : String(error)

    await publishBridgeEvent(admin, {
      organizationId: input.organizationId,
      eventType: "decision.ai_evidence_failed",
      missionId: input.missionId,
      workOrderId: input.workOrderId,
      ownerAgent: input.ownerAgent,
      source: input.source,
      payload: {
        detail: failureReason,
        fallback: "rule_only",
        source: input.source ?? "ai_decision_intelligence_bridge_service",
      },
    })

    return {
      ...EMPTY_RESULT,
      failed: true,
      failureReason,
    }
  }
}
