/**
 * GE-AIOS-NEXT-3D — Organizational learning loop regression tests.
 * Run: pnpm test:ge-aios-next-3d-organizational-learning-loop
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { enrichGrowthHomeExecutiveLanguageNext3c } from "../lib/growth/ava-home/recommendations/growth-home-ava-executive-language-enrichment-next-3c"
import { enrichGrowthHomeOrganizationalLearningNext3d } from "../lib/growth/ava-home/recommendations/growth-home-ava-organizational-learning-enrichment-next-3d"
import { buildGrowthHomeAvaExecutiveReasoningNext3c } from "../lib/growth/ava-home/recommendations/growth-home-ava-executive-reasoning-next-3c"
import {
  buildGrowthHomeAvaOperatorDecisionMemoryEvent,
  parseGrowthHomeAvaOperatorDecisionFromMemoryEvent,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-operator-decision-memory-next-3d"
import {
  buildGrowthHomeAvaRecommendationAccountabilityNext3d,
  buildOrganizationalLearningLine,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-accountability-next-3d"
import { GROWTH_AIOS_NEXT_3D_RECOMMENDATION_ACCOUNTABILITY_QA_MARKER } from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-accountability-next-3d-types"
import { buildGrowthOrganizationalEvidenceCompletenessSnapshot } from "../lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b"
import type { GrowthOrganizationalEvidenceCompletenessInput } from "../lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b-types"
import { GROWTH_LEARNING_MIN_SAMPLE_SIZE } from "../lib/growth/aios/learning/growth-closed-loop-learning-types"

const PHASE = "GE-AIOS-NEXT-3D-ORGANIZATIONAL-LEARNING-LOOP" as const
const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function evidenceInput(overrides?: Partial<GrowthOrganizationalEvidenceCompletenessInput["operator"]>): GrowthOrganizationalEvidenceCompletenessInput {
  return {
    organizationId: "org-3d",
    generatedAt: new Date().toISOString(),
    measurementPeriodLabel: "Current 24 hours",
    baselineSnapshot: {
      qaMarker: "ge-aios-next-3a-organizational-effectiveness-baseline-v1",
      principle: "test",
      architecturalRule: "test",
      organizationId: "org-3d",
      generatedAt: new Date().toISOString(),
      measurementPeriod: {
        id: "current_24h",
        label: "Current 24 hours",
        start: new Date(Date.now() - 86400000).toISOString(),
        end: new Date().toISOString(),
        sampleSizeNote: null,
        sufficientForComparison: true,
      },
      comparisonPeriod: null,
      baselineStatus: "establishing",
      improvementTrend: "establishing_baseline",
      dimensions: [],
      bottleneckCandidates: [],
      highestConfidenceBottleneck: null,
      unavailableMeasurements: [],
      dataCompletenessSummary: "test",
      canonicalDefinitions: {},
    },
    admission: {
      driftRows: [{ evaluatedState: "review", reasons: ["pending_operational_keyword_validation"] }],
      discoveryIntake: {
        discoveryRunsInWindow: 28,
        providerRecordsInWindow: 9295,
        intakeSelectedTotal: 111,
        intakePushedTotal: 0,
        intakeExistingTotal: 70,
        intakeRejectedTotal: 0,
        intakeSkippedInvalidTotal: 0,
        intakeErrorTotal: 0,
        leadsAdmittedInWindow: 0,
        providerToLeadYieldPct: 0,
        completeness: "available",
        completenessNote: null,
      },
    },
    decisionMakers: {
      waitingForDm: 19,
      waitingForContactVerification: 0,
      verifiedWithDecisionMakerId: 1,
      contactVerificationFailed: 0,
      draftFactoryActive: 46,
      progressionHoursSamples: [2, 4],
      blockingReasons: [{ reason: "waiting_for_dm", count: 19 }],
    },
    research: {
      completedRuns: [{ createdAt: new Date(Date.now() - 3600000).toISOString(), completedAt: new Date().toISOString() }],
      activeRuns: 9,
      stalledThresholdHours: 24,
    },
    operator: {
      packageApprovedInPeriod: 0,
      packageRejectedInPeriod: 0,
      pendingApprovals: 1,
      memoryDecisionEvents: 0,
      memoryApprovalEvents: 0,
      workflowRequestsAcceptedInPeriod: 0,
      workflowRequestsCompletedInPeriod: 0,
      workflowRequestsTotal: 14,
      ...overrides,
    },
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] certification`)

  const event = buildGrowthHomeAvaOperatorDecisionMemoryEvent({
    organizationId: "org-3d",
    decisionType: "recommendation_accepted",
    summary: "Operator accepted Ava recommendation (admission_yield).",
    recommendationTopic: "admission_yield",
    recommendationKind: "approval_package",
  })
  const parsed = parseGrowthHomeAvaOperatorDecisionFromMemoryEvent(event)
  assert.equal(parsed?.decisionType, "recommendation_accepted")
  assert.equal(parsed?.recommendationTopic, "admission_yield")
  console.log("  ✓ operator decision memory event round-trips through parser")

  const completeness = buildGrowthOrganizationalEvidenceCompletenessSnapshot(evidenceInput())
  const reasoning = buildGrowthHomeAvaExecutiveReasoningNext3c({
    evidenceCompleteness: completeness,
    pendingApprovals: 1,
    outboundDisabled: true,
  })

  const accountability = buildGrowthHomeAvaRecommendationAccountabilityNext3d({
    organizationId: "org-3d",
    generatedAt: new Date().toISOString(),
    evidenceCompleteness: completeness,
    executiveReasoning: reasoning,
    memoryEvents: [event],
  })

  assert.equal(accountability.qaMarker, GROWTH_AIOS_NEXT_3D_RECOMMENDATION_ACCOUNTABILITY_QA_MARKER)
  assert.ok(accountability.history)
  assert.equal(accountability.history?.stages.find((row) => row.stage === "created")?.status, "recorded")
  assert.equal(accountability.history?.stages.find((row) => row.stage === "implemented")?.status, "not_recorded")
  assert.match(
    accountability.organizationalLearningLine ?? "",
    /not yet enough evidence/i,
  )
  console.log("  ✓ accountability projection does not infer missing stages")

  const insufficientLine = buildOrganizationalLearningLine({
    topic: "admission_yield",
    evolution: "insufficient_evidence",
    outcomeLinkage: null,
  })
  assert.match(insufficientLine ?? "", /not yet enough evidence/i)

  const provenCompleteness = buildGrowthOrganizationalEvidenceCompletenessSnapshot(
    evidenceInput({
      workflowRequestsAcceptedInPeriod: GROWTH_LEARNING_MIN_SAMPLE_SIZE,
      workflowRequestsCompletedInPeriod: 3,
      workflowRequestsTotal: 14,
      packageApprovedInPeriod: 2,
    }),
  )
  const provenAccountability = buildGrowthHomeAvaRecommendationAccountabilityNext3d({
    organizationId: "org-3d",
    generatedAt: new Date().toISOString(),
    evidenceCompleteness: provenCompleteness,
    executiveReasoning: reasoning,
  })
  assert.equal(provenAccountability.confidenceEvolution, "increasing")
  assert.match(provenAccountability.organizationalLearningLine ?? "", /historically/i)
  console.log("  ✓ confidence evolution requires sufficient evidence before increasing")

  const enriched = enrichGrowthHomeOrganizationalLearningNext3d({
    executiveLanguage: enrichGrowthHomeExecutiveLanguageNext3c({
      reasoningInput: { evidenceCompleteness: completeness, outboundDisabled: true, pendingApprovals: 1 },
    }),
    accountability,
  })
  assert.ok(enriched.recommendationAccountability)
  console.log("  ✓ home enrichment adds organizational learning without new sections")

  const heroSource = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
  assert.match(heroSource, /enrichGrowthHomeOrganizationalLearningNext3d/)
  assert.match(heroSource, /buildGrowthHomeAvaRecommendationAccountabilityNext3d/)
  assert.doesNotMatch(heroSource, /OrganizationalLearningSection/)
  console.log("  ✓ hero wires accountability projection only")

  const projectionSource = readSource(
    "lib/growth/ava-home/recommendations/growth-home-ava-recommendation-accountability-next-3d.ts",
  )
  assert.doesNotMatch(projectionSource, /runGrowthObjectiveRuntimeScheduler|new CronJob/)
  assert.doesNotMatch(projectionSource, /\.insert\(|\.update\(|\.upsert\(/)
  console.log("  ✓ no duplicate recommendation, analytics, or learning engines in projection")

  console.log(`\n[${PHASE}] PASS — evolution=${accountability.confidenceEvolution}`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
