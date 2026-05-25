import type {
  ExecutionPriorityBand,
  ExecutionPrioritySignal,
  ExecutionPrioritySignalKey,
  ExecutionPrioritySignalsInput,
} from "@/lib/growth/execution/execution-priority-types"

export const EXECUTION_SIGNAL_WEIGHTS: Record<ExecutionPrioritySignalKey, number> = {
  deal_risk_increase: 18,
  competitor_detected: 12,
  buying_signal_detected: 10,
  meeting_follow_up_overdue: 14,
  next_step_missing: 12,
  unanswered_reply: 14,
  high_confidence_close_window: 16,
  renewal_risk: 15,
  expansion_candidate: 8,
  low_call_score: 10,
  stalled_opportunity: 12,
  no_owner_assigned: 8,
  open_objections: 11,
  onboarding_stalled: 13,
  provider_failure: 9,
  calendar_conflict: 7,
  call_quality_decline: 10,
  missing_follow_up: 13,
  stale_opportunity: 11,
}

export const EXECUTION_SIGNAL_LABELS: Record<ExecutionPrioritySignalKey, string> = {
  deal_risk_increase: "Deal risk increased",
  competitor_detected: "Competitor detected",
  buying_signal_detected: "Buying signal detected",
  meeting_follow_up_overdue: "Meeting follow-up overdue",
  next_step_missing: "Next step missing",
  unanswered_reply: "Unanswered reply",
  high_confidence_close_window: "High-confidence close window",
  renewal_risk: "Renewal at risk",
  expansion_candidate: "Expansion candidate",
  low_call_score: "Low call score",
  stalled_opportunity: "Stalled opportunity",
  no_owner_assigned: "No owner assigned",
  open_objections: "Open objections",
  onboarding_stalled: "Onboarding stalled",
  provider_failure: "Provider failure",
  calendar_conflict: "Calendar conflict",
  call_quality_decline: "Call quality decline",
  missing_follow_up: "Missing follow-up",
  stale_opportunity: "Stale opportunity",
}

export function resolveExecutionPriorityBand(score: number): ExecutionPriorityBand {
  if (score >= 80) return "critical"
  if (score >= 60) return "high"
  if (score >= 40) return "medium"
  return "low"
}

export function buildExecutionPrioritySignals(
  input: ExecutionPrioritySignalsInput,
): ExecutionPrioritySignal[] {
  const signals: ExecutionPrioritySignal[] = []
  for (const [key, active] of Object.entries(input) as Array<[ExecutionPrioritySignalKey, boolean | undefined]>) {
    if (!active) continue
    signals.push({
      key,
      label: EXECUTION_SIGNAL_LABELS[key],
      weight: EXECUTION_SIGNAL_WEIGHTS[key],
    })
  }
  return signals.sort((a, b) => b.weight - a.weight)
}

export function computeExecutionPriorityScore(input: ExecutionPrioritySignalsInput): {
  executionPriorityScore: number
  priorityBand: ExecutionPriorityBand
  signals: ExecutionPrioritySignal[]
} {
  const signals = buildExecutionPrioritySignals(input)
  const raw = signals.reduce((sum, signal) => sum + signal.weight, 0)
  const executionPriorityScore = Math.max(0, Math.min(100, raw))
  return {
    executionPriorityScore,
    priorityBand: resolveExecutionPriorityBand(executionPriorityScore),
    signals,
  }
}

export function executionPriorityBandTone(
  band: ExecutionPriorityBand,
): "critical" | "attention" | "medium" | "neutral" {
  if (band === "critical") return "critical"
  if (band === "high") return "attention"
  if (band === "medium") return "medium"
  return "neutral"
}

export function executionPressureLabel(pressure: number): string {
  if (pressure >= 85) return "Critical overload"
  if (pressure >= 70) return "High pressure"
  if (pressure >= 50) return "Elevated load"
  if (pressure >= 30) return "Manageable"
  return "Light load"
}
