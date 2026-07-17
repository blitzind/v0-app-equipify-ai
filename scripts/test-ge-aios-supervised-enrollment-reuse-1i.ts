/**
 * GE-AIOS-SUPERVISED-ENROLLMENT-REUSE-1I — certification.
 * Run: pnpm test:ge-aios-supervised-enrollment-reuse-1i
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GE_AIOS_SUPERVISED_ENROLLMENT_REUSE_1I_QA_MARKER,
  SUPERVISED_ENROLLMENT_REUSE_CONFLICT_PREFIX,
  formatSupervisedEnrollmentReuseConflict,
  parseSupervisedEnrollmentReuseConflict,
} from "../lib/growth/mission-center/growth-ava-outreach-enrollment-reuse-1i-types"

const PHASE = "GE-AIOS-SUPERVISED-ENROLLMENT-REUSE-1I" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Supervised enrollment reuse certification`)

  assert.equal(GE_AIOS_SUPERVISED_ENROLLMENT_REUSE_1I_QA_MARKER, "ge-aios-supervised-enrollment-reuse-1i-v1")

  const reuse = readSource("lib/growth/mission-center/growth-ava-outreach-enrollment-reuse-1i.ts")
  assert.match(reuse, /validateSupervisedExecutionEnrollmentReuse/)
  assert.match(reuse, /enrollment_pattern_mismatch/)
  assert.match(reuse, /pickInProgressEnrollmentStep/)

  const fulfillment = readSource(
    "lib/growth/mission-center/growth-ava-outreach-execution-request-fulfillment-service.ts",
  )
  assert.match(fulfillment, /validateSupervisedExecutionEnrollmentReuse/)
  assert.match(fulfillment, /input\.request\.sequenceEnrollmentId/)
  assert.match(fulfillment, /createGrowthSequenceEnrollmentDraft/)
  assert.match(fulfillment, /findActiveSequenceExecutionJob/)
  assert.match(fulfillment, /enrollmentReuse: true/)
  assert.match(fulfillment, /job_reused: true/)
  assert.match(fulfillment, /supervisedExecutionRequestFulfillment: true/)
  assert.doesNotMatch(fulfillment, /executeTransportSend|sendSms|runSequenceExecutionJob/)

  const executionService = readSource("lib/growth/mission-center/growth-ava-outreach-execution-request-service.ts")
  assert.match(executionService, /boundSequenceEnrollmentId: existing\.sequenceEnrollmentId/)

  const handoffService = readSource("lib/growth/mission-center/growth-ava-outreach-sequence-handoff-service-1f.ts")
  assert.match(handoffService, /excludeEnrollmentId: input\.boundSequenceEnrollmentId/)

  const bridge = readSource("lib/growth/aios/growth/growth-send-plane-1a-copilot-bridge.ts")
  assert.match(bridge, /supervisedApprovedOperatorFastPath/)
  assert.doesNotMatch(bridge, /sequenceEnrollmentId/)

  const orchestrator = readSource("lib/growth/sequence-enrollment/sequence-enrollment-orchestrator.ts")
  assert.doesNotMatch(orchestrator, /validateSupervisedExecutionEnrollmentReuse/)

  const retryRoute = readSource(
    "app/api/platform/growth/ai-os/autonomous-outreach-preparation-pilot/execution-requests/[requestId]/retry/route.ts",
  )
  assert.match(retryRoute, /SUPERVISED_ENROLLMENT_REUSE_CONFLICT_PREFIX/)

  const conflict = {
    qaMarker: GE_AIOS_SUPERVISED_ENROLLMENT_REUSE_1I_QA_MARKER,
    enrollmentId: "a362d777-ea07-44c7-bb66-702bc3bc3973",
    requestedPatternId: "pat-a",
    existingPatternId: "pat-b",
    resumabilityStatus: "active",
    blockingReason: "enrollment_pattern_mismatch",
  }
  const encoded = formatSupervisedEnrollmentReuseConflict(conflict)
  assert.ok(encoded.startsWith(SUPERVISED_ENROLLMENT_REUSE_CONFLICT_PREFIX))
  assert.deepEqual(parseSupervisedEnrollmentReuseConflict(encoded), conflict)
  assert.equal(parseSupervisedEnrollmentReuseConflict("active_enrollment"), null)

  console.log(`[${PHASE}] passed`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
