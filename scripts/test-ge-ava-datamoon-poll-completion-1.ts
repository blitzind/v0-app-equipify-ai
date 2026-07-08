/**
 * GE-AVA-DATAMOON-POLL-COMPLETION-1 — Bounded Datamoon poll wait certification.
 * Run: pnpm test:ge-ava-datamoon-poll-completion-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  DATAMOON_AUDIENCE_POLL_WAIT_INTERVAL_MS,
  DATAMOON_AUDIENCE_POLL_WAIT_MAX_MS,
  GROWTH_AVA_DATAMOON_POLL_COMPLETION_1_QA_MARKER,
  GROWTH_DATAMOON_POLL_PENDING_ERROR,
  GROWTH_DATAMOON_POLL_PENDING_MESSAGE,
  classifyDatamoonAudiencePollRunStatus,
  isDatamoonAudienceImportRunImportReady,
  resolveDatamoonAudiencePollWaitTimeoutError,
  shouldContinueDatamoonAudiencePollWait,
} from "../lib/growth/lead-sources/datamoon/datamoon-audience-poll-wait"
import { isGrowthMissionAvaLaunchValidationFailureError } from "../lib/growth/mission-center/growth-mission-ava-launch-run-api-contract"

const PHASE = "GE-AVA-DATAMOON-POLL-COMPLETION-1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Datamoon bounded poll wait certification`)

  assert.equal(GROWTH_AVA_DATAMOON_POLL_COMPLETION_1_QA_MARKER, "ge-ava-datamoon-poll-completion-1-v1")
  assert.equal(DATAMOON_AUDIENCE_POLL_WAIT_INTERVAL_MS, 2_500)
  assert.equal(DATAMOON_AUDIENCE_POLL_WAIT_MAX_MS, 25_000)

  const service = readSource("lib/growth/mission-center/growth-mission-ava-launch-run-service.ts")
  const importService = readSource("lib/growth/lead-sources/datamoon/datamoon-audience-import-service.ts")
  const route = readSource("app/api/platform/growth/mission-center/[missionId]/ava-launch-run/route.ts")

  assert.match(service, /waitForDatamoonAudienceImportRunPollCompletion/)
  assert.doesNotMatch(service, /pollDatamoonAudienceImportRun\(admin, started\.run\.id\)/)
  assert.match(service, /error: pollWait\.error/)
  assert.match(service, /pollWait\.error === "datamoon_poll_pending" \? 409 : 400/)
  assert.match(service, /message: pollWait\.message/)
  assert.match(importService, /waitForDatamoonAudienceImportRunPollCompletion/)
  assert.match(importService, /datamoon_audience_import_poll_waiting/)
  assert.match(route, /result\.message/)

  assert.equal(isDatamoonAudienceImportRunImportReady("completed"), true)
  assert.equal(isDatamoonAudienceImportRunImportReady("imported_partial"), true)
  assert.equal(isDatamoonAudienceImportRunImportReady("building"), false)
  assert.equal(classifyDatamoonAudiencePollRunStatus("building"), "building")
  assert.equal(classifyDatamoonAudiencePollRunStatus("pending_build"), "building")

  assert.equal(
    shouldContinueDatamoonAudiencePollWait({ elapsedMs: 5_000, maxWaitMs: 25_000, runStatus: "building" }),
    true,
  )
  assert.equal(
    shouldContinueDatamoonAudiencePollWait({ elapsedMs: 25_000, maxWaitMs: 25_000, runStatus: "building" }),
    false,
  )
  assert.equal(
    shouldContinueDatamoonAudiencePollWait({ elapsedMs: 0, maxWaitMs: 25_000, runStatus: "completed" }),
    false,
  )

  const pending = resolveDatamoonAudiencePollWaitTimeoutError({ runStatus: "building" })
  assert.equal(pending.error, GROWTH_DATAMOON_POLL_PENDING_ERROR)
  assert.equal(pending.message, GROWTH_DATAMOON_POLL_PENDING_MESSAGE)

  assert.equal(isGrowthMissionAvaLaunchValidationFailureError(GROWTH_DATAMOON_POLL_PENDING_ERROR), false)
  assert.equal(isGrowthMissionAvaLaunchValidationFailureError("datamoon_poll_incomplete"), false)

  let attempts = 0
  const statuses = ["building", "building", "completed"]
  const sleepCalls: number[] = []
  const poll = async () => {
    const status = statuses[attempts] ?? "completed"
    attempts += 1
    return { ok: true as const, run: { status, previewCount: status === "completed" ? 3 : 0 }, records: [] }
  }

  const startedAt = Date.now()
  while (true) {
    const result = await poll()
    if (isDatamoonAudienceImportRunImportReady(result.run.status)) break
    const elapsedMs = attempts * DATAMOON_AUDIENCE_POLL_WAIT_INTERVAL_MS
    if (!shouldContinueDatamoonAudiencePollWait({ elapsedMs, maxWaitMs: 25_000, runStatus: result.run.status })) {
      throw new Error("expected simulated poll loop to complete before timeout")
    }
    sleepCalls.push(DATAMOON_AUDIENCE_POLL_WAIT_INTERVAL_MS)
  }
  assert.equal(attempts, 3)
  assert.equal(sleepCalls.length, 2)
  assert.ok(Date.now() - startedAt < 100)

  console.log(`[${PHASE}] recommended settings`, {
    intervalMs: DATAMOON_AUDIENCE_POLL_WAIT_INTERVAL_MS,
    maxWaitMs: DATAMOON_AUDIENCE_POLL_WAIT_MAX_MS,
    maxAttemptsApprox: Math.ceil(DATAMOON_AUDIENCE_POLL_WAIT_MAX_MS / DATAMOON_AUDIENCE_POLL_WAIT_INTERVAL_MS),
  })
  console.log(`[${PHASE}] passed`)
}

void main()
