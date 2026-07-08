/**
 * GE-IRE-8A — Native Revenue Decision Integration certification.
 * Run: pnpm test:growth-native-decision-integration
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { ProspectQualification } from "../lib/growth/contact-verification/prospect-qualification-types"
import type { SequenceRecommendation } from "../lib/growth/contact-verification/sequence-recommendation-types"
import {
  adaptNativeToCommandCenterRecommendation,
  adaptNativeToDisplaySummary,
  adaptNativeToMeetingPrepObjective,
  adaptNativeToOperatorRecommendations,
  adaptNativeToRelationshipRecommendation,
  adaptNativeToSequenceReadiness,
  applyNativeRevenueDecisionToContactIntelligence,
  buildNativeRevenueDecisionAuthoritativeBundle,
  buildNativeRevenueDecisionComparisonMetrics,
  buildNativeRevenueDecisionStack,
  GROWTH_NATIVE_DECISION_ENGINE_QA_MARKER,
  resolveAuthoritativeOperatorRecommendations,
  resolveAuthoritativeSequenceReadiness,
  resolveNativeRevenueDecisionAuthoritativeBundle,
} from "../lib/growth/contact-verification/native-revenue-decision-adapter"
import {
  isNativeRevenueDecisionEngineEnabled,
  isNativeRevenueDecisionEngineEnabledClient,
} from "../lib/growth/contact-verification/native-revenue-decision-feature"
import { resolveAccountSequenceReadiness } from "../lib/growth/prospect-search/prospect-search-sequence-readiness"
import { buildProspectSearchOperatorRecommendations } from "../lib/growth/prospect-search/prospect-search-operator-recommendations"
import type { GrowthProspectSearchContactIntelligence } from "../lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import { GROWTH_PROSPECT_SEARCH_CONTACT_INTELLIGENCE_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-contact-intelligence-types"

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

const FIXTURE_INTELLIGENCE: GrowthProspectSearchContactIntelligence = {
  qa_marker: GROWTH_PROSPECT_SEARCH_CONTACT_INTELLIGENCE_QA_MARKER,
  schema_ready: true,
  has_contacts: true,
  contacts: [
    {
      id: "person-001",
      name: "Chris Taylor",
      title: "VP Operations",
      confidence: 88,
      source_evidence: [],
      role_type: "economic_buyer",
      recommended_priority: 1,
      email: "chris.taylor@precisionbiomedical.com",
      verification_status: "verified",
    },
  ],
  committee_roles: [],
  committee_completeness_pct: 67,
  first_contact: {
    contact_id: "person-001",
    role: "economic_buyer",
    name: "Chris Taylor",
    confidence: 88,
    reasons: ["Verified executive"],
  },
  confidence_explanation: null,
  outreach_recommendation: null,
  source_labels: ["fixture"],
  empty_reason: null,
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
  acquisitionCandidate: {
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
    verification: { emailVerified: true, deliverability: "verified", confidence: 92 },
    committee: { role: "economic_buyer", confidence: 72 },
    outreach: { readiness: "ready", preferredChannel: "email", recommendedSequence: "Executive outbound" },
    backupContacts: [],
    blockers: [],
    reasons: ["Verified executive contact"],
    overallConfidence: 85,
  },
  strengths: ["Verified executive contact"],
  risks: [],
  blockers: [],
  recommendations: ["Enroll in outbound sequence"],
  nextAction: "enroll_sequence",
}

const FIXTURE_SEQUENCE: SequenceRecommendation = {
  version: 1,
  companyId: "company-fixture-001",
  generatedAt: "2026-06-28T00:00:00.000Z",
  recommendedSequence: { name: "Executive Cold Outbound Sequence", type: "cold_outbound", confidence: 88 },
  enrollmentReadiness: "ready",
  preferredChannel: "email",
  cadence: { intensity: "high", suggestedTouchCount: 5, suggestedDurationDays: 14 },
  personalizationInputs: { primaryReason: "Verified executive contact" },
  reasons: ["Qualification permits sequence enrollment"],
  risks: [],
  blockers: [],
  nextAction: "enroll_sequence",
  confidence: 82,
}

function fixtureStack() {
  return {
    acquisition: FIXTURE_QUALIFICATION.acquisitionCandidate,
    qualification: FIXTURE_QUALIFICATION,
    sequence: FIXTURE_SEQUENCE,
    nextBestAction: {
      version: 1 as const,
      companyId: "company-fixture-001",
      generatedAt: "2026-06-28T00:00:00.000Z",
      action: "enroll_sequence" as const,
      priority: "high" as const,
      confidence: 84,
      executionReadiness: "ready" as const,
      recommendedSequence: { name: "Executive Cold Outbound Sequence" },
      recommendedChannel: "email" as const,
      recommendedDelayHours: 0,
      reasons: ["Qualified and ready for enrollment"],
      blockers: [] as string[],
      dependencies: [] as string[],
      warnings: [] as string[],
    },
  }
}

const LEGACY_SEQUENCE_INPUT = {
  company: {
    id: "company-fixture-001",
    company_name: "Precision Biomedical",
    is_suppressed: false,
    suppression_reason: null,
    company_match_confidence: 0.9,
    lead_engine_score: 78,
    lead_score: 78,
    in_revenue_queue: false,
    existing_customer: false,
    reachable_human: { score: 80 },
  },
  peopleRows: [
    {
      contact_id: "person-001",
      full_name: "Chris Taylor",
      title: "VP Operations",
      email_available: true,
      email_eligibility: "eligible" as const,
      call_ready: false,
      call_eligibility: "ineligible" as const,
      freshness_status: "fresh" as const,
      conflict_status: "no_conflict" as const,
      persona_type: "operations",
      outreach_rank_score: 80,
      priority_tier: "primary" as const,
      is_recommended_contact: true,
    },
  ],
  coverage: {
    persona_completeness: 67,
    outreach_readiness_score: 75,
    ranking_summary: "Strong coverage",
    primary_recommended_contact_id: "person-001",
    coverage_label: "Good",
  },
  accountStrategy: {
    account_outreach_readiness: "ready" as const,
    primary_contact: { contact_id: "person-001", full_name: "Chris Taylor" },
    queue_priority_score: 70,
    strategy_reasons: [],
    strategy_summary: "Email first",
    queue_prioritization_reason: null,
    missing_personas: [],
    blocked_contacts: [],
  },
} as Parameters<typeof resolveAccountSequenceReadiness>[0]

async function main(): Promise<void> {
  console.log("\n=== GE-IRE-8A Native Revenue Decision Integration Certification ===\n")

  assert.equal(GROWTH_NATIVE_DECISION_ENGINE_QA_MARKER, "native-revenue-decision-engine-v1")
  assert.equal(isNativeRevenueDecisionEngineEnabled(), false)
  assert.equal(isNativeRevenueDecisionEngineEnabled({ GROWTH_NATIVE_DECISION_ENGINE: "true" }), true)
  assert.equal(isNativeRevenueDecisionEngineEnabledClient(), false)
  console.log("  ✓ Feature flag false by default")

  const adapterSource = readSource("lib/growth/contact-verification/native-revenue-decision-adapter.ts")
  assert.match(adapterSource, /buildNativeRevenueDecisionStack/)
  assert.match(adapterSource, /buildProspectQualification/)
  assert.match(adapterSource, /buildSequenceRecommendation/)
  assert.match(adapterSource, /buildNextBestAction/)
  assert.doesNotMatch(adapterSource, /\.insert\(/)
  assert.doesNotMatch(adapterSource, /enrollContact/i)
  console.log("  ✓ Adapter orchestrates native stack without persistence or execution")

  const stack = fixtureStack()
  const sequenceReadiness = adaptNativeToSequenceReadiness(stack)
  assert.equal(sequenceReadiness.readiness_state, "ready")
  assert.equal(sequenceReadiness.sequence_suitability, "email_first")
  console.log("  ✓ Prospect Search sequence readiness adapted from native stack")

  const operatorRecs = adaptNativeToOperatorRecommendations(stack)
  assert.equal(operatorRecs.top_recommendation?.recommendation_type, "email_first")
  assert.ok(operatorRecs.evidence_backed)
  console.log("  ✓ Prospect Search operator recommendations adapted from native stack")

  const display = adaptNativeToDisplaySummary(stack)
  assert.equal(display.source, "native")
  assert.equal(display.action, "enroll_sequence")
  console.log("  ✓ Lead Detail display summary adapted from native stack")

  const meetingObjective = adaptNativeToMeetingPrepObjective(stack)
  assert.ok(meetingObjective?.objective.includes("outreach"))
  console.log("  ✓ Meeting Prep objective adapted from native stack")

  const relationshipRec = adaptNativeToRelationshipRecommendation(stack)
  assert.match(relationshipRec, /enroll sequence/i)
  console.log("  ✓ Relationship Intelligence recommendation adapted from native stack")

  const commandRec = adaptNativeToCommandCenterRecommendation(stack)
  assert.equal(commandRec.headline, "enroll sequence")
  assert.ok(commandRec.reasons.length > 0)
  console.log("  ✓ Ava Command Center recommendation adapted from native stack")

  const legacySequence = resolveAccountSequenceReadiness(LEGACY_SEQUENCE_INPUT)
  const metrics = buildNativeRevenueDecisionComparisonMetrics({
    companyId: "company-fixture-001",
    legacySequence,
    stack,
  })
  assert.equal(metrics.qa_marker, GROWTH_NATIVE_DECISION_ENGINE_QA_MARKER)
  assert.ok("legacyQualification" in metrics)
  assert.ok("nativeQualification" in metrics)
  assert.ok("decisionAgreement" in metrics)
  assert.ok(Array.isArray(metrics.decisionDifference))
  console.log("  ✓ Comparison metrics generated")

  const authoritative = buildNativeRevenueDecisionAuthoritativeBundle({
    stack,
    legacySequence,
  })
  assert.equal(authoritative.qa_marker, GROWTH_NATIVE_DECISION_ENGINE_QA_MARKER)
  console.log("  ✓ Authoritative bundle built with comparison logging")

  await withEnv({ GROWTH_NATIVE_DECISION_ENGINE: "true" }, async () => {
    const authoritativeSequence = resolveAuthoritativeSequenceReadiness({
      legacyInput: LEGACY_SEQUENCE_INPUT,
      nativeBundle: authoritative,
    })
    assert.equal(authoritativeSequence.readiness_state, "ready")
    assert.equal(authoritativeSequence.suggested_sequence_type, "Executive Cold Outbound Sequence")

    const authoritativeOperator = resolveAuthoritativeOperatorRecommendations({
      nativeBundle: authoritative,
      legacyBuilder: () =>
        buildProspectSearchOperatorRecommendations({
          ...LEGACY_SEQUENCE_INPUT,
          peopleRows: LEGACY_SEQUENCE_INPUT.peopleRows as never,
          coverage: LEGACY_SEQUENCE_INPUT.coverage as never,
          accountStrategy: LEGACY_SEQUENCE_INPUT.accountStrategy as never,
        }),
    })
    assert.equal(authoritativeOperator.top_recommendation?.recommendation_type, "email_first")
    console.log("  ✓ Native authority used when feature flag ON")
  })

  await withEnv({ GROWTH_NATIVE_DECISION_ENGINE: undefined }, async () => {
    const fallbackSequence = resolveAuthoritativeSequenceReadiness({
      legacyInput: LEGACY_SEQUENCE_INPUT,
      nativeBundle: authoritative,
    })
    assert.equal(fallbackSequence.qa_marker, legacySequence.qa_marker)
    console.log("  ✓ Legacy fallback when feature flag OFF")
  })

  let qualificationCalls = 0
  let sequenceCalls = 0
  let nbaCalls = 0

  await withEnv({ GROWTH_NATIVE_DECISION_ENGINE: "true" }, async () => {
    const builtStack = await buildNativeRevenueDecisionStack(
      {
        companyId: "company-fixture-001",
        companyName: "Precision Biomedical",
        website: "https://precisionbiomedical.com",
        intelligence: FIXTURE_INTELLIGENCE,
        generatedAt: "2026-06-28T00:00:00.000Z",
      },
      {
        buildProspectQualification: async (input) => {
          qualificationCalls += 1
          return { ...FIXTURE_QUALIFICATION, companyId: input.companyId }
        },
        buildSequenceRecommendation: async (input) => {
          sequenceCalls += 1
          return { ...FIXTURE_SEQUENCE, companyId: input.companyId }
        },
        buildNextBestAction: async () => fixtureStack().nextBestAction,
      },
    )
    assert.ok(builtStack)
    assert.equal(qualificationCalls, 1)
    assert.equal(sequenceCalls, 1)
    assert.equal(nbaCalls, 0)
    console.log("  ✓ Native stack built once without duplicated engine fan-out")

    nbaCalls = 0
    const bundle = await resolveNativeRevenueDecisionAuthoritativeBundle({
      buildInput: {
        companyId: "company-fixture-001",
        intelligence: FIXTURE_INTELLIGENCE,
        generatedAt: "2026-06-28T00:00:00.000Z",
      },
      dependencies: {
        buildProspectQualification: async () => FIXTURE_QUALIFICATION,
        buildSequenceRecommendation: async () => FIXTURE_SEQUENCE,
        buildNextBestAction: async () => {
          nbaCalls += 1
          return fixtureStack().nextBestAction
        },
      },
    })
    assert.ok(bundle)
    assert.equal(nbaCalls, 1)
    console.log("  ✓ resolveNativeRevenueDecisionAuthoritativeBundle returns bundle")
  })

  const patched = applyNativeRevenueDecisionToContactIntelligence(FIXTURE_INTELLIGENCE, authoritative)
  assert.equal(patched.sequence_readiness?.readiness_state, "ready")
  assert.equal(patched.native_revenue_decision?.source, "native")
  assert.ok(patched.native_meeting_prep_objective)
  assert.ok(patched.native_relationship_recommendation)
  console.log("  ✓ Contact intelligence patched with authoritative native decisions")

  const operationalSource = readSource("lib/growth/prospect-search/prospect-search-operational-intelligence.ts")
  const operatorAssistSource = readSource("lib/growth/prospect-search/prospect-search-operator-assist-intelligence.ts")
  const loaderSource = readSource("lib/growth/prospect-search/prospect-search-contact-intelligence-loader.ts")
  const meetingPrepSource = readSource("lib/growth/meeting-intelligence/meeting-prep-bundle.ts")
  const campaignSource = readSource("lib/growth/campaign-readiness/campaign-readiness-service.ts")
  const synthesizerSource = readSource(
    "lib/growth/aios/operator-experience/growth-ai-os-operator-experience-synthesizer.ts",
  )

  assert.match(operationalSource, /resolveAuthoritativeSequenceReadiness/)
  assert.match(operatorAssistSource, /resolveAuthoritativeOperatorRecommendations/)
  assert.match(loaderSource, /resolveNativeRevenueDecisionAuthoritativeBundle/)
  assert.match(meetingPrepSource, /nativeMeetingPrepObjective/)
  assert.match(campaignSource, /contactIntel\?\.sequence_readiness/)
  assert.match(synthesizerSource, /nativeRevenueDecisionRecommendation/)
  console.log("  ✓ Consumer integration points wired")

  assert.match(readSource("next.config.mjs"), /NEXT_PUBLIC_GROWTH_NATIVE_DECISION_ENGINE/)
  assert.match(readSource("package.json"), /test:growth-native-decision-integration/)
  console.log("  ✓ Feature flag env and test script registered")

  console.log("\n=== GE-IRE-8A certification passed ===\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
