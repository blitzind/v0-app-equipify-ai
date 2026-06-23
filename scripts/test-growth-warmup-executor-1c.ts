/**
 * GS-GROWTH-WARMUP-EXECUTOR-1C — JSON response contract + client safe parsing regression.
 * Run: pnpm test:growth-warmup-executor-1c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildWarmupExecutorErrorBody,
  buildWarmupExecutorSuccessBody,
  GROWTH_WARMUP_EXECUTOR_1C_QA_MARKER,
  parseWarmupExecutorClientResponse,
} from "../lib/growth/warmup/warmup-executor-api-response"
import { GROWTH_WARMUP_EXECUTOR_QA_MARKER } from "../lib/growth/warmup/warmup-executor-types"

function mockRunResult() {
  return {
    qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER,
    runId: "run-1",
    runKind: "manual" as const,
    idempotencyKey: "manual:2026-06-23T12:00:00.000Z",
    status: "completed" as const,
    profilesScanned: 2,
    sendsAttempted: 1,
    sendsSucceeded: 1,
    sendsFailed: 0,
    sendsSkipped: 0,
    senderResults: [
      {
        senderAccountId: "sender-1",
        senderEmail: "sender@equipify.ai",
        profileId: "profile-1",
        plannedToday: 5,
        sendsToday: 1,
        executorSendsToday: 1,
        remainingCapacity: 4,
        attempted: 1,
        sent: 1,
        skipped: 0,
        failed: 0,
        skipReasons: [],
      },
    ],
    skipReasons: [],
    previewOnly: false,
  }
}

function runTests(): void {
  console.log("\n=== GS-GROWTH-WARMUP-EXECUTOR-1C ===\n")

  assert.equal(GROWTH_WARMUP_EXECUTOR_1C_QA_MARKER, "growth-warmup-executor-1c-v1")
  console.log("  ✓ 1C QA marker")

  const successBody = buildWarmupExecutorSuccessBody(mockRunResult())
  assert.equal(successBody.ok, true)
  assert.equal(successBody.run.runId, "run-1")
  assert.equal(successBody.profileResults.length, 1)
  assert.equal(successBody.summary, null)
  assert.equal(successBody.qa_marker, GROWTH_WARMUP_EXECUTOR_QA_MARKER)
  console.log("  ✓ Success body exposes run/summary/profileResults contract")

  const errorBody = buildWarmupExecutorErrorBody({
    error: "Warmup batch failed unexpectedly.",
    code: "warmup_executor_failed",
    details: { run_id: "run-1" },
  })
  assert.equal(errorBody.ok, false)
  assert.equal(errorBody.code, "warmup_executor_failed")
  assert.equal(errorBody.error, errorBody.message)
  console.log("  ✓ Error body exposes ok/error/code/details contract")

  const emptyParse = parseWarmupExecutorClientResponse("", 500)
  assert.equal(emptyParse.ok, false)
  if (!emptyParse.ok) {
    assert.match(emptyParse.error, /Empty response from warmup executor/)
  }
  console.log("  ✓ Client handles empty body")

  const invalidParse = parseWarmupExecutorClientResponse("not-json", 500)
  assert.equal(invalidParse.ok, false)
  if (!invalidParse.ok) {
    assert.match(invalidParse.error, /Invalid JSON from warmup executor/)
    assert.ok(invalidParse.error.length <= 350)
  }
  console.log("  ✓ Client handles invalid JSON with safe preview")

  const validParse = parseWarmupExecutorClientResponse(JSON.stringify({ ok: false, error: "Denied" }), 403)
  assert.equal(validParse.ok, true)
  if (validParse.ok) {
    assert.equal(validParse.data.ok, false)
    assert.equal(validParse.data.error, "Denied")
  }
  console.log("  ✓ Client parses valid JSON failure payload")

  const routeFiles = [
    "app/api/platform/growth/warmup/executor/run/route.ts",
    "app/api/platform/growth/warmup/executor/preview/route.ts",
  ]
  for (const file of routeFiles) {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8")
    assert.match(source, /try \{/)
    assert.match(source, /catch \(error\)/)
    assert.match(source, /warmupExecutorJsonError/)
    assert.doesNotMatch(source, /status:\s*204/)
    assert.doesNotMatch(source, /new Response\(\s*\)/)
  }
  console.log("  ✓ Executor routes wrap failures and never return empty 204 bodies")

  const runRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/warmup/executor/run/route.ts"),
    "utf8",
  )
  assert.match(runRoute, /warmupExecutorJsonSuccess/)
  assert.match(runRoute, /warmup_executor_failed/)
  console.log("  ✓ Manual run route returns JSON success and failure payloads")

  const previewRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/warmup/executor/preview/route.ts"),
    "utf8",
  )
  assert.match(previewRoute, /buildWarmupExecutorSuccessBody/)
  assert.match(previewRoute, /preview,/)
  console.log("  ✓ Preview route preserves preview alias + JSON contract")

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-warmup-executor-panel.tsx"),
    "utf8",
  )
  assert.match(uiSource, /fetchWarmupExecutorJson/)
  assert.doesNotMatch(uiSource, /runBatch[\s\S]*response\.json\(\)/)
  console.log("  ✓ Executor panel uses safe JSON fetch for manual run")

  const executorSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/warmup/warmup-send-executor.ts"),
    "utf8",
  )
  assert.match(executorSource, /warmup_executor_transport_failed/)
  assert.match(executorSource, /warmup_executor_profile_failed/)
  assert.match(executorSource, /warmup_executor_finalize_failed/)
  console.log("  ✓ Executor logs transport/profile/finalize failures without secrets")

  const routeUtils = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/warmup/warmup-executor-route-utils.ts"),
    "utf8",
  )
  assert.match(routeUtils, /warmup_executor_api_error/)
  assert.match(routeUtils, /NextResponse\.json/)
  console.log("  ✓ Route utils always emit JSON error responses")

  console.log("\nGS-GROWTH-WARMUP-EXECUTOR-1C passed.\n")
}

runTests()
