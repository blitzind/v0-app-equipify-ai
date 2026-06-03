/**
 * Regression checks for Growth outbound mode (standalone transport vs adapter queue).
 * Run: pnpm test:growth-outbound-mode
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_OUTBOUND_MODE_ENV,
  GROWTH_OUTBOUND_MODES,
  growthOutboundModeLabel,
  parseGrowthOutboundMode,
} from "../lib/growth/runtime/outbound-mode-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

assert.deepEqual([...GROWTH_OUTBOUND_MODES], ["adapter", "standalone"])
assert.equal(GROWTH_OUTBOUND_MODE_ENV, "GROWTH_OUTBOUND_MODE")
assert.equal(parseGrowthOutboundMode(undefined), "adapter")
assert.equal(parseGrowthOutboundMode(""), "adapter")
assert.equal(parseGrowthOutboundMode("adapter"), "adapter")
assert.equal(parseGrowthOutboundMode("standalone"), "standalone")
assert.equal(parseGrowthOutboundMode("STANDALONE"), "standalone")
assert.equal(parseGrowthOutboundMode("invalid"), "adapter")
assert.equal(growthOutboundModeLabel("standalone"), "standalone (transport)")
assert.equal(growthOutboundModeLabel("adapter"), "adapter (outreach queue)")

const schedulerSource = readSource("lib/growth/sequence-enrollment/run-sequence-scheduler.ts")
assert.match(schedulerSource, /isGrowthOutboundStandaloneMode/)
assert.match(schedulerSource, /queueSequenceStepTransportJob/)
assert.match(schedulerSource, /queueSequenceStepOutreach/)
assert.match(schedulerSource, /sequence_scheduler_outbound_mode/)
assert.match(schedulerSource, /findActiveSequenceExecutionJob/)

const transportQueueSource = readSource(
  "lib/growth/sequences/execution/queue-sequence-step-transport-job.ts",
)
assert.match(transportQueueSource, /createSequenceExecutionJob/)
assert.match(transportQueueSource, /findActiveSequenceExecutionJob/)
assert.match(transportQueueSource, /fetchGrowthOutreachQueueByEnrollmentStepId/)
assert.match(transportQueueSource, /runGrowthOutreachPreflight/)
assert.match(transportQueueSource, /resolveSequenceExecutionSender/)
assert.match(transportQueueSource, /runGrowthAiCopilotGeneration/)
assert.match(transportQueueSource, /sequence_scheduler_transport_job_created/)
assert.match(transportQueueSource, /sequence_scheduler_transport_job_skipped/)
assert.match(transportQueueSource, /providerAdapterSkipped/)
assert.doesNotMatch(transportQueueSource, /insertGrowthOutreachQueueItem/)
assert.doesNotMatch(transportQueueSource, /executeGrowthOutreachQueueItem/)
assert.doesNotMatch(transportQueueSource, /getOutboundProviderAdapter/)

assert.match(schedulerSource, /standaloneMode\s*\?\s*await queueSequenceStepTransportJob/)
assert.match(schedulerSource, /:\s*await queueSequenceStepOutreach/)

const plannerSource = readSource("lib/growth/sequences/execution/sequence-job-planner.ts")
assert.match(plannerSource, /fetchGrowthOutreachQueueByEnrollmentStepId/)

const safeExecuteSource = readSource("lib/growth/sequences/execution/sequence-job-runner.ts")
assert.match(safeExecuteSource, /executeTransportSend/)
assert.match(safeExecuteSource, /listApprovedDueSequenceExecutionJobs/)

const cronSafeSource = readSource("app/api/cron/growth-sequence-safe-execute/route.ts")
assert.match(cronSafeSource, /runApprovedDueSequenceExecutionJobs/)

const envExample = readSource(".env.local.example")
assert.match(envExample, /GROWTH_OUTBOUND_MODE=standalone/)

console.log("growth outbound mode tests passed")
