/**
 * GS-GROWTH-WARMUP-CRON-1N — cron actor UUID + governance audit regression.
 * Run: pnpm test:growth-warmup-cron-1n
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_CRON_ACTOR_EMAIL,
  normalizeGrowthActorUserIdForDb,
  resolveGrowthActorForDb,
} from "../lib/growth/actor-user-id"
import {
  deriveWarmupCronExecutionOk,
  deriveWarmupCronFailureReason,
} from "../lib/growth/warmup/warmup-cron-telemetry"
import type { GrowthWarmupExecutorRunResult } from "../lib/growth/warmup/warmup-executor-types"

const OPERATOR_UUID = "a1b2c3d4-e5f6-4789-a012-3456789abcde"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function mockExecutorResult(
  overrides: Partial<GrowthWarmupExecutorRunResult> = {},
): GrowthWarmupExecutorRunResult {
  return {
    qa_marker: "growth-warmup-executor-1a-v1",
    runId: "run-1",
    runKind: "cron",
    idempotencyKey: "warmup-cron:2026-06-24:16",
    status: "failed",
    profilesScanned: 6,
    sendsAttempted: 6,
    sendsSucceeded: 0,
    sendsFailed: 6,
    sendsSkipped: 0,
    senderResults: [],
    skipReasons: [{ code: "profile_execution_failed", message: "invalid input syntax for type uuid: \"\"" }],
    previewOnly: false,
    ...overrides,
  }
}

async function runTests(): Promise<void> {
  console.log("\n=== GS-GROWTH-WARMUP-CRON-1N ===\n")

  const cronActor = resolveGrowthActorForDb({ actorUserId: undefined, actorEmail: GROWTH_CRON_ACTOR_EMAIL })
  assert.equal(cronActor.actorUserId, null)
  assert.equal(cronActor.actorEmail, GROWTH_CRON_ACTOR_EMAIL)
  console.log("  ✓ Cron actor resolves to null user id + cron email")

  const manualActor = resolveGrowthActorForDb({
    actorUserId: OPERATOR_UUID,
    actorEmail: "operator@equipify.ai",
  })
  assert.equal(manualActor.actorUserId, OPERATOR_UUID)
  assert.equal(manualActor.actorEmail, "operator@equipify.ai")
  console.log("  ✓ Manual actor preserves operator UUID + email")

  assert.equal(normalizeGrowthActorUserIdForDb(""), null)
  assert.equal(normalizeGrowthActorUserIdForDb(undefined), null)
  console.log("  ✓ Empty/undefined actor ids normalize to null")

  assert.equal(mockGovernanceAuditInsert(undefined), null)
  assert.equal(mockGovernanceAuditInsert(OPERATOR_UUID), OPERATOR_UUID)
  console.log("  ✓ Governance audit contract uses null actor_user_id for cron/system actor")

  const executorSource = readSource("lib/growth/warmup/warmup-send-executor.ts")
  assert.match(executorSource, /resolveGrowthActorForDb/)
  assert.doesNotMatch(executorSource, /actorUserId:\s*actorUserId\s*\?\?\s*""/)
  console.log("  ✓ Warmup executor uses actor helper and never passes actorUserId ?? \"\"")

  const transportSource = readSource("lib/growth/providers/transport/transport-orchestrator.ts")
  assert.match(transportSource, /resolveGrowthActorForDb/)
  assert.doesNotMatch(transportSource, /actorUserId:\s*actorUserId\s*\?\?\s*""/)
  console.log("  ✓ Transport orchestrator normalizes actor before governance")

  const approvalSource = readSource("lib/growth/governance/approval-audit.ts")
  assert.match(approvalSource, /normalizeGrowthActorUserIdForDb/)
  console.log("  ✓ Governance approval audit normalizes actor_user_id before insert")

  const failedAll = mockExecutorResult()
  assert.equal(deriveWarmupCronExecutionOk(failedAll), false)
  assert.ok(deriveWarmupCronFailureReason(failedAll)?.includes("uuid"))
  console.log("  ✓ All-profile failed cron run marked executionOk=false with failure_reason")

  const partial = mockExecutorResult({
    status: "partial",
    sendsSucceeded: 2,
    sendsFailed: 4,
  })
  assert.equal(deriveWarmupCronExecutionOk(partial), true)
  assert.equal(deriveWarmupCronFailureReason(partial), null)
  console.log("  ✓ Partial-success cron run remains executionOk=true")

  const cronRoute = readSource("app/api/cron/growth-warmup-send-executor/route.ts")
  assert.match(cronRoute, /deriveWarmupCronExecutionOk/)
  assert.match(cronRoute, /failure_reason/)
  console.log("  ✓ Warmup cron route records executionOk + failure_reason metadata")

  const cronRunner = readSource("lib/growth/runtime/growth-cron-runner.ts")
  assert.match(cronRunner, /executionOk/)
  console.log("  ✓ Growth cron runner respects executionOk telemetry flag")

  console.log("\nGS-GROWTH-WARMUP-CRON-1N passed.\n")
}

function mockGovernanceAuditInsert(actorUserId: unknown): string | null {
  return normalizeGrowthActorUserIdForDb(actorUserId)
}

runTests().catch((error) => {
  console.error(error)
  process.exit(1)
})
