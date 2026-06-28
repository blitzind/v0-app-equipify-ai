/**
 * GE-IRE-6D — Contact Engagement Prediction certification.
 * Run: pnpm test:growth-contact-engagement-prediction
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildEmailLearningObservation } from "../lib/growth/contact-verification/email-learning"
import {
  assertContactEngagementPreviewHasNoPlaintextEmails,
  deriveEngagementTier,
  GROWTH_CONTACT_ENGAGEMENT_PREDICTION_QA_MARKER,
  maskEmailForPreview,
  predictContactEngagement,
  resolveContactEngagementScore,
} from "../lib/growth/contact-verification/contact-engagement-prediction"
import { recommendContacts } from "../lib/growth/contact-verification/contact-recommendation-engine"
import { analyzeBuyingCommittee } from "../lib/growth/contact-verification/buying-committee-intelligence"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log("\n=== GE-IRE-6D Contact Engagement Prediction Certification ===\n")

  const observations = [
    buildEmailLearningObservation({
      email: "chris.taylor@acme.com",
      outcome: "sent",
      source: "outbound_send",
      eventTimestamp: "2026-06-01T10:00:00.000Z",
    }).observation!,
    buildEmailLearningObservation({
      email: "chris.taylor@acme.com",
      outcome: "positive_reply",
      source: "reply_intelligence",
      eventTimestamp: "2026-06-02T12:00:00.000Z",
    }).observation!,
    buildEmailLearningObservation({
      email: "chris.taylor@acme.com",
      outcome: "meeting_booked",
      source: "meeting_booked",
      eventTimestamp: "2026-06-03T09:00:00.000Z",
    }).observation!,
    buildEmailLearningObservation({
      email: "other@acme.com",
      outcome: "sent",
      source: "outbound_send",
      eventTimestamp: "2026-06-01T11:00:00.000Z",
    }).observation!,
  ]

  const withHistory = predictContactEngagement({
    domain: "acme.com",
    industry: "healthcare",
    contact: {
      firstName: "Chris",
      lastName: "Taylor",
      email: "chris.taylor@acme.com",
      jobTitle: "Director of Operations",
      department: "operations",
    },
    historicalLearning: observations,
  })

  assert.equal(withHistory.qa_marker, GROWTH_CONTACT_ENGAGEMENT_PREDICTION_QA_MARKER)
  assert.ok(withHistory.reply_probability > 0)
  assert.ok(withHistory.meeting_probability > 0)
  assert.ok(withHistory.engagement_score >= withHistory.reply_probability * 0.5)
  assert.ok(withHistory.confidence >= 25 && withHistory.confidence <= 100)
  console.log("  ✓ Reply/meeting probability from historical domain data")

  const withoutHistory = predictContactEngagement({
    domain: "acme.com",
    industry: "healthcare",
    contact: { jobTitle: "Office Coordinator", department: "administration" },
  })
  assert.ok(withoutHistory.warnings.includes("insufficient_historical_learning"))
  assert.ok(withoutHistory.engagement_tier === "low" || withoutHistory.engagement_tier === "medium")
  console.log("  ✓ Insufficient data warnings and title/department heuristics")

  assert.equal(deriveEngagementTier(0.8, true), "high")
  assert.equal(deriveEngagementTier(0.6, true), "medium")
  assert.equal(deriveEngagementTier(0.2, true), "low")
  assert.equal(deriveEngagementTier(0, false), "unknown")
  console.log("  ✓ Engagement tiers and confidence bounds")

  const resolved = resolveContactEngagementScore({
    prediction: withHistory,
    legacyScore: 0.55,
    ireEngagement: 0.7,
  })
  assert.ok(resolved.score >= 0 && resolved.score <= 1)
  console.log("  ✓ CRE integration helper")

  const withLearning = await recommendContacts(
    {
      domain: "acme.com",
      industry: "healthcare",
      historicalLearning: observations,
      contacts: [
        {
          firstName: "Chris",
          lastName: "Taylor",
          email: "chris.taylor@acme.com",
          jobTitle: "Director of Operations",
          department: "operations",
        },
        {
          firstName: "Amy",
          lastName: "Lee",
          jobTitle: "Coordinator",
          department: "administration",
        },
      ],
    },
    { skipDns: true },
  )

  const withoutLearning = await recommendContacts(
    {
      domain: "acme.com",
      industry: "healthcare",
      contacts: [
        {
          firstName: "Chris",
          lastName: "Taylor",
          email: "chris.taylor@acme.com",
          jobTitle: "Director of Operations",
          department: "operations",
        },
        {
          firstName: "Amy",
          lastName: "Lee",
          jobTitle: "Coordinator",
          department: "administration",
        },
      ],
    },
    { skipDns: true },
  )

  const chrisWith = withLearning.recommended.find((row) => row.contact.display_name === "Chris Taylor")
  const chrisWithout = withoutLearning.recommended.find((row) => row.contact.display_name === "Chris Taylor")
  assert.ok(chrisWith && chrisWithout)
  assert.ok(chrisWith.scores.engagement >= chrisWithout.scores.engagement)
  assert.ok(chrisWith.evidence.some((item) => item.startsWith("engagement_tier:")))
  console.log("  ✓ Contact Recommendation Engine uses engagement prediction")

  const bci = await analyzeBuyingCommittee(
    {
      domain: "acme.com",
      industry: "healthcare",
      targetUseCase: "service_operations",
      historicalLearning: observations,
      contacts: [
        {
          firstName: "Chris",
          lastName: "Taylor",
          email: "chris.taylor@acme.com",
          jobTitle: "Director of Operations",
          department: "operations",
        },
      ],
    },
    { skipDns: true },
  )
  assert.ok(bci.recommendation.primary_contact)
  console.log("  ✓ Buying Committee Intelligence benefits through CRE")

  assert.equal(maskEmailForPreview("secret@acme.com"), "***@***")
  const sanitized = { email_present: true, recommended_email_masked: maskEmailForPreview("a@b.com") }
  assert.ok(assertContactEngagementPreviewHasNoPlaintextEmails(sanitized))
  console.log("  ✓ Privacy masking")

  const repeat = predictContactEngagement({
    domain: "acme.com",
    industry: "healthcare",
    contact: {
      firstName: "Chris",
      lastName: "Taylor",
      email: "chris.taylor@acme.com",
      jobTitle: "Director of Operations",
      department: "operations",
    },
    historicalLearning: observations,
  })
  assert.deepEqual(withHistory, repeat)
  console.log("  ✓ Deterministic ordering")

  const engineSource = readSource("lib/growth/contact-verification/contact-engagement-prediction.ts")
  assert.doesNotMatch(engineSource, /zerobounce|createClient|from "@supabase/)
  console.log("  ✓ No provider imports or database calls")

  console.log("\nGE-IRE-6D contact engagement prediction certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
