/**
 * GE-AIOS-NEXT-3B — Evidence completeness regression certification.
 * Run: pnpm test:ge-aios-next-3b-evidence-completeness
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  aggregateAdmissionReasonCategories,
  buildAdmissionEvidenceFinding,
  categorizeGrowthLeadAdmissionReason,
} from "../lib/growth/organizational-effectiveness/growth-organizational-admission-evidence-next-3b"
import { buildGrowthOrganizationalEffectivenessBaselineSnapshot } from "../lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-next-3a"
import type { GrowthOrganizationalEffectivenessEvidenceInput } from "../lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-next-3a-types"
import {
  assertGrowthOrganizationalEvidenceCompletenessProjectionOnly,
  buildGrowthOrganizationalEvidenceCompletenessSnapshot,
} from "../lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b"
import { GROWTH_AIOS_NEXT_3B_EVIDENCE_COMPLETENESS_QA_MARKER } from "../lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b-types"
import { computeResearchDurationStats } from "../lib/growth/organizational-effectiveness/growth-organizational-research-duration-next-3b"

const PHASE = "GE-AIOS-NEXT-3B-EVIDENCE-COMPLETENESS" as const
const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function baseEvidence(): GrowthOrganizationalEffectivenessEvidenceInput {
  return {
    organizationId: "org-test-3b",
    generatedAt: new Date().toISOString(),
    measurementPeriod: {
      id: "current_24h",
      label: "Current 24 hours",
      start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString(),
      sampleSizeNote: null,
      sufficientForComparison: true,
    },
    comparisonPeriod: null,
    outboundSendExecutionEnabled: false,
    pipeline: {
      discoveryRuns: 20,
      providerRecords: 400,
      leadsAdmitted: 0,
      leadsRejected: 0,
      duplicatesPrevented: null,
      admissionYield: 0,
      pipelineCoverage: 84,
      comparisonDiscoveryRuns: null,
      comparisonLeadsAdmitted: null,
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
      qualifiedCount: 2,
      rejectedCount: 0,
      unresolvedCount: 82,
      qualificationYield: 2.4,
      operatorAgreementRate: null,
      comparisonQualificationYield: null,
    },
    decisionMakers: {
      verified: null,
      contactable: null,
      unresolved: 19,
      verificationRate: 58.7,
      waitingForDecisionMaker: 19,
    },
    packages: {
      draftFactoryActive: 46,
      draftReady: null,
      waitingForApproval: 1,
      packagesBlocked: 26,
      packagesApproved: null,
      comparisonDraftReady: null,
    },
    operator: {
      pendingApprovals: 1,
      recommendationsAccepted: null,
      recommendationsSkipped: null,
      strategicOverrideCount: null,
      comparisonPendingApprovals: null,
    },
    outreach: {
      outboundDisabled: true,
      approvedPackages: null,
      draftsReady: null,
      sendWindowEligible: null,
      transportAuthorized: false,
      outboundMessagesInPeriod: 0,
    },
    meetings: {
      replies: null,
      meetingsBooked: null,
      opportunitiesOpened: null,
      packageToMeetingRate: null,
      outboundDisabledNote: "Outbound transport disabled.",
    },
    runtime: {
      schedulerRuns: 71,
      schedulerSuccessRate: 100,
      schedulerFailures: 0,
      draftFactoryUpdates: 33,
      queueDepth: 46,
      comparisonSchedulerRuns: null,
    },
    strategicLearning: {
      organizationalKnowledgeItems: null,
      validatedFindings: null,
      overridePatterns: null,
      segmentSamples: 84,
    },
    admissionAnalysisAvailable: true,
    salesOutcomesAvailable: false,
    segmentAnalyticsAvailable: false,
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] certification`)

  assert.equal(categorizeGrowthLeadAdmissionReason("negative_keyword:roofing"), "icp_mismatch")
  assert.equal(categorizeGrowthLeadAdmissionReason("operational_keyword_validation_failed"), "policy")
  assert.equal(categorizeGrowthLeadAdmissionReason("consumer_domain_as_company_website"), "data_quality")
  console.log("  ✓ admission reason categorization reuses 21C vocabulary")

  const categories = aggregateAdmissionReasonCategories([
    { evaluatedState: "rejected", reasons: ["negative_keyword:roofing", "operational_keyword_validation_failed"] },
    { evaluatedState: "review", reasons: ["missing_approved_profile"] },
  ])
  assert.ok(categories.length >= 2)
  console.log("  ✓ admission reason aggregation")

  const admissionFinding = buildAdmissionEvidenceFinding({
    driftRows: [{ evaluatedState: "rejected", reasons: ["negative_keyword:roofing"] }],
    discoveryIntake: {
      discoveryRunsInWindow: 28,
      providerRecordsInWindow: 9295,
      intakeSelectedTotal: 120,
      intakePushedTotal: 0,
      intakeExistingTotal: 80,
      intakeRejectedTotal: 40,
      intakeSkippedInvalidTotal: 0,
      intakeErrorTotal: 0,
      leadsAdmittedInWindow: 0,
      providerToLeadYieldPct: 0,
      completeness: "available",
      completenessNote: null,
    },
  })
  assert.ok(admissionFinding.evidenceBackedExplanation)
  assert.doesNotMatch(admissionFinding.evidenceBackedExplanation ?? "", /I believe/i)
  console.log("  ✓ admission evidence explanation is evidence-backed, not speculative")

  const research = computeResearchDurationStats({
    completedRuns: [
      { createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), completedAt: new Date().toISOString() },
      { createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(), completedAt: new Date().toISOString() },
    ],
    activeRuns: 1,
  })
  assert.ok(research.medianCompletionHours !== null)
  assert.match(research.completenessNote ?? "", /Sample size/i)
  console.log("  ✓ research duration uses timestamps with sample-size guard")

  const baseline = buildGrowthOrganizationalEffectivenessBaselineSnapshot(baseEvidence())
  const snapshot = buildGrowthOrganizationalEvidenceCompletenessSnapshot({
    organizationId: "org-test-3b",
    generatedAt: new Date().toISOString(),
    measurementPeriodLabel: "Current 24 hours",
    baselineSnapshot: baseline,
    admission: {
      driftRows: [{ evaluatedState: "rejected", reasons: ["negative_keyword:roofing"] }],
      discoveryIntake: admissionFinding.discoveryIntake,
    },
    decisionMakers: {
      waitingForDm: 19,
      waitingForContactVerification: 2,
      verifiedWithDecisionMakerId: 5,
      contactVerificationFailed: 1,
      draftFactoryActive: 46,
      progressionHoursSamples: [4, 8, 12],
      blockingReasons: [{ reason: "waiting_for_dm", count: 19 }],
    },
    research: {
      completedRuns: [
        { createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), completedAt: new Date().toISOString() },
      ],
      activeRuns: 9,
      stalledThresholdHours: 24,
    },
    operator: {
      packageApprovedInPeriod: 1,
      packageRejectedInPeriod: 0,
      pendingApprovals: 1,
      memoryDecisionEvents: 0,
      memoryApprovalEvents: 2,
      workflowRequestsAcceptedInPeriod: 1,
      workflowRequestsCompletedInPeriod: 0,
      workflowRequestsTotal: 3,
    },
  })

  assertGrowthOrganizationalEvidenceCompletenessProjectionOnly(snapshot)
  assert.equal(snapshot.qaMarker, GROWTH_AIOS_NEXT_3B_EVIDENCE_COMPLETENESS_QA_MARKER)
  console.log("  ✓ evidence completeness is projection-only over NEXT-3A baseline")

  const projectionSource = readSource(
    "lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b.ts",
  )
  const loaderSource = readSource(
    "lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-production-loader-next-3b.ts",
  )
  assert.doesNotMatch(projectionSource, /runGrowthObjectiveRuntimeScheduler|setInterval|node-cron/)
  assert.doesNotMatch(loaderSource, /\.insert\(|\.update\(|\.upsert\(/)
  console.log("  ✓ no duplicate analytics engine or operational mutation")

  const heroSource = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
  assert.doesNotMatch(heroSource, /ExecutiveReasoningSection|EvidenceCompletenessSection|data-qa-section="home-ava-evidence-completeness"/i)
  console.log("  ✓ no Home expansion")

  assert.ok(snapshot.completenessMatrix.some((entry) => entry.measurementId === "admission_rejection_reasons"))
  assert.ok(snapshot.gapsClosed.length > 0)
  console.log("  ✓ completeness matrix and gap tracking present")

  assert.match(snapshot.recommendationOutcomes.causationNote, /not proof/i)
  console.log("  ✓ recommendation outcomes avoid overstated causation")

  console.log(`\n[${PHASE}] PASS — ${snapshot.gapsClosed.length} gaps closed; ${snapshot.remainingGaps.length} remaining`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
