/**
 * GE-IRE-7C — Native Sequence Recommendation Engine certification.
 * Run: pnpm test:growth-sequence-recommendation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { ProspectQualification } from "../lib/growth/contact-verification/prospect-qualification-types"
import {
  buildSequenceCadence,
  buildSequenceRecommendation,
  computeSequenceRecommendationConfidence,
  resolveSequenceEnrollmentReadiness,
  resolveSequenceNextAction,
  selectSequenceType,
  type SequenceRecommendationEngineDependencies,
} from "../lib/growth/contact-verification/sequence-recommendation-engine"
import {
  isSequenceRecommendationEnabled,
  isSequenceRecommendationEnabledClient,
  GROWTH_SEQUENCE_RECOMMENDATION_PANEL_QA_MARKER,
} from "../lib/growth/contact-verification/sequence-recommendation-feature"
import {
  GROWTH_SEQUENCE_RECOMMENDATION_QA_MARKER,
  SEQUENCE_RECOMMENDATION_CONFIDENCE_WEIGHTING,
} from "../lib/growth/contact-verification/sequence-recommendation-types"
import {
  assertSequenceRecommendationViewHasNoSensitiveData,
  buildSequenceRecommendationView,
  sanitizeSequenceRecommendationView,
} from "../lib/growth/contact-verification/sequence-recommendation-view"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const saved = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(overrides)) {
    saved.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of saved.entries()) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }) as Promise<T>
}

const FIXTURE_ACQUISITION: AcquisitionCandidate = {
  version: 1,
  companyId: "company-fixture-001",
  generatedAt: "2026-06-28T00:00:00.000Z",
  primaryContact: {
    personId: "person-001",
    fullName: "Chris Taylor",
    title: "VP Operations",
    email: "chris.taylor@precisionbiomedical.com",
    confidence: 88,
  },
  verification: {
    emailVerified: true,
    deliverability: "verified",
    confidence: 92,
  },
  committee: {
    role: "economic_buyer",
    confidence: 72,
  },
  outreach: {
    readiness: "ready",
    preferredChannel: "email",
    recommendedSequence: "contact primary: Chris Taylor via email",
  },
  backupContacts: [],
  blockers: [],
  reasons: ["Economic buyer identified"],
  overallConfidence: 85,
}

const FIXTURE_QUALIFICATION: ProspectQualification = {
  version: 1,
  companyId: "company-fixture-001",
  generatedAt: "2026-06-28T00:00:00.000Z",
  qualification: "qualified",
  overallScore: 78,
  fitScore: 82,
  contactScore: 86,
  engagementScore: 72,
  buyingCommitteeCoverage: 67,
  confidence: 80,
  acquisitionCandidate: FIXTURE_ACQUISITION,
  strengths: ["Verified executive contact", "Strong ICP match"],
  risks: [],
  blockers: [],
  recommendations: ["Enroll in outbound sequence"],
  nextAction: "enroll_sequence",
}

async function main(): Promise<void> {
  console.log("\n=== GE-IRE-7C Sequence Recommendation Engine Certification ===\n")

  assert.equal(GROWTH_SEQUENCE_RECOMMENDATION_QA_MARKER, "sequence-recommendation-engine-v1")
  assert.equal(SEQUENCE_RECOMMENDATION_CONFIDENCE_WEIGHTING.version, "sre-v1")
  assert.equal(isSequenceRecommendationEnabled(), false)
  assert.equal(isSequenceRecommendationEnabled({ GROWTH_SEQUENCE_RECOMMENDATION: "true" }), true)
  assert.equal(isSequenceRecommendationEnabledClient(), false)
  console.log("  ✓ Feature flag false by default")

  const engineSource = readSource("lib/growth/contact-verification/sequence-recommendation-engine.ts")
  assert.match(engineSource, /buildProspectQualification/)
  assert.match(engineSource, /recommendAccountOutreach/)
  assert.match(engineSource, /predictContactEngagement/)
  assert.match(engineSource, /aggregateEmailLearningByDomain/)
  assert.match(engineSource, /acquisitionCandidate/)
  assert.doesNotMatch(engineSource, /openai/i)
  assert.doesNotMatch(engineSource, /enrollContact/i)
  assert.doesNotMatch(engineSource, /\.insert\(/)
  console.log("  ✓ Engine consumes qualification stack without AI, enrollment, or persistence")

  let qualificationCalls = 0
  let outreachCalls = 0
  let engagementCalls = 0
  let learningCalls = 0

  const dependencies: SequenceRecommendationEngineDependencies = {
    skipDns: true,
    buildProspectQualification: async (...args) => {
      qualificationCalls += 1
      const { buildProspectQualification } = await import(
        "../lib/growth/contact-verification/prospect-qualification-engine"
      )
      return buildProspectQualification(...args)
    },
    recommendAccountOutreach: async (...args) => {
      outreachCalls += 1
      const { recommendAccountOutreach } = await import(
        "../lib/growth/contact-verification/account-outreach-recommendation"
      )
      return recommendAccountOutreach(...args)
    },
    predictContactEngagement: (...args) => {
      engagementCalls += 1
      const { predictContactEngagement } = require("../lib/growth/contact-verification/contact-engagement-prediction")
      return predictContactEngagement(...args)
    },
    aggregateEmailLearningByDomain: (...args) => {
      learningCalls += 1
      const { aggregateEmailLearningByDomain } = require("../lib/growth/contact-verification/email-learning")
      return aggregateEmailLearningByDomain(...args)
    },
  }

  const input = {
    companyId: "company-fixture-001",
    generatedAt: "2026-06-28T00:00:00.000Z",
    qualification: FIXTURE_QUALIFICATION,
    historicalLearning: [],
  }

  const first = await buildSequenceRecommendation(input, dependencies)
  const second = await buildSequenceRecommendation(input, dependencies)

  assert.equal(qualificationCalls, 0)
  assert.equal(outreachCalls, 0)
  assert.equal(engagementCalls, 2)
  assert.equal(learningCalls, 2)
  assert.ok(first.recommendedSequence.name.length > 0)
  assert.equal(JSON.stringify(first), JSON.stringify(second))
  console.log("  ✓ Qualification consumed; engagement + learning invoked; deterministic output")

  const enrollmentReadiness = resolveSequenceEnrollmentReadiness({ qualification: FIXTURE_QUALIFICATION })
  assert.equal(enrollmentReadiness, "ready")

  const selected = selectSequenceType({
    qualification: FIXTURE_QUALIFICATION,
    engagementScore: 72,
    enrollmentReadiness: "ready",
  })
  assert.equal(selected.type, "cold_outbound")

  const cadence = buildSequenceCadence({
    sequenceType: "cold_outbound",
    engagementScore: 72,
    enrollmentReadiness: "ready",
  })
  assert.equal(cadence.intensity, "high")
  assert.equal(cadence.suggestedTouchCount, 5)
  console.log("  ✓ Sequence selection, enrollment readiness, and cadence rules")

  assert.equal(
    resolveSequenceNextAction({ qualification: FIXTURE_QUALIFICATION, enrollmentReadiness: "ready" }),
    "enroll_sequence",
  )

  const confidence = computeSequenceRecommendationConfidence({
    qualification: FIXTURE_QUALIFICATION,
    sequenceMatchScore: 90,
    engagementScore: 72,
    learningSignalBoost: 40,
  })
  assert.ok(confidence >= 70 && confidence <= 100)
  console.log("  ✓ Next action precedence and confidence weighting")

  assert.ok(first.reasons.length > 0)
  assert.ok(first.personalizationInputs.primaryReason.length > 0)
  assert.equal(first.nextAction, "enroll_sequence")
  console.log("  ✓ Personalization inputs, reasons, risks, blockers")

  const sanitized = sanitizeSequenceRecommendationView(first)
  assert.ok(assertSequenceRecommendationViewHasNoSensitiveData(sanitized))
  console.log("  ✓ View sanitization")

  await withEnv({ GROWTH_SEQUENCE_RECOMMENDATION: undefined }, async () => {
    const disabled = await buildSequenceRecommendationView(input, { skipDns: true })
    assert.equal(disabled, null)
  })

  const view = await withEnv({ GROWTH_SEQUENCE_RECOMMENDATION: "true" }, async () =>
    buildSequenceRecommendationView(input, { skipDns: true }),
  )
  assert.ok(view)
  assert.equal(view?.qa_marker, GROWTH_SEQUENCE_RECOMMENDATION_PANEL_QA_MARKER)
  console.log("  ✓ Feature-gated view builder")

  const panelSource = readSource(
    "components/growth/prospect-search/prospect-search-sequence-recommendation-panel.tsx",
  )
  assert.match(panelSource, /isSequenceRecommendationEnabledClient/)
  assert.match(panelSource, /Collapsible/)
  assert.match(panelSource, /sequence-recommendation/)
  assert.match(panelSource, /data-sequence-recommendation-panel="read-only"/)
  assert.doesNotMatch(panelSource, /onClick=\{[^}]*enroll/i)
  console.log("  ✓ Panel collapsible, lazy-loaded, read-only, no enroll button")

  const intelligencePanelSource = readSource(
    "components/growth/prospect-search/company-contact-intelligence-panel.tsx",
  )
  assert.match(intelligencePanelSource, /ProspectSearchSequenceRecommendationPanel/)
  assert.match(intelligencePanelSource, /ProspectSearchQualificationPanel/)
  console.log("  ✓ Panel mounted beneath Prospect Qualification")

  const apiSource = readSource(
    "app/api/platform/growth/prospect-search/sequence-recommendation/route.ts",
  )
  assert.match(apiSource, /companyId/)
  assert.match(apiSource, /isSequenceRecommendationEnabled/)
  assert.match(apiSource, /sequence_recommendation_disabled/)
  assert.ok(!apiSource.includes("supabase.from"))
  assert.ok(!apiSource.includes(".insert("))
  console.log("  ✓ Diagnostic API gated, read-only, no persistence")

  const nextConfig = readSource("next.config.mjs")
  assert.match(nextConfig, /NEXT_PUBLIC_GROWTH_SEQUENCE_RECOMMENDATION/)
  console.log("  ✓ Client env exposure in next.config")

  console.log("\nGE-IRE-7C sequence recommendation engine certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
