/**
 * GE-EI-IMP-4A — Email Intelligence Learning foundation.
 * Run: pnpm test:growth-email-learning
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  aggregateEmailLearningByDomain,
  buildEmailLearningDedupeKey,
  buildEmailLearningObservation,
  buildEmailLearningObservations,
  computeDomainLearningRates,
  emailLearningObservationFromCompliance,
  emailLearningObservationFromManualVerification,
  emailLearningObservationFromMessageEvent,
  emailLearningObservationFromOutboundSend,
  emailLearningObservationFromProviderWebhook,
  emailLearningObservationFromReplyIntelligence,
  emailLearningObservationFromSuppression,
  GROWTH_EMAIL_LEARNING_QA_MARKER,
  inferEmailLocalPartPattern,
  isDuplicateEmailLearningObservation,
  normalizeEmailLearningObservationInput,
  recordEmailPatternLearningPlaceholder,
  reduceEmailLearningObservationsToDomainStats,
  validateEmailLearningObservationInput,
} from "../lib/growth/contact-verification/email-learning"

const TS = "2026-06-19T12:00:00.000Z"

assert.equal(GROWTH_EMAIL_LEARNING_QA_MARKER, "growth-email-learning-v1")

// Normalization
const normalized = normalizeEmailLearningObservationInput({
  email: " Lead@Example.com ",
  outcome: "sent",
  source: "outbound_send",
  eventTimestamp: TS,
  organizationId: " org-1 ",
})
assert.equal(normalized.email, "lead@example.com")
assert.equal(normalized.source, "outbound_send")

// Valid event creation
const valid = buildEmailLearningObservation({
  email: "jane.doe@acme.com",
  outcome: "delivered",
  source: "provider_webhook",
  eventTimestamp: TS,
  campaignId: "camp-1",
  provider: "google",
})
assert.equal(valid.ok, true)
assert.ok(valid.observation)
assert.equal(valid.observation!.normalized_email, "jane.doe@acme.com")
assert.equal(valid.observation!.domain, "acme.com")
assert.equal(valid.observation!.event_type, "delivered")
assert.equal(valid.observation!.qa_marker, GROWTH_EMAIL_LEARNING_QA_MARKER)

// Invalid event rejection
const invalidOutcome = buildEmailLearningObservation({
  email: "jane@acme.com",
  outcome: "not_a_real_outcome",
  source: "outbound_send",
  eventTimestamp: TS,
})
assert.equal(invalidOutcome.ok, false)
assert.equal(invalidOutcome.rejection_reason, "invalid_outcome")

const invalidEmail = buildEmailLearningObservation({
  email: "bad-email",
  outcome: "sent",
  source: "outbound_send",
  eventTimestamp: TS,
})
assert.equal(invalidEmail.ok, false)
assert.equal(invalidEmail.rejection_reason, "email_required")

const invalidTimestamp = buildEmailLearningObservation({
  email: "jane@acme.com",
  outcome: "sent",
  source: "outbound_send",
  eventTimestamp: "not-a-date",
})
assert.equal(invalidTimestamp.ok, false)
assert.equal(invalidTimestamp.rejection_reason, "invalid_event_timestamp")

const validation = validateEmailLearningObservationInput({
  email: "jane@acme.com",
  outcome: "interested",
  source: "reply_intelligence",
  eventTimestamp: TS,
})
assert.equal(validation.valid, true)
assert.equal(validation.outcome, "positive_reply")

// Duplicate detection
const batch = buildEmailLearningObservations([
  {
    email: "jane@acme.com",
    outcome: "sent",
    source: "outbound_send",
    eventTimestamp: TS,
    campaignId: "camp-1",
  },
  {
    email: "jane@acme.com",
    outcome: "sent",
    source: "outbound_send",
    eventTimestamp: TS,
    campaignId: "camp-1",
  },
  {
    email: "jane@acme.com",
    outcome: "delivered",
    source: "provider_webhook",
    eventTimestamp: TS,
    campaignId: "camp-1",
  },
])
assert.equal(batch.length, 2)

const seen = new Set<string>()
const first = batch[0]!
const dedupeKey = buildEmailLearningDedupeKey({
  normalizedEmail: first.normalized_email,
  eventType: first.event_type,
  eventTimestamp: first.event_timestamp,
  source: first.source,
  campaignId: first.campaign_id,
  contactId: first.contact_id,
})
seen.add(dedupeKey)
assert.equal(isDuplicateEmailLearningObservation(first, seen), true)

// Explicit dedupe key
const explicit = buildEmailLearningObservation({
  email: "jane@acme.com",
  outcome: "sent",
  source: "outbound_send",
  eventTimestamp: TS,
  dedupeKey: "custom:dedupe:1",
})
assert.equal(explicit.ok, true)

// Never throws
assert.doesNotThrow(() => {
  buildEmailLearningObservation({
    email: null,
    outcome: "sent",
    source: "invalid_source",
    eventTimestamp: null,
  })
})

// Pattern recording placeholders
assert.equal(
  inferEmailLocalPartPattern("jane.doe@acme.com", { firstName: "Jane", lastName: "Doe" }),
  "first_dot_last",
)
assert.equal(
  inferEmailLocalPartPattern("janedoe@acme.com", { firstName: "Jane", lastName: "Doe" }),
  "first_last_concat",
)
assert.equal(
  inferEmailLocalPartPattern("jdoe@acme.com", { firstName: "Jane", lastName: "Doe" }),
  "first_initial_last",
)
assert.equal(
  inferEmailLocalPartPattern("jane@acme.com", { firstName: "Jane", lastName: "Doe" }),
  "first_only",
)

const patternRecord = recordEmailPatternLearningPlaceholder({
  email: "jane.doe@acme.com",
  provedCorrect: true,
  observedAt: TS,
  source: "manual_verification",
  firstName: "Jane",
  lastName: "Doe",
})
assert.ok(patternRecord)
assert.equal(patternRecord!.pattern_key, "first_dot_last")
assert.equal(patternRecord!.proved_correct, true)

// Domain aggregation + reducer determinism
const observations = buildEmailLearningObservations([
  { email: "a@acme.com", outcome: "sent", source: "outbound_send", eventTimestamp: TS },
  { email: "b@acme.com", outcome: "delivered", source: "provider_webhook", eventTimestamp: TS },
  { email: "c@acme.com", outcome: "opened", source: "provider_webhook", eventTimestamp: TS },
  { email: "d@acme.com", outcome: "replied", source: "reply_intelligence", eventTimestamp: TS },
  { email: "e@acme.com", outcome: "meeting_booked", source: "meeting_booked", eventTimestamp: TS },
  { email: "f@acme.com", outcome: "bounce_hard", source: "compliance", eventTimestamp: TS },
  { email: "g@acme.com", outcome: "complaint", source: "compliance", eventTimestamp: TS },
  { email: "h@acme.com", outcome: "unsubscribe", source: "suppression", eventTimestamp: TS },
  { email: "x@other.com", outcome: "sent", source: "outbound_send", eventTimestamp: TS },
])

const statsA = aggregateEmailLearningByDomain(observations)
const statsB = reduceEmailLearningObservationsToDomainStats(observations)
assert.deepEqual(statsA, statsB)

const acme = statsA.find((row) => row.domain === "acme.com")
assert.ok(acme)
assert.equal(acme!.messages_sent, 1)
assert.equal(acme!.deliveries, 1)
assert.equal(acme!.opens, 1)
assert.equal(acme!.replies, 1)
assert.equal(acme!.meetings, 1)
assert.equal(acme!.hard_bounces, 1)
assert.equal(acme!.complaints, 1)
assert.equal(acme!.unsubscribe_count, 1)
assert.equal(acme!.reply_rate, 1)
assert.equal(acme!.bounce_rate, 1)
assert.equal(acme!.unsubscribe_rate, 1)

const rates = computeDomainLearningRates({
  domain: "demo.com",
  messages_sent: 4,
  deliveries: 0,
  opens: 0,
  replies: 1,
  meetings: 0,
  hard_bounces: 0,
  complaints: 0,
  unsubscribe_count: 0,
  reply_rate: null,
  bounce_rate: null,
  unsubscribe_rate: null,
})
assert.equal(rates.reply_rate, 0.25)

// Source normalizers
assert.equal(emailLearningObservationFromOutboundSend({ email: "a@acme.com", sentAt: TS }).ok, true)
assert.equal(
  emailLearningObservationFromProviderWebhook({
    email: "a@acme.com",
    normalizedEventType: "opened",
    occurredAt: TS,
    providerEventId: "evt-1",
  }).observation?.event_type,
  "opened",
)
assert.equal(
  emailLearningObservationFromReplyIntelligence({
    email: "a@acme.com",
    intent: "meeting_request",
    receivedAt: TS,
    replyId: "reply-1",
  }).observation?.event_type,
  "meeting_booked",
)
assert.equal(
  emailLearningObservationFromManualVerification({
    email: "a@acme.com",
    verified: true,
    verifiedAt: TS,
  }).observation?.event_type,
  "manual_verified",
)
assert.equal(
  emailLearningObservationFromCompliance({
    email: "a@acme.com",
    reason: "Hard bounce (hard)",
    occurredAt: TS,
  }).observation?.event_type,
  "bounce_hard",
)
assert.equal(
  emailLearningObservationFromSuppression({
    email: "a@acme.com",
    reason: "spam_complaint",
    suppressedAt: TS,
  }).observation?.event_type,
  "complaint",
)
assert.equal(
  emailLearningObservationFromMessageEvent({
    email: "a@acme.com",
    eventType: "spam_complaint",
    occurredAt: TS,
    messageEventId: "msg-evt-1",
  }).observation?.event_type,
  "complaint",
)

// No runtime wiring into confidence / promotion / suppression
const learningSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/contact-verification/email-learning.ts"),
  "utf8",
)
assert.doesNotMatch(learningSource, /supabase|createClient|assertPreSend|confidence-signals-native|upsertGrowthSuppressionEntry/)
assert.doesNotMatch(learningSource, /openai|anthropic|generateText/)

const preSend = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/compliance/pre-send-assertion.ts"),
  "utf8",
)
assert.doesNotMatch(preSend, /email-learning/)

console.log(`${GROWTH_EMAIL_LEARNING_QA_MARKER}: all checks passed`)
