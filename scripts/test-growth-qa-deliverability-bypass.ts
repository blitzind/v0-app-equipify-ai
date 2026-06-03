/**
 * QA deliverability bypass regression checks.
 * Run: pnpm test:growth-qa-deliverability-bypass
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_QA_ALLOWED_RECIPIENTS_ENV,
  GROWTH_QA_DELIVERABILITY_BYPASS_BANNER,
  GROWTH_QA_DELIVERABILITY_BYPASS_QA_MARKER,
  GROWTH_QA_DELIVERABILITY_BYPASSABLE_BLOCK_CODES,
  isGrowthQaDeliverabilityBypassableBlockCode,
  readQaDeliverabilityBypassFromJobEventMetadata,
  parseGrowthQaAllowedRecipients,
} from "../lib/growth/sequence-enrollment/qa-deliverability-bypass-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

assert.equal(GROWTH_QA_DELIVERABILITY_BYPASS_QA_MARKER, "growth-qa-deliverability-bypass-v1")
assert.equal(GROWTH_QA_ALLOWED_RECIPIENTS_ENV, "GROWTH_QA_ALLOWED_RECIPIENTS")
assert.ok(GROWTH_QA_DELIVERABILITY_BYPASSABLE_BLOCK_CODES.includes("domain_protection"))
assert.equal(isGrowthQaDeliverabilityBypassableBlockCode("domain_protection"), true)
assert.equal(isGrowthQaDeliverabilityBypassableBlockCode("suppression"), false)

process.env[GROWTH_QA_ALLOWED_RECIPIENTS_ENV] = " Mike@BlitzInd.com , qa@example.com "
const allowlist = parseGrowthQaAllowedRecipients()
assert.equal(allowlist.has("mike@blitzind.com"), true)
assert.equal(allowlist.has("qa@example.com"), true)
delete process.env[GROWTH_QA_ALLOWED_RECIPIENTS_ENV]

const snapshot = readQaDeliverabilityBypassFromJobEventMetadata({
  qa_deliverability_bypass: {
    active: true,
    recipientEmail: "mike@blitzind.com",
    senderEmail: "mike@equipify.ai",
    bypassReason: "sender_mailbox_recipient",
    enrollmentId: "enroll-1",
    jobId: "job-1",
  },
})
assert.ok(snapshot?.active)
assert.equal(snapshot?.recipientEmail, "mike@blitzind.com")

const bypassSource = readSource("lib/growth/sequence-enrollment/qa-deliverability-bypass.ts")
assert.match(bypassSource, /evaluateGrowthQaDeliverabilityBypass/)
assert.match(bypassSource, /qa_deliverability_bypass_used/)
assert.match(bypassSource, /qa_deliverability_bypass_denied/)
assert.match(bypassSource, /isPlatformAdminEmail/)

const preflightSource = readSource("lib/growth/outreach/outreach-preflight.ts")
assert.match(preflightSource, /evaluateGrowthQaDeliverabilityBypass/)
assert.match(preflightSource, /qaDeliverabilityBypass/)

const preSendSource = readSource("lib/growth/compliance/pre-send-assertion.ts")
assert.match(preSendSource, /maybeApplyGrowthQaDeliverabilityInfrastructureBypass/)

const queueSource = readSource("lib/growth/sequences/execution/queue-sequence-step-transport-job.ts")
assert.match(queueSource, /serializeGrowthQaDeliverabilityBypassSnapshot/)

const runnerSource = readSource("lib/growth/sequences/execution/sequence-job-runner.ts")
assert.match(runnerSource, /evaluateGrowthQaDeliverabilityBypassForJobSend/)
assert.match(runnerSource, /qa_deliverability_bypass/)

const enrollmentUi = readSource("components/growth/growth-pattern-enrollment-detail.tsx")
assert.match(enrollmentUi, /GROWTH_QA_DELIVERABILITY_BYPASS_BANNER/)

const executionUi = readSource("components/growth/growth-sequence-safe-execution-dashboard.tsx")
assert.match(executionUi, /qaDeliverabilityBypassUsed/)

const envExample = readSource(".env.local.example")
assert.match(envExample, /GROWTH_QA_ALLOWED_RECIPIENTS/)

assert.match(GROWTH_QA_DELIVERABILITY_BYPASS_BANNER, /QA Deliverability Bypass Active/)

console.log("growth qa deliverability bypass tests passed")
