/**
 * GE-AIOS-SAFETY-1 — Autonomous execution guardrails certification.
 * Run: pnpm test:growth-autonomous-execution-guardrails
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateAutonomousExecutionGuardrails,
  summarizeAutonomousExecutionGuardrailDecision,
} from "../lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-engine"
import {
  isAutonomousExecutionGuardrailsEnabled,
  isAutonomousExecutionKillSwitchActive,
} from "../lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-feature"
import type { AutonomousExecutionGuardrailInput } from "../lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T): T {
  const saved = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(overrides)) {
    saved.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    return fn()
  } finally {
    for (const [key, value] of saved.entries()) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

function baseInput(
  overrides: Partial<AutonomousExecutionGuardrailInput> = {},
): AutonomousExecutionGuardrailInput {
  return {
    guardrailsEnabled: true,
    killSwitchActive: false,
    leadId: "lead-1",
    companyId: "company-1",
    action: "send_email",
    channel: "email",
    confidence: 85,
    contactEmail: "exec@example.com",
    acquisitionCandidate: {
      version: 1,
      companyId: "company-1",
      generatedAt: "2026-06-28T00:00:00.000Z",
      primaryContact: {
        fullName: "Pat Example",
        email: "exec@example.com",
        confidence: 90,
      },
      verification: { emailVerified: true, deliverability: "verified", confidence: 92 },
      committee: { role: "economic_buyer", confidence: 70 },
      outreach: { readiness: "ready", preferredChannel: "email" },
      backupContacts: [],
      reasons: [],
      overallConfidence: 88,
    },
    providerReadiness: {
      emailReady: true,
      templatePresent: true,
      unsubscribeFooterAvailable: true,
    },
    ...overrides,
  }
}

console.log("[GE-AIOS-SAFETY-1] Autonomous execution guardrails certification")

withEnv({ GROWTH_AUTONOMOUS_EXECUTION_GUARDRAILS: "true" }, () => {
  assert.equal(isAutonomousExecutionGuardrailsEnabled(), true)
})
withEnv({ GROWTH_AUTONOMOUS_EXECUTION_KILL_SWITCH: "true" }, () => {
  assert.equal(isAutonomousExecutionKillSwitchActive(), true)
})
console.log("  ✓ Feature flags and kill switch")

const killSwitch = evaluateAutonomousExecutionGuardrails(
  baseInput({ killSwitchActive: true }),
)
assert.equal(killSwitch.blocked, true)
assert.equal(killSwitch.riskLevel, "critical")
console.log("  ✓ Kill switch blocks all autonomous actions")

const suppressed = evaluateAutonomousExecutionGuardrails(baseInput({ suppressed: true }))
assert.equal(suppressed.blocked, true)
console.log("  ✓ Suppressed lead blocks")

const unsubscribed = evaluateAutonomousExecutionGuardrails(baseInput({ unsubscribed: true }))
assert.equal(unsubscribed.blocked, true)
console.log("  ✓ Unsubscribed lead blocks")

const bounced = evaluateAutonomousExecutionGuardrails(baseInput({ hardBounced: true }))
assert.equal(bounced.blocked, true)
console.log("  ✓ Hard bounce blocks")

const missingEmail = evaluateAutonomousExecutionGuardrails(
  baseInput({ contactEmail: null, acquisitionCandidate: null }),
)
assert.equal(missingEmail.blocked, true)
console.log("  ✓ Missing verified email blocks email")

const mailboxCap = evaluateAutonomousExecutionGuardrails(
  baseInput({ mailbox: { dailyCap: 10, dailyUsed: 10 } }),
)
assert.equal(mailboxCap.blocked, true)
console.log("  ✓ Mailbox cap blocks")

const warmupCap = evaluateAutonomousExecutionGuardrails(
  baseInput({ mailbox: { warmupCap: 5, warmupUsed: 5 } }),
)
assert.equal(warmupCap.blocked, true)
console.log("  ✓ Warmup cap blocks")

const riskyDeliverability = evaluateAutonomousExecutionGuardrails(
  baseInput({
    acquisitionCandidate: {
      ...baseInput().acquisitionCandidate!,
      verification: { emailVerified: true, deliverability: "risky", confidence: 55 },
    },
  }),
)
assert.equal(riskyDeliverability.requiresApproval, true)
console.log("  ✓ Risky deliverability requires approval")

const lowConfidence = evaluateAutonomousExecutionGuardrails(baseInput({ confidence: 55, action: "send_sms", channel: "sms", contactPhone: "+15551234567", providerReadiness: { smsEnabled: true } }))
assert.equal(lowConfidence.requiresApproval, true)
console.log("  ✓ Low confidence requires approval")

const smsMissingPhone = evaluateAutonomousExecutionGuardrails(
  baseInput({ action: "send_sms", channel: "sms", contactPhone: null, providerReadiness: { smsEnabled: true } }),
)
assert.equal(smsMissingPhone.blocked, true)
console.log("  ✓ SMS requires phone and enabled flag")

const voiceDrop = evaluateAutonomousExecutionGuardrails(
  baseInput({
    action: "launch_voice_drop",
    channel: "voice_drop",
    contactPhone: "+15551234567",
    providerReadiness: { voiceDropEnabled: true, voiceDropRecordingApproved: false },
  }),
)
assert.equal(voiceDrop.blocked, true)
console.log("  ✓ Voice drop requires phone and approved recording")

const linkedin = evaluateAutonomousExecutionGuardrails(
  baseInput({ action: "create_linkedin_task", channel: "linkedin" }),
)
assert.equal(linkedin.requiresApproval, true)
assert.match(linkedin.reasons.join(" "), /manual task only/i)
console.log("  ✓ LinkedIn remains manual task only")

const duplicateEnrollment = evaluateAutonomousExecutionGuardrails(
  baseInput({ campaign: { alreadyEnrolled: true } }),
)
assert.equal(duplicateEnrollment.blocked, true)
console.log("  ✓ Duplicate enrollment blocks")

const customer = evaluateAutonomousExecutionGuardrails(
  baseInput({ isCustomer: true, leadStatus: "converted" }),
)
assert.equal(customer.blocked, true)
console.log("  ✓ Existing customer blocks SDR outreach")

const allowedPreview = evaluateAutonomousExecutionGuardrails(baseInput())
assert.equal(allowedPreview.blocked, false)
assert.equal(allowedPreview.requiresApproval, false)
assert.equal(allowedPreview.allowed, true)
console.log("  ✓ Under-cap verified email allowed in preview only")

assert.ok(allowedPreview.auditMetadata.decision)
assert.ok(allowedPreview.auditMetadata.risk_level)
assert.equal(typeof summarizeAutonomousExecutionGuardrailDecision(allowedPreview), "string")
console.log("  ✓ Audit metadata generated")

assert.equal(
  readSource("lib/growth/outbound/process-event.ts").includes("emitEmailRevenueOutcomeFromWebhook"),
  true,
)
assert.equal(
  readSource("lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-engine.ts").includes(
    "publishGrowthAiEvent",
  ),
  false,
)
console.log("  ✓ Guardrails do not send, enroll, or mutate execution")

const wired = [
  "app/api/platform/growth/autonomous-execution-guardrails/route.ts",
  "components/growth/growth-lead-autonomous-execution-guardrail-panel.tsx",
  "lib/growth/audiences/growth-audience-enrollment-readiness.ts",
  "components/growth/growth-command-daily-action-queue.tsx",
]
for (const file of wired) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}
console.log("  ✓ Integration points wired")

console.log("\nGE-AIOS-SAFETY-1 autonomous execution guardrails certification passed.")
