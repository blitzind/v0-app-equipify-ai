/**
 * GE-IRE-7B — Native Prospect Qualification Engine certification.
 * Run: pnpm test:growth-prospect-qualification
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildProspectQualification,
  computeProspectQualificationOverallScore,
  resolveProspectQualificationNextAction,
  resolveProspectQualificationState,
  type ProspectQualificationEngineDependencies,
} from "../lib/growth/contact-verification/prospect-qualification-engine"
import {
  isProspectQualificationEnabled,
  isProspectQualificationEnabledClient,
  GROWTH_PROSPECT_QUALIFICATION_PANEL_QA_MARKER,
} from "../lib/growth/contact-verification/prospect-qualification-feature"
import {
  GROWTH_PROSPECT_QUALIFICATION_QA_MARKER,
  PROSPECT_QUALIFICATION_SCORE_WEIGHTING,
} from "../lib/growth/contact-verification/prospect-qualification-types"
import {
  assertProspectQualificationViewHasNoSensitiveData,
  buildProspectQualificationView,
  sanitizeProspectQualificationView,
} from "../lib/growth/contact-verification/prospect-qualification-view"
import type { AcquisitionCandidate } from "../lib/growth/contact-verification/contact-acquisition-types"

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
  backupContacts: [
    {
      name: "Pat Reed",
      title: "Procurement Manager",
      role: "economic_buyer",
      email: "pat.reed@precisionbiomedical.com",
      confidence: 80,
      reasonSelected: "Selected as backup outreach target",
    },
  ],
  blockers: [],
  reasons: ["Economic buyer identified"],
  overallConfidence: 85,
}

const FIXTURE_INPUT = {
  companyId: "company-fixture-001",
  generatedAt: "2026-06-28T00:00:00.000Z",
  acquisitionCandidate: FIXTURE_ACQUISITION,
  prospectIntelligence: {
    companyName: "Precision Biomedical",
    domain: "precisionbiomedical.com",
    industry: "healthcare",
    companyMatchConfidence: 0.82,
    committeeCompletenessPct: 67,
    hasPhoneOnPrimary: true,
    contactCount: 2,
    verifiedContactCount: 2,
  },
  historicalLearning: [],
}

async function main(): Promise<void> {
  console.log("\n=== GE-IRE-7B Prospect Qualification Engine Certification ===\n")

  assert.equal(GROWTH_PROSPECT_QUALIFICATION_QA_MARKER, "prospect-qualification-engine-v1")
  assert.equal(PROSPECT_QUALIFICATION_SCORE_WEIGHTING.version, "pqe-v1")
  assert.equal(isProspectQualificationEnabled(), false)
  assert.equal(isProspectQualificationEnabled({ GROWTH_PROSPECT_QUALIFICATION: "true" }), true)
  assert.equal(isProspectQualificationEnabledClient(), false)
  console.log("  ✓ Feature flag false by default")

  const engineSource = readSource("lib/growth/contact-verification/prospect-qualification-engine.ts")
  assert.match(engineSource, /buildAcquisitionCandidate/)
  assert.match(engineSource, /predictContactEngagement/)
  assert.match(engineSource, /aggregateEmailLearningByDomain/)
  assert.match(engineSource, /acquisitionCandidate/)
  assert.doesNotMatch(engineSource, /openai/i)
  assert.doesNotMatch(engineSource, /zerobounce/i)
  console.log("  ✓ Engine consumes acquisition, engagement prediction, and learning engine")

  let engagementCalls = 0
  let learningCalls = 0
  let acquisitionCalls = 0

  const dependencies: ProspectQualificationEngineDependencies = {
    skipDns: true,
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
    buildAcquisitionCandidate: async (...args) => {
      acquisitionCalls += 1
      const { buildAcquisitionCandidate } = await import(
        "../lib/growth/contact-verification/contact-acquisition-engine"
      )
      return buildAcquisitionCandidate(...args)
    },
  }

  const first = await buildProspectQualification(FIXTURE_INPUT, dependencies)
  const second = await buildProspectQualification(FIXTURE_INPUT, dependencies)

  assert.equal(engagementCalls, 2)
  assert.equal(learningCalls, 2)
  assert.equal(acquisitionCalls, 0)
  assert.equal(first.acquisitionCandidate.companyId, FIXTURE_INPUT.companyId)
  assert.equal(JSON.stringify(first), JSON.stringify(second))
  console.log("  ✓ Acquisition candidate consumed; engagement + learning invoked; deterministic output")

  const weighted = computeProspectQualificationOverallScore({
    fitScore: 80,
    contactScore: 85,
    engagementScore: 70,
    buyingCommitteeCoverage: 65,
    acquisitionConfidence: 85,
  })
  assert.equal(weighted, 78)
  console.log("  ✓ Score weighting produces stable normalized overall score")

  const qualifiedState = resolveProspectQualificationState({
    overallScore: 75,
    contactScore: 70,
    engagementScore: 55,
    buyingCommitteeCoverage: 65,
    acquisition: FIXTURE_ACQUISITION,
  })
  assert.equal(qualifiedState, "qualified")

  const disqualifiedState = resolveProspectQualificationState({
    overallScore: 20,
    contactScore: 15,
    engagementScore: 10,
    buyingCommitteeCoverage: 10,
    acquisition: {
      ...FIXTURE_ACQUISITION,
      overallConfidence: 20,
      outreach: { ...FIXTURE_ACQUISITION.outreach, readiness: "blocked" },
    },
    intelligence: { isSuppressed: true },
  })
  assert.equal(disqualifiedState, "disqualified")
  console.log("  ✓ Qualification state rules are deterministic")

  assert.ok(first.strengths.length > 0)
  assert.ok(first.recommendations.length > 0)
  assert.equal(
    resolveProspectQualificationNextAction({
      qualification: "qualified",
      acquisition: FIXTURE_ACQUISITION,
    }),
    "enroll_sequence",
  )
  assert.equal(
    resolveProspectQualificationNextAction({
      qualification: "research",
      acquisition: {
        ...FIXTURE_ACQUISITION,
        blockers: ["Verification pending"],
        verification: { emailVerified: false, deliverability: "unknown", confidence: 40 },
      },
    }),
    "verify_contact",
  )
  console.log("  ✓ Strengths, recommendations, and next action precedence")

  const sanitized = sanitizeProspectQualificationView(first)
  assert.ok(assertProspectQualificationViewHasNoSensitiveData(sanitized))
  assert.ok(!JSON.stringify(sanitized).includes("acquisitionCandidate"))
  console.log("  ✓ View sanitization strips internal acquisition payload")

  await withEnv({ GROWTH_PROSPECT_QUALIFICATION: undefined }, async () => {
    const disabled = await buildProspectQualificationView(FIXTURE_INPUT, { skipDns: true })
    assert.equal(disabled, null)
  })

  const view = await withEnv({ GROWTH_PROSPECT_QUALIFICATION: "true" }, async () =>
    buildProspectQualificationView(FIXTURE_INPUT, { skipDns: true }),
  )
  assert.ok(view)
  assert.equal(view?.qa_marker, GROWTH_PROSPECT_QUALIFICATION_PANEL_QA_MARKER)
  console.log("  ✓ Feature-gated view builder")

  const panelSource = readSource(
    "components/growth/prospect-search/prospect-search-qualification-panel.tsx",
  )
  assert.match(panelSource, /isProspectQualificationEnabledClient/)
  assert.match(panelSource, /Collapsible/)
  assert.match(panelSource, /prospect-qualification/)
  assert.match(panelSource, /data-prospect-qualification-panel="read-only"/)
  console.log("  ✓ Prospect Search panel is collapsible, lazy-loaded, read-only")

  const intelligencePanelSource = readSource(
    "components/growth/prospect-search/company-contact-intelligence-panel.tsx",
  )
  assert.match(intelligencePanelSource, /ProspectSearchQualificationPanel/)
  assert.match(intelligencePanelSource, /ProspectSearchAcquisitionCandidatePanel/)
  console.log("  ✓ Panel mounted beneath Acquisition Candidate")

  const apiSource = readSource(
    "app/api/platform/growth/prospect-search/prospect-qualification/route.ts",
  )
  assert.match(apiSource, /companyId/)
  assert.match(apiSource, /isProspectQualificationEnabled/)
  assert.match(apiSource, /qualification_disabled/)
  assert.ok(!apiSource.includes("supabase.from"))
  assert.ok(!apiSource.includes(".insert("))
  console.log("  ✓ Diagnostic API gated, read-only, no persistence")

  const nextConfig = readSource("next.config.mjs")
  assert.match(nextConfig, /NEXT_PUBLIC_GROWTH_PROSPECT_QUALIFICATION/)
  console.log("  ✓ Client env exposure in next.config")

  console.log("\nGE-IRE-7B prospect qualification engine certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
