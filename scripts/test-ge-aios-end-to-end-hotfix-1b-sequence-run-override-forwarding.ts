/**
 * GE-AIOS-END-TO-END HOTFIX 1B — `/run` canonicalDecisionOverrideReason forwarding.
 * Run: pnpm test:ge-aios-end-to-end-hotfix-1b-sequence-run-override-forwarding
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

export const GE_AIOS_END_TO_END_HOTFIX_1B_QA_MARKER =
  "ge-aios-end-to-end-hotfix-1b-sequence-run-override-forwarding-v1" as const

const RUN_ROUTE = "app/api/platform/growth/sequences/execution/jobs/[jobId]/run/route.ts"
const JOB_RUNNER = "lib/growth/sequences/execution/sequence-job-runner.ts"
const SEND_BUILDER = "lib/growth/sequences/execution/sequence-send-builder.ts"
const TRANSPORT_AUTHORITY = "lib/growth/sequences/execution/growth-transport-authority-1c.ts"
const SAFE_EXECUTE_CRON = "app/api/cron/growth-sequence-safe-execute/route.ts"
const SCHEDULER_ROUTE = "app/api/platform/growth/sequences/scheduler/run/route.ts"
const AUTONOMOUS_ORCHESTRATOR =
  "lib/growth/aios/outbound/growth-bounded-autonomous-outbound-orchestrator.ts"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function extractRunRouteCallBlock(source: string): string {
  const marker = "runSequenceExecutionJob(access.admin,"
  const start = source.indexOf(marker)
  assert.ok(start >= 0, "run route must call runSequenceExecutionJob")
  const end = source.indexOf("})", start) + 2
  return source.slice(start, end)
}

function extractRunnerInputType(source: string): string {
  const start = source.indexOf("export type SequenceExecutionRunInput")
  assert.ok(start >= 0, "SequenceExecutionRunInput type missing")
  const end = source.indexOf("}", start) + 1
  return source.slice(start, end)
}

function extractCanonicalGateCall(source: string): string {
  const marker = "enforceCanonicalDecisionForSequenceChannelJob(admin,"
  const start = source.indexOf(marker)
  assert.ok(start >= 0, "runner must enforce canonical decision")
  const end = source.indexOf("})", start) + 2
  return source.slice(start, end)
}

function extractApprovedDueLoopBlock(source: string): string {
  const marker = "for (const job of jobs) {"
  const start = source.indexOf(marker)
  assert.ok(start >= 0, "runApprovedDueSequenceExecutionJobs loop missing")
  const end = source.indexOf("}", start) + 1
  return source.slice(start, end)
}

function main(): void {
  assert.equal(GE_AIOS_END_TO_END_HOTFIX_1B_QA_MARKER, GE_AIOS_END_TO_END_HOTFIX_1B_QA_MARKER)

  const runRoute = readSource(RUN_ROUTE)
  const jobRunner = readSource(JOB_RUNNER)
  const sendBuilder = readSource(SEND_BUILDER)
  const transportAuthority = readSource(TRANSPORT_AUTHORITY)
  const safeExecuteCron = readSource(SAFE_EXECUTE_CRON)
  const schedulerRoute = readSource(SCHEDULER_ROUTE)
  const autonomousOrchestrator = readSource(AUTONOMOUS_ORCHESTRATOR)

  // 1. Human `/run` route accepts and forwards operator override.
  assert.match(runRoute, /humanApproved: z\.boolean\(\)\.optional\(\)/)
  assert.match(runRoute, /humanApprovalConfirmed: z\.boolean\(\)\.optional\(\)/)
  assert.match(runRoute, /canonicalDecisionOverrideReason: z\.string\(\)\.trim\(\)\.min\(1\)\.optional\(\)/)
  const runRouteCall = extractRunRouteCallBlock(runRoute)
  assert.match(
    runRouteCall,
    /canonicalDecisionOverrideReason: parsed\.data\.canonicalDecisionOverrideReason \?\? null/,
  )

  // 2. Runner supports override input and forwards it to canonical enforcement.
  const runnerInput = extractRunnerInputType(jobRunner)
  assert.match(runnerInput, /canonicalDecisionOverrideReason\?: string \| null/)
  const canonicalGateCall = extractCanonicalGateCall(jobRunner)
  assert.match(canonicalGateCall, /operatorOverrideReason: input\.canonicalDecisionOverrideReason/)

  // 3. Supervised transport uses frozen authority; legacy generation remains for autonomous jobs.
  assert.match(sendBuilder, /resolveTransportAuthority/)
  assert.match(transportAuthority, /source: "frozen_snapshot"/)
  assert.match(transportAuthority, /resolveLegacyGenerationTransportAuthority/)
  assert.match(sendBuilder, /authority\.source === "frozen_snapshot"/)
  assert.match(sendBuilder, /authority\.source === "legacy_generation"/)
  assert.match(sendBuilder, /approved_sender_substitution_blocked/)

  // 4. Scheduler / cron / autonomous paths cannot supply override.
  assert.match(safeExecuteCron, /runApprovedDueSequenceExecutionJobs/)
  assert.doesNotMatch(safeExecuteCron, /canonicalDecisionOverrideReason/)
  const approvedDueLoop = extractApprovedDueLoopBlock(jobRunner)
  assert.match(approvedDueLoop, /runSequenceExecutionJob\(admin,/)
  assert.doesNotMatch(approvedDueLoop, /canonicalDecisionOverrideReason/)
  assert.match(schedulerRoute, /runGrowthSequenceScheduler/)
  assert.doesNotMatch(schedulerRoute, /runSequenceExecutionJob/)
  assert.doesNotMatch(schedulerRoute, /canonicalDecisionOverrideReason/)
  const autonomousBlock = autonomousOrchestrator.slice(
    autonomousOrchestrator.indexOf("const result = await runSequenceExecutionJob"),
    autonomousOrchestrator.indexOf("return {", autonomousOrchestrator.indexOf("const result = await runSequenceExecutionJob")),
  )
  assert.match(autonomousBlock, /cronMode: true/)
  assert.doesNotMatch(autonomousBlock, /canonicalDecisionOverrideReason/)

  // 5. Only explicit human `/run` route exposes override to callers.
  assert.match(runRoute, /requireGrowthEnginePlatformAccess/)
  assert.doesNotMatch(safeExecuteCron, /requireGrowthEnginePlatformAccess/)

  console.log(JSON.stringify({ ok: true, qaMarker: GE_AIOS_END_TO_END_HOTFIX_1B_QA_MARKER }, null, 2))
  console.log("GE-AIOS end-to-end hotfix 1B sequence run override forwarding tests passed")
}

main()
