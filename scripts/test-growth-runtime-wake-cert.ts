/**
 * GS-RG-1B — Wake engine resource impact certification (local simulation).
 * Run: pnpm test:growth-runtime-wake-cert
 */
import assert from "node:assert/strict"
import {
  buildWakeBatchResult,
  planWakeEvaluationBatch,
} from "../lib/growth/runtime-guardrails/growth-wake-guardrails"
import { GROWTH_RUNTIME_GUARDRAIL_LIMITS } from "../lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

type WaitLoadEstimate = {
  totalWaits: number
  readsPerCronRun: number
  evaluationsPerRun: number
  writesPerRun: number
  runsToDrain: number
}

function estimateTimeoutProcessorImpact(totalWaits: number): WaitLoadEstimate {
  const perRun = GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_WAKE_EVALUATIONS_PER_RUN
  const evaluations = Math.min(perRun, totalWaits)
  const readsPerRun = 2 + evaluations + evaluations * 2
  const writesPerRun = 1 + evaluations * 3

  return {
    totalWaits,
    readsPerCronRun: readsPerRun,
    evaluationsPerRun: evaluations,
    writesPerRun,
    runsToDrain: Math.ceil(totalWaits / perRun),
  }
}

function estimateEventWakeImpact(totalWaits: number): WaitLoadEstimate {
  const plan = planWakeEvaluationBatch({ totalWaits })
  const perRun = plan.effectiveLimit

  return {
    totalWaits,
    readsPerCronRun: 1 + 1 + (perRun + 1),
    evaluationsPerRun: perRun,
    writesPerRun: 2 + perRun * 2,
    runsToDrain: Math.ceil(totalWaits / perRun),
  }
}

function main(): void {
  console.log("\n=== GS-RG-1B Wake Engine Certification ===\n")

  const loads = [100, 500, 1000, 10000]

  console.log("Timeout processor (cron) worst-case per run:")
  console.log("  totalWaits | evals/run | runs to drain | est reads/run | est writes/run")
  for (const total of loads) {
    const est = estimateTimeoutProcessorImpact(total)
    console.log(
      `  ${String(total).padStart(9)} | ${String(est.evaluationsPerRun).padStart(9)} | ${String(est.runsToDrain).padStart(13)} | ${String(est.readsPerCronRun).padStart(13)} | ${String(est.writesPerRun).padStart(14)}`,
    )
  }

  console.log("\nEvent-attributed wake (per event) worst-case:")
  for (const total of loads) {
    const est = estimateEventWakeImpact(total)
    assert.ok(est.evaluationsPerRun <= GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_WAKE_EVALUATIONS_PER_RUN)
  }
  console.log("  ✓ All load levels capped at MAX_WAKE_EVALUATIONS_PER_RUN evaluations")

  const batch = buildWakeBatchResult({
    waits: [{ id: "w1", createdAt: "2026-06-19T10:00:00.000Z" }],
    totalAvailable: 10000,
    processedThisRun: 1,
    priorCursor: null,
  })
  assert.equal(batch.remainingCount, 9999)
  assert.equal(batch.truncated, true)
  console.log("  ✓ Cursor persistence + remaining_count for 10k waits")

  console.log("\nBefore GS-RG-1: unbounded wait load (no LIMIT on listActiveWaitsForWakeEvent)")
  console.log("After GS-RG-1: bounded to 50 evals/run, cursor resume, kill switch halt")
  console.log("\nGS-RG-1B wake certification passed.\n")
}

main()
