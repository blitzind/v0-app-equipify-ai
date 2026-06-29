/**
 * GE-AIOS-SAFETY-1 — Display adapter for guardrail decisions (client-safe).
 */

import type { AutonomousExecutionGuardrailDecision } from "@/lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-types"
import { summarizeAutonomousExecutionGuardrailDecision } from "@/lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-engine"

export type AutonomousExecutionGuardrailDisplay = {
  headline: string
  status_label: "Allowed" | "Requires approval" | "Blocked" | "Guardrails off"
  risk_level: AutonomousExecutionGuardrailDecision["riskLevel"]
  reasons: string[]
  blockers: string[]
  limits_applied: string[]
}

export function adaptAutonomousExecutionGuardrailToDisplay(
  decision: AutonomousExecutionGuardrailDecision,
): AutonomousExecutionGuardrailDisplay {
  const status_label = !decision.enabled
    ? "Guardrails off"
    : decision.blocked
      ? "Blocked"
      : decision.requiresApproval
        ? "Requires approval"
        : "Allowed"

  return {
    headline: summarizeAutonomousExecutionGuardrailDecision(decision),
    status_label,
    risk_level: decision.riskLevel,
    reasons: decision.reasons,
    blockers: decision.blockers,
    limits_applied: decision.limitsApplied,
  }
}
