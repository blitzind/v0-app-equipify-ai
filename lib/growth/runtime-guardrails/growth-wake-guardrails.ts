/** GS-RG-1 — wake evaluation guardrails (client-safe). */

import {
  GROWTH_RUNTIME_GUARDRAIL_LIMITS,
} from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

export type WakeEvaluationBatchPlan = {
  limit: number
  cursor: string | null
  wakeExecutionEnabled: boolean
}

export type WakeEvaluationBatchResult = {
  wakeCursor: string | null
  processedCount: number
  remainingCount: number
  truncated: boolean
}

export function planWakeEvaluationBatch(input: {
  totalWaits: number
  cursor?: string | null
  perRunCap?: number
  alreadyProcessedThisOrg?: number
  perOrgCap?: number
  wakeExecutionEnabled?: boolean
}): WakeEvaluationBatchPlan & { effectiveLimit: number } {
  const perRunCap = input.perRunCap ?? GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_WAKE_EVALUATIONS_PER_RUN
  const perOrgCap = input.perOrgCap ?? GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_WAKE_EVALUATIONS_PER_ORG
  const orgRemaining = Math.max(0, perOrgCap - (input.alreadyProcessedThisOrg ?? 0))
  const effectiveLimit = Math.min(perRunCap, orgRemaining, input.totalWaits)

  return {
    limit: perRunCap,
    cursor: input.cursor ?? null,
    wakeExecutionEnabled: input.wakeExecutionEnabled !== false,
    effectiveLimit,
  }
}

export function buildWakeBatchResult(input: {
  waits: Array<{ id: string; createdAt: string }>
  totalAvailable: number
  processedThisRun: number
  priorCursor: string | null
}): WakeEvaluationBatchResult {
  const lastProcessed = input.waits.at(-1)
  const wakeCursor = lastProcessed
    ? `${lastProcessed.createdAt}|${lastProcessed.id}`
    : input.priorCursor

  const remainingCount = Math.max(0, input.totalAvailable - input.processedThisRun)

  return {
    wakeCursor,
    processedCount: input.processedThisRun,
    remainingCount,
    truncated: remainingCount > 0,
  }
}

export function parseWakeCursor(cursor: string | null): { createdAt: string | null; waitId: string | null } {
  if (!cursor) return { createdAt: null, waitId: null }
  const [createdAt, waitId] = cursor.split("|")
  return {
    createdAt: createdAt?.trim() || null,
    waitId: waitId?.trim() || null,
  }
}
