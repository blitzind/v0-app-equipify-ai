/**
 * GE-EI-IMP-4D — live email learning shadow observation certification.
 * Run: pnpm test:growth-email-learning-shadow
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  assertEmailLearningShadowLogHasNoPlaintextEmails,
  emailLearningObservationToShadowLogEntry,
  GROWTH_EMAIL_LEARNING_SHADOW_QA_MARKER,
  isEmailLearningShadowLoggingEnabled,
  logEmailLearningObservationShadow,
  logEmailLearningObservationsShadow,
  shadowLogComplianceBounce,
  shadowLogComplianceComplaint,
  shadowLogComplianceUnsubscribe,
  shadowLogOutboundSend,
  shadowLogProviderWebhook,
  shadowLogReplyIntelligence,
} from "../lib/growth/contact-verification/email-learning-shadow"
import { emailLearningObservationFromOutboundSend } from "../lib/growth/contact-verification/email-learning"

const TS = "2026-06-19T12:00:00.000Z"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function captureConsoleInfo(fn: () => void): string[] {
  const lines: string[] = []
  const original = console.info
  console.info = (message?: unknown) => {
    if (typeof message === "string") lines.push(message)
  }
  try {
    fn()
  } finally {
    console.info = original
  }
  return lines
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

function main(): void {
  console.log("\n=== GE-EI-IMP-4D Email Learning Shadow Certification ===\n")

  assert.equal(GROWTH_EMAIL_LEARNING_SHADOW_QA_MARKER, "growth-email-learning-shadow-v1")
  assert.equal(isEmailLearningShadowLoggingEnabled(), false)
  assert.equal(isEmailLearningShadowLoggingEnabled({ GROWTH_EMAIL_LEARNING_SHADOW_LOG: "true" }), true)

  const noopLines = captureConsoleInfo(() => {
    shadowLogOutboundSend({
      email: "jane.doe@acme.com",
      provider: "google",
      deliveryAttemptId: "attempt-1",
      sentAt: TS,
    })
    shadowLogProviderWebhook({
      email: "jane.doe@acme.com",
      normalizedEventType: "opened",
      provider: "google",
      providerEventId: "evt-1",
      occurredAt: TS,
    })
    shadowLogReplyIntelligence({
      email: "jane.doe@acme.com",
      intent: "meeting_request",
      classification: "interested",
      replyId: "reply-1",
      receivedAt: TS,
    })
    shadowLogComplianceBounce({
      email: "bad@acme.com",
      bounceType: "hard",
      occurredAt: TS,
    })
    shadowLogComplianceComplaint({ email: "angry@acme.com", occurredAt: TS })
    shadowLogComplianceUnsubscribe({ email: "gone@acme.com", occurredAt: TS })
  })
  assert.equal(noopLines.length, 0, "shadow hooks must no-op when flag is off")
  console.log("  ✓ Flag false by default; hooks no-op when disabled")

  const enabledLines = withEnv({ GROWTH_EMAIL_LEARNING_SHADOW_LOG: "true" }, () =>
    captureConsoleInfo(() => {
      shadowLogOutboundSend({
        email: "jane.doe@acme.com",
        provider: "google",
        deliveryAttemptId: "attempt-1",
        sentAt: TS,
        context: { route_id: "route-1" },
      })
      shadowLogProviderWebhook({
        email: "bob.smith@acme.com",
        normalizedEventType: "delivered",
        provider: "sendgrid",
        providerEventId: "evt-2",
        occurredAt: TS,
      })
      shadowLogReplyIntelligence({
        email: "jane.doe@acme.com",
        intent: "meeting_request",
        classification: "interested",
        replyId: "reply-1",
        receivedAt: TS,
      })
      shadowLogComplianceBounce({
        email: "bad@other.com",
        bounceType: "soft",
        occurredAt: TS,
      })
      shadowLogComplianceComplaint({ email: "angry@other.com", occurredAt: TS })
      shadowLogComplianceUnsubscribe({ email: "gone@other.com", occurredAt: TS })
    }),
  )

  assert.ok(enabledLines.length >= 6, "expected shadow logs when flag enabled")
  for (const line of enabledLines) {
    const parsed = JSON.parse(line) as Record<string, unknown>
    assert.equal(parsed.shadow, "email_learning_observation")
    assert.equal(parsed.qa_marker, GROWTH_EMAIL_LEARNING_SHADOW_QA_MARKER)
    assert.ok(typeof parsed.source === "string")
    assert.ok(typeof parsed.event_type === "string")
    assert.ok(typeof parsed.observation_id === "string")
    assert.equal(parsed.email_present, true)
    assert.ok(
      assertEmailLearningShadowLogHasNoPlaintextEmails(parsed),
      `shadow log must not contain plaintext email: ${line}`,
    )
  }
  assert.ok(
    enabledLines.some((line) => JSON.parse(line).event_type === "sent"),
    "expected sent shadow log",
  )
  assert.ok(
    enabledLines.some((line) => JSON.parse(line).event_type === "delivered"),
    "expected delivered shadow log",
  )
  assert.ok(
    enabledLines.some((line) => JSON.parse(line).event_type === "meeting_booked"),
    "expected meeting_booked shadow log",
  )
  console.log("  ✓ Flag on emits safe structured summaries")
  console.log("  ✓ No plaintext emails in shadow logs")

  const batchLines = withEnv({ GROWTH_EMAIL_LEARNING_SHADOW_LOG: "true" }, () =>
    captureConsoleInfo(() => {
      logEmailLearningObservationsShadow([
        emailLearningObservationFromOutboundSend({
          email: "alpha@acme.com",
          deliveryAttemptId: "a-1",
          sentAt: TS,
        }),
        emailLearningObservationFromOutboundSend({
          email: "beta@acme.com",
          deliveryAttemptId: "a-2",
          sentAt: TS,
        }),
      ])
    }),
  )
  assert.equal(batchLines.length, 2)
  console.log("  ✓ Batch logging works")

  const errorLines = withEnv({ GROWTH_EMAIL_LEARNING_SHADOW_LOG: "true" }, () =>
    captureConsoleInfo(() => {
      logEmailLearningObservationShadow({ ok: false, observation: null, rejection_reason: "invalid" })
      const entry = emailLearningObservationToShadowLogEntry(
        emailLearningObservationFromOutboundSend({
          email: "safe@acme.com",
          deliveryAttemptId: "safe-1",
          sentAt: TS,
        }).observation!,
        { note: "jane.doe@acme.com should be stripped" },
      )
      assert.equal(entry.context?.note, undefined)
    }),
  )
  assert.equal(errorLines.length, 0)
  console.log("  ✓ Invalid observations skipped; context email stripped")

  const swallowed = withEnv({ GROWTH_EMAIL_LEARNING_SHADOW_LOG: "true" }, () => {
    const original = console.info
    console.info = () => {
      throw new Error("log sink failure")
    }
    try {
      shadowLogOutboundSend({ email: "jane.doe@acme.com", deliveryAttemptId: "x", sentAt: TS })
      return true
    } catch {
      return false
    } finally {
      console.info = original
    }
  })
  assert.equal(swallowed, true, "shadow logger must swallow logging errors")
  console.log("  ✓ Errors swallowed without throwing")

  const shadowModule = readSource("lib/growth/contact-verification/email-learning-shadow.ts")
  assert.doesNotMatch(shadowModule, /\.insert\(/)
  assert.doesNotMatch(shadowModule, /\.update\(/)
  assert.doesNotMatch(shadowModule, /\.delete\(/)
  assert.doesNotMatch(shadowModule, /\.upsert\(/)
  console.log("  ✓ Shadow module has no database writes")

  const hookFiles: Array<{ file: string; pattern: RegExp }> = [
    {
      file: "lib/growth/providers/transport/transport-orchestrator.ts",
      pattern: /shadowLogOutboundSend\(/,
    },
    {
      file: "lib/growth/webhooks/webhook-router.ts",
      pattern: /shadowLogProviderWebhook\(|maybeShadowLogProviderWebhook\(/,
    },
    {
      file: "lib/growth/replies/finalize-ingested-reply-intelligence.ts",
      pattern: /shadowLogReplyIntelligence\(/,
    },
    {
      file: "lib/growth/compliance/compliance-repository.ts",
      pattern: /shadowLogComplianceBounce\(/,
    },
    {
      file: "lib/growth/compliance/complaint-engine.ts",
      pattern: /shadowLogComplianceComplaint\(/,
    },
    {
      file: "lib/growth/compliance/suppression-engine.ts",
      pattern: /shadowLogComplianceUnsubscribe\(/,
    },
  ]

  for (const hook of hookFiles) {
    const source = readSource(hook.file)
    assert.match(source, hook.pattern, `missing shadow hook in ${hook.file}`)
  }
  console.log("  ✓ Canonical ingestion hooks present")

  const transport = readSource("lib/growth/providers/transport/transport-orchestrator.ts")
  assert.match(
    transport,
    /return \{ ok: true, attempt: sent, provider_message_id: sendResult\.provider_message_id \}/,
    "transport send return shape preserved",
  )
  console.log("  ✓ Existing return values unchanged")

  console.log("\nGE-EI-IMP-4D email learning shadow certification passed.\n")
}

main()
