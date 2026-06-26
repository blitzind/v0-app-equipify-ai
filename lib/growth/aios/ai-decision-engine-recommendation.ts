/** GE-AIOS-2H — Recommendation builder (client-safe, rule-based). */

import type { AiDecisionActionRef } from "@/lib/growth/aios/ai-decision-record-types"
import { lookupAiDecisionRegistryEntry } from "@/lib/growth/aios/ai-decision-record-registry"
import { lookupDecisionEngineWorkOrderBinding } from "@/lib/growth/aios/ai-decision-engine-work-order-binding"
import type { AiDecisionEngineRecommendation } from "@/lib/growth/aios/ai-decision-engine-types"
import { resolveDecisionConfidenceBand } from "@/lib/growth/aios/ai-decision-engine-types"
import type { AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"

const DEFER_ACTION: AiDecisionActionRef = {
  actionKey: "defer",
  label: "Defer — insufficient evidence",
}

export function buildDecisionEngineRecommendation(input: {
  decisionKey: string
  workOrderType: AiWorkOrderType
  confidence: number
  riskScore: number
  sufficientEvidence: boolean
}): AiDecisionEngineRecommendation {
  const band = resolveDecisionConfidenceBand(input.confidence)
  const binding = lookupDecisionEngineWorkOrderBinding(input.workOrderType)
  const registry = lookupAiDecisionRegistryEntry(input.decisionKey)

  if (!input.sufficientEvidence || input.decisionKey === "insufficient_evidence") {
    return {
      chosenAction: DEFER_ACTION,
      rejectedActions: [{ actionKey: binding.defaultActionKey, label: "Proceed blocked" }],
      explanation: "Evidence insufficient for constitutional proceed threshold (confidence < 45).",
      confidenceBand: band,
      proceed: false,
    }
  }

  const chosenAction: AiDecisionActionRef = {
    actionKey: binding.defaultActionKey,
    label: registry?.description ?? binding.defaultActionKey,
  }

  const rejectedActions: AiDecisionActionRef[] = []
  if (input.riskScore >= 70) {
    rejectedActions.push({ actionKey: "defer", label: "High risk deferral considered" })
  }
  if (band === "low") {
    rejectedActions.push({ actionKey: "recommend_only", label: "Recommend only — low confidence band" })
  }

  return {
    chosenAction,
    rejectedActions,
    explanation: `Rule evaluation for ${input.decisionKey}: confidence ${input.confidence}, risk ${input.riskScore}, band ${band}.`,
    confidenceBand: band,
    proceed: band !== "insufficient",
  }
}
