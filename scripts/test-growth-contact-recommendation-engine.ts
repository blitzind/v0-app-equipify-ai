/**
 * GE-IRE-6B — Contact Recommendation Engine certification.
 * Run: pnpm test:growth-contact-recommendation-engine
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildEmailLearningObservation } from "../lib/growth/contact-verification/email-learning"
import { buildCompanyPatternEvidenceFromCounts } from "../lib/growth/contact-verification/identity-resolution-engine"
import {
  CONTACT_RECOMMENDATION_WEIGHTING_MODEL,
  computeContactRecommendationOverallScore,
  GROWTH_CONTACT_RECOMMENDATION_ENGINE_QA_MARKER,
  recommendContacts,
  scoreContactAccessibility,
  scoreContactAuthority,
  scoreContactEngagement,
  scoreContactRelationship,
} from "../lib/growth/contact-verification/contact-recommendation-engine"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log("\n=== GE-IRE-6B Contact Recommendation Engine Certification ===\n")

  assert.equal(GROWTH_CONTACT_RECOMMENDATION_ENGINE_QA_MARKER, "contact-recommendation-engine-v1")
  const weightSum = Object.values(CONTACT_RECOMMENDATION_WEIGHTING_MODEL.components).reduce(
    (sum, value) => sum + value,
    0,
  )
  assert.ok(Math.abs(weightSum - 1) < 0.001)
  console.log("  ✓ Weighting model documented")

  const ceoAuthority = scoreContactAuthority({ jobTitle: "CEO" })
  const coordinatorAuthority = scoreContactAuthority({ jobTitle: "Office Coordinator" })
  assert.ok(ceoAuthority.score > coordinatorAuthority.score)
  console.log("  ✓ Title authority scoring")

  const accessible = scoreContactAccessibility({
    email: "john.smith@acme.com",
    phone: "+1-555-0100",
    linkedinUrl: "https://linkedin.com/in/johnsmith",
    firstName: "John",
    lastName: "Smith",
  })
  const limited = scoreContactAccessibility({
    email: "info@acme.com",
    phone: null,
    linkedinUrl: null,
    firstName: "Info",
    lastName: "",
  })
  assert.ok(accessible.score > limited.score)
  console.log("  ✓ Accessibility scoring")

  const engagement = scoreContactEngagement({
    industry: "healthcare",
    jobTitle: "Director of Operations",
    department: "operations",
    domainReplyRate: 0.2,
  })
  assert.ok(engagement.score >= 0.5)
  console.log("  ✓ Engagement scoring")

  assert.equal(scoreContactRelationship(null).score, 0.5)
  console.log("  ✓ Relationship neutral default")

  const overall = computeContactRecommendationOverallScore({
    identity: 0.94,
    deliverability: 0.91,
    authority: 0.95,
    accessibility: 0.88,
    engagement: 0.9,
    relationship: 0.5,
  })
  assert.ok(overall >= 0.85 && overall <= 1)
  console.log("  ✓ Overall score computation")

  const companyEvidence = buildCompanyPatternEvidenceFromCounts({
    domain: "precisionbiomedical.com",
    pattern_counts: { first_dot_last: 39, first_initial_last: 3 },
  })

  const learningObservations = [
    buildEmailLearningObservation({
      email: "prior.contact@precisionbiomedical.com",
      outcome: "positive_reply",
      source: "reply_intelligence",
      eventTimestamp: "2026-06-01T12:00:00.000Z",
    }).observation!,
    buildEmailLearningObservation({
      email: "prior.contact@precisionbiomedical.com",
      outcome: "sent",
      source: "outbound_send",
      eventTimestamp: "2026-06-01T11:00:00.000Z",
    }).observation!,
  ]

  const result = await recommendContacts(
    {
      companyName: "Precision Biomedical",
      domain: "precisionbiomedical.com",
      industry: "healthcare",
      companyPatternEvidence: companyEvidence,
      historicalLearning: learningObservations,
      contacts: [
        {
          firstName: "John",
          lastName: "Smith",
          jobTitle: "Director of Operations",
          department: "operations",
          source: "prospect_search",
          confidence: 0.82,
        },
        {
          firstName: "Amy",
          lastName: "Lee",
          jobTitle: "Office Coordinator",
          department: "administration",
        },
        {
          fullName: "Chris Taylor",
          jobTitle: "VP Operations",
          department: "operations",
          email: "chris.taylor@precisionbiomedical.com",
        },
      ],
    },
    { skipDns: true },
  )

  assert.equal(result.qa_marker, GROWTH_CONTACT_RECOMMENDATION_ENGINE_QA_MARKER)
  assert.equal(result.recommended.length, 3)
  assert.equal(result.summary.total_contacts, 3)
  assert.ok(result.summary.top_contact)
  assert.ok((result.summary.top_score ?? 0) > 0)
  assert.ok(result.recommended[0]!.rank === 1)

  const top = result.recommended[0]!
  assert.ok(
    top.contact.display_name === "Chris Taylor" || top.contact.display_name === "John Smith",
  )
  assert.ok(top.scores.authority >= 0.5)
  assert.ok(top.reasons.length >= 2)
  assert.ok(top.evidence.length >= 2)
  console.log("  ✓ Contact ranking and top recommendation")

  const john = result.recommended.find((row) => row.contact.display_name === "John Smith")
  assert.ok(john)
  assert.ok(john.recommended_email?.includes("john.smith@precisionbiomedical.com"))
  assert.ok(john.scores.identity > 0.5)
  console.log("  ✓ IRE integration")

  const chris = result.recommended.find((row) => row.contact.display_name === "Chris Taylor")
  assert.ok(chris)
  assert.equal(chris.recommended_email, "chris.taylor@precisionbiomedical.com")
  assert.ok(chris.scores.identity >= 0.85)
  console.log("  ✓ Provided email handling")

  const repeat = await recommendContacts(
    {
      companyName: "Precision Biomedical",
      domain: "precisionbiomedical.com",
      industry: "healthcare",
      companyPatternEvidence: companyEvidence,
      historicalLearning: learningObservations,
      contacts: [
        {
          firstName: "John",
          lastName: "Smith",
          jobTitle: "Director of Operations",
          department: "operations",
          source: "prospect_search",
          confidence: 0.82,
        },
        {
          firstName: "Amy",
          lastName: "Lee",
          jobTitle: "Office Coordinator",
          department: "administration",
        },
        {
          fullName: "Chris Taylor",
          jobTitle: "VP Operations",
          department: "operations",
          email: "chris.taylor@precisionbiomedical.com",
        },
      ],
    },
    { skipDns: true },
  )
  assert.deepEqual(
    result.recommended.map((row) => ({
      name: row.contact.display_name,
      rank: row.rank,
      overall: row.scores.overall,
    })),
    repeat.recommended.map((row) => ({
      name: row.contact.display_name,
      rank: row.rank,
      overall: row.scores.overall,
    })),
  )
  console.log("  ✓ Deterministic ordering")

  const missingNames = await recommendContacts(
    {
      domain: "acme.com",
      contacts: [{ jobTitle: "Manager", email: "info@acme.com" }],
    },
    { skipDns: true },
  )
  assert.equal(missingNames.recommended.length, 1)
  assert.ok(missingNames.recommended[0]!.warnings.length > 0)
  console.log("  ✓ Missing names handled")

  assert.ok(result.summary.recommendation.includes("Prioritize"))
  console.log("  ✓ Explanation output")

  const engineSource = readSource(
    "lib/growth/contact-verification/contact-recommendation-engine.ts",
  )
  assert.doesNotMatch(engineSource, /zerobounce|apollo\.io|createClient|from "@supabase/)
  assert.doesNotMatch(engineSource, /from ["']openai|from ["']@anthropic/)

  const verificationSource = readSource(
    "lib/growth/contact-verification/email-verification-service.ts",
  )
  assert.doesNotMatch(verificationSource, /contact-recommendation-engine/)
  console.log("  ✓ No external provider imports or production wiring")

  console.log("\nGE-IRE-6B contact recommendation engine certification passed.\n")
  console.log(
    `Top contact: ${result.summary.top_contact} (${result.summary.top_score}% confidence)`,
  )
  console.log(`Summary: ${result.summary.recommendation}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
