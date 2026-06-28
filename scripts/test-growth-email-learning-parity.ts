/**
 * GE-EI-IMP-4E — Email Learning shadow parity certification (fixtures only).
 * Run: pnpm test:growth-email-learning-parity
 */
import assert from "node:assert/strict"
import {
  emailLearningObservationFromOutboundSend,
  emailLearningObservationFromProviderWebhook,
  emailLearningObservationFromReplyIntelligence,
} from "../lib/growth/contact-verification/email-learning"
import { emailLearningObservationToShadowLogEntry } from "../lib/growth/contact-verification/email-learning-shadow"
import {
  assertEmailLearningParityReportHasNoPlaintextEmails,
  buildEmailLearningParityReport,
  compareEmailLearningObservationSets,
  GROWTH_EMAIL_LEARNING_PARITY_QA_MARKER,
  summarizeEmailLearningParity,
} from "../lib/growth/contact-verification/email-learning-parity"
import {
  reconstructEmailLearningFromDeliveryAttempt,
  reconstructEmailLearningFromProviderEvent,
  reconstructEmailLearningFromReply,
} from "../lib/growth/contact-verification/email-learning-reconstruction"

const TS = "2026-06-19T12:00:00.000Z"
const TS_FUZZY = "2026-06-19T12:34:56.000Z"

function observationFromResult(
  result: ReturnType<typeof emailLearningObservationFromOutboundSend>,
) {
  assert.ok(result.ok && result.observation)
  return result.observation
}

