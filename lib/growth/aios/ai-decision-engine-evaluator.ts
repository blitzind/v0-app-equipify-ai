/** GE-AIOS-2H — Decision Engine rule evaluator (client-safe). */

import { lookupAiDecisionRegistryEntry } from "@/lib/growth/aios/ai-decision-record-registry"
import { calculateDecisionEngineCost, calculateDecisionEngineExpectedValue } from "@/lib/growth/aios/ai-decision-engine-cost"
import {
  calculateDecisionEngineConfidence,
  isDecisionEngineEvidenceSufficient,
} from "@/lib/growth/aios/ai-decision-engine-confidence"
import { collectAiDecisionEngineEvidence } from "@/lib/growth/aios/ai-decision-engine-evidence-collector"
import { calculateDecisionEngineRisk } from "@/lib/growth/aios/ai-decision-engine-risk"
import { buildDecisionEngineRecommendation } from "@/lib/growth/aios/ai-decision-engine-recommendation"
import { resolveDecisionKeyForWorkOrderType } from "@/lib/growth/aios/ai-decision-engine-work-order-binding"
import type { AiDecisionEngineEvaluationResult, AiDecisionEngineEvidenceCollectInput } from "@/lib/growth/aios/ai-decision-engine-types"
import type { AiWorkOrder } from "@/lib/growth/aios/ai-work-order-types"

export function evaluateAiDecisionEngineRules(input: {
  workOrder: AiWorkOrder
  decisionKey?: string
  evidenceInput: AiDecisionEngineEvidenceCollectInput
  degradedMode?: boolean
}): AiDecisionEngineEvaluationResult {
  const bindingKey = input.decisionKey ?? resolveDecisionKeyForWorkOrderType(input.workOrder.workOrderType)
  const evidenceBundle = collectAiDecisionEngineEvidence(input.evidenceInput)
  const confidence = calculateDecisionEngineConfidence(evidenceBundle)
  const sufficientEvidence = isDecisionEngineEvidenceSufficient(confidence) && !input.degradedMode

  const decisionKey = sufficientEvidence
    ? bindingKey
    : "insufficient_evidence"

  const riskScore = calculateDecisionEngineRisk({
    decisionKey,
    confidence,
    evidence: evidenceBundle,
    workOrderPriority: input.workOrder.priority,
  })

  const expectedCostUsd = calculateDecisionEngineCost(decisionKey)
  const expectedValueUsd = calculateDecisionEngineExpectedValue({
    decisionKey,
    confidence,
    expectedCostUsd,
  })

  const recommendation = buildDecisionEngineRecommendation({
    decisionKey,
    workOrderType: input.workOrder.workOrderType,
    confidence,
    riskScore,
    sufficientEvidence,
  })

  const registry = lookupAiDecisionRegistryEntry(decisionKey)
  const requestStatus = sufficientEvidence && recommendation.proceed ? "evaluated" : "insufficient_evidence"

  return {
    requestStatus,
    decisionKey,
    evidenceBundle,
    confidence,
    riskScore,
    expectedCostUsd,
    expectedValueUsd,
    recommendation,
    evaluation: {
      work_order_type: input.workOrder.workOrderType,
      work_order_status: input.workOrder.status,
      owner_agent: registry?.ownerAgent ?? input.workOrder.assignedAgent,
      evidence_count: evidenceBundle.length,
      degraded_mode: input.degradedMode ?? false,
      confidence_band: recommendation.confidenceBand,
    },
  }
}
