/** GS-RG-1 — cascade budget tracking (client-safe). */

import { GROWTH_RUNTIME_GUARDRAIL_LIMITS } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

export type CascadeBudgetCounters = {
  writesGenerated: number
  notificationsGenerated: number
  wakeEvaluationsGenerated: number
}

export function createCascadeBudgetCounters(): CascadeBudgetCounters {
  return {
    writesGenerated: 0,
    notificationsGenerated: 0,
    wakeEvaluationsGenerated: 0,
  }
}

export function totalCascadeSideEffects(counters: CascadeBudgetCounters): number {
  return (
    counters.writesGenerated +
    counters.notificationsGenerated +
    counters.wakeEvaluationsGenerated
  )
}

export function evaluateCascadeBudget(
  counters: CascadeBudgetCounters,
  cap = GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_EVENT_SIDE_EFFECTS,
): { allowed: boolean; total: number; reason: string | null } {
  const total = totalCascadeSideEffects(counters)
  if (total >= cap) {
    return {
      allowed: false,
      total,
      reason: `Cascade budget exceeded: ${total} side effects (cap ${cap}).`,
    }
  }
  return { allowed: true, total, reason: null }
}

export function incrementCascadeWrite(counters: CascadeBudgetCounters, volume = 1): CascadeBudgetCounters {
  return { ...counters, writesGenerated: counters.writesGenerated + volume }
}

export function incrementCascadeNotification(
  counters: CascadeBudgetCounters,
  volume = 1,
): CascadeBudgetCounters {
  return { ...counters, notificationsGenerated: counters.notificationsGenerated + volume }
}

export function incrementCascadeWakeEvaluation(
  counters: CascadeBudgetCounters,
  volume = 1,
): CascadeBudgetCounters {
  return { ...counters, wakeEvaluationsGenerated: counters.wakeEvaluationsGenerated + volume }
}