function main(): void {
  console.log("\n=== GE-EI-IMP-4E Email Learning Parity Certification ===\n")

  assert.equal(GROWTH_EMAIL_LEARNING_PARITY_QA_MARKER, "growth-email-learning-parity-v1")

  const emptyComparison = compareEmailLearningObservationSets({ reconstructed: [], shadow: [] })
  assert.equal(emptyComparison.reconstructed_count, 0)
  assert.equal(emptyComparison.shadow_count, 0)
  assert.equal(emptyComparison.matched_count, 0)
  assert.ok(emptyComparison.warnings.includes("empty_observation_sets"))
  console.log("  ✓ Empty inputs handled safely")

  const reconstructedSent = reconstructEmailLearningFromDeliveryAttempt({
    id: "attempt-1",
    status: "sent",
    lead_id: "lead-1",
    sent_at: TS,
    metadata: { to: "jane.doe@acme.com" },
  })
  const reconstructedOpened = reconstructEmailLearningFromProviderEvent({
    id: "evt-1",
    normalized_event_type: "opened",
    provider_family: "google",
    lead_id: "lead-1",
    occurred_at: TS,
    recipient_email: "jane.doe@acme.com",
  })
  const reconstructedReply = reconstructEmailLearningFromReply({
    id: "reply-1",
    lead_id: "lead-1",
    received_at: TS,
    classification: "interested",
    intent: "meeting_request",
    sender_email: "jane.doe@acme.com",
  })

  const shadowSent = observationFromResult(
    emailLearningObservationFromOutboundSend({
      email: "jane.doe@acme.com",
      provider: "google",
      deliveryAttemptId: "attempt-1",
      sentAt: TS,
      contactId: "lead-1",
    }),
  )
  const shadowOpened = observationFromResult(
    emailLearningObservationFromProviderWebhook({
      email: "jane.doe@acme.com",
      normalizedEventType: "opened",
      provider: "google",
      providerEventId: "evt-1",
      occurredAt: TS,
      contactId: "lead-1",
    }),
  )
  const shadowReply = observationFromResult(
    emailLearningObservationFromReplyIntelligence({
      email: "jane.doe@acme.com",
      intent: "meeting_request",
      classification: "interested",
      replyId: "reply-1",
      receivedAt: TS,
      contactId: "lead-1",
    }),
  )

  const exactComparison = compareEmailLearningObservationSets({
    reconstructed: [...reconstructedSent, ...reconstructedOpened, ...reconstructedReply],
    shadow: [
      emailLearningObservationToShadowLogEntry(shadowSent),
      emailLearningObservationToShadowLogEntry(shadowOpened),
      emailLearningObservationToShadowLogEntry(shadowReply),
    ],
  })

  assert.equal(exactComparison.reconstructed_count, 3)
  assert.equal(exactComparison.shadow_count, 3)
  assert.equal(exactComparison.matched_count, 3)
  assert.equal(exactComparison.strict_matched_count, 3)
  assert.equal(exactComparison.fuzzy_matched_count, 0)
  assert.equal(exactComparison.missing_from_shadow, 0)
  assert.equal(exactComparison.extra_in_shadow, 0)
  console.log("  ✓ Exact match parity via observation_id")

  const missingComparison = compareEmailLearningObservationSets({
    reconstructed: reconstructedSent,
    shadow: [],
  })
  assert.equal(missingComparison.missing_from_shadow, 1)
  assert.equal(missingComparison.extra_in_shadow, 0)
  assert.ok(missingComparison.warnings.includes("missing_from_shadow"))
  console.log("  ✓ Missing shadow observation detected")

  const extraComparison = compareEmailLearningObservationSets({
    reconstructed: [],
    shadow: [emailLearningObservationToShadowLogEntry(shadowSent)],
  })
  assert.equal(extraComparison.missing_from_shadow, 0)
  assert.equal(extraComparison.extra_in_shadow, 1)
  assert.ok(extraComparison.warnings.includes("extra_in_shadow"))
  console.log("  ✓ Extra shadow observation detected")

  const fuzzyReconstructed = observationFromResult(
    emailLearningObservationFromProviderWebhook({
      email: "bob.smith@acme.com",
      normalizedEventType: "delivered",
      provider: "sendgrid",
      providerEventId: "evt-fuzzy",
      occurredAt: TS_FUZZY,
    }),
  )
  const fuzzyShadow = emailLearningObservationToShadowLogEntry(
    observationFromResult(
      emailLearningObservationFromProviderWebhook({
        email: "bob.smith@acme.com",
        normalizedEventType: "delivered",
        provider: "sendgrid",
        providerEventId: "evt-fuzzy-shadow-id",
        occurredAt: TS,
      }),
    ),
  )

  const fuzzyComparison = compareEmailLearningObservationSets({
    reconstructed: [fuzzyReconstructed],
    shadow: [fuzzyShadow],
  })
  assert.equal(fuzzyComparison.matched_count, 1)
  assert.equal(fuzzyComparison.fuzzy_matched_count, 1)
  assert.ok(fuzzyComparison.warnings.includes("fuzzy_matches_applied"))
  console.log("  ✓ Fuzzy matching fallback works")

  const report = buildEmailLearningParityReport({
    reconstructed: [...reconstructedSent, ...reconstructedOpened, ...reconstructedReply],
    shadow: [shadowSent, shadowOpened, shadowReply],
    context: { fixture: "parity-cert" },
  })

  const summary = summarizeEmailLearningParity(report.comparison)
  assert.deepEqual(summary, {
    reconstructed_count: 3,
    shadow_count: 3,
    matched_count: 3,
    missing_from_shadow: 0,
    extra_in_shadow: 0,
    warnings: [],
  })

  assert.ok(report.event_type_coverage.sent)
  assert.equal(report.event_type_coverage.sent?.reconstructed_count, 1)
  assert.equal(report.event_type_coverage.sent?.shadow_count, 1)
  assert.ok(report.domain_coverage["acme.com"])
  assert.equal(report.domain_coverage["acme.com"]?.matched_count, 3)
  assert.ok(report.source_coverage.outbound_send)
  assert.ok(report.source_coverage.provider_webhook)
  assert.ok(report.source_coverage.reply_intelligence)
  console.log("  ✓ Event-type, domain, and source coverage summaries")

  assert.ok(assertEmailLearningParityReportHasNoPlaintextEmails(report))
  const reportJson = JSON.stringify(report)
  assert.doesNotMatch(reportJson, /jane\.doe@acme\.com/i)
  console.log("  ✓ No plaintext email in parity report")

  const reportRepeat = buildEmailLearningParityReport({
    reconstructed: [...reconstructedSent, ...reconstructedOpened, ...reconstructedReply],
    shadow: [shadowSent, shadowOpened, shadowReply],
    context: { fixture: "parity-cert" },
  })
  assert.deepEqual(report, reportRepeat, "parity report must be deterministic")
  console.log("  ✓ Deterministic output ordering")

  console.log("\nGE-EI-IMP-4E email learning parity certification passed.\n")
}

main()
