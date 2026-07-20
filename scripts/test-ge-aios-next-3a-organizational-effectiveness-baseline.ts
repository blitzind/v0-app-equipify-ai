/**
 * GE-AIOS-NEXT-3A — Organizational effectiveness baseline regression certification.
 * Run: pnpm test:ge-aios-next-3a-organizational-effectiveness-baseline
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS } from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"
import {
  assertGrowthOrganizationalEffectivenessProjectionOnly,
  buildGrowthOrganizationalEffectivenessBaselineSnapshot,
  GROWTH_AIOS_NEXT_3A_CANONICAL_OPERATIONAL_DEFINITIONS,
} from "../lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-next-3a"
import {
  GROWTH_AIOS_NEXT_3A_ORGANIZATIONAL_EFFECTIVENESS_QA_MARKER,
  type GrowthOrganizationalEffectivenessEvidenceInput,
  type GrowthOrganizationalEffectivenessTimeWindow,
} from "../lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-next-3a-types"

const PHASE = "GE-AIOS-NEXT-3A-ORGANIZATIONAL-EFFECTIVENESS-BASELINE" as const
const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function timeWindow(
  id: string,
  sufficient: boolean,
  sampleNote: string | null = null,
): GrowthOrganizationalEffectivenessTimeWindow {
  return {
    id,
    label: id,
    start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
    sampleSizeNote: sampleNote,
    sufficientForComparison: sufficient,
  }
}

function baseEvidence(
  overrides: Partial<GrowthOrganizationalEffectivenessEvidenceInput> = {},
): GrowthOrganizationalEffectivenessEvidenceInput {
  return {
    organizationId: "org-test-3a",
    generatedAt: new Date().toISOString(),
    measurementPeriod: timeWindow("current_24h", true),
    comparisonPeriod: timeWindow("prior_24h", false, "Sample size 0 — insufficient for confident period comparison."),
    outboundSendExecutionEnabled: false,
    pipeline: {
      discoveryRuns: 20,
      providerRecords: 400,
      leadsAdmitted: 12,
      leadsRejected: 88,
      duplicatesPrevented: null,
      admissionYield: 3,
      pipelineCoverage: 120,
      comparisonDiscoveryRuns: 0,
      comparisonLeadsAdmitted: 0,
    },
    research: {
      researchRuns: 15,
      researchCompleted: 10,
      leadsWithResearch: 8,
      stalledResearch: 2,
      medianCompletionHours: null,
      comparisonResearchRuns: null,
    },
    qualification: {
      qualifiedCount: 40,
      rejectedCount: 20,
      unresolvedCount: 5,
      qualificationYield: 61.5,
      operatorAgreementRate: null,
      comparisonQualificationYield: null,
    },
    decisionMakers: {
      verified: 5,
      contactable: 4,
      unresolved: 3,
      verificationRate: 62.5,
      waitingForDecisionMaker: 3,
    },
    packages: {
      draftFactoryActive: 25,
      draftReady: 8,
      waitingForApproval: 4,
      packagesBlocked: 1,
      packagesApproved: 6,
      comparisonDraftReady: null,
    },
    operator: {
      pendingApprovals: 4,
      recommendationsAccepted: null,
      recommendationsSkipped: null,
      strategicOverrideCount: null,
      comparisonPendingApprovals: null,
    },
    outreach: {
      outboundDisabled: true,
      approvedPackages: 6,
      draftsReady: 8,
      sendWindowEligible: null,
      transportAuthorized: false,
      outboundMessagesInPeriod: 0,
    },
    meetings: {
      replies: null,
      meetingsBooked: null,
      opportunitiesOpened: null,
      packageToMeetingRate: null,
      outboundDisabledNote: "Outbound transport disabled — meeting progression baseline not applicable.",
    },
    runtime: {
      schedulerRuns: 71,
      schedulerSuccessRate: 100,
      schedulerFailures: 0,
      draftFactoryUpdates: 25,
      queueDepth: 25,
      comparisonSchedulerRuns: 0,
    },
    strategicLearning: {
      organizationalKnowledgeItems: 12,
      validatedFindings: null,
      overridePatterns: null,
      segmentSamples: 120,
    },
    admissionAnalysisAvailable: true,
    salesOutcomesAvailable: false,
    segmentAnalyticsAvailable: false,
    ...overrides,
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] certification`)

  // 1. Existing authorities remain canonical — projection does not import scheduler runners
  const projectionSource = readSource(
    "lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-next-3a.ts",
  )
  assert.doesNotMatch(projectionSource, /runGrowthObjectiveRuntimeScheduler/)
  assert.doesNotMatch(projectionSource, /tickGrowthObjectiveRuntime/)
  assert.doesNotMatch(projectionSource, /setInterval|node-cron/)
  console.log("  ✓ existing authorities remain canonical — no scheduler execution in projection")

  // 2. Effectiveness metrics are projections only
  const snapshot = buildGrowthOrganizationalEffectivenessBaselineSnapshot(baseEvidence())
  assertGrowthOrganizationalEffectivenessProjectionOnly(snapshot)
  assert.equal(snapshot.qaMarker, GROWTH_AIOS_NEXT_3A_ORGANIZATIONAL_EFFECTIVENESS_QA_MARKER)
  console.log("  ✓ effectiveness metrics are projections only")

  // 3. Organization data is isolated — snapshot carries organizationId
  assert.equal(snapshot.organizationId, "org-test-3a")
  const loaderSource = readSource(
    "lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-production-loader-next-3a.ts",
  )
  assert.match(loaderSource, /\.eq\("organization_id", organizationId\)/)
  console.log("  ✓ organization data is isolated in production loader queries")

  // 4. Time windows calculated correctly
  assert.equal(snapshot.measurementPeriod.id, "current_24h")
  assert.ok(snapshot.measurementPeriod.start < snapshot.measurementPeriod.end)
  console.log("  ✓ time windows present with valid start/end ordering")

  // 5. Empty prior periods do not create false improvement claims
  assert.equal(snapshot.improvementTrend, "establishing_baseline")
  const insufficientComparison = buildGrowthOrganizationalEffectivenessBaselineSnapshot(
    baseEvidence({
      comparisonPeriod: timeWindow("prior_24h", false, "Sample size 0"),
      pipeline: {
        ...baseEvidence().pipeline,
        comparisonDiscoveryRuns: 0,
        comparisonLeadsAdmitted: 0,
      },
    }),
  )
  assert.notEqual(insufficientComparison.improvementTrend, "improving")
  console.log("  ✓ empty prior periods do not create false improvement claims")

  // 6. Disabled outbound does not create false outreach-performance penalties
  const outreachDim = snapshot.dimensions.find((d) => d.id === "outreach_readiness")
  assert.ok(outreachDim)
  assert.match(outreachDim.summaryLine ?? "", /penalties for zero sends do not apply/i)
  const meetingDim = snapshot.dimensions.find((d) => d.id === "meeting_opportunity_progression")
  assert.ok(meetingDim?.summaryLine?.includes("not authorized"))
  console.log("  ✓ disabled outbound does not create false outreach-performance penalties")

  // 7. Counts and rates use compatible cohorts — admission yield uses discovery/admitted
  const pipelineDim = snapshot.dimensions.find((d) => d.id === "pipeline_creation")
  const yieldMetric = pipelineDim?.metrics.find((m) => m.id === "admission_yield_pct")
  assert.ok(yieldMetric?.qualificationNote?.includes("Yield"))
  console.log("  ✓ counts and rates document cohort semantics")

  // 8. Qualification yield is not mislabeled as accuracy
  const qualDim = snapshot.dimensions.find((d) => d.id === "qualification_effectiveness")
  const qualYield = qualDim?.metrics.find((m) => m.id === "qualification_yield_pct")
  assert.match(qualYield?.qualificationNote ?? "", /not accuracy/i)
  assert.match(qualDim?.summaryLine ?? "", /yield is measurable/i)
  console.log("  ✓ qualification yield is not mislabeled as accuracy")

  // 9. Bottleneck candidates include evidence and confidence
  assert.ok(snapshot.bottleneckCandidates.length > 0)
  for (const candidate of snapshot.bottleneckCandidates) {
    assert.ok(candidate.evidence.length > 0)
    assert.ok(["high", "moderate", "low"].includes(candidate.confidence))
  }
  assert.ok(snapshot.highestConfidenceBottleneck)
  console.log("  ✓ bottleneck candidates include evidence and confidence")

  // 10. Missing data reported honestly
  assert.ok(snapshot.unavailableMeasurements.length > 0)
  assert.match(snapshot.dataCompletenessSummary, /partially available|metric gaps/i)
  console.log("  ✓ missing data is reported honestly")

  // 11. Small samples do not produce exaggerated conclusions
  const smallSample = buildGrowthOrganizationalEffectivenessBaselineSnapshot(
    baseEvidence({
      strategicLearning: {
        organizationalKnowledgeItems: 2,
        validatedFindings: null,
        overridePatterns: null,
        segmentSamples: 3,
      },
      segmentAnalyticsAvailable: true,
    }),
  )
  const learningDim = smallSample.dimensions.find((d) => d.id === "strategic_learning")
  const segmentMetric = learningDim?.metrics.find((m) => m.id === "segment_samples")
  assert.match(segmentMetric?.qualificationNote ?? "", /Insufficient sample/i)
  console.log("  ✓ small samples do not produce exaggerated conclusions")

  // 12. Runtime metrics do not create another scheduler
  assert.doesNotMatch(loaderSource, /runGrowthObjectiveRuntimeScheduler/)
  console.log("  ✓ runtime metrics reuse cron telemetry — no duplicate scheduler")

  // 13. No Home dashboard expansion
  const heroSource = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
  const dashboardSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.doesNotMatch(heroSource, /ExecutiveReasoningSection|EffectivenessBaselineSection/)
  assert.doesNotMatch(dashboardSource, /ExecutiveReasoningSection|EffectivenessBaselineSection/)
  console.log("  ✓ no Home dashboard expansion introduced")

  // 14. No duplicate analytics engine
  assert.doesNotMatch(projectionSource, /\.insert\(|\.update\(|\.upsert\(/)
  assert.doesNotMatch(loaderSource, /\.insert\(|\.update\(|\.upsert\(/)
  console.log("  ✓ no duplicate analytics engine — read-only projection")

  // Canonical definitions present
  assert.ok(GROWTH_AIOS_NEXT_3A_CANONICAL_OPERATIONAL_DEFINITIONS.discovered)
  assert.ok(GROWTH_AIOS_NEXT_3A_CANONICAL_OPERATIONAL_DEFINITIONS.qualified.includes("yield"))
  console.log("  ✓ canonical operational definitions documented")

  // Outbound policy unchanged
  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.outbound_send_execution_enabled, false)
  console.log("  ✓ outbound policy unchanged — send execution disabled")

  // Ten dimensions
  assert.equal(snapshot.dimensions.length, 10)
  console.log("  ✓ ten effectiveness dimensions projected")

  console.log(`\n[${PHASE}] PASS — ${snapshot.bottleneckCandidates.length} bottleneck candidates; highest-confidence: ${snapshot.highestConfidenceBottleneck?.stage ?? "none"}`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
