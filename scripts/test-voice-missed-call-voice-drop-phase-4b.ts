/**
 * Voice missed-call recovery + voice drop — Phase 4B regression checks.
 * Run: pnpm test:voice-missed-call-voice-drop-phase-4b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildCallbackWorkflowDraft, canOperatorInitiateCallback } from "../lib/voice/missed-call-recovery/callback-workflow"
import {
  buildRecommendedAction,
  buildRecoveryEvidenceText,
  callbackPriorityForRecovery,
  defaultCallbackDueAt,
  inferRecoveryType,
} from "../lib/voice/missed-call-recovery/recovery-generation"
import { buildMissedCallRecoveryWorkspaceSnapshot } from "../lib/voice/missed-call-recovery/snapshot-builder"
import {
  VOICE_MISSED_CALL_RECOVERY_AUTONOMOUS_OUTBOUND_DISABLED,
  VOICE_MISSED_CALL_RECOVERY_QA_MARKER,
} from "../lib/voice/missed-call-recovery/types"
import {
  applyApprovalTransition,
  canTransitionCampaign,
} from "../lib/voice/voice-drops/approval-workflow"
import { evaluateRecipientCompliance, summarizeComplianceResults } from "../lib/voice/voice-drops/compliance-gating"
import { renderPersonalizedMessage, validateMessageTemplate } from "../lib/voice/voice-drops/personalization"
import { resolveVoiceDropProvider } from "../lib/voice/voice-drops/provider-registry"
import { stubVoiceDropProvider } from "../lib/voice/voice-drops/stub-provider"
import { buildVoiceDropCampaignDashboardSnapshot } from "../lib/voice/voice-drops/snapshot-builder"
import {
  VOICE_DROP_APPROVAL_REQUIRED,
  VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED,
  VOICE_DROP_FREQUENCY_CAP_DAYS,
  VOICE_DROP_INFRASTRUCTURE_QA_MARKER,
  VOICE_DROP_MAX_RECIPIENTS_PER_CAMPAIGN,
} from "../lib/voice/voice-drops/types"
import { VOICE_SCHEMA_MIGRATION_ID, VOICE_SCHEMA_PROBE_VERSION } from "../lib/voice/schema-health"

assert.equal(VOICE_MISSED_CALL_RECOVERY_QA_MARKER, "voice-missed-call-recovery-v1")
assert.equal(VOICE_DROP_INFRASTRUCTURE_QA_MARKER, "voice-drop-infrastructure-v1")
assert.equal(VOICE_SCHEMA_PROBE_VERSION, "v19")
assert.equal(VOICE_SCHEMA_MIGRATION_ID, "20270619120000_voice_workflow_orchestration_phase_5c")
assert.equal(VOICE_MISSED_CALL_RECOVERY_AUTONOMOUS_OUTBOUND_DISABLED, true)
assert.equal(VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED, true)
assert.equal(VOICE_DROP_APPROVAL_REQUIRED, true)
assert.equal(VOICE_DROP_MAX_RECIPIENTS_PER_CAMPAIGN, 500)
assert.equal(VOICE_DROP_FREQUENCY_CAP_DAYS, 7)

const recoveryType = inferRecoveryType({ voicemailLeft: true, phoneNumber: "+14155550199" })
assert.equal(recoveryType, "voicemail_left")
assert.match(
  buildRecoveryEvidenceText({ recoveryType, phoneNumber: "+14155550199" }),
  /Voicemail left/i,
)
assert.equal(buildRecommendedAction({ recoveryType, phoneNumber: "+14155550199" }), "review_voicemail_and_callback")
assert.equal(callbackPriorityForRecovery("transfer_failed"), "urgent")

const due = defaultCallbackDueAt("after_hours_call")
assert.ok(due.getTime() > Date.now())

const callback = buildCallbackWorkflowDraft({
  phoneNumber: "+14155550199",
  contactName: "Jane Doe",
  priority: "high",
  dueAt: new Date(),
  handoffSummary: "Caller asked about forklift service.",
})
assert.match(callback.handoffSummary, /forklift/)
assert.equal(canOperatorInitiateCallback("recommended"), true)
assert.equal(canOperatorInitiateCallback("completed"), false)

const recoverySnapshot = buildMissedCallRecoveryWorkspaceSnapshot({
  voiceCallId: "call-1",
  activeRecoveries: [],
  callbackTasks: [],
})
assert.equal(recoverySnapshot.autonomousOutboundDisabled, true)

const templateValidation = validateMessageTemplate("Hi {{first_name}}, please call {{callback_number}}.")
assert.equal(templateValidation.ok, true)
const badTemplate = validateMessageTemplate("Act now! Guaranteed appointment confirmed!")
assert.equal(badTemplate.ok, false)

const rendered = renderPersonalizedMessage("Hi {{first_name}} from {{company_name}}.", {
  first_name: "Jane",
  company_name: null,
})
assert.match(rendered.rendered, /Jane/)
assert.match(rendered.rendered, /your company/)

const complianceAllowed = evaluateRecipientCompliance({
  organizationId: "org",
  phoneNumber: "+14155550199",
  campaignId: "camp",
  isOptedOut: false,
  isOnDncList: false,
  duplicateInCampaign: false,
  recentDropWithinCapDays: false,
  relationshipSuppressed: false,
  businessHoursProfile: null,
})
assert.equal(complianceAllowed.allowed, true)

const complianceOptOut = evaluateRecipientCompliance({
  organizationId: "org",
  phoneNumber: "+14155550199",
  campaignId: "camp",
  isOptedOut: true,
  isOnDncList: false,
  duplicateInCampaign: false,
  recentDropWithinCapDays: false,
  relationshipSuppressed: false,
  businessHoursProfile: null,
})
assert.equal(complianceOptOut.suppressed, true)
assert.equal(complianceOptOut.reason, "opt_out")

const summary = summarizeComplianceResults([
  complianceAllowed,
  complianceOptOut,
  { allowed: false, suppressed: false, manualReview: true, reason: "dnc_status_unknown" },
])
assert.equal(summary.eligibleCount, 1)
assert.equal(summary.suppressedCount, 1)
assert.equal(summary.manualReviewCount, 1)

assert.equal(canTransitionCampaign("submit_for_approval", "draft", "draft"), true)
assert.equal(canTransitionCampaign("approve", "draft", "draft"), false)
assert.equal(canTransitionCampaign("approve", "pending_approval", "pending_approval"), true)
assert.equal(canTransitionCampaign("start_running", "approved", "draft"), false)

const approved = applyApprovalTransition("approve")
assert.equal(approved?.approvalStatus, "approved")
assert.equal(approved?.campaignStatus, "approved")

async function main() {
  const stub = resolveVoiceDropProvider("stub")
  assert.equal(stub.id, "stub")
  const validation = stub.validateRecipient("+14155550199")
  assert.equal(validation.valid, true)

  const delivery = await stubVoiceDropProvider.queueDelivery({
    organizationId: "org",
    campaignId: "camp",
    recipientId: "rec",
    phoneNumber: "+14155550199",
    renderedMessage: "Test message",
  })
  assert.equal(delivery.status, "queued")
  assert.match(delivery.evidenceText, /Stub provider/)

  const dashboard = buildVoiceDropCampaignDashboardSnapshot([])
  assert.equal(dashboard.approvalRequired, true)
  assert.equal(dashboard.autonomousOutboundDisabled, true)

  const schemaHealth = fs.readFileSync(path.join(process.cwd(), "lib/voice/schema-health.ts"), "utf8")
  assert.match(schemaHealth, /voice_missed_call_recovery_events/)
  assert.match(schemaHealth, /voice_drop_campaigns/)
  assert.match(schemaHealth, /"v19"/)

  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270615120000_voice_missed_call_voice_drop_phase_4b.sql"),
    "utf8",
  )
  assert.match(migration, /voice_missed_call_recovery_events/)
  assert.match(migration, /voice_drop_delivery_attempts/)

  const workspace = fs.readFileSync(path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"), "utf8")
  assert.match(workspace, /data-voice-missed-call-recovery-qa-marker/)

  const recoverySection = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-call-workspace-missed-call-recovery-section.tsx"),
    "utf8",
  )
  assert.match(recoverySection, /VOICE_MISSED_CALL_RECOVERY_QA_MARKER/)
  assert.match(recoverySection, /missed-call-recovery-acknowledge/)

  const voiceDropPanel = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-voice-drop-campaigns-panel.tsx"),
    "utf8",
  )
  assert.match(voiceDropPanel, /VOICE_DROP_INFRASTRUCTURE_QA_MARKER/)
  assert.match(voiceDropPanel, /voice-drop-approve/)
  assert.match(voiceDropPanel, /No autonomous outbound/)

  const receptionistService = fs.readFileSync(
    path.join(process.cwd(), "lib/voice/ai-receptionist/receptionist-service.ts"),
    "utf8",
  )
  assert.match(receptionistService, /recordMissedCallRecoveryFromReceptionistHook/)

  console.log("voice-missed-call-voice-drop-phase-4b: all checks passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
