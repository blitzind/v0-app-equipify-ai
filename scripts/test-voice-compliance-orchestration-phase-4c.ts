/**
 * Voice compliance + consent orchestration — Phase 4C regression checks.
 * Run: pnpm test:voice-compliance-orchestration-phase-4c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { evaluateCallHourRule, buildDefaultCallHourRule } from "../lib/voice/compliance-orchestration/call-hour-evaluator"
import { evaluateCommunicationCompliance, mapComplianceToRecipientStatus, mapComplianceResultToRecipientPatch } from "../lib/voice/compliance-orchestration/compliance-decision-engine"
import { evaluateCommunicationComplianceBatch } from "../lib/voice/compliance-orchestration/batch-evaluation"
import { resolveDncProvider, stubDncProvider } from "../lib/voice/compliance-orchestration/dnc-provider-scaffold"
import {
  VOICE_COMPLIANCE_AUTONOMOUS_OUTBOUND_DISABLED,
  VOICE_COMPLIANCE_BATCH_PREVIEW_LIMIT,
  VOICE_COMPLIANCE_CONSERVATIVE_DEFAULT,
  VOICE_COMPLIANCE_ORCHESTRATION_QA_MARKER,
  VOICE_CONSENT_CHANNELS,
  VOICE_CONSENT_STATUSES,
  VOICE_SUPPRESSION_TYPES,
  VOICE_DNC_SCOPES,
  VOICE_COMPLIANCE_DECISIONS,
  VOICE_COMPLIANCE_AUDIT_ACTIONS,
  type CommunicationComplianceEvaluationContext,
} from "../lib/voice/compliance-orchestration/types"
import { VOICE_SCHEMA_MIGRATION_ID, VOICE_SCHEMA_PROBE_VERSION } from "../lib/voice/schema-health"

assert.equal(VOICE_COMPLIANCE_ORCHESTRATION_QA_MARKER, "voice-compliance-orchestration-v1")
assert.equal(VOICE_SCHEMA_PROBE_VERSION, "v19")
assert.equal(VOICE_SCHEMA_MIGRATION_ID, "20270619120000_voice_workflow_orchestration_phase_5c")
assert.equal(VOICE_COMPLIANCE_AUTONOMOUS_OUTBOUND_DISABLED, true)
assert.equal(VOICE_COMPLIANCE_CONSERVATIVE_DEFAULT, true)
assert.equal(VOICE_COMPLIANCE_BATCH_PREVIEW_LIMIT, 500)
assert.ok(VOICE_CONSENT_CHANNELS.includes("voicemail"))
assert.ok(VOICE_CONSENT_STATUSES.includes("unknown"))
assert.ok(VOICE_SUPPRESSION_TYPES.includes("opt_out"))
assert.ok(VOICE_DNC_SCOPES.includes("organization"))
assert.ok(VOICE_COMPLIANCE_DECISIONS.includes("manual_review_required"))
assert.ok(VOICE_COMPLIANCE_AUDIT_ACTIONS.includes("opt_out_propagated"))

const baseContext = (overrides: Partial<CommunicationComplianceEvaluationContext> = {}): CommunicationComplianceEvaluationContext => ({
  isOptedOut: false,
  activeSuppressions: [],
  consentStatus: "unknown",
  dncListed: null,
  duplicateInCampaign: false,
  recentContactWithinCap: false,
  relationshipSuppressed: false,
  callHourRule: buildDefaultCallHourRule("org-1") as CommunicationComplianceEvaluationContext["callHourRule"],
  timezoneKnown: true,
  withinCallHours: true,
  providerReputationFlag: false,
  ...overrides,
})

const unknownConsent = evaluateCommunicationCompliance(
  { organizationId: "org-1", phoneNumber: "+14155550199", channel: "voicemail" },
  baseContext({ dncListed: false }),
)
assert.equal(unknownConsent.manualReviewRequired, true)
assert.ok(unknownConsent.reasons.includes("consent_unknown"))

const optOut = evaluateCommunicationCompliance(
  { organizationId: "org-1", phoneNumber: "+14155550199", channel: "sms" },
  baseContext({ isOptedOut: true }),
)
assert.equal(optOut.blocked, true)
assert.ok(optOut.reasons.includes("opt_out"))

const dncListed = evaluateCommunicationCompliance(
  { organizationId: "org-1", phoneNumber: "+14155550199", channel: "voice_call" },
  baseContext({ dncListed: true, consentStatus: "granted" }),
)
assert.equal(dncListed.blocked, true)

const dncUnknown = evaluateCommunicationCompliance(
  { organizationId: "org-1", phoneNumber: "+14155550199", channel: "sms" },
  baseContext({ dncListed: null }),
)
assert.equal(dncUnknown.manualReviewRequired, true)

const outsideHours = evaluateCommunicationCompliance(
  { organizationId: "org-1", phoneNumber: "+14155550199", channel: "callback" },
  baseContext({ withinCallHours: false, consentStatus: "granted", dncListed: false }),
)
assert.equal(outsideHours.manualReviewRequired, true)
assert.ok(outsideHours.reasons.includes("outside_call_hours"))

const granted = evaluateCommunicationCompliance(
  { organizationId: "org-1", phoneNumber: "+14155550199", channel: "callback" },
  baseContext({ consentStatus: "granted", dncListed: false }),
)
assert.equal(granted.allowed, true)

const mapped = mapComplianceToRecipientStatus(unknownConsent)
assert.equal(mapped.manualReviewRequired, true)
assert.equal(mapped.status, "pending")

const patch = mapComplianceResultToRecipientPatch(optOut)
assert.equal(patch.status, "suppressed")
assert.equal(patch.complianceDecision, "blocked")

const hourRule = buildDefaultCallHourRule("org-1")
const hourEval = evaluateCallHourRule({
  ...hourRule,
  id: "rule-1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})
assert.equal(typeof hourEval.timezoneKnown, "boolean")

const unknownTz = evaluateCallHourRule(null)
assert.equal(unknownTz.timezoneKnown, false)
assert.equal(unknownTz.withinCallHours, null)

assert.equal(resolveDncProvider().id, stubDncProvider.id)

async function batchTest() {
  const batch = await evaluateCommunicationComplianceBatch({
    organizationId: "org-1",
    channel: "voicemail",
    recipients: [
      { phoneNumber: "+14155550199" },
      { phoneNumber: "+14155550199" },
      { phoneNumber: "+14155550200" },
    ],
    loadContext: async () => baseContext(),
  })
  assert.equal(batch.evaluatedCount, 2)
  assert.equal(batch.dedupedCount, 1)
}
void batchTest()

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20270616120000_voice_compliance_orchestration_phase_4c.sql",
)
assert.ok(fs.existsSync(migrationPath))
const migrationSql = fs.readFileSync(migrationPath, "utf8")
assert.match(migrationSql, /voice_consent_records/)
assert.match(migrationSql, /voice_suppression_entries/)
assert.match(migrationSql, /voice_dnc_entries/)
assert.match(migrationSql, /voice_call_hour_rules/)
assert.match(migrationSql, /voice_compliance_audit_events/)
assert.match(migrationSql, /compliance_decision/)

const schemaHealth = fs.readFileSync(path.join(process.cwd(), "lib/voice/schema-health.ts"), "utf8")
assert.match(schemaHealth, /"v19"/)
assert.match(schemaHealth, /voice_consent_records/)
assert.match(schemaHealth, /voice_observability_events/)
assert.match(schemaHealth, /voice_ai_outbound_sessions/)

const voiceDropService = fs.readFileSync(path.join(process.cwd(), "lib/voice/voice-drops/voice-drop-service.ts"), "utf8")
assert.match(voiceDropService, /evaluateCommunicationComplianceBatchForOrg/)
assert.match(voiceDropService, /mapComplianceResultToRecipientPatch/)
assert.match(voiceDropService, /manualReviewRequired/)

const recoveryService = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/missed-call-recovery/missed-call-recovery-service.ts"),
  "utf8",
)
assert.match(recoveryService, /buildSafeRecoveryAction/)

const readinessUi = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-compliance-orchestration-readiness-section.tsx"),
  "utf8",
)
assert.match(readinessUi, /VOICE_COMPLIANCE_ORCHESTRATION_QA_MARKER/)
assert.match(readinessUi, /data-voice-compliance-orchestration-qa-marker/)

const manualReviewUi = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-compliance-manual-review-panel.tsx"),
  "utf8",
)
assert.match(manualReviewUi, /Manual review queue/)

console.log("voice-compliance-orchestration-phase-4c: all checks passed")
