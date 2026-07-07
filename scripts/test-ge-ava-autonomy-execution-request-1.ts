/**
 * GE-AVA-AUTONOMY-EXECUTION-REQUEST-1 — Execution Request orchestration certification.
 * Run: pnpm test:ge-ava-autonomy-execution-request-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
  GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_FEATURE_FLAG,
} from "../lib/growth/mission-center/growth-ava-outreach-execution-request-types"

const PHASE = "GE-AVA-AUTONOMY-EXECUTION-REQUEST-1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Execution Request orchestration certification`)

  assert.equal(GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER, "ge-ava-autonomy-execution-request-1-v1")
  assert.equal(GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_FEATURE_FLAG, "GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_ENABLED")

  const service = readSource("lib/growth/mission-center/growth-ava-outreach-execution-request-service.ts")
  assert.match(service, /submitAvaOutreachPackageApprovalAction/)
  assert.match(service, /persistExecutionRequest/)
  assert.match(service, /publishAiOsEvent/)
  assert.doesNotMatch(service, /executeTransportSend|sendSms|runSequenceExecutionJob/)

  const fulfillment = readSource(
    "lib/growth/mission-center/growth-ava-outreach-execution-request-fulfillment-service.ts",
  )
  assert.match(fulfillment, /createGrowthSequenceEnrollmentDraft/)
  assert.match(fulfillment, /queueSequenceStepTransportJob/)
  assert.doesNotMatch(fulfillment, /executeTransportSend|sendSms|runSequenceExecutionJob|approveSequenceExecutionJob/)

  const route = readSource(
    "app/api/platform/growth/ai-os/autonomous-outreach-preparation-pilot/packages/[packageId]/action/route.ts",
  )
  assert.match(route, /submitAvaOutreachPackageApprovalAction/)
  assert.match(route, /transportBlocked: true/)
  assert.doesNotMatch(route, /executeTransportSend|sendEmail|outboundExecution/i)

  const hac = readSource("lib/growth/aios/approvals/growth-human-approval-center-engine.ts")
  assert.match(hac, /packageApprovalDecision/)
  assert.doesNotMatch(hac, /submitAvaOutreachPackageApprovalAction/)

  const pilotStore = readSource("lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store.ts")
  assert.match(pilotStore, /findAutonomousOutreachPreparationRunByPackageId/)
  assert.match(pilotStore, /markAutonomousOutreachPackageApprovalDecision/)
  assert.doesNotMatch(pilotStore, /orgStateById|new Map/)

  const pilotRepository = readSource(
    "lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-repository.ts",
  )
  assert.match(pilotRepository, /findOutreachPreparationRunByPackageId/)
  assert.match(pilotRepository, /markOutreachPreparationPackageApprovalDecision/)

  console.log(`[${PHASE}] passed`)
}

void main()
