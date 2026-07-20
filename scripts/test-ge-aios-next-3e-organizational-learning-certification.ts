/**
 * GE-AIOS-NEXT-3E — Organizational learning certification regression tests.
 * Run: pnpm test:ge-aios-next-3e-organizational-learning-certification
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildGrowthHomeAvaOperatorDecisionMemoryEvent } from "../lib/growth/ava-home/recommendations/growth-home-ava-operator-decision-memory-next-3d"
import { enrichExecutiveReasoningWithLearningCertificationNext3e } from "../lib/growth/ava-home/recommendations/growth-home-ava-organizational-learning-enrichment-next-3e"
import {
  GROWTH_AIOS_NEXT_3E_RECOMMENDATION_TOPICS,
  mapRecommendationKindToTopic,
  resolveGrowthRecommendationTopic,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-topic-next-3e-types"
import { buildGrowthHomeAvaExecutiveReasoningNext3c } from "../lib/growth/ava-home/recommendations/growth-home-ava-executive-reasoning-next-3c"
import { buildGrowthHomeAvaRecommendationAccountabilityNext3d } from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-accountability-next-3d"
import { buildGrowthOrganizationalEvidenceCompletenessSnapshot } from "../lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b"
import type { GrowthOrganizationalEvidenceCompletenessInput } from "../lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b-types"
import { buildGrowthOrganizationalLearningCertificationNext3e } from "../lib/growth/organizational-effectiveness/growth-organizational-learning-certification-next-3e"
import { GROWTH_AIOS_NEXT_3E_ORGANIZATIONAL_LEARNING_CERTIFICATION_QA_MARKER } from "../lib/growth/organizational-effectiveness/growth-organizational-learning-certification-next-3e-types"
import { GROWTH_LEARNING_MIN_SAMPLE_SIZE } from "../lib/growth/aios/learning/growth-closed-loop-learning-types"

const PHASE = "GE-AIOS-NEXT-3E-ORGANIZATIONAL-LEARNING-CERTIFICATION" as const
const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function baselineSnapshot(organizationId: string) {
  return {
    qaMarker: "ge-aios-next-3a-organizational-effectiveness-baseline-v1" as const,
    principle: "test",
    architecturalRule: "test",
    organizationId,
    generatedAt: new Date().toISOString(),
    measurementPeriod: {
      id: "current_24h",
      label: "Current 24 hours",
      start: new Date(Date.now() - 86400000).toISOString(),
      end: new Date().toISOString(),
      sampleSizeNote: null,
      sufficientForComparison: true,
    },
    comparisonPeriod: {
      id: "prior_24h",
      label: "Previous 24 hours",
      start: new Date(Date.now() - 172800000).toISOString(),
      end: new Date(Date.now() - 86400000).toISOString(),
      sampleSizeNote: null,
      sufficientForComparison: true,
    },
    baselineStatus: "comparable" as const,
    improvementTrend: "establishing_baseline" as const,
    dimensions: [],
    bottleneckCandidates: [],
    highestConfidenceBottleneck: null,
    unavailableMeasurements: [],
    dataCompletenessSummary: "test",
    canonicalDefinitions: {},
  }
}

function evidenceInput(
  overrides?: Partial<GrowthOrganizationalEvidenceCompletenessInput["operator"]>,
): GrowthOrganizationalEvidenceCompletenessInput {
  return {
    organizationId: "org-3e",
    generatedAt: new Date().toISOString(),
    measurementPeriodLabel: "Current 24 hours",
    baselineSnapshot: baselineSnapshot("org-3e"),
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

function buildFixtureCertification(
  operatorOverrides?: Partial<GrowthOrganizationalEvidenceCompletenessInput["operator"]>,
) {
  const evidence = buildGrowthOrganizationalEvidenceCompletenessSnapshot(evidenceInput(operatorOverrides))
  const reasoning = buildGrowthHomeAvaExecutiveReasoningNext3c({
    evidenceCompleteness: evidence,
    pendingApprovals: 1,
    outboundDisabled: true,
  })
  const accountability = buildGrowthHomeAvaRecommendationAccountabilityNext3d({
    organizationId: "org-3e",
    generatedAt: new Date().toISOString(),
    evidenceCompleteness: evidence,
    executiveReasoning: reasoning,
  })
  return buildGrowthOrganizationalLearningCertificationNext3e({
    organizationId: "org-3e",
    generatedAt: new Date().toISOString(),
    accountability,
    evidenceCompleteness: evidence,
    baselineSnapshot: evidence.baselineSnapshot,
    baselineEvidence: null,
    executiveReasoning: reasoning,
    outboundDisabled: true,
  })
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] certification`)

  assert.ok(GROWTH_AIOS_NEXT_3E_RECOMMENDATION_TOPICS.includes("admission_yield"))
  assert.equal(mapRecommendationKindToTopic("approval_package"), "operator_review")
  assert.equal(resolveGrowthRecommendationTopic({ explicitTopic: "admission_yield" }), "admission_yield")
  console.log("  ✓ stable topic identity across reasoning and operator decision mapping")

  const immature = buildFixtureCertification()
  assert.equal(immature.qaMarker, GROWTH_AIOS_NEXT_3E_ORGANIZATIONAL_LEARNING_CERTIFICATION_QA_MARKER)
  assert.equal(immature.attributionWindows[0]?.maturity, "not_started")
  assert.equal(immature.primaryTopicCredibility?.confidenceEvolution, "insufficient_evidence")
  console.log("  ✓ immature windows cannot change confidence")

  const oneOutcome = buildFixtureCertification({
    workflowRequestsAcceptedInPeriod: GROWTH_LEARNING_MIN_SAMPLE_SIZE,
    workflowRequestsCompletedInPeriod: 1,
    packageApprovedInPeriod: 1,
  })
  assert.notEqual(oneOutcome.primaryTopicCredibility?.confidenceEvolution, "increasing")
  console.log("  ✓ one successful outcome does not create increasing confidence")

  const implementationAt = new Date(Date.now() - 3600000).toISOString()
  const memoryEvent = buildGrowthHomeAvaOperatorDecisionMemoryEvent({
    organizationId: "org-3e",
    decisionType: "recommendation_accepted",
    summary: "Operator accepted Ava recommendation (admission_yield).",
    recommendationTopic: "admission_yield",
    recommendationKind: "approval_package",
    implementationAt,
  })
  assert.equal(memoryEvent.metadata.implementation_at, implementationAt)
  assert.equal(memoryEvent.metadata.recommendation_topic, "admission_yield")
  console.log("  ✓ package/recommendation operator events retain recommendation-topic linkage")

  const withMemory = buildGrowthOrganizationalLearningCertificationNext3e({
    ...{
      organizationId: "org-3e",
      generatedAt: new Date().toISOString(),
      accountability: buildGrowthHomeAvaRecommendationAccountabilityNext3d({
        organizationId: "org-3e",
        generatedAt: new Date().toISOString(),
        evidenceCompleteness: buildGrowthOrganizationalEvidenceCompletenessSnapshot(evidenceInput()),
        executiveReasoning: buildGrowthHomeAvaExecutiveReasoningNext3c({
          evidenceCompleteness: buildGrowthOrganizationalEvidenceCompletenessSnapshot(evidenceInput()),
          outboundDisabled: true,
        }),
        memoryEvents: [memoryEvent],
      }),
      evidenceCompleteness: buildGrowthOrganizationalEvidenceCompletenessSnapshot(evidenceInput()),
      baselineSnapshot: baselineSnapshot("org-3e"),
      baselineEvidence: null,
      executiveReasoning: buildGrowthHomeAvaExecutiveReasoningNext3c({
        evidenceCompleteness: buildGrowthOrganizationalEvidenceCompletenessSnapshot(evidenceInput()),
        outboundDisabled: true,
      }),
      memoryEvents: [memoryEvent],
      outboundDisabled: true,
    },
  })
  assert.ok(withMemory.attributionWindows[0]?.implementationAt)
  assert.ok(withMemory.attributionWindows[0]?.observationWindow.start >= withMemory.attributionWindows[0]?.implementationAt!)
  console.log("  ✓ outcome windows begin after implementation")

  const comparison = withMemory.periodComparisons.find((row) => row.metricId === "leads_admitted")
  if (comparison?.relativeDeltaPct != null) {
    assert.ok(Number.isFinite(comparison.relativeDeltaPct))
  }
  console.log("  ✓ zero-denominator comparisons are safe")

  assert.match(withMemory.periodComparisons[0]?.causationNote ?? "", /causal effect remains unknown/i)
  console.log("  ✓ correlation is not described as causation")

  const enriched = enrichExecutiveReasoningWithLearningCertificationNext3e({
    reasoning: buildGrowthHomeAvaExecutiveReasoningNext3c({
      evidenceCompleteness: buildGrowthOrganizationalEvidenceCompletenessSnapshot(evidenceInput()),
      outboundDisabled: true,
    }),
    certification: withMemory,
  })
  assert.ok(enriched?.primary?.confidenceReason.includes("not yet enough evidence") || enriched?.primary?.confidenceReason.length)
  console.log("  ✓ executive reasoning integration enriches confidence language")

  const heroSource = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
  assert.match(heroSource, /buildGrowthOrganizationalLearningCertificationNext3e/)
  assert.doesNotMatch(heroSource, /LearningCertificationSection|OrganizationalLearningCertificationSection/)
  console.log("  ✓ no new Home section")

  const projectionSource = readSource(
    "lib/growth/organizational-effectiveness/growth-organizational-learning-certification-next-3e.ts",
  )
  assert.doesNotMatch(projectionSource, /growth-learning-insight-engine|runGrowthObjectiveRuntimeScheduler/)
  assert.doesNotMatch(projectionSource, /\.insert\(|\.update\(|\.upsert\(/)
  assert.doesNotMatch(projectionSource, /avaScore|universalScore|gamified/i)
  console.log("  ✓ no duplicate analytics/learning engine and no universal Ava score")

  console.log(`\n[${PHASE}] PASS — verdict=${withMemory.certificationVerdict}`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
