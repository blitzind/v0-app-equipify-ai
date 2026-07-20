/**
 * GE-AIOS-NEXT-3E — Organizational learning certification projection (read-model only).
 * Certifies Recommendation → Operator decision → Implementation → Outcome → Comparison → Confidence → Reasoning.
 * Reuses NEXT-3A periods, NEXT-3B evidence, NEXT-3C topics, NEXT-3D accountability — no duplicate engines.
 */

import { GROWTH_LEARNING_MIN_SAMPLE_SIZE } from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"
import type { GrowthRevenueDirectorWorkflowRequestRecord } from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-types"
import type { AvaMemoryEvent } from "@/lib/growth/memory/types"
import type { GrowthHomeAvaRecommendationAccountabilitySnapshot } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-accountability-next-3d-types"
import type { GrowthRecommendationConfidenceEvolution } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-accountability-next-3d-types"
import {
  growthRecommendationTopicLabel,
  normalizeGrowthRecommendationTopic,
  type GrowthRecommendationTopic,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-topic-next-3e-types"
import { parseGrowthHomeAvaOperatorDecisionFromMemoryEvent } from "@/lib/growth/ava-home/recommendations/growth-home-ava-operator-decision-memory-next-3d"
import type { GrowthHomeAvaExecutiveReasoningPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-reasoning-next-3c-types"
import type {
  GrowthOrganizationalEffectivenessEvidenceInput,
  GrowthOrganizationalEffectivenessSnapshot,
} from "@/lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-next-3a-types"
import type { GrowthOrganizationalEvidenceCompletenessSnapshot } from "@/lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b-types"
import {
  GROWTH_AIOS_NEXT_3E_CERTIFICATION_PRINCIPLE,
  GROWTH_AIOS_NEXT_3E_OPERATOR_DECISION_METADATA_KEYS,
  GROWTH_AIOS_NEXT_3E_ORGANIZATIONAL_LEARNING_CERTIFICATION_QA_MARKER,
  type GrowthAttributionTimeWindow,
  type GrowthAttributionWindowMaturity,
  type GrowthOrganizationalLearningCertificationSnapshot,
  type GrowthOrganizationalLearningCertificationVerdict,
  type GrowthOrganizationalLearningPromotionAssessment,
  type GrowthRecommendationAttributionWindow,
  type GrowthTopicComparisonDirection,
  type GrowthTopicPeriodComparison,
  type GrowthTopicRecommendationCredibility,
} from "./growth-organizational-learning-certification-next-3e-types"

const CAUSATION_BOUNDARY =
  "Correlation is established from operational truth — causal effect remains unknown." as const

function safeRelativeDeltaPct(baseline: number, observed: number): number | null {
  if (baseline === 0) return null
  return Math.round(((observed - baseline) / baseline) * 1000) / 10
}

function topicMinimumSample(topic: GrowthRecommendationTopic): number {
  switch (topic) {
    case "admission_yield":
      return 5
    case "decision_maker_readiness":
      return 3
    case "operator_review":
    case "package_throughput":
      return 2
    case "pipeline_coverage":
    case "research_throughput":
      return 3
    case "outreach_readiness":
      return 1
    default:
      return GROWTH_LEARNING_MIN_SAMPLE_SIZE
  }
}

function resolveImplementationAt(input: {
  topic: GrowthRecommendationTopic
  memoryEvents: AvaMemoryEvent[]
  workflowRequests: GrowthRevenueDirectorWorkflowRequestRecord[]
}): string | null {
  const topicEvents = input.memoryEvents
    .map((event) => ({ event, parsed: parseGrowthHomeAvaOperatorDecisionFromMemoryEvent(event) }))
    .filter(
      (row): row is { event: AvaMemoryEvent; parsed: NonNullable<ReturnType<typeof parseGrowthHomeAvaOperatorDecisionFromMemoryEvent>> } =>
        Boolean(row.parsed && (!row.parsed.recommendationTopic || row.parsed.recommendationTopic === input.topic)),
    )

  const implementationAtFromMemory = topicEvents
    .filter((row) => row.parsed.decisionType === "recommendation_accepted" || row.parsed.decisionType === "package_approved")
    .map((row) => {
      const implementationAt =
        row.event.metadata.implementation_at ??
        row.event.metadata[GROWTH_AIOS_NEXT_3E_OPERATOR_DECISION_METADATA_KEYS.implementationAt]
      return typeof implementationAt === "string" ? implementationAt : row.event.timestamp
    })
    .sort()[0]

  const implementedAtFromWorkflow = input.workflowRequests
    .filter((request) => request.completedAt || request.acceptedAt)
    .map((request) => request.completedAt ?? request.acceptedAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0]

  return implementationAtFromMemory ?? implementedAtFromWorkflow ?? null
}

function buildAttributionWindow(input: {
  topic: GrowthRecommendationTopic
  baselineSnapshot: GrowthOrganizationalEffectivenessSnapshot
  implementationAt: string | null
  observationSampleSize: number
  generatedAt: string
}): GrowthRecommendationAttributionWindow {
  const baselineWindow: GrowthAttributionTimeWindow = {
    id: input.baselineSnapshot.comparisonPeriod?.id ?? "prior_window",
    label: input.baselineSnapshot.comparisonPeriod?.label ?? "Prior comparison window",
    start: input.baselineSnapshot.comparisonPeriod?.start ?? input.baselineSnapshot.measurementPeriod.start,
    end: input.baselineSnapshot.comparisonPeriod?.end ?? input.baselineSnapshot.measurementPeriod.start,
  }

  const observationStart = input.implementationAt ?? input.baselineSnapshot.measurementPeriod.start

  const observationWindow: GrowthAttributionTimeWindow = {
    id: "post_implementation_observation",
    label: input.implementationAt ? "Post-implementation observation window" : "Current observation window",
    start: observationStart,
    end: input.generatedAt,
  }

  const comparisonWindow: GrowthAttributionTimeWindow = {
    id: input.baselineSnapshot.measurementPeriod.id,
    label: input.baselineSnapshot.measurementPeriod.label,
    start: input.baselineSnapshot.measurementPeriod.start,
    end: input.baselineSnapshot.measurementPeriod.end,
  }

  const minimumSampleRequired = topicMinimumSample(input.topic)
  let maturity: GrowthAttributionWindowMaturity = "not_started"
  let maturityReason = "No implementation timestamp recorded for this topic."

  if (!input.implementationAt) {
    maturity = "not_started"
  } else if (input.implementationAt > input.generatedAt) {
    maturity = "invalid"
    maturityReason = "Implementation timestamp is after the observation window end."
  } else if (input.observationSampleSize < minimumSampleRequired) {
    maturity = input.observationSampleSize === 0 ? "accumulating" : "insufficient_volume"
    maturityReason = `Observation sample ${input.observationSampleSize} is below the ${minimumSampleRequired} required for ${growthRecommendationTopicLabel(input.topic)}.`
  } else if (!input.baselineSnapshot.comparisonPeriod?.sufficientForComparison) {
    maturity = "insufficient_volume"
    maturityReason = "Baseline comparison window lacks sufficient volume for period-over-period comparison."
  } else {
    maturity = "mature"
    maturityReason = "Observation window is post-implementation with sufficient sample and a valid comparison window."
  }

  return {
    windowId: `${input.topic}:${observationWindow.start.slice(0, 10)}`,
    topic: input.topic,
    baselineWindow,
    implementationAt: input.implementationAt,
    observationWindow,
    comparisonWindow,
    maturity,
    maturityReason,
    minimumSampleRequired,
    observationSampleSize: input.observationSampleSize,
  }
}

function topicMetricValues(
  topic: GrowthRecommendationTopic,
  evidence: GrowthOrganizationalEvidenceCompletenessSnapshot,
  baselineEvidence: GrowthOrganizationalEffectivenessEvidenceInput,
): Array<{
  metricId: string
  metricLabel: string
  baselineValue: number | null
  observedValue: number | null
  baselineSampleSize: number
  observationSampleSize: number
}> {
  switch (topic) {
    case "admission_yield":
      return [
        {
          metricId: "leads_admitted",
          metricLabel: "Leads admitted",
          baselineValue: baselineEvidence.pipeline.comparisonLeadsAdmitted,
          observedValue: evidence.admissionEvidence.discoveryIntake.leadsAdmittedInWindow,
          baselineSampleSize: baselineEvidence.pipeline.comparisonDiscoveryRuns ?? 0,
          observationSampleSize: evidence.admissionEvidence.discoveryIntake.discoveryRunsInWindow,
        },
        {
          metricId: "provider_to_lead_yield_pct",
          metricLabel: "Provider-to-lead yield (%)",
          baselineValue: null,
          observedValue: evidence.admissionEvidence.discoveryIntake.providerToLeadYieldPct,
          baselineSampleSize: baselineEvidence.pipeline.comparisonDiscoveryRuns ?? 0,
          observationSampleSize: evidence.admissionEvidence.discoveryIntake.providerRecordsInWindow,
        },
      ]
    case "decision_maker_readiness":
      return [
        {
          metricId: "waiting_for_dm",
          metricLabel: "Leads waiting for decision-maker research",
          baselineValue: null,
          observedValue: evidence.decisionMakerReadiness.waitingForDecisionMaker,
          baselineSampleSize: 0,
          observationSampleSize: evidence.decisionMakerReadiness.verifiedWithDecisionMakerId,
        },
      ]
    case "operator_review":
    case "package_throughput":
      return [
        {
          metricId: "packages_approved",
          metricLabel: "Packages approved",
          baselineValue: null,
          observedValue: evidence.operatorDecisionHistory.packageApprovedInPeriod,
          baselineSampleSize: 0,
          observationSampleSize:
            evidence.operatorDecisionHistory.packageApprovedInPeriod +
            evidence.operatorDecisionHistory.packageRejectedInPeriod,
        },
        {
          metricId: "packages_pending",
          metricLabel: "Packages awaiting approval",
          baselineValue: null,
          observedValue: evidence.operatorDecisionHistory.pendingApprovals,
          baselineSampleSize: 0,
          observationSampleSize: evidence.operatorDecisionHistory.pendingApprovals,
        },
      ]
    case "pipeline_coverage":
      return [
        {
          metricId: "discovery_runs",
          metricLabel: "Discovery runs",
          baselineValue: baselineEvidence.pipeline.comparisonDiscoveryRuns,
          observedValue: evidence.admissionEvidence.discoveryIntake.discoveryRunsInWindow,
          baselineSampleSize: baselineEvidence.pipeline.comparisonDiscoveryRuns ?? 0,
          observationSampleSize: evidence.admissionEvidence.discoveryIntake.discoveryRunsInWindow,
        },
      ]
    case "research_throughput":
      return [
        {
          metricId: "research_completed",
          metricLabel: "Completed research runs",
          baselineValue: baselineEvidence.research.comparisonResearchRuns,
          observedValue: evidence.researchDuration.completedSampleSize,
          baselineSampleSize: baselineEvidence.research.comparisonResearchRuns ?? 0,
          observationSampleSize: evidence.researchDuration.completedSampleSize,
        },
      ]
    case "outreach_readiness":
      return [
        {
          metricId: "outbound_messages",
          metricLabel: "Outbound messages sent",
          baselineValue: null,
          observedValue: baselineEvidence.outreach.outboundMessagesInPeriod,
          baselineSampleSize: 0,
          observationSampleSize: baselineEvidence.outreach.outboundMessagesInPeriod,
        },
      ]
    default:
      return []
  }
}

function resolveDirection(
  metricId: string,
  baseline: number | null,
  observed: number | null,
): GrowthTopicComparisonDirection {
  if (baseline == null || observed == null) return "unknown"
  if (metricId === "waiting_for_dm" || metricId === "packages_pending") {
    if (observed < baseline) return "improved"
    if (observed > baseline) return "declined"
    return "unchanged"
  }
  if (observed > baseline) return "improved"
  if (observed < baseline) return "declined"
  return "unchanged"
}

function buildPeriodComparisons(input: {
  topic: GrowthRecommendationTopic
  evidence: GrowthOrganizationalEvidenceCompletenessSnapshot
  baselineEvidence: GrowthOrganizationalEffectivenessEvidenceInput
  attributionWindow: GrowthRecommendationAttributionWindow
  outboundDisabled: boolean
}): GrowthTopicPeriodComparison[] {
  const metrics = topicMetricValues(input.topic, input.evidence, input.baselineEvidence)

  return metrics.map((metric) => {
    const direction = resolveDirection(metric.metricId, metric.baselineValue, metric.observedValue)
    const absoluteDelta =
      metric.baselineValue != null && metric.observedValue != null
        ? Math.round((metric.observedValue - metric.baselineValue) * 1000) / 1000
        : null
    const relativeDeltaPct =
      metric.baselineValue != null && metric.observedValue != null
        ? safeRelativeDeltaPct(metric.baselineValue, metric.observedValue)
        : null

    const competingExplanations = [
      input.evidence.recommendationOutcomes.causationNote,
      input.baselineEvidence.outboundSendExecutionEnabled === false && input.topic === "outreach_readiness"
        ? "Outbound send execution is disabled — outreach readiness comparisons are not penalized for zero sends."
        : null,
      input.attributionWindow.implementationAt
        ? "Policy, discovery volume, or operator pacing may have changed between windows."
        : null,
    ].filter((line): line is string => Boolean(line))

    let confidence: GrowthTopicPeriodComparison["confidence"] = "insufficient_evidence"
    if (input.attributionWindow.maturity === "mature" && metric.observationSampleSize >= topicMinimumSample(input.topic)) {
      confidence = direction === "unknown" ? "low" : "moderate"
    }

    return {
      topic: input.topic,
      metricId: metric.metricId,
      metricLabel: metric.metricLabel,
      baselineValue: metric.baselineValue,
      observedValue: metric.observedValue,
      absoluteDelta,
      relativeDeltaPct,
      baselineSampleSize: metric.baselineSampleSize,
      observationSampleSize: metric.observationSampleSize,
      dataCompleteness:
        input.attributionWindow.maturity === "mature" ? "available" : "partially_available",
      direction,
      confidence,
      competingExplanations,
      causationNote: CAUSATION_BOUNDARY,
      windowMaturity: input.attributionWindow.maturity,
      excludesPreImplementationOutcomes: Boolean(input.attributionWindow.implementationAt),
    }
  })
}

function countWindowDirections(comparisons: GrowthTopicPeriodComparison[]): {
  positive: number
  neutral: number
  negative: number
  mature: number
} {
  const matureComparisons = comparisons.filter((row) => row.windowMaturity === "mature")
  let positive = 0
  let neutral = 0
  let negative = 0
  for (const row of matureComparisons) {
    if (row.direction === "improved") positive += 1
    else if (row.direction === "declined") negative += 1
    else neutral += 1
  }
  return { positive, neutral, negative, mature: matureComparisons.length }
}

function resolveCertifiedConfidenceEvolution(input: {
  accountabilityEvolution: GrowthRecommendationConfidenceEvolution
  acceptedCount: number
  implementedCount: number
  matureWindows: number
  positiveWindows: number
  neutralWindows: number
  negativeWindows: number
}): { evolution: GrowthRecommendationConfidenceEvolution; reason: string } {
  if (input.acceptedCount < GROWTH_LEARNING_MIN_SAMPLE_SIZE) {
    return {
      evolution: "insufficient_evidence",
      reason: `Fewer than ${GROWTH_LEARNING_MIN_SAMPLE_SIZE} accepted recommendations — immature for confidence change.`,
    }
  }

  if (input.matureWindows === 0) {
    return {
      evolution: "insufficient_evidence",
      reason: "No mature post-implementation observation windows — confidence cannot change yet.",
    }
  }

  if (input.matureWindows === 1 && input.positiveWindows >= 1) {
    return {
      evolution: "stable",
      reason: "One mature window with a positive comparison is not enough to increase confidence.",
    }
  }

  if (input.positiveWindows >= 2 && input.implementedCount >= 2 && input.negativeWindows === 0) {
    return {
      evolution: "increasing",
      reason:
        "Multiple mature comparison windows align directionally — confidence is increasing, although causal effect remains unknown.",
    }
  }

  if (input.negativeWindows >= 2 && input.positiveWindows === 0) {
    return {
      evolution: "declining",
      reason: "Repeated mature windows show outcomes that have not supported this recommendation consistently.",
    }
  }

  if (input.positiveWindows >= 1 && input.negativeWindows >= 1) {
    return {
      evolution: "stable",
      reason: "Mixed mature windows — treat this as a working hypothesis rather than an established operating practice.",
    }
  }

  return {
    evolution: input.accountabilityEvolution === "declining" ? "declining" : "unknown",
    reason: "Mature evidence exists but direction is not yet consistent enough for a strong credibility change.",
  }
}

function buildTopicCredibility(input: {
  topic: GrowthRecommendationTopic
  accountability: GrowthHomeAvaRecommendationAccountabilitySnapshot
  comparisons: GrowthTopicPeriodComparison[]
  evidence: GrowthOrganizationalEvidenceCompletenessSnapshot
}): GrowthTopicRecommendationCredibility {
  const acceptedCount =
    input.accountability.history?.stages.find((row) => row.stage === "accepted" && row.status === "recorded")
      ?.count ?? 0
  const implementedCount =
    input.accountability.history?.stages.find((row) => row.stage === "implemented" && row.status === "recorded")
      ?.count ?? 0
  const observedCount =
    input.accountability.history?.stages.find((row) => row.stage === "observed_outcome" && row.status === "recorded")
      ?.count ?? 0

  const { positive, neutral, negative, mature } = countWindowDirections(input.comparisons)
  const { evolution, reason } = resolveCertifiedConfidenceEvolution({
    accountabilityEvolution: input.accountability.confidenceEvolution,
    acceptedCount,
    implementedCount,
    matureWindows: mature,
    positiveWindows: positive,
    neutralWindows: neutral,
    negativeWindows: negative,
  })

  const topicLabel = growthRecommendationTopicLabel(input.topic)
  let learningStatement = `There is not yet enough evidence to know whether recommendations like this consistently improve ${topicLabel}.`
  let uncertaintyStatement = reason

  if (evolution === "increasing") {
    learningStatement = `Across ${positive} mature comparison window${positive === 1 ? "" : "s"}, recommendations like this correlated with improved ${topicLabel}. Confidence is increasing, although policy changes may also have contributed.`
  } else if (evolution === "stable" && positive >= 1 && negative >= 1) {
    learningStatement =
      "Results have been mixed. I recommend treating this as a working hypothesis rather than an established operating practice."
  } else if (evolution === "stable") {
    learningStatement = `There is early outcome evidence for ${topicLabel}, but not yet enough mature windows to increase confidence.`
  } else if (evolution === "declining") {
    learningStatement = `Recent outcomes have not supported ${topicLabel} recommendations consistently. I am lowering confidence and recommend reassessing the underlying assumption.`
  }

  return {
    topic: input.topic,
    confidenceEvolution: evolution,
    acceptedCount,
    implementedCount,
    matureOutcomeCount: mature,
    positiveWindows: positive,
    neutralWindows: neutral,
    negativeWindows: negative,
    latestComparison: input.comparisons[0] ?? null,
    evidenceQuality: input.evidence.recommendationOutcomes.completeness,
    learningStatement,
    uncertaintyStatement,
  }
}

function assessLearningPromotion(input: {
  credibility: GrowthTopicRecommendationCredibility | null
}): GrowthOrganizationalLearningPromotionAssessment {
  if (!input.credibility) {
    return {
      classification: "observation",
      eligibleForKnowledgePromotion: false,
      reason: "No topic credibility projection available.",
      causationBoundary: CAUSATION_BOUNDARY,
    }
  }

  if (input.credibility.confidenceEvolution === "increasing" && input.credibility.matureOutcomeCount >= 2) {
    return {
      classification: "supported_learning",
      eligibleForKnowledgePromotion: true,
      reason:
        "Multiple mature windows support a supported learning classification — promotion still requires existing organizational knowledge policy.",
      causationBoundary: CAUSATION_BOUNDARY,
    }
  }

  if (input.credibility.confidenceEvolution === "declining" && input.credibility.negativeWindows >= 2) {
    return {
      classification: "contradicted_learning",
      eligibleForKnowledgePromotion: false,
      reason: "Repeated negative mature windows contradict the recommendation hypothesis.",
      causationBoundary: CAUSATION_BOUNDARY,
    }
  }

  if (input.credibility.implementedCount > 0 && input.credibility.matureOutcomeCount === 0) {
    return {
      classification: "tested_recommendation",
      eligibleForKnowledgePromotion: false,
      reason: "Recommendations were implemented but observation windows are not yet mature.",
      causationBoundary: CAUSATION_BOUNDARY,
    }
  }

  if (input.credibility.acceptedCount > 0) {
    return {
      classification: "tested_recommendation",
      eligibleForKnowledgePromotion: false,
      reason: "Operator acceptance is recorded; mature outcome comparison is not yet available.",
      causationBoundary: CAUSATION_BOUNDARY,
    }
  }

  return {
    classification: "inconclusive_result",
    eligibleForKnowledgePromotion: false,
    reason: "Insufficient Production history for promoted organizational knowledge.",
    causationBoundary: CAUSATION_BOUNDARY,
  }
}

function fallbackBaselineEvidence(input: {
  organizationId: string
  generatedAt: string
  baselineSnapshot: GrowthOrganizationalEffectivenessSnapshot
  evidence: GrowthOrganizationalEvidenceCompletenessSnapshot
  outboundDisabled: boolean
}): GrowthOrganizationalEffectivenessEvidenceInput {
  return {
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    measurementPeriod: input.baselineSnapshot.measurementPeriod,
    comparisonPeriod: input.baselineSnapshot.comparisonPeriod,
    outboundSendExecutionEnabled: !input.outboundDisabled,
    pipeline: {
      discoveryRuns: input.evidence.admissionEvidence.discoveryIntake.discoveryRunsInWindow,
      providerRecords: input.evidence.admissionEvidence.discoveryIntake.providerRecordsInWindow,
      leadsAdmitted: input.evidence.admissionEvidence.discoveryIntake.leadsAdmittedInWindow,
      leadsRejected: 0,
      duplicatesPrevented: input.evidence.admissionEvidence.discoveryIntake.intakeExistingTotal,
      admissionYield: input.evidence.admissionEvidence.discoveryIntake.providerToLeadYieldPct,
      pipelineCoverage: null,
      comparisonDiscoveryRuns: null,
      comparisonLeadsAdmitted: null,
    },
    research: {
      researchRuns: input.evidence.researchDuration.completedSampleSize,
      researchCompleted: input.evidence.researchDuration.completedSampleSize,
      leadsWithResearch: null,
      stalledResearch: input.evidence.researchDuration.stalledBeyondThreshold,
      medianCompletionHours: input.evidence.researchDuration.medianCompletionHours,
      comparisonResearchRuns: null,
    },
    qualification: {
      qualifiedCount: null,
      rejectedCount: null,
      unresolvedCount: null,
      qualificationYield: null,
      operatorAgreementRate: null,
      comparisonQualificationYield: null,
    },
    decisionMakers: {
      verified: input.evidence.decisionMakerReadiness.verifiedWithDecisionMakerId,
      contactable: null,
      unresolved: input.evidence.decisionMakerReadiness.waitingForDecisionMaker,
      verificationRate: input.evidence.decisionMakerReadiness.verificationRatePct,
      waitingForDecisionMaker: input.evidence.decisionMakerReadiness.waitingForDecisionMaker,
    },
    packages: {
      draftFactoryActive: null,
      draftReady: null,
      waitingForApproval: input.evidence.operatorDecisionHistory.pendingApprovals,
      packagesBlocked: null,
      packagesApproved: input.evidence.operatorDecisionHistory.packageApprovedInPeriod,
      comparisonDraftReady: null,
    },
    operator: {
      pendingApprovals: input.evidence.operatorDecisionHistory.pendingApprovals,
      recommendationsAccepted: input.evidence.recommendationOutcomes.acceptedCount,
      recommendationsSkipped: null,
      strategicOverrideCount: null,
      comparisonPendingApprovals: null,
    },
    outreach: {
      outboundDisabled: input.outboundDisabled,
      approvedPackages: input.evidence.operatorDecisionHistory.packageApprovedInPeriod,
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
      outboundDisabledNote: input.outboundDisabled ? "Outbound disabled" : null,
    },
    runtime: {
      schedulerRuns: 0,
      schedulerSuccessRate: null,
      schedulerFailures: 0,
      draftFactoryUpdates: null,
      queueDepth: null,
      comparisonSchedulerRuns: null,
    },
    strategicLearning: {
      organizationalKnowledgeItems: null,
      validatedFindings: null,
      overridePatterns: null,
      segmentSamples: null,
    },
    admissionAnalysisAvailable: input.evidence.admissionEvidence.completeness !== "unavailable",
    salesOutcomesAvailable: false,
    segmentAnalyticsAvailable: false,
  }
}

function resolveCertificationVerdict(input: {
  accountability: GrowthHomeAvaRecommendationAccountabilitySnapshot | null
  primaryCredibility: GrowthTopicRecommendationCredibility | null
  architectureGaps: string[]
  claimsUnsupportedLearning: boolean
}): { verdict: GrowthOrganizationalLearningCertificationVerdict; detail: string } {
  if (input.claimsUnsupportedLearning) {
    return { verdict: "fail", detail: "Ava would claim learning unsupported by Production evidence." }
  }
  if (input.architectureGaps.some((gap) => gap.startsWith("BLOCKED:"))) {
    return {
      verdict: "blocked",
      detail: input.architectureGaps.find((gap) => gap.startsWith("BLOCKED:")) ?? "Required attribution linkage missing.",
    }
  }
  if (!input.accountability) {
    return { verdict: "blocked", detail: "Accountability snapshot unavailable." }
  }
  if (input.primaryCredibility?.confidenceEvolution === "increasing") {
    return {
      verdict: "certified",
      detail: "Learning loop functions; one or more topic confidence states evolved from mature evidence.",
    }
  }
  return {
    verdict: "certified",
    detail: "Learning loop functions; current topic remains insufficient evidence for strong credibility change.",
  }
}

function resolveArchitectureGaps(input: {
  accountability: GrowthHomeAvaRecommendationAccountabilitySnapshot | null
  hasBaselineComparison: boolean
  hasTopicIdentity: boolean
}): string[] {
  const gaps: string[] = []
  if (!input.hasTopicIdentity) gaps.push("BLOCKED: stable recommendation-topic identity missing for primary reasoning block.")
  if (!input.accountability) gaps.push("BLOCKED: NEXT-3D accountability projection unavailable.")
  if (!input.hasBaselineComparison) gaps.push("Comparison windows exist but prior-period volume may be insufficient.")
  if (input.accountability?.operatorDecisionSummary.browserLocalOnlyNote) {
    gaps.push("Some operator accept/skip signals remain browser-local until mirrored to organizational memory.")
  }
  return gaps
}

export function buildGrowthOrganizationalLearningCertificationNext3e(input: {
  organizationId: string
  generatedAt: string
  accountability: GrowthHomeAvaRecommendationAccountabilitySnapshot | null
  evidenceCompleteness: GrowthOrganizationalEvidenceCompletenessSnapshot | null
  baselineSnapshot: GrowthOrganizationalEffectivenessSnapshot | null
  baselineEvidence: GrowthOrganizationalEffectivenessEvidenceInput | null
  executiveReasoning?: GrowthHomeAvaExecutiveReasoningPayload | null
  memoryEvents?: AvaMemoryEvent[]
  workflowRequests?: GrowthRevenueDirectorWorkflowRequestRecord[]
  outboundDisabled?: boolean
}): GrowthOrganizationalLearningCertificationSnapshot {
  const primaryTopic = normalizeGrowthRecommendationTopic(
    input.executiveReasoning?.primary?.topic ?? input.accountability?.primaryTopic ?? null,
  )
  const memoryEvents = input.memoryEvents ?? []
  const workflowRequests = input.workflowRequests ?? []
  const evidence = input.evidenceCompleteness
  const baselineSnapshot = input.baselineSnapshot
  const baselineEvidence =
    input.baselineEvidence ??
    (evidence && baselineSnapshot
      ? fallbackBaselineEvidence({
          organizationId: input.organizationId,
          generatedAt: input.generatedAt,
          baselineSnapshot,
          evidence,
          outboundDisabled: input.outboundDisabled ?? true,
        })
      : null)

  const architectureGaps = resolveArchitectureGaps({
    accountability: input.accountability,
    hasBaselineComparison: Boolean(baselineSnapshot?.comparisonPeriod),
    hasTopicIdentity: Boolean(primaryTopic),
  })

  if (!primaryTopic || !evidence || !baselineSnapshot || !baselineEvidence || !input.accountability) {
    const verdict = resolveCertificationVerdict({
      accountability: input.accountability,
      primaryCredibility: null,
      architectureGaps,
      claimsUnsupportedLearning: false,
    })
    return {
      qaMarker: GROWTH_AIOS_NEXT_3E_ORGANIZATIONAL_LEARNING_CERTIFICATION_QA_MARKER,
      principle: GROWTH_AIOS_NEXT_3E_CERTIFICATION_PRINCIPLE,
      organizationId: input.organizationId,
      generatedAt: input.generatedAt,
      readOnly: true,
      certificationVerdict: verdict.verdict,
      certificationDetail: verdict.detail,
      architectureVerdict: architectureGaps.some((gap) => gap.startsWith("BLOCKED:"))
        ? "not_complete"
        : "architecturally_complete",
      architectureGaps,
      primaryTopic,
      primaryTopicCredibility: null,
      topicCredibility: [],
      attributionWindows: [],
      periodComparisons: [],
      learningPromotion: assessLearningPromotion({ credibility: null }),
      executiveReasoningLines: [],
      organizationalLearningLine:
        "There is not yet enough evidence to know whether recommendations like this consistently improve outcomes.",
      learningLoop: {
        recommendationCreated: Boolean(input.executiveReasoning?.primary?.recommendation),
        operatorAccepted: null,
        implemented: null,
        outcomeObserved: null,
        outcomeCompared: false,
        correlationEstablished: false,
        causalEffectKnown: false,
        confidenceChanged: false,
        remainsUncertain: true,
      },
    }
  }

  const observationSampleSize = Math.max(
    evidence.recommendationOutcomes.observedOutcomeCount,
    evidence.operatorDecisionHistory.packageApprovedInPeriod,
    evidence.admissionEvidence.discoveryIntake.discoveryRunsInWindow,
    evidence.researchDuration.completedSampleSize,
  )

  const implementationAt = resolveImplementationAt({
    topic: primaryTopic,
    memoryEvents,
    workflowRequests,
  })

  const attributionWindow = buildAttributionWindow({
    topic: primaryTopic,
    baselineSnapshot,
    implementationAt,
    observationSampleSize,
    generatedAt: input.generatedAt,
  })

  const periodComparisons = buildPeriodComparisons({
    topic: primaryTopic,
    evidence,
    baselineEvidence,
    attributionWindow,
    outboundDisabled: input.outboundDisabled ?? true,
  })

  const primaryCredibility = buildTopicCredibility({
    topic: primaryTopic,
    accountability: input.accountability,
    comparisons: periodComparisons,
    evidence,
  })

  const topicCredibility = [primaryCredibility]

  const learningPromotion = assessLearningPromotion({ credibility: primaryCredibility })
  const windowDirections = countWindowDirections(periodComparisons)

  const claimsUnsupportedLearning =
    primaryCredibility.confidenceEvolution === "increasing" &&
    primaryCredibility.matureOutcomeCount < 2

  const { verdict, detail } = resolveCertificationVerdict({
    accountability: input.accountability,
    primaryCredibility,
    architectureGaps,
    claimsUnsupportedLearning,
  })

  const executiveReasoningLines = [
    primaryCredibility.learningStatement,
    primaryCredibility.uncertaintyStatement,
    CAUSATION_BOUNDARY,
  ]

  const learningLoop = {
    recommendationCreated: input.accountability.learningModel.recommendationMade,
    operatorAccepted: input.accountability.learningModel.recommendationAccepted,
    implemented:
      input.accountability.history?.stages.find((row) => row.stage === "implemented")?.status === "recorded"
        ? true
        : input.accountability.history?.stages.find((row) => row.stage === "implemented")?.status === "not_recorded"
          ? false
          : null,
    outcomeObserved: input.accountability.learningModel.outcomeObserved,
    outcomeCompared: windowDirections.mature > 0,
    correlationEstablished: windowDirections.positive + windowDirections.negative > 0,
    causalEffectKnown: false as const,
    confidenceChanged:
      primaryCredibility.confidenceEvolution !== "insufficient_evidence" &&
      primaryCredibility.confidenceEvolution !== "unknown",
    remainsUncertain:
      primaryCredibility.confidenceEvolution === "insufficient_evidence" ||
      primaryCredibility.confidenceEvolution === "unknown" ||
      primaryCredibility.confidenceEvolution === "stable",
  }

  return {
    qaMarker: GROWTH_AIOS_NEXT_3E_ORGANIZATIONAL_LEARNING_CERTIFICATION_QA_MARKER,
    principle: GROWTH_AIOS_NEXT_3E_CERTIFICATION_PRINCIPLE,
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    readOnly: true,
    certificationVerdict: claimsUnsupportedLearning ? "fail" : verdict,
    certificationDetail: claimsUnsupportedLearning
      ? "Confidence increase claimed without two mature comparison windows."
      : detail,
    architectureVerdict: architectureGaps.some((gap) => gap.startsWith("BLOCKED:"))
      ? "not_complete"
      : "architecturally_complete",
    architectureGaps,
    primaryTopic,
    primaryTopicCredibility: primaryCredibility,
    topicCredibility,
    attributionWindows: [attributionWindow],
    periodComparisons,
    learningPromotion,
    executiveReasoningLines,
    organizationalLearningLine: primaryCredibility.learningStatement,
    learningLoop,
  }
}

export function buildGrowthOrganizationalLearningProductionConclusions(
  certification: GrowthOrganizationalLearningCertificationSnapshot,
): import("./growth-organizational-learning-certification-next-3e-types").GrowthOrganizationalLearningProductionConclusion[] {
  return certification.topicCredibility.map((row) => ({
    topic: row.topic,
    confidenceEvolution: row.confidenceEvolution,
    matureWindows: row.matureOutcomeCount,
    summary: row.learningStatement,
  }))
}
