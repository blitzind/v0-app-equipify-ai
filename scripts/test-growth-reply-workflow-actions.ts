/**
 * Regression checks for reply workflow action center (Sprint 2).
 * Run: pnpm test:growth-reply-workflow-actions
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_REPLY_WORKFLOW_CENTER_QA_MARKER,
  categorizeReplyWorkflowAction,
} from "../lib/growth/reply-intelligence/workflow-actions-types"

assert.equal(GROWTH_REPLY_WORKFLOW_CENTER_QA_MARKER, "growth-reply-workflow-center-v1")
assert.equal(categorizeReplyWorkflowAction("mark_interested"), "interested")
assert.equal(categorizeReplyWorkflowAction("create_call_task"), "call_task")
assert.equal(categorizeReplyWorkflowAction("create_follow_up_task"), "follow_up")
assert.equal(categorizeReplyWorkflowAction("route_demo_scheduling"), "opportunity")

const executeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/reply-intelligence/execute-reply-workflow-actions.ts"),
  "utf8",
)
assert.match(executeSource, /markLeadInterestedFromReply/)
assert.match(executeSource, /createCallTaskFromReply/)
assert.match(executeSource, /createFollowUpTaskFromReply/)
assert.match(executeSource, /confirmCreateOpportunityFromReply/)
assert.match(executeSource, /resolveMarkInterestedStatus/)
assert.match(executeSource, /recomputeGrowthLeadWorkflowSignals/)
assert.match(executeSource, /GROWTH_REPLY_OPPORTUNITY_ROUTE_ACTION_TYPES/)
assert.doesNotMatch(executeSource, /actionTypes: \["mark_interested", "create_follow_up_task"\]/)
assert.doesNotMatch(executeSource, /createGrowthOpportunity\(admin.*\)\s*;\s*\/\/ auto/i)

const repoSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/reply-intelligence/workflow-actions-repository.ts"),
  "utf8",
)
assert.match(repoSource, /completePendingReplyWorkflowActions/)
assert.match(repoSource, /GROWTH_REPLY_SEQUENCE_EXIT_ACTION_TYPES/)

const exitSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/reply-intelligence/sequence-exit-candidates-repository.ts"),
  "utf8",
)
assert.match(exitSource, /resolveSequenceExitCandidate/)
assert.match(exitSource, /resumeGrowthSequenceEnrollment/)
assert.match(exitSource, /cancelSequenceEnrollment/)
assert.match(exitSource, /completePendingReplyWorkflowActions/)
assert.match(exitSource, /GROWTH_REPLY_SEQUENCE_EXIT_ACTION_TYPES/)

const panelSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-reply-workflow-actions-panel.tsx"),
  "utf8",
)
assert.match(panelSource, /Mark interested/)
assert.match(panelSource, /Create call task/)
assert.match(panelSource, /Create follow up/)
assert.match(panelSource, /Confirm & create/)
assert.match(panelSource, /Resume sequence/)
assert.match(panelSource, /Keep paused/)
assert.match(panelSource, /Exit sequence/)
assert.doesNotMatch(panelSource, /workflow-actions\/dismiss.*activeItem/s)

const routes = [
  "app/api/platform/growth/replies/workflow-actions/route.ts",
  "app/api/platform/growth/replies/workflow-actions/mark-interested/route.ts",
  "app/api/platform/growth/replies/workflow-actions/create-call-task/route.ts",
  "app/api/platform/growth/replies/workflow-actions/create-follow-up-task/route.ts",
  "app/api/platform/growth/replies/workflow-actions/create-opportunity/route.ts",
  "app/api/platform/growth/replies/sequence-exit-candidates/route.ts",
  "app/(admin)/admin/growth/replies/workflow/page.tsx",
]
for (const route of routes) {
  assert.ok(fs.existsSync(path.join(process.cwd(), route)), `missing ${route}`)
}

console.log("growth-reply-workflow-actions: all checks passed")
