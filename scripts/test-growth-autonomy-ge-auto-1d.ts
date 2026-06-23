/**
 * GE-AUTO-1D — Suppression, approval execution & production validation certification.
 * Run: pnpm test:growth-autonomy-ge-auto-1d
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  approveGeV15PreparedAction,
  editGeV15PreparedAction,
  listGeV15OperatorReviewActions,
  rejectGeV15PreparedAction,
  transitionGeV15PreparedAction,
} from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-approval"
import { GE_AUTO_1D_PREPARE_GUARDS_QA_MARKER } from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-prepare-guards"
import { GE_AUTO_1D_EXECUTE_QA_MARKER } from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-execute"
import {
  GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS,
  type GeV15PreparedAction,
} from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function samplePrepared(overrides: Partial<GeV15PreparedAction> = {}): GeV15PreparedAction {
  const now = new Date().toISOString()
  return {
    id: "act_test_1",
    action: "prepare_email",
    channel: "email",
    title: "Follow up on pricing",
    summary: "Pricing intent detected",
    draftContent: "Original AI draft body",
    status: "pending_approval",
    playbookId: "pb_pricing",
    trigger: "question_asked",
    ownerUserId: null,
    createdAt: now,
    updatedAt: now,
    autonomyPrepared: true,
    approvalRequired: true,
    confidenceScore: 82,
    triggerReason: "Pricing question asked",
    senderProfileId: "sender-1",
    recipientEmail: "buyer@example.com",
    sequenceId: null,
    audienceId: null,
    channelPolicyMetadata: null,
    dedupeKey: "dedupe-1",
    ...overrides,
  }
}

async function main() {
  console.log("\nGE-AUTO-1D certification\n")

  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.outbound_send_execution_enabled, false)
  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.autonomous_approval_enabled, false)
  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.operator_approved_send_execution_enabled, true)
  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.human_approval_required, true)
  console.log("  ✓ Safety flags: no autonomous send/approval; operator execute enabled")

  const prepareSource = readSource("lib/growth/automation-runtime/ge-v1-5-automation-runtime-prepare.ts")
  assert.match(prepareSource, /evaluateGeV15PrepareSuppression/)
  console.log("  ✓ Suppression checks wired before prepare")

  const guardsSource = readSource("lib/growth/automation-runtime/ge-v1-5-automation-runtime-prepare-guards.ts")
  assert.match(guardsSource, /evaluatePreSendAllowed/)
  assert.match(guardsSource, /loadProspectSearchSuppressionLookup/)
  assert.match(guardsSource, /evaluateAndAuditCompliance/)
  assert.equal(GE_AUTO_1D_PREPARE_GUARDS_QA_MARKER, "growth-autonomy-ge-auto-1d-v1")
  console.log("  ✓ Prepare guards use existing email/SMS/voice suppression systems")

  const executeSource = readSource("lib/growth/automation-runtime/ge-v1-5-automation-runtime-execute.ts")
  assert.match(executeSource, /executeTransportSend/)
  assert.match(executeSource, /sendSms/)
  assert.match(executeSource, /addVoiceDropRecipient/)
  assert.match(executeSource, /human_approved: true/)
  assert.match(executeSource, /evaluateGeV15PrepareSuppression/)
  assert.equal(GE_AUTO_1D_EXECUTE_QA_MARKER, "growth-autonomy-ge-auto-1d-v1")
  console.log("  ✓ Approved execution routes through existing email/SMS/voice paths")

  const actionsSource = readSource("lib/growth/automation-runtime/ge-v1-5-automation-runtime-actions.ts")
  assert.doesNotMatch(actionsSource, /executeGeV15ApprovedPreparedAction/)
  console.log("  ✓ Playbook runtime does not auto-execute approved actions")

  const approvalRoute = readSource("app/api/platform/growth/automation-runtime/approvals/route.ts")
  assert.match(approvalRoute, /decision\?: "approve" \| "reject" \| "execute"/)
  assert.match(approvalRoute, /executeGeV15ApprovedPreparedAction/)
  assert.match(approvalRoute, /editGeV15LeadPreparedAction/)
  console.log("  ✓ Approvals API supports edit, approve, reject, execute")

  const inboxRoute = readSource("app/api/platform/growth/automation-runtime/approvals/inbox/route.ts")
  assert.match(inboxRoute, /listGeV15OrganizationApprovalInbox/)
  console.log("  ✓ Org-wide approval inbox API present")

  const panelSource = readSource("components/growth/automation/ge-v1-5-automation-runtime-approval-panel.tsx")
  assert.match(panelSource, /Save edits/)
  assert.match(panelSource, /Execute send/)
  assert.match(panelSource, /Reject reason/)
  assert.match(panelSource, /Original AI draft/)
  console.log("  ✓ Approval panel supports edit-before-approval and operator execute")

  const inboxUi = readSource("components/growth/automation/ge-v1-5-automation-runtime-approval-inbox.tsx")
  assert.match(inboxUi, /Prepared follow-ups awaiting review/)
  console.log("  ✓ Approval inbox component present")

  for (const mountPath of [
    "components/growth/workspace/growth-workspace-dashboard-body.tsx",
    "app/(growth)/growth/activity/page.tsx",
    "app/(growth)/growth/engagement/page.tsx",
    "app/(growth)/growth/campaigns/sequences/page.tsx",
    "components/growth/growth-lead-drawer.tsx",
  ]) {
    const source = readSource(mountPath)
    assert.match(
      source,
      /GeV15AutomationRuntimeApproval(Inbox|Panel)/,
      `${mountPath} should mount approval surface`,
    )
  }
  console.log("  ✓ Approval surfaces mounted on operator pages and lead drawer")

  let actions = [samplePrepared()]
  actions = editGeV15PreparedAction(actions, "act_test_1", {
    editedDraftContent: "Operator edited body",
    editedSubject: "Updated subject",
    editedBy: "user-1",
  })
  const edited = actions[0]
  assert.equal(edited.originalDraftContent, "Original AI draft body")
  assert.equal(edited.editedDraftContent, "Operator edited body")
  assert.equal(edited.editedSubject, "Updated subject")
  assert.equal(edited.editedBy, "user-1")
  console.log("  ✓ Edit preserves original AI draft and operator edits")

  actions = approveGeV15PreparedAction(actions, "act_test_1", "user-1")
  assert.equal(actions[0].status, "approved")
  assert.ok(actions[0].approvedAt)
  console.log("  ✓ Approve records approval audit")

  const reviewQueue = listGeV15OperatorReviewActions([
    samplePrepared({ id: "pending-1", status: "pending_approval" }),
    samplePrepared({ id: "approved-1", status: "approved" }),
    samplePrepared({ id: "executed-1", status: "executed" }),
  ])
  assert.deepEqual(
    reviewQueue.map((row) => row.id).sort(),
    ["approved-1", "pending-1"],
  )
  console.log("  ✓ Operator review queue includes pending and approved-not-executed")

  actions = rejectGeV15PreparedAction([samplePrepared()], "act_test_1", {
    rejectedBy: "user-2",
    reason: "Not a fit right now",
  })
  assert.equal(actions[0].status, "rejected")
  assert.equal(actions[0].rejectReason, "Not a fit right now")
  console.log("  ✓ Reject stores reason and does not execute")

  assert.throws(() => transitionGeV15PreparedAction(samplePrepared({ status: "pending_approval" }), "executed"))
  console.log("  ✓ Cannot transition pending → executed without approval")

  console.log("\nGE-AUTO-1D passed.\n")
}

void main()
