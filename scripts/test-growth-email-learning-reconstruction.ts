/**
 * GE-EI-IMP-4B — historical email learning reconstruction.
 * Run: pnpm test:growth-email-learning-reconstruction
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildDomainIntelligencePreview,
  buildPatternIntelligencePreview,
  compareReconstructedObservations,
  GROWTH_EMAIL_LEARNING_RECONSTRUCTION_QA_MARKER,
  reconstructEmailLearningBatch,
  reconstructEmailLearningFromBounce,
  reconstructEmailLearningFromComplaint,
  reconstructEmailLearningFromDeliveryAttempt,
  reconstructEmailLearningFromOutboundMessage,
  reconstructEmailLearningFromProviderEvent,
  reconstructEmailLearningFromReply,
  reconstructEmailLearningFromReplyIngestion,
  reconstructEmailLearningFromTimeline,
  reconstructEmailLearningFromVerification,
  summarizeLearningReconstruction,
} from "../lib/growth/contact-verification/email-learning-reconstruction"

const TS = "2026-06-19T12:00:00.000Z"

assert.equal(GROWTH_EMAIL_LEARNING_RECONSTRUCTION_QA_MARKER, "growth-email-learning-reconstruction-v1")

// Delivery reconstruction
const delivery = reconstructEmailLearningFromDeliveryAttempt({
  id: "attempt-1",
  status: "sent",
  lead_id: "lead-1",
  sent_at: TS,
  metadata: { to: "jane.doe@acme.com" },
})
assert.equal(delivery.length, 1)
assert.equal(delivery[0]?.event_type, "sent")
assert.equal(delivery[0]?.domain, "acme.com")

// Webhook reconstruction
const webhook = reconstructEmailLearningFromProviderEvent({
  id: "evt-1",
  normalized_event_type: "opened",
  provider_family: "google",
  lead_id: "lead-1",
  occurred_at: TS,
  recipient_email: "jane.doe@acme.com",
})
assert.equal(webhook.length, 1)
assert.equal(webhook[0]?.event_type, "opened")

// Outbound message reconstruction
const message = reconstructEmailLearningFromOutboundMessage({
  id: "msg-1",
  lead_id: "lead-1",
  sent_at: TS,
  delivered_at: "2026-06-19T12:05:00.000Z",
  status: "delivered",
  email: "jane.doe@acme.com",
})
assert.equal(message.length, 2)
assert.deepEqual(
  message.map((row) => row.event_type).sort(),
  ["delivered", "sent"],
)

// Reply reconstruction
const reply = reconstructEmailLearningFromReply({
  id: "reply-1",
  lead_id: "lead-1",
  received_at: TS,
  classification: "interested",
  intent: "meeting_request",
  sender_email: "jane.doe@acme.com",
})
assert.equal(reply.length, 1)
assert.equal(reply[0]?.event_type, "meeting_booked")

// Reply ingestion reconstruction
const ingestion = reconstructEmailLearningFromReplyIngestion({
  id: "ing-1",
  sender_email: "bob@acme.com",
  lead_id: "lead-2",
  received_at: TS,
  normalized_payload: { classification: "interested" },
})
assert.equal(ingestion.length, 1)
assert.equal(ingestion[0]?.event_type, "positive_reply")

// Verification reconstruction
const verification = reconstructEmailLearningFromVerification({
  id: "ver-1",
  contact_candidate_id: "contact-1",
  email_status: "operator_verified",
  created_at: TS,
  email: "jane.doe@acme.com",
  source_attribution: [{ source: "website", signal: "published_on_website" }],
})
assert.equal(verification.length, 1)
assert.equal(verification[0]?.event_type, "manual_verified")
assert.equal(verification[0]?.metadata.discovery_source, "website")

// Bounce + complaint reconstruction
const bounce = reconstructEmailLearningFromBounce({
  id: "bounce-1",
  bounce_type: "hard",
  occurred_at: TS,
  recipient_email: "bad@acme.com",
})
assert.equal(bounce.length, 1)
assert.equal(bounce[0]?.event_type, "bounce_hard")

const complaint = reconstructEmailLearningFromComplaint({
  id: "complaint-1",
  complaint_type: "spam",
  occurred_at: TS,
  recipient_email: "angry@acme.com",
})
assert.equal(complaint.length, 1)
assert.equal(complaint[0]?.event_type, "complaint")

// Timeline reconstruction
const timeline = reconstructEmailLearningFromTimeline({
  id: "tl-1",
  event_type: "email_clicked",
  occurred_at: TS,
  lead_id: "lead-1",
  payload: { email: "jane.doe@acme.com" },
})
assert.equal(timeline.length, 1)
assert.equal(timeline[0]?.event_type, "clicked")

// Unsupported timeline event safely skipped
const unsupportedTimeline = reconstructEmailLearningFromTimeline({
  id: "tl-2",
  event_type: "notes_updated",
  occurred_at: TS,
  payload: { email: "jane.doe@acme.com" },
})
assert.equal(unsupportedTimeline.length, 0)

// Batch deduplication
const batch = reconstructEmailLearningBatch({
  deliveryAttempts: [
    {
      id: "attempt-1",
      status: "sent",
      sent_at: TS,
      metadata: { to: "jane.doe@acme.com" },
    },
  ],
  providerEvents: [
    {
      id: "evt-1",
      normalized_event_type: "opened",
      occurred_at: TS,
      recipient_email: "jane.doe@acme.com",
    },
    {
      id: "evt-2",
      normalized_event_type: "opened",
      occurred_at: TS,
      recipient_email: "jane.doe@acme.com",
    },
  ],
  outboundReplies: [
    {
      id: "reply-1",
      received_at: TS,
      classification: "interested",
      sender_email: "jane.doe@acme.com",
    },
  ],
  timelineEvents: [
    {
      id: "tl-unsupported",
      event_type: "status_changed",
      occurred_at: TS,
      payload: { email: "jane.doe@acme.com" },
    },
  ],
  contactVerifications: [
    {
      id: "ver-unverified",
      email_status: "unverified",
      created_at: TS,
      email: "skip@acme.com",
    },
  ],
})

assert.ok(batch.observations.length >= 3)
assert.ok(batch.summary.duplicates_removed >= 1)
assert.ok(batch.summary.unsupported_events_skipped >= 1)
assert.deepEqual(batch.summary.domains_discovered, ["acme.com"])
assert.ok(batch.summary.email_patterns_identified.includes("first_dot_last"))

const summary = summarizeLearningReconstruction(batch)
assert.equal(summary.observations_created, batch.observations.length)

// Deterministic output
const batchAgain = reconstructEmailLearningBatch({
  deliveryAttempts: [
    {
      id: "attempt-1",
      status: "sent",
      sent_at: TS,
      metadata: { to: "jane.doe@acme.com" },
    },
  ],
  providerEvents: [
    {
      id: "evt-1",
      normalized_event_type: "delivered",
      occurred_at: TS,
      recipient_email: "jane.doe@acme.com",
    },
  ],
})
const comparison = compareReconstructedObservations(batchAgain.observations, batchAgain.observations)
assert.equal(comparison.matched, true)
assert.deepEqual(comparison.only_in_left, [])
assert.deepEqual(comparison.only_in_right, [])

// Domain intelligence preview
const domainBatch = reconstructEmailLearningBatch({
  deliveryAttempts: Array.from({ length: 182 }, (_, index) => ({
    id: `attempt-${index}`,
    status: "sent",
    sent_at: new Date(Date.parse(TS) + index * 60_000).toISOString(),
    metadata: { to: "jane.doe@acme.com" },
  })),
  outboundReplies: Array.from({ length: 41 }, (_, index) => ({
    id: `reply-${index}`,
    received_at: new Date(Date.parse(TS) + index * 90_000).toISOString(),
    classification: index % 5 === 0 ? "interested" : "unclassified",
    sender_email: "jane.doe@acme.com",
  })),
  emailBounces: [
    { id: "b1", bounce_type: "hard", occurred_at: TS, recipient_email: "bad1@acme.com" },
    { id: "b2", bounce_type: "hard", occurred_at: TS, recipient_email: "bad2@acme.com" },
  ],
  contactVerifications: [
    {
      id: "ver-1",
      email_status: "operator_verified",
      created_at: TS,
      email: "jane.doe@acme.com",
      source_attribution: [{ source: "website" }],
    },
  ],
})

const acmePreview = buildDomainIntelligencePreview(domainBatch.observations, "acme.com")
assert.ok(acmePreview)
assert.equal(acmePreview!.messages_sent, 182)
assert.equal(acmePreview!.replies, 41)
assert.equal(acmePreview!.reply_rate, "22.5%")
assert.equal(acmePreview!.hard_bounces, 2)
assert.equal(acmePreview!.complaint_rate, "0.0%")
assert.equal(acmePreview!.most_successful_pattern, "firstname.lastname")
assert.equal(acmePreview!.best_discovery_source, "Website")

// Pattern intelligence preview
const patternPreview = buildPatternIntelligencePreview(domainBatch.observations)
assert.ok(patternPreview.length > 0)
const firstDotLast = patternPreview.find((row) => row.pattern_key === "first_dot_last")
assert.ok(firstDotLast)
assert.ok(firstDotLast!.observed_count > 0)
assert.ok(firstDotLast!.verification_success_count >= 1)
assert.ok(firstDotLast!.reply_success_count >= 1)

// Never throws on malformed records
assert.doesNotThrow(() => {
  reconstructEmailLearningFromDeliveryAttempt({ id: "bad" })
  reconstructEmailLearningFromProviderEvent({ id: "bad" })
  reconstructEmailLearningFromReply({ id: "bad" })
  reconstructEmailLearningBatch({ deliveryAttempts: [{ id: "bad" }] })
})

// No runtime wiring
const reconstructionSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/contact-verification/email-learning-reconstruction.ts"),
  "utf8",
)
assert.doesNotMatch(reconstructionSource, /supabase|createClient|assertPreSend|confidence-signals-native/)
assert.match(reconstructionSource, /emailLearningObservationFromProviderWebhook/)
assert.match(reconstructionSource, /emailLearningObservationFromReplyIntelligence/)
assert.doesNotMatch(
  fs.readFileSync(path.join(process.cwd(), "lib/growth/compliance/pre-send-assertion.ts"), "utf8"),
  /email-learning-reconstruction/,
)

console.log(`${GROWTH_EMAIL_LEARNING_RECONSTRUCTION_QA_MARKER}: all checks passed`)
