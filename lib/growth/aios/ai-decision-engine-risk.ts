/** GE-AIOS-2H — Deterministic risk calculator (client-safe). */

import {
  clampDecisionRiskScore,
  type AiDecisionEvidenceRef,
} from "@/lib/growth/aios/ai-decision-record-types"

const HIGH_RISK_DECISION_KEYS = new Set([
  "send_outbound",
  "send_email",
  "launch_sequence",
  "spend_apollo_credits",
  "create_opportunity",
])

export function calculateDecisionEngineRisk(input: {
  decisionKey: string
  confidence: number
  evidence: AiDecisionEvidenceRef[]
  workOrderPriority?: number
}): number {
  let risk = 100 - input.confidence

  if (HIGH_RISK_DECISION_KEYS.has(input.decisionKey)) risk += 15
  if (input.evidence.length === 0) risk += 25
  if (input.evidence.length < 2) risk += 10

  const priority = input.workOrderPriority ?? 500
  if (priority >= 800) risk += 5

  return clampDecisionRiskScore(Math.round(risk))
}
