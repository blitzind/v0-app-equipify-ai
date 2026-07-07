/**
 * GE-AVA-LAUNCH-RUN-TRACE-1 — Ava launch run service failure trace certification.
 * Run: pnpm test:ge-ava-launch-run-trace-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  AVA_LAUNCH_STAGE,
  buildAvaLaunchFailureTraceRecord,
  GROWTH_AVA_LAUNCH_RUN_TRACE_1_QA_MARKER,
  resolveExceptionTrace,
} from "../lib/growth/mission-center/growth-mission-ava-launch-run-trace-types"
import { GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR } from "../lib/growth/mission-center/growth-mission-ava-launch-run-api-contract"
import { AVA_LAUNCH_VALIDATOR_LAUNCH_SERVICE } from "../lib/growth/mission-center/growth-ava-launch-search-validation-trace"

const PHASE = "GE-AVA-LAUNCH-RUN-TRACE-1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

const SERVICE_FAILURES: Array<{ code: string; stage: string }> = [
  { code: "approved_by_user_required", stage: AVA_LAUNCH_STAGE.audience_draft },
  { code: "growth_profile_schema_not_ready", stage: AVA_LAUNCH_STAGE.audience_draft },
  { code: "growth_profile_not_approved", stage: AVA_LAUNCH_STAGE.audience_draft },
  { code: "mission_not_found", stage: AVA_LAUNCH_STAGE.mission_lookup },
  { code: "mission_org_mismatch", stage: AVA_LAUNCH_STAGE.mission_lookup },
  { code: "started.error", stage: AVA_LAUNCH_STAGE.provider_launch },
  { code: "bound.error", stage: AVA_LAUNCH_STAGE.bind_results },
  { code: "polled.error", stage: AVA_LAUNCH_STAGE.provider_launch },
  { code: "datamoon_poll_incomplete", stage: AVA_LAUNCH_STAGE.provider_launch },
  { code: "exceptionTrace.message", stage: AVA_LAUNCH_STAGE.provider_launch },
]

async function main(): Promise<void> {
  console.log(`[${PHASE}] Ava launch run service trace certification`)

  assert.equal(GROWTH_AVA_LAUNCH_RUN_TRACE_1_QA_MARKER, "ge-ava-launch-run-trace-1-v1")

  const traceSource = readSource("lib/growth/mission-center/growth-mission-ava-launch-run-trace.ts")
  const traceTypesSource = readSource("lib/growth/mission-center/growth-mission-ava-launch-run-trace-types.ts")
  assert.match(traceSource, /AVA_LAUNCH_FAILURE_RETURN/)
  assert.match(traceSource, /logAvaLaunchStage/)
  assert.match(traceSource, /returnAvaLaunchFailure/)
  assert.match(traceTypesSource, /AVA_LAUNCH_STAGE/)
  assert.match(traceTypesSource, /resolveExceptionTrace/)

  const service = readSource("lib/growth/mission-center/growth-mission-ava-launch-run-service.ts")
  assert.match(service, /returnAvaLaunchFailure/)
  assert.match(service, /logAvaLaunchStage/)
  assert.match(service, /AVA_LAUNCH_STAGE\.audience_draft/)
  assert.match(service, /AVA_LAUNCH_STAGE\.mission_lookup/)
  assert.match(service, /AVA_LAUNCH_STAGE\.bound_search_lookup/)
  assert.match(service, /AVA_LAUNCH_STAGE\.provider_request/)
  assert.match(service, /AVA_LAUNCH_STAGE\.datamoon_validation/)
  assert.match(service, /AVA_LAUNCH_STAGE\.provider_launch/)
  assert.match(service, /AVA_LAUNCH_STAGE\.bind_results/)
  assert.match(service, /AVA_LAUNCH_STAGE\.autonomy_start/)
  assert.match(service, /started\.issues/)
  assert.match(service, /resolveExceptionTrace/)

  for (const failure of SERVICE_FAILURES) {
    if (failure.code === "started.error") {
      assert.match(service, /started\.error === "validation_failed"/)
      continue
    }
    assert.match(service, new RegExp(`code: "${failure.code.replace(/\./g, "\\.")}"|code: ${failure.code.replace(/\./g, "\\.")}`))
  }

  assert.match(service, /error: "approved_by_user_required"/)
  assert.match(service, /error: "growth_profile_schema_not_ready"/)
  assert.match(service, /error: "growth_profile_not_approved"/)
  assert.match(service, /error: "mission_not_found"/)
  assert.match(service, /error: "mission_org_mismatch"/)
  assert.match(service, /error: started\.error/)
  assert.match(service, /error: bound\.error/)
  assert.match(service, /error: polled\.error/)
  assert.match(service, /error: "datamoon_poll_incomplete"/)
  assert.match(service, /error: exceptionTrace\.message/)

  const failureReturns = service.match(/returnAvaLaunchFailure\(/g) ?? []
  assert.equal(failureReturns.length, 10, "expected 10 traced failure returns in launch service")

  const record = buildAvaLaunchFailureTraceRecord({
    stage: AVA_LAUNCH_STAGE.datamoon_validation,
    code: "validation_failed",
    message: "validation_failed",
    original: { issues: [{ code: "topic_ids_required", message: "b2b and b2c audiences require at least one topic_id." }] },
    validator: AVA_LAUNCH_VALIDATOR_LAUNCH_SERVICE,
    payload: { audience_type: "b2b", topic_ids: [] },
  })
  assert.equal(record.stage, AVA_LAUNCH_STAGE.datamoon_validation)
  assert.equal(record.validator, AVA_LAUNCH_VALIDATOR_LAUNCH_SERVICE)
  assert.equal(record.code, "validation_failed")

  const exception = resolveExceptionTrace(new Error("Validation failed"))
  assert.equal(exception.message, "Validation failed")
  assert.ok(exception.stack)

  const diagnostics = readSource("lib/growth/mission-center/growth-ava-launch-validation-diagnostics.ts")
  assert.match(
    diagnostics,
    /case "validation_failed":[\s\S]*message: error[\s\S]*validator: AVA_LAUNCH_VALIDATOR_LAUNCH_SERVICE/,
  )
  assert.doesNotMatch(service, /Validation failed/)

  console.log(`[${PHASE}] generic collapse note:`)
  console.log(
    JSON.stringify(
      {
        serviceReturns: "validation_failed (lowercase) with issues on started.issues when Datamoon validation fails",
        routeMapsGenericWhen:
          "mapServiceErrorToAvaLaunchValidationErrors re-validates providerRequest; if ok, message becomes error string",
        genericConstant: GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR,
        firstGenericMessageAssignmentOutsideService:
          "lib/growth/mission-center/growth-ava-launch-validation-diagnostics.ts mapServiceErrorToAvaLaunchValidationErrors validation_failed case OR growth-mission-ava-launch-run-api-contract.ts ensureGrowthAvaLaunchValidationErrors fallback",
      },
      null,
      2,
    ),
  )

  console.log(`[${PHASE}] passed`)
}

void main()
