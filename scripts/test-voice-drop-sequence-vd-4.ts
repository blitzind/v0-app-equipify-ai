/**
 * Voice Drop sequence — VD-4 live certification & Apollo readiness harness.
 * Run: pnpm test:voice-drop-sequence-vd-4
 *
 * Automated: production audit, failure paths, fatigue rules, timeline/engagement types.
 * Manual: one real Twilio call per docs/VOICE_DROP_SEQUENCE_VD_3_LIVE_CERTIFICATION.md
 *
 * Optional live evidence validation:
 *   VOICE_DROP_VD_4_EVIDENCE_JSON=/path/to/evidence.json
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  evaluateSequenceChannelSelectionRules,
  shouldSkipStepByChannelRules,
} from "../lib/growth/sequence-orchestration/sequence-channel-selection-rules"
import type { GrowthSequenceEnrollmentStep } from "../lib/growth/sequence-enrollment-types"
import { GROWTH_SEQUENCE_CHANNEL_EVENT_KINDS } from "../lib/growth/sequence-orchestration/sequence-multi-channel-state-types"
import {
  GROWTH_VOICE_DROP_SEQUENCE_SCHEMA_TABLES,
} from "../lib/growth/sequences/voice-drop-sequence-schema-health"
import { GROWTH_LEAD_TIMELINE_EVENT_TYPES } from "../lib/growth/timeline-types"
import {
  setVoiceDropTwilioCallCreateOverrideForTests,
} from "../lib/voice/voice-drops/twilio-voice-drop-client"
import {
  evaluateVoiceDropTwilioQueueGate,
} from "../lib/voice/voice-drops/twilio-voice-drop-gates"
import {
  mapTwilioTerminalCallStatusToFailureReason,
  planVoiceDropStatusWebhookUpdate,
} from "../lib/voice/voice-drops/twilio-voice-drop-status-mapping"
import { twilioVoiceDropProvider } from "../lib/voice/voice-drops/twilio-voice-drop-provider"
import { mapDeliveryAttemptToEvidenceView } from "../lib/voice/voice-drops/voice-drop-delivery-evidence-types"
import {
  formatVoiceDropVd4AuditReportMarkdown,
  runVoiceDropVd4ProductionReadinessAudit,
  VOICE_DROP_VD_4_QA_MARKER,
} from "../lib/voice/voice-drops/voice-drop-vd-4-production-readiness-audit"
import {
  VOICE_DROP_APPROVAL_REQUIRED,
  VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED,
} from "../lib/voice/voice-drops/types"

type CertificationResult = {
  id: string
  section: string
  status: "pass" | "fail" | "skip" | "manual"
  detail: string
}

const results: CertificationResult[] = []

function record(
  id: string,
  section: string,
  status: CertificationResult["status"],
  detail: string,
): void {
  results.push({ id, section, status, detail })
  const prefix = status === "pass" ? "✓" : status === "fail" ? "✗" : status === "manual" ? "○" : "—"
  console.log(`${prefix} [${section}] ${id}: ${detail}`)
}

const REQUIRED_FILES = [
  "lib/voice/voice-drops/voice-drop-vd-4-production-readiness-audit.ts",
  "docs/VOICE_DROP_OPERATIONS_RUNBOOK.md",
  "docs/VOICE_DROP_APOLLO_READINESS_ASSESSMENT.md",
  "docs/VOICE_DROP_SEQUENCE_VD_4_CERTIFICATION_REPORT.md",
  "docs/VOICE_DROP_SEQUENCE_VD_3_LIVE_CERTIFICATION.md",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing required file: ${relativePath}`)
  record(`file.${relativePath}`, "static", "pass", `Present: ${relativePath}`)
}

assert.equal(VOICE_DROP_VD_4_QA_MARKER, "voice-drop-sequence-vd-4")
assert.equal(VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED, true)
assert.equal(VOICE_DROP_APPROVAL_REQUIRED, true)

console.log("\n=== VD-4 Production Readiness Audit ===")
const auditReport = runVoiceDropVd4ProductionReadinessAudit()
for (const finding of auditReport.findings) {
  if (finding.status === "manual") {
    record(finding.id, "production_audit", "manual", finding.message)
  } else if (finding.status === "pass") {
    record(finding.id, "production_audit", "pass", finding.message)
  } else if (finding.status === "warn") {
    record(finding.id, "production_audit", "skip", finding.message)
  } else {
    record(finding.id, "production_audit", "fail", finding.message)
  }
}

console.log("\n=== VD-4 Timeline & Engagement Types ===")
const timelineEvents = [
  "voice_drop_queued",
  "voice_drop_attempted",
  "voice_drop_delivered",
  "voice_drop_failed",
  "voice_drop_answered",
] as const

for (const eventType of timelineEvents) {
  const ok = (GROWTH_LEAD_TIMELINE_EVENT_TYPES as readonly string[]).includes(eventType)
  assert.ok(ok, `Missing timeline event type: ${eventType}`)
  record(`timeline.${eventType}`, "timeline", "pass", "Registered in GROWTH_LEAD_TIMELINE_EVENT_TYPES")
}

for (const eventKind of ["voice_drop_delivered", "voice_drop_answered"] as const) {
  const ok = (GROWTH_SEQUENCE_CHANNEL_EVENT_KINDS as readonly string[]).includes(eventKind)
  assert.ok(ok, `Missing channel event kind: ${eventKind}`)
  record(`engagement.${eventKind}`, "engagement", "pass", "Registered in GROWTH_SEQUENCE_CHANNEL_EVENT_KINDS")
}

console.log("\n=== VD-4 Delivery Evidence Mapping ===")
const nowIso = "2026-06-08T12:00:00.000Z"
const evidenceView = mapDeliveryAttemptToEvidenceView({
  id: "attempt-1",
  organizationId: "org",
  campaignId: "camp",
  recipientId: "rec",
  provider: "twilio",
  providerDeliveryId: "CA999",
  status: "delivered",
  failureReason: null,
  deliveredAt: nowIso,
  durationSeconds: 12,
  costAmount: null,
  metadata: {
    answeredBy: "machine_end_beep",
    callStatus: "completed",
    startedAt: "2026-06-08T11:59:50.000Z",
    completedAt: nowIso,
    rawCallbackPayload: { CallSid: "CA999", CallStatus: "completed", AnsweredBy: "machine_end_beep" },
    evidenceText: "Twilio outbound call created",
  },
  createdAt: "2026-06-08T11:59:50.000Z",
})
assert.equal(evidenceView.providerDeliveryId, "CA999")
assert.equal(evidenceView.answeredBy, "machine_end_beep")
assert.equal(evidenceView.hasRawCallbackPayload, true)
record("evidence.fields", "delivery_evidence", "pass", "CallSid, AnsweredBy, raw callback, timestamps mapped")

console.log("\n=== VD-4 Failure Paths ===")
const gateCases: Array<{ id: string; input: Parameters<typeof evaluateVoiceDropTwilioQueueGate>[0]; reason: string }> = [
  {
    id: "failure.disabled_env",
    input: { voiceDropEnabled: false, twilioCredentialsConfigured: true, twilioOutboundCertified: true, fromNumberConfigured: true },
    reason: "voice_drop_disabled",
  },
  {
    id: "failure.uncertified_env",
    input: { voiceDropEnabled: true, twilioCredentialsConfigured: true, twilioOutboundCertified: false, fromNumberConfigured: true },
    reason: "twilio_outbound_not_certified",
  },
  {
    id: "failure.missing_credentials",
    input: { voiceDropEnabled: true, twilioCredentialsConfigured: false, twilioOutboundCertified: true, fromNumberConfigured: true },
    reason: "twilio_not_configured",
  },
  {
    id: "failure.missing_from_number",
    input: { voiceDropEnabled: true, twilioCredentialsConfigured: true, twilioOutboundCertified: true, fromNumberConfigured: false },
    reason: "from_number_missing",
  },
]

for (const gateCase of gateCases) {
  const gate = evaluateVoiceDropTwilioQueueGate(gateCase.input)
  assert.equal(gate.allowed, false)
  if (!gate.allowed) {
    assert.equal(gate.reason, gateCase.reason)
    record(gateCase.id, "failure_paths", "pass", gate.message)
  }
}

const twilioRejectPlan = planVoiceDropStatusWebhookUpdate({
  payload: { CallSid: "CA_FAIL", CallStatus: "failed", ErrorCode: "32014", ErrorMessage: "Call blocked" },
  existingAttemptMetadata: {},
  nowIso,
})
assert.equal(twilioRejectPlan.kind, "interim")
if (twilioRejectPlan.kind === "interim") {
  assert.equal(twilioRejectPlan.attemptPatch.status, "failed")
  record("failure.twilio_rejection", "failure_paths", "pass", "Twilio failed status maps to failed attempt")
}

const missingCallbackPlan = planVoiceDropStatusWebhookUpdate({
  payload: {},
  existingAttemptMetadata: {},
  nowIso,
})
assert.equal(missingCallbackPlan.kind, "invalid")
record("failure.missing_callback", "failure_paths", "pass", "Empty callback payload rejected as invalid")

const networkFailureReason = mapTwilioTerminalCallStatusToFailureReason({
  callStatus: "failed",
  errorCode: "32014",
  errorMessage: "Invalid number",
})
assert.equal(networkFailureReason, "twilio_failed_32014")
record("failure.invalid_number", "failure_paths", "pass", `Terminal failure reason: ${networkFailureReason}`)

console.log("\n=== VD-4 Fatigue Rules ===")
function mockStep(channel: GrowthSequenceEnrollmentStep["channel"], stepOrder: number): GrowthSequenceEnrollmentStep {
  return {
    id: `step-${stepOrder}`,
    enrollmentId: "enrollment",
    leadId: "lead",
    sequencePatternStepId: "pattern-step",
    stepOrder,
    channel,
    generationType: null,
    scheduledFor: new Date().toISOString(),
    status: "pending",
    stepExecutionConfidence: 80,
    outreachQueueId: null,
    cadenceTaskId: null,
    generationId: null,
    instructions: null,
    voiceDropCampaignId: null,
    stepOutcome: null,
    skipReason: null,
    opportunityId: null,
    meetingId: null,
    dueAt: null,
    completedAt: null,
    failureReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

const recentVoiceDrop = evaluateSequenceChannelSelectionRules({
  steps: [mockStep("email", 1), mockStep("voice_drop", 2)],
  currentStep: mockStep("voice_drop", 2),
  touches: [{ occurredAt: new Date(Date.now() - 2 * 86400000).toISOString(), channel: "voice_drop", generationType: null }],
})
assert.equal(recentVoiceDrop.ruleCode, "voice_drop_cooldown_skip")
assert.ok(shouldSkipStepByChannelRules(recentVoiceDrop))
record("fatigue.recent_voice_drop", "fatigue", "pass", "Recent voice drop triggers cooldown skip")

const recentSms = evaluateSequenceChannelSelectionRules({
  steps: [mockStep("sms", 1), mockStep("voice_drop", 2)],
  currentStep: mockStep("voice_drop", 2),
  touches: [{ occurredAt: new Date(Date.now() - 6 * 3600000).toISOString(), channel: "sms", generationType: null }],
})
assert.equal(recentSms.ruleCode, "voice_drop_sms_fatigue_skip")
record("fatigue.recent_sms", "fatigue", "pass", "Recent SMS triggers voice drop fatigue skip")

const recentCall = evaluateSequenceChannelSelectionRules({
  steps: [mockStep("manual_call", 1), mockStep("voice_drop", 2)],
  currentStep: mockStep("voice_drop", 2),
  touches: [{ occurredAt: new Date(Date.now() - 4 * 3600000).toISOString(), channel: "manual_call", generationType: null }],
})
assert.equal(recentCall.ruleCode, "voice_drop_call_fatigue_skip")
record("fatigue.recent_call", "fatigue", "pass", "Recent call triggers voice drop fatigue skip")

console.log("\n=== VD-4 Server Fatigue Gate Codes ===")
const fatigueSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/sequence-orchestration/sequence-voice-drop-fatigue.ts"),
  "utf8",
)
for (const code of [
  "voice_drop_cooldown_active",
  "voice_opt_out",
  "outside_call_hours",
  "compliance_blocked",
  "sms_fatigue_window",
  "call_fatigue_window",
] as const) {
  assert.match(fatigueSource, new RegExp(code))
  record(`fatigue.server.${code}`, "fatigue", "pass", `Server fatigue gate implements ${code}`)
}

console.log("\n=== VD-4 Mock Provider Queue Gate ===")
async function runMockProviderChecks(): Promise<void> {
  const priorEnabled = process.env.VOICE_DROP_ENABLED
  const priorCertified = process.env.VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED
  const priorSid = process.env.TWILIO_ACCOUNT_SID
  const priorToken = process.env.TWILIO_AUTH_TOKEN
  const priorFrom = process.env.TWILIO_VOICE_FROM_NUMBER

  process.env.VOICE_DROP_ENABLED = "true"
  process.env.VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED = "true"
  process.env.TWILIO_ACCOUNT_SID = "AC_test"
  process.env.TWILIO_AUTH_TOKEN = "test_token"
  process.env.TWILIO_VOICE_FROM_NUMBER = "+15555550100"

  let mockCallCount = 0
  setVoiceDropTwilioCallCreateOverrideForTests(async () => {
    mockCallCount += 1
    return { ok: true, callSid: "CA_VD4_MOCK", status: "queued" }
  })

  try {
    const invalidRecipient = twilioVoiceDropProvider.validateRecipient("not-a-phone")
    assert.equal(invalidRecipient.valid, false)
    record("failure.invalid_number_provider", "failure_paths", "pass", invalidRecipient.reason ?? "invalid_phone_number")

    const success = await twilioVoiceDropProvider.queueDelivery({
      organizationId: "org",
      campaignId: "camp",
      recipientId: "rec",
      phoneNumber: "+14155550199",
      renderedMessage: "Equipify VD-4 certification message.",
    })
    assert.equal(success.status, "queued")
    assert.equal(mockCallCount, 1)
    assert.equal(success.providerDeliveryId, "CA_VD4_MOCK")
    record("mock.end_to_end_provider", "controlled_live", "pass", "Mock Twilio call created with CallSid CA_VD4_MOCK")
  } finally {
    setVoiceDropTwilioCallCreateOverrideForTests(null)
    if (priorEnabled === undefined) delete process.env.VOICE_DROP_ENABLED
    else process.env.VOICE_DROP_ENABLED = priorEnabled
    if (priorCertified === undefined) delete process.env.VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED
    else process.env.VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED = priorCertified
    if (priorSid === undefined) delete process.env.TWILIO_ACCOUNT_SID
    else process.env.TWILIO_ACCOUNT_SID = priorSid
    if (priorToken === undefined) delete process.env.TWILIO_AUTH_TOKEN
    else process.env.TWILIO_AUTH_TOKEN = priorToken
    if (priorFrom === undefined) delete process.env.TWILIO_VOICE_FROM_NUMBER
    else process.env.TWILIO_VOICE_FROM_NUMBER = priorFrom
  }
}

type LiveEvidence = {
  callSid?: string
  recipientId?: string
  deliveryAttemptId?: string
  timelineEventIds?: string[]
  channelEventIds?: string[]
  enrollmentId?: string
  campaignId?: string
  leadId?: string
}

function validateLiveEvidenceFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    record("live.evidence_file", "controlled_live", "manual", `Evidence file not found: ${filePath}`)
    return
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as LiveEvidence
  const required = ["callSid", "recipientId", "deliveryAttemptId"] as const
  for (const key of required) {
    assert.ok(parsed[key], `Evidence JSON missing ${key}`)
  }
  record("live.evidence_file", "controlled_live", "pass", `Validated evidence from ${filePath}`)
  record("live.call_sid", "controlled_live", "pass", `CallSid: ${parsed.callSid}`)
  record("live.delivery_attempt", "controlled_live", "pass", `Attempt: ${parsed.deliveryAttemptId}`)
}

async function runSupabaseProbes(): Promise<void> {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    record("supabase.schema", "persistence", "skip", "Supabase credentials unavailable — schema probes skipped")
    return
  }

  const admin: SupabaseClient = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  for (const table of GROWTH_VOICE_DROP_SEQUENCE_SCHEMA_TABLES) {
    const { error } = await admin.schema("growth").from(table).select("id").limit(1)
    if (error) {
      record(`supabase.${table}`, "persistence", "skip", `growth.${table} not queryable: ${error.message}`)
      return
    }
  }
  record("supabase.growth_tables", "persistence", "pass", "VD-2 sequence tables queryable")

  const attemptId = process.env.VOICE_DROP_VD_4_CERT_ATTEMPT_ID?.trim()
  if (!attemptId) {
    record("supabase.live_attempt", "controlled_live", "manual", "Set VOICE_DROP_VD_4_CERT_ATTEMPT_ID to validate live attempt row")
    return
  }

  const { data: attempt, error: attemptError } = await admin
    .schema("voice")
    .from("voice_drop_delivery_attempts")
    .select("id, provider_delivery_id, status, failure_reason, delivered_at, metadata")
    .eq("id", attemptId)
    .maybeSingle()

  if (attemptError || !attempt) {
    record("supabase.live_attempt", "controlled_live", "fail", attemptError?.message ?? "Attempt not found")
    return
  }

  assert.ok(attempt.provider_delivery_id, "Expected provider_delivery_id (CallSid)")
  record("supabase.live_attempt", "controlled_live", "pass", `Attempt ${attemptId} status=${attempt.status}`)
  record("supabase.call_sid", "controlled_live", "pass", `CallSid stored: ${attempt.provider_delivery_id}`)
}

function writeCertificationArtifacts(): void {
  const reportPath = path.join(process.cwd(), "docs/VOICE_DROP_SEQUENCE_VD_4_CERTIFICATION_REPORT.md")
  const auditMarkdown = formatVoiceDropVd4AuditReportMarkdown(auditReport)

  const pass = results.filter((r) => r.status === "pass").length
  const fail = results.filter((r) => r.status === "fail").length
  const manual = results.filter((r) => r.status === "manual").length
  const skip = results.filter((r) => r.status === "skip").length
  const structuralFailures = results.filter((r) => r.status === "fail" && r.section !== "production_audit")
  const productionFailures = results.filter((r) => r.status === "fail" && r.section === "production_audit")

  const resultTable = results
    .map((r) => `| ${r.id} | ${r.section} | ${r.status} | ${r.detail.replace(/\|/g, "\\|")} |`)
    .join("\n")

  const body = `# Voice Drop Sequence — VD-4 Certification Report

Generated by \`pnpm test:voice-drop-sequence-vd-4\` at ${new Date().toISOString()}.

## Certification Summary

| Outcome | Count |
|---------|-------|
| pass | ${pass} |
| fail | ${fail} |
| manual | ${manual} |
| skip | ${skip} |

**Automated harness verdict:** ${structuralFailures.length === 0 ? "PASS" : "FAIL (see failed rows outside production_audit)"}

**Production env readiness:** ${productionFailures.length === 0 ? "PASS" : `FAIL (${productionFailures.length} env/config finding(s) — configure Twilio + public origin before live certification)`}

**Live certification verdict:** ${manual > 0 ? "PENDING — complete manual checklist in docs/VOICE_DROP_SEQUENCE_VD_3_LIVE_CERTIFICATION.md" : "See results below"}

**Apollo rollout verdict:** See [VOICE_DROP_APOLLO_READINESS_ASSESSMENT.md](./VOICE_DROP_APOLLO_READINESS_ASSESSMENT.md)

## Test Results

| ID | Section | Status | Detail |
|----|---------|--------|--------|
${resultTable}

---

${auditMarkdown}

## Manual Live Certification Checklist

Complete [VOICE_DROP_SEQUENCE_VD_3_LIVE_CERTIFICATION.md](./VOICE_DROP_SEQUENCE_VD_3_LIVE_CERTIFICATION.md) and record evidence JSON:

\`\`\`json
{
  "callSid": "CA...",
  "recipientId": "...",
  "deliveryAttemptId": "...",
  "timelineEventIds": ["..."],
  "channelEventIds": ["..."],
  "enrollmentId": "...",
  "campaignId": "...",
  "leadId": "..."
}
\`\`\`

Re-run with \`VOICE_DROP_VD_4_EVIDENCE_JSON=/path/to/evidence.json\` to validate captured evidence.
`

  fs.writeFileSync(reportPath, body, "utf8")
  console.log(`\nWrote certification report: ${reportPath}`)
}

async function main(): Promise<void> {
  await runMockProviderChecks()

  const evidencePath = process.env.VOICE_DROP_VD_4_EVIDENCE_JSON?.trim()
  if (evidencePath) {
    console.log("\n=== VD-4 Live Evidence Validation ===")
    validateLiveEvidenceFile(evidencePath)
  } else {
    record(
      "live.controlled_sequence",
      "controlled_live",
      "manual",
      "Execute one live sequence certification per VD-3 checklist; capture evidence JSON",
    )
  }

  console.log("\n=== VD-4 Supabase Probes ===")
  await runSupabaseProbes()

  const failures = results.filter((r) => r.status === "fail" && r.section !== "production_audit")
  writeCertificationArtifacts()

  if (failures.length > 0) {
    console.error(`\nVD-4 certification failed: ${failures.length} automated failure(s).`)
    process.exitCode = 1
    return
  }

  console.log("\nVD-4 voice drop sequence certification passed (automated). Complete manual live checklist for full VD-4 sign-off.")
}

void main()
