/**
 * Regression checks for standalone solo approval flow (Phase 1.2).
 * Run: pnpm test:growth-outbound-solo-approval
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  describeGrowthOutboundSoloApprovalGate,
  GROWTH_OUTBOUND_SOLO_AUTO_APPROVE_ENV,
  isGrowthOutboundSoloAutoApproveConfigured,
  parseGrowthOutboundSoloAutoApprove,
} from "../lib/growth/runtime/outbound-solo-approval-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

assert.equal(GROWTH_OUTBOUND_SOLO_AUTO_APPROVE_ENV, "GROWTH_OUTBOUND_SOLO_AUTO_APPROVE")
assert.equal(parseGrowthOutboundSoloAutoApprove(undefined), false)
assert.equal(parseGrowthOutboundSoloAutoApprove("true"), true)
assert.equal(parseGrowthOutboundSoloAutoApprove("TRUE"), true)
assert.equal(isGrowthOutboundSoloAutoApproveConfigured("true", "standalone"), true)
assert.equal(isGrowthOutboundSoloAutoApproveConfigured("true", "adapter"), false)
assert.equal(isGrowthOutboundSoloAutoApproveConfigured("false", "standalone"), false)

const enabledGate = describeGrowthOutboundSoloApprovalGate({
  outboundMode: "standalone",
  soloAutoApprove: true,
  platformAdmin: true,
})
assert.equal(enabledGate.enabled, true)
assert.equal(enabledGate.reason, null)

const adapterGate = describeGrowthOutboundSoloApprovalGate({
  outboundMode: "adapter",
  soloAutoApprove: true,
  platformAdmin: true,
})
assert.equal(adapterGate.enabled, false)
assert.equal(adapterGate.reason, "standalone_outbound_mode_required")

const adminGate = describeGrowthOutboundSoloApprovalGate({
  outboundMode: "standalone",
  soloAutoApprove: true,
  platformAdmin: false,
})
assert.equal(adminGate.enabled, false)
assert.equal(adminGate.reason, "platform_admin_required")

const soloSource = readSource("lib/growth/sequences/execution/approve-sequence-execution-solo.ts")
assert.match(soloSource, /approveGrowthAiCopilotGeneration/)
assert.match(soloSource, /approveSequenceExecutionJob/)
assert.match(soloSource, /solo_approval_used/)
assert.match(soloSource, /solo_approval_not_enabled/)
assert.match(soloSource, /sequence_execution_solo_approval_noop/)
assert.match(soloSource, /generation_not_approvable/)
assert.doesNotMatch(soloSource, /executeTransportSend/)

const approveRoute = readSource(
  "app/api/platform/growth/sequences/execution/jobs/[jobId]/approve/route.ts",
)
assert.match(approveRoute, /canUseGrowthOutboundSoloApproval/)
assert.match(approveRoute, /approveSequenceExecutionJobSolo/)
assert.match(approveRoute, /approveSequenceExecutionJob/)

const jobRunner = readSource("lib/growth/sequences/execution/sequence-job-runner.ts")
assert.match(jobRunner, /already_approved/)
assert.match(jobRunner, /recordJobApprovedAudit/)

const sendBuilder = readSource("lib/growth/sequences/execution/sequence-send-builder.ts")
assert.match(sendBuilder, /generation_not_approved/)

const cronSource = readSource("app/api/cron/growth-sequence-safe-execute/route.ts")
assert.match(cronSource, /runApprovedDueSequenceExecutionJobs/)

const uiSource = readSource("components/growth/growth-sequence-safe-execution-dashboard.tsx")
assert.match(uiSource, /Approve & Queue Send/)
assert.match(uiSource, /soloApprovalEnabled/)
assert.match(uiSource, /Queued for cron/)

const dashboardSource = readSource("lib/growth/sequences/execution/sequence-execution-dashboard.ts")
assert.match(dashboardSource, /soloApprovalEnabled/)
assert.match(dashboardSource, /canUseGrowthOutboundSoloApproval/)

const envExample = readSource(".env.local.example")
assert.match(envExample, /GROWTH_OUTBOUND_SOLO_AUTO_APPROVE=true/)

console.log("growth outbound solo approval tests passed")
