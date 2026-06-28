/**
 * GE-IRE-6A — Identity Resolution Engine certification.
 * Run: pnpm test:growth-identity-resolution-engine
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildEmailLearningObservation } from "../lib/growth/contact-verification/email-learning"
import {
  buildCompanyPatternEvidenceFromCounts,
  buildIdentityResolutionExplanation,
  computeIdentityResolutionOverallProbability,
  deriveCompanyPatternEvidenceFromLearning,
  generateIdentityEmailCandidates,
  GROWTH_IDENTITY_RESOLUTION_ENGINE_QA_MARKER,
  IDENTITY_EMAIL_PATTERN_IDS,
  IDENTITY_RESOLVER_TYPES,
  IDENTITY_RESOLUTION_WEIGHTING_MODEL,
  normalizeIdentityResolutionIndustry,
  resolveEmailIdentity,
} from "../lib/growth/contact-verification/identity-resolution-engine"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log("\n=== GE-IRE-6A Identity Resolution Engine Certification ===\n")

  assert.equal(GROWTH_IDENTITY_RESOLUTION_ENGINE_QA_MARKER, "identity-resolution-engine-v1")
  assert.ok(IDENTITY_EMAIL_PATTERN_IDS.length >= 10)
  assert.deepEqual(IDENTITY_RESOLVER_TYPES[0], "email")
  assert.ok(IDENTITY_RESOLVER_TYPES.includes("phone"))
  assert.ok(IDENTITY_RESOLVER_TYPES.includes("linkedin"))
  console.log("  ✓ Future identity extensibility")

  const candidates = generateIdentityEmailCandidates({
    firstName: "John",
    lastName: "Smith",
    domain: "precisionbiomedical.com",
  })
  assert.ok(candidates.length >= 8)
  assert.ok(candidates.some((row) => row.email === "john.smith@precisionbiomedical.com"))
  assert.ok(candidates.some((row) => row.email === "jsmith@precisionbiomedical.com"))
  const uniqueEmails = new Set(candidates.map((row) => row.email))
  assert.equal(uniqueEmails.size, candidates.length)
  console.log("  ✓ Pattern generation and duplicate removal")

  const ordered = generateIdentityEmailCandidates({
    firstName: "Jane",
    lastName: "Doe",
    domain: "acme.com",
  })
  const orderedRepeat = generateIdentityEmailCandidates({
    firstName: "Jane",
    lastName: "Doe",
    domain: "acme.com",
  })
  assert.deepEqual(
    ordered.map((row) => row.email),
    orderedRepeat.map((row) => row.email),
  )
  console.log("  ✓ Deterministic candidate ordering")

  assert.equal(normalizeIdentityResolutionIndustry("Healthcare"), "healthcare")
  assert.equal(normalizeIdentityResolutionIndustry("SaaS Technology"), "software")
  assert.equal(normalizeIdentityResolutionIndustry("unknown vertical"), "default")
  console.log("  ✓ Industry heuristics")

  const companyEvidence = buildCompanyPatternEvidenceFromCounts({
    domain: "precisionbiomedical.com",
    pattern_counts: {
      first_dot_last: 39,
      first_initial_last: 2,
      first_last_concat: 1,
    },
  })
  assert.equal(companyEvidence.total_verified, 42)
  assert.equal(companyEvidence.dominant_pattern, "first_dot_last")
  assert.ok((companyEvidence.dominant_share ?? 0) > 0.9)
  console.log("  ✓ Company pattern learning")

  const learningObservations = [
    buildEmailLearningObservation({
      email: "alice.jones@acme.com",
      outcome: "manual_verified",
      source: "manual_verification",
      eventTimestamp: "2026-06-01T12:00:00.000Z",
      firstName: "Alice",
      lastName: "Jones",
    }).observation!,
    buildEmailLearningObservation({
      email: "bob.smith@acme.com",
      outcome: "manual_verified",
      source: "manual_verification",
      eventTimestamp: "2026-06-02T12:00:00.000Z",
      firstName: "Bob",
      lastName: "Smith",
    }).observation!,
  ]
  const derivedEvidence = deriveCompanyPatternEvidenceFromLearning({
    domain: "acme.com",
    observations: learningObservations,
  })
  assert.equal(derivedEvidence.total_verified, 2)
  assert.ok(derivedEvidence.pattern_counts.first_dot_last === 2)
  console.log("  ✓ Email learning integration")

  const weighted = computeIdentityResolutionOverallProbability({
    pattern_probability: 0.99,
    deliverability_probability: 0.96,
    engagement_probability: 0.9,
    historical_learning_score: 0.88,
    company_evidence_score: 0.93,
    industry_evidence_score: 0.8,
    conflict_penalty: 0,
  })
  assert.ok(weighted >= 0.9 && weighted <= 1)
  const penalized = computeIdentityResolutionOverallProbability({
    pattern_probability: 0.99,
    deliverability_probability: 0.96,
    engagement_probability: 0.9,
    historical_learning_score: 0.88,
    company_evidence_score: 0.93,
    industry_evidence_score: 0.8,
    conflict_penalty: 0.35,
  })
  assert.ok(penalized < weighted)
  console.log("  ✓ Weighting model")

  const resolved = await resolveEmailIdentity(
    {
      firstName: "John",
      lastName: "Smith",
      domain: "precisionbiomedical.com",
      companyName: "Precision Biomedical",
      industry: "healthcare",
      jobTitle: "Director of Operations",
      historicalPatterns: companyEvidence,
      historicalLearning: {
        domain_reply_rate: 0.18,
        domain_meeting_rate: 0.04,
        pattern_success_rates: { first_dot_last: 0.91 },
        verified_contact_count: 42,
        placeholders: ["relationship_intelligence_placeholder"],
      },
    },
    { skipDns: true },
  )

  assert.equal(resolved.qa_marker, GROWTH_IDENTITY_RESOLUTION_ENGINE_QA_MARKER)
  assert.equal(resolved.resolver_type, "email")
  assert.ok(resolved.candidates.length > 0)
  assert.ok(resolved.recommended)
  assert.equal(resolved.recommended?.pattern.id, "first_dot_last")
  assert.equal(resolved.recommended?.email, "john.smith@precisionbiomedical.com")
  assert.ok(resolved.recommended.overall_probability >= 0.55)
  assert.ok(resolved.recommended.overall_probability <= 1)
  assert.ok(resolved.recommended.deliverability_probability > 0)
  assert.ok(resolved.recommended.engagement_probability > 0)
  assert.ok(resolved.recommended.rank === 1)
  assert.ok(resolved.candidates.every((row) => row.rank >= 1))
  console.log("  ✓ Deliverability and engagement scoring")

  const explanation = buildIdentityResolutionExplanation({
    recommended: resolved.recommended,
    companyEvidence,
    industry: "healthcare",
  })
  assert.equal(explanation.recommended_email, "john.smith@precisionbiomedical.com")
  assert.ok(explanation.evidence_bullets.length >= 3)
  assert.ok(explanation.overall_probability != null)
  console.log("  ✓ Explanation generation")

  const missingNames = await resolveEmailIdentity(
    { firstName: "", lastName: "Smith", domain: "acme.com" },
    { skipDns: true },
  )
  assert.equal(missingNames.candidates.length, 0)
  assert.ok(missingNames.warnings.includes("missing_or_invalid_name_parts"))
  console.log("  ✓ Missing names handled")

  const emptyLearning = await resolveEmailIdentity(
    {
      firstName: "Amy",
      lastName: "Nguyen",
      domain: "buildco.com",
      industry: "construction",
    },
    { skipDns: true },
  )
  assert.ok(emptyLearning.candidates.length > 0)
  assert.ok(emptyLearning.recommended)
  console.log("  ✓ Empty learning defaults")

  assert.ok(
    emptyLearning.candidates.every(
      (row) => row.overall_probability >= 0 && row.overall_probability <= 1,
    ),
  )
  assert.ok(
    emptyLearning.candidates.every((row) =>
      ["low", "medium", "high", "excellent"].includes(row.confidence),
    ),
  )
  console.log("  ✓ Confidence bounds")

  const deterministicRepeat = await resolveEmailIdentity(
    {
      firstName: "John",
      lastName: "Smith",
      domain: "precisionbiomedical.com",
      companyName: "Precision Biomedical",
      industry: "healthcare",
      jobTitle: "Director of Operations",
      historicalPatterns: companyEvidence,
      historicalLearning: {
        domain_reply_rate: 0.18,
        domain_meeting_rate: 0.04,
        pattern_success_rates: { first_dot_last: 0.91 },
        verified_contact_count: 42,
        placeholders: ["relationship_intelligence_placeholder"],
      },
    },
    { skipDns: true },
  )
  assert.deepEqual(
    resolved.candidates.map((row) => ({
      email: row.email,
      rank: row.rank,
      overall: row.overall_probability,
    })),
    deterministicRepeat.candidates.map((row) => ({
      email: row.email,
      rank: row.rank,
      overall: row.overall_probability,
    })),
  )
  console.log("  ✓ Deterministic resolution output")

  const serviceSource = readSource("lib/growth/contact-verification/email-verification-service.ts")
  assert.doesNotMatch(serviceSource, /identity-resolution-engine/)
  assert.doesNotMatch(serviceSource, /resolveEmailIdentity/)
  console.log("  ✓ No production verification wiring")

  assert.equal(IDENTITY_RESOLUTION_WEIGHTING_MODEL.version, "ire-v1")
  const weightSum = Object.values(IDENTITY_RESOLUTION_WEIGHTING_MODEL.components).reduce(
    (sum, value) => sum + value,
    0,
  )
  assert.ok(Math.abs(weightSum - 1) < 0.001)
  console.log("  ✓ Documented weighting sums to 1")

  console.log("\nGE-IRE-6A identity resolution engine certification passed.\n")
  console.log(
    `Recommended identity: ${resolved.recommended?.email} (${roundPercent(resolved.recommended?.overall_probability ?? 0)})`,
  )
}

function roundPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
