/**
 * GS-RG-1 — wake batching regression checks.
 * Run: pnpm test:growth-wake-batching
 */
import assert from "node:assert/strict"
import {
  buildWakeBatchResult,
  parseWakeCursor,
  planWakeEvaluationBatch,
} from "../lib/growth/runtime-guardrails/growth-wake-guardrails"
import { GROWTH_RUNTIME_GUARDRAIL_LIMITS } from "../lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

async function main(): Promise<void> {
  const plan = planWakeEvaluationBatch({ totalWaits: 200 })
  assert.equal(plan.effectiveLimit, GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_WAKE_EVALUATIONS_PER_RUN)

  const orgCapped = planWakeEvaluationBatch({
    totalWaits: 200,
    alreadyProcessedThisOrg: GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_WAKE_EVALUATIONS_PER_ORG - 10,
  })
  assert.equal(orgCapped.effectiveLimit, 10)

  const disabled = planWakeEvaluationBatch({ totalWaits: 10, wakeExecutionEnabled: false })
  assert.equal(disabled.wakeExecutionEnabled, false)

  const batch = buildWakeBatchResult({
    waits: [
      { id: "a", createdAt: "2026-06-19T10:00:00.000Z" },
      { id: "b", createdAt: "2026-06-19T10:01:00.000Z" },
    ],
    totalAvailable: 10,
    processedThisRun: 2,
    priorCursor: null,
  })
  assert.equal(batch.wakeCursor, "2026-06-19T10:01:00.000Z|b")
  assert.equal(batch.remainingCount, 8)
  assert.equal(batch.truncated, true)

  const parsed = parseWakeCursor("2026-06-19T10:01:00.000Z|b")
  assert.equal(parsed.waitId, "b")

  console.log("GS-RG-1 wake batching regression checks passed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
