/** GE-AIOS-2H — Deterministic cost calculator (client-safe). */

/** Static expected cost catalog — no provider calls. */
export const AI_DECISION_ENGINE_COST_USD: Readonly<Record<string, number>> = {
  target_company: 0,
  verify_email: 0.01,
  select_primary_contact: 0.02,
  enrich_company: 0.05,
  build_buying_committee: 0.08,
  send_email: 0.1,
  pause_outreach: 0,
  launch_sequence: 0.15,
  change_messaging: 0.03,
  send_outbound: 0.12,
  schedule_meeting: 0.02,
  create_opportunity: 0.05,
  spend_apollo_credits: 0.25,
  pause_mission: 0,
  compliance_veto: 0,
  work_order_execute: 0.02,
  insufficient_evidence: 0,
}

export function calculateDecisionEngineCost(decisionKey: string): number {
  return AI_DECISION_ENGINE_COST_USD[decisionKey] ?? 0.02
}

export function calculateDecisionEngineExpectedValue(input: {
  decisionKey: string
  confidence: number
  expectedCostUsd: number
}): number | null {
  if (input.confidence < 45) return null
  const multiplier = input.decisionKey === "create_opportunity" ? 500 : input.decisionKey === "send_outbound" ? 50 : 10
  return Math.round((input.confidence / 100) * multiplier - input.expectedCostUsd * 100) / 100
}
