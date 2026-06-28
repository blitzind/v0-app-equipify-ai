/**
 * GE-IRE-6E — Account Outreach Recommendation Engine certification.
 * Run: pnpm test:growth-account-outreach-recommendation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildAccountOutreachStagedPlan,
  computeAccountOutreachReadiness,
  GROWTH_ACCOUNT_OUTREACH_RECOMMENDATION_QA_MARKER,
  recommendAccountOutreach,
  selectOutreachChannel,
  type AccountOutreachPrimaryRecommendation,
} from "../lib/growth/contact-verification/account-outreach-recommendation"
import { buildCompanyPatternEvidenceFromCounts } from "../lib/growth/contact-verification/identity-resolution-engine"
import { buildEmailLearningObservation } from "../lib/growth/contact-verification/email-learning"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log("\n=== GE-IRE-6E Account Outreach Recommendation Certification ===\n")

  assert.equal(GROWTH_ACCOUNT_OUTREACH_RECOMMENDATION_QA_MARKER, "account-outreach-recommendation-v1")
  console.log("  ✓ QA marker")

  const channelEmail = selectOutreachChannel({
    candidate: { email: "a@b.com", phone: "+1-555-0100" },
    recommendation: {
      rank: 1,
      contact: { display_name: "A B", email: "a@b.com" },
      recommended_email: "a@b.com",
      scores: {
        identity: 0.8,
        deliverability: 0.7,
        authority: 0.6,
        accessibility: 0.6,
        engagement: 0.5,
        relationship: 0.5,
        overall: 0.65,
      },
      confidence: 65,
      reasons: [],
      evidence: [],
      warnings: [],
    },
  })
  assert.equal(channelEmail.channel, "email")
  console.log("  ✓ Channel selection prefers deliverable email")

  const channelPhone = selectOutreachChannel({
    candidate: { phone: "+1-555-0100", linkedinUrl: "https://linkedin.com/in/test" },
    recommendation: {
      rank: 1,
      contact: { display_name: "No Email" },
      scores: {
        identity: 0.5,
        deliverability: 0.1,
        authority: 0.6,
        accessibility: 0.4,
        engagement: 0.3,
        relationship: 0.2,
        overall: 0.4,
      },
      confidence: 40,
      reasons: [],
      evidence: [],
      warnings: [],
    },
  })
  assert.equal(channelPhone.channel, "phone")
  console.log("  ✓ Channel selection falls back to phone when email weak")

  const channelPreferred = selectOutreachChannel({
    candidate: {
      email: "a@b.com",
      phone: "+1-555-0100",
      linkedinUrl: "https://linkedin.com/in/test",
    },
    recommendation: {
      rank: 1,
      contact: { display_name: "A B", email: "a@b.com" },
      recommended_email: "a@b.com",
      scores: {
        identity: 0.8,
        deliverability: 0.7,
        authority: 0.6,
        accessibility: 0.6,
        engagement: 0.5,
        relationship: 0.5,
        overall: 0.65,
      },
      confidence: 65,
      reasons: [],
      evidence: [],
      warnings: [],
    },
    preferredChannels: ["linkedin", "email"],
  })
  assert.equal(channelPreferred.channel, "linkedin")
  console.log("  ✓ Preferred channel order respected")

  const companyEvidence = buildCompanyPatternEvidenceFromCounts({
    domain: "precisionbiomedical.com",
    pattern_counts: { first_dot_last: 30 },
  })

  const historicalLearning = [
    buildEmailLearningObservation({
      email: "chris.taylor@precisionbiomedical.com",
      outcome: "positive_reply",
      source: "reply_intelligence",
      eventTimestamp: "2026-06-02T14:00:00.000Z",
    }).observation!,
  ]

  const baseInput = {
    companyName: "Precision Biomedical",
    domain: "precisionbiomedical.com",
    industry: "healthcare",
    targetUseCase: "service_operations" as const,
    companyPatternEvidence: companyEvidence,
    historicalLearning,
    contacts: [
      {
        firstName: "Chris",
        lastName: "Taylor",
        jobTitle: "VP Operations",
        department: "operations",
        email: "chris.taylor@precisionbiomedical.com",
        phone: "+1-555-0100",
      },
      {
        firstName: "John",
        lastName: "Smith",
        jobTitle: "Director of Operations",
        department: "operations",
        linkedinUrl: "https://linkedin.com/in/johnsmith",
      },
      {
        firstName: "Pat",
        lastName: "Reed",
        jobTitle: "Procurement Manager",
        department: "finance",
        email: "pat.reed@precisionbiomedical.com",
      },
    ],
  }

  const result = await recommendAccountOutreach(baseInput, { skipDns: true })

  assert.equal(result.qa_marker, GROWTH_ACCOUNT_OUTREACH_RECOMMENDATION_QA_MARKER)
  assert.ok(result.primary_recommendation)
  assert.ok(result.primary_recommendation.contact.contact.display_name)
  assert.ok(result.primary_recommendation.committee_role)
  assert.equal(result.primary_recommendation.recommended_channel, "email")
  assert.ok(result.primary_recommendation.score >= 0.5)
  assert.ok(result.primary_recommendation.reasons.length >= 2)
  console.log("  ✓ Primary recommendation with committee integration")

  assert.ok(result.backup_recommendations.length >= 1)
  assert.ok(result.backup_recommendations.every((row) => row.recommended_channel !== undefined))
  console.log("  ✓ Backup recommendations")

  assert.ok(result.committee.coverage)
  assert.ok(result.summary.committee_coverage_score >= 0)
  console.log("  ✓ Committee intelligence embedded")

  assert.ok(result.staged_plan.length >= 2)
  assert.equal(result.staged_plan[0]?.action, "contact_primary")
  assert.ok(result.staged_plan.some((step) => step.action === "contact_backup"))
  assert.ok(result.staged_plan.some((step) => step.action === "research_missing_role"))
  console.log("  ✓ Staged outreach plan generation")

  assert.ok(["ready", "needs_review", "insufficient"].includes(result.readiness.tier))
  assert.ok(result.readiness.score >= 0)
  console.log("  ✓ Readiness model")

  const requireEmail = await recommendAccountOutreach(
    {
      ...baseInput,
      contacts: [
        {
          firstName: "John",
          lastName: "Smith",
          jobTitle: "Director of Operations",
          linkedinUrl: "https://linkedin.com/in/johnsmith",
        },
      ],
      preferences: { requireDeliverableEmail: true },
    },
    { skipDns: true },
  )
  assert.ok(
    requireEmail.readiness.blockers.includes("deliverable_email_required") ||
      requireEmail.readiness.tier === "insufficient" ||
      requireEmail.readiness.tier === "needs_review",
  )
  console.log("  ✓ requireDeliverableEmail preference")

  const lowCoverage = await recommendAccountOutreach(
    {
      companyName: "Sparse Co",
      domain: "sparse.co",
      targetUseCase: "growth_engine",
      contacts: [
        {
          firstName: "Alex",
          lastName: "User",
          jobTitle: "Intern",
          department: "marketing",
        },
      ],
    },
    { skipDns: true },
  )
  assert.ok(
    lowCoverage.warnings.some((w) => w.includes("readiness")) ||
      lowCoverage.readiness.tier !== "ready" ||
      lowCoverage.staged_plan.some((s) => s.action === "expand_committee"),
  )
  console.log("  ✓ Low coverage warning and expand committee step")

  const repeat = await recommendAccountOutreach(baseInput, { skipDns: true })
  assert.deepEqual(
    {
      primary: repeat.primary_recommendation?.contact.contact.display_name,
      backups: repeat.backup_recommendations.map((row) => row.contact.contact.display_name),
      tier: repeat.readiness.tier,
      plan: repeat.staged_plan.map((step) => step.action),
    },
    {
      primary: result.primary_recommendation?.contact.contact.display_name,
      backups: result.backup_recommendations.map((row) => row.contact.contact.display_name),
      tier: result.readiness.tier,
      plan: result.staged_plan.map((step) => step.action),
    },
  )
  console.log("  ✓ Deterministic ordering")

  const orchestratorSource = readSource("lib/growth/contact-verification/account-outreach-recommendation.ts")
  assert.ok(!orchestratorSource.includes("supabase"))
  assert.ok(!orchestratorSource.includes("enrollContact"))
  assert.ok(!orchestratorSource.includes("sendMessage"))
  assert.ok(!/\bfrom\s+["']@\/lib\/.*enroll/.test(orchestratorSource))
  console.log("  ✓ No DB, enrollment, or send code paths in orchestrator")

  const verificationService = readSource("lib/growth/contact-verification/email-verification-service.ts")
  assert.ok(!verificationService.includes("account-outreach-recommendation"))
  console.log("  ✓ Not wired to production verification service")

  const mockPrimary: AccountOutreachPrimaryRecommendation = {
    contact: {
      rank: 1,
      contact: { display_name: "Chris Taylor" },
      scores: {
        identity: 0.8,
        deliverability: 0.7,
        authority: 0.8,
        accessibility: 0.7,
        engagement: 0.6,
        relationship: 0.5,
        overall: 0.72,
      },
      confidence: 72,
      reasons: [],
      evidence: [],
      warnings: [],
    },
    committee_role: "operational_buyer",
    recommended_channel: "email",
    score: 0.72,
    confidence: 72,
    reasons: [],
    evidence: [],
    warnings: [],
  }

  const ready = computeAccountOutreachReadiness({
    primary: mockPrimary,
    committee: {
      qa_marker: "buying-committee-intelligence-v1",
      coverage: {
        required_roles: ["operational_buyer"],
        covered_roles: ["operational_buyer", "champion"],
        missing_roles: [],
        coverage_score: 0.75,
        coverage_tier: "moderate",
      },
    } as Awaited<ReturnType<typeof recommendAccountOutreach>>["committee"],
    useCase: "service_operations",
  })
  assert.equal(ready.tier, "ready")
  assert.equal(ready.ready, true)
  console.log("  ✓ Readiness ready tier")

  const insufficient = computeAccountOutreachReadiness({
    primary: undefined,
    committee: {
      qa_marker: "buying-committee-intelligence-v1",
      coverage: {
        required_roles: [],
        covered_roles: [],
        missing_roles: ["economic_buyer"],
        coverage_score: 0,
        coverage_tier: "insufficient",
      },
    } as Awaited<ReturnType<typeof recommendAccountOutreach>>["committee"],
    useCase: "generic",
  })
  assert.equal(insufficient.tier, "insufficient")
  console.log("  ✓ Readiness insufficient tier")

  const plan = buildAccountOutreachStagedPlan({
    primary: mockPrimary,
    backups: [],
    committee: {
      coverage: {
        required_roles: [],
        covered_roles: [],
        missing_roles: ["finance_procurement"],
        coverage_score: 0.4,
        coverage_tier: "weak",
      },
    } as Awaited<ReturnType<typeof recommendAccountOutreach>>["committee"],
    readiness: { ready: false, score: 55, tier: "needs_review", blockers: ["primary_score_below_threshold"] },
  })
  assert.ok(plan.some((step) => step.action === "research_missing_role"))
  assert.ok(plan.some((step) => step.action === "hold"))
  console.log("  ✓ Missing role research and hold steps")

  console.log("\nGE-IRE-6E account outreach recommendation certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
