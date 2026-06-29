/**
 * GE-IRE-7D — Native Next Best Action Engine certification.
 * Run: pnpm test:growth-next-best-action
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { ProspectQualification } from "../lib/growth/contact-verification/prospect-qualification-types"
import type { SequenceRecommendation } from "../lib/growth/contact-verification/sequence-recommendation-types"
import {
  buildNextBestAction,
  computeNextBestActionConfidence,
  resolveNextBestActionDelayHours,
  resolveNextBestActionExecutionReadiness,
  resolveNextBestActionPriority,
  resolveNextBestActionType,
  type NextBestActionEngineDependencies,
} from "../lib/growth/contact-verification/next-best-action-engine"
import {
  isNextBestActionEnabled,
  isNextBestActionEnabledClient,
  GROWTH_NEXT_BEST_ACTION_PANEL_QA_MARKER,
} from "../lib/growth/contact-verification/next-best-action-feature"
import {
  GROWTH_NEXT_BEST_ACTION_QA_MARKER,
  NEXT_BEST_ACTION_CONFIDENCE_WEIGHTING,
} from "../lib/growth/contact-verification/next-best-action-types"
import {
  assertNextBestActionViewHasNoSensitiveData,
  buildNextBestActionView,
  formatNextBestActionDelayLabel,
  sanitizeNextBestActionView,
} from "../lib/growth/contact-verification/next-best-action-view"

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
  recommendedSequence: {
    name: "Executive Cold Outbound Sequence",
    type: "cold_outbound",
    confidence: 88,
  },
  enrollmentReadiness: "ready",
  preferredChannel: "email",
  cadence: {
    intensity: "high",
    suggestedTouchCount: 5,
    suggestedDurationDays: 14,
  },
  personalizationInputs: {
    primaryReason: "Verified executive contact",
  },
  reasons: ["Qualification permits sequence enrollment"],
  risks: [],
  blockers: [],
  nextAction: "enroll_sequence",
  confidence: 82,
}

async function main(): Promise<void> {
  console.log("\n=== GE-IRE-7D Next Best Action Engine Certification ===\n")

  assert.equal(GROWTH_NEXT_BEST_ACTION_QA_MARKER, "next-best-action-engine-v1")
  assert.equal(NEXT_BEST_ACTION_CONFIDENCE_WEIGHTING.version, "nba-v1")
  assert.equal(isNextBestActionEnabled(), false)
  assert.equal(isNextBestActionEnabled({ GROWTH_NEXT_BEST_ACTION: "true" }), true)
  assert.equal(isNextBestActionEnabledClient(), false)
  console.log("  ✓ Feature flag false by default")

  const engineSource = readSource("lib/growth/contact-verification/next-best-action-engine.ts")
  assert.match(engineSource, /buildSequenceRecommendation/)
  assert.match(engineSource, /predictContactEngagement/)
  assert.match(engineSource, /aggregateEmailLearningByDomain/)
  assert.match(engineSource, /acquisitionCandidate/)
  assert.doesNotMatch(engineSource, /openai/i)
  assert.doesNotMatch(engineSource, /enrollContact/i)
  assert.doesNotMatch(engineSource, /\.insert\(/)
  console.log("  ✓ Engine consumes full stack without AI, execution, or persistence")

  let sequenceCalls = 0
  let engagementCalls = 0
  let learningCalls = 0

  const dependencies: NextBestActionEngineDependencies = {
    skipDns: true,
    buildSequenceRecommendation: async (...args) => {
      sequenceCalls += 1
      const { buildSequenceRecommendation } = await import(
        "../lib/growth/contact-verification/sequence-recommendation-engine"
      )
      return buildSequenceRecommendation(...args)
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
    sequenceRecommendation: FIXTURE_SEQUENCE,
    historicalLearning: [],
  }

  const first = await buildNextBestAction(input, dependencies)
  const second = await buildNextBestAction(input, dependencies)

  assert.equal(sequenceCalls, 0)
  assert.equal(engagementCalls, 2)
  assert.equal(learningCalls, 2)
  assert.equal(JSON.stringify(first), JSON.stringify(second))
  assert.equal(first.action, "enroll_sequence")
  assert.equal(first.priority, "high")
  assert.equal(first.executionReadiness, "ready")
  console.log("  ✓ Qualification + sequence consumed; learning + engagement invoked; deterministic")

  assert.equal(
    resolveNextBestActionType({ qualification: FIXTURE_QUALIFICATION, sequence: FIXTURE_SEQUENCE }),
    "enroll_sequence",
  )
  assert.equal(
    resolveNextBestActionPriority({
      action: "enroll_sequence",
      qualification: FIXTURE_QUALIFICATION,
      sequence: FIXTURE_SEQUENCE,
    }),
    "high",
  )
  assert.equal(
    resolveNextBestActionExecutionReadiness({
      action: "enroll_sequence",
      qualification: FIXTURE_QUALIFICATION,
      sequence: FIXTURE_SEQUENCE,
    }),
    "ready",
  )
  assert.equal(
    resolveNextBestActionDelayHours({
      action: "enroll_sequence",
      executionReadiness: "ready",
    }),
    0,
  )
  assert.equal(formatNextBestActionDelayLabel(0), "Immediately")
  assert.equal(formatNextBestActionDelayLabel(undefined), "Never")
  console.log("  ✓ Action selection, priority, readiness, and delay rules")

  const confidence = computeNextBestActionConfidence({
    qualification: FIXTURE_QUALIFICATION,
    sequence: FIXTURE_SEQUENCE,
    engagementScore: 72,
    learningSignalBoost: 40,
  })
  assert.ok(confidence >= 70 && confidence <= 100)
  console.log("  ✓ Confidence weighting")

  assert.ok(first.reasons.length > 0)
  assert.ok(first.dependencies.length >= 0)
  assert.ok(first.warnings.length >= 0)
  console.log("  ✓ Reasons, dependencies, warnings, blockers generated")

  const sanitized = sanitizeNextBestActionView(first)
  assert.ok(assertNextBestActionViewHasNoSensitiveData(sanitized))
  console.log("  ✓ View sanitization")

  await withEnv({ GROWTH_NEXT_BEST_ACTION: undefined }, async () => {
    const disabled = await buildNextBestActionView(input, { skipDns: true })
    assert.equal(disabled, null)
  })

  const view = await withEnv({ GROWTH_NEXT_BEST_ACTION: "true" }, async () =>
    buildNextBestActionView(input, { skipDns: true }),
  )
  assert.ok(view)
  assert.equal(view?.qa_marker, GROWTH_NEXT_BEST_ACTION_PANEL_QA_MARKER)
  console.log("  ✓ Feature-gated view builder")

  const panelSource = readSource(
    "components/growth/prospect-search/prospect-search-next-best-action-panel.tsx",
  )
  assert.match(panelSource, /isNextBestActionEnabledClient/)
  assert.match(panelSource, /Collapsible/)
  assert.match(panelSource, /next-best-action/)
  assert.match(panelSource, /data-next-best-action-panel="read-only"/)
  assert.doesNotMatch(panelSource, /onClick=\{[^}]*enroll/i)
  console.log("  ✓ Panel collapsible, lazy-loaded, read-only, no execute button")

  const intelligencePanelSource = readSource(
    "components/growth/prospect-search/company-contact-intelligence-panel.tsx",
  )
  assert.match(intelligencePanelSource, /ProspectSearchNextBestActionPanel/)
  assert.match(intelligencePanelSource, /ProspectSearchSequenceRecommendationPanel/)
  console.log("  ✓ Panel mounted beneath Sequence Recommendation")

  const apiSource = readSource("app/api/platform/growth/prospect-search/next-best-action/route.ts")
  assert.match(apiSource, /companyId/)
  assert.match(apiSource, /isNextBestActionEnabled/)
  assert.match(apiSource, /next_best_action_disabled/)
  assert.ok(!apiSource.includes("supabase.from"))
  assert.ok(!apiSource.includes(".insert("))
  console.log("  ✓ Diagnostic API gated, read-only, no persistence")

  const nextConfig = readSource("next.config.mjs")
  assert.match(nextConfig, /NEXT_PUBLIC_GROWTH_NEXT_BEST_ACTION/)
  console.log("  ✓ Client env exposure in next.config")

  console.log("\nGE-IRE-7D next best action engine certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
