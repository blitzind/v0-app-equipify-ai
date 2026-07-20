/**
 * GE-AIOS-NEXT-3D — Recommendation accountability read model (presentation-only).
 * Closes Recommendation → Operator decision → Outcome → Learning → Future reasoning.
 * Reuses NEXT-3B evidence, organizational memory, revenue director, and draft-factory truth.
 */

import { GROWTH_LEARNING_MIN_SAMPLE_SIZE } from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"
import type { AvaMemoryEvent } from "@/lib/growth/memory/types"
import type { GrowthOrganizationalEvidenceCompletenessSnapshot } from "@/lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b-types"
import type { GrowthHomeAvaRecommendationPreferenceRecord } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-preference-memory-next-1a"
import { parseGrowthHomeAvaOperatorDecisionFromMemoryEvent } from "./growth-home-ava-operator-decision-memory-next-3d"
import type { GrowthHomeAvaExecutiveReasoningPayload } from "./growth-home-ava-executive-reasoning-next-3c-types"
import {
  GROWTH_AIOS_NEXT_3D_ACCOUNTABILITY_PRINCIPLE,
  GROWTH_AIOS_NEXT_3D_RECOMMENDATION_ACCOUNTABILITY_QA_MARKER,
  type GrowthHomeAvaRecommendationAccountabilitySnapshot,
  type GrowthRecommendationAccountabilityStatus,
  type GrowthRecommendationConfidenceEvolution,
  type GrowthRecommendationHistoryStageRecord,
  type GrowthRecommendationOutcomeLinkage,
  type GrowthRecommendationOutcomeSignal,
} from "./growth-home-ava-recommendation-accountability-next-3d-types"

function stageRecorded(
  stage: GrowthRecommendationHistoryStageRecord["stage"],
  count: number,
  source: string,
  recordedAt: string | null = null,
): GrowthRecommendationHistoryStageRecord {
  if (count <= 0) {
    return { stage, status: "not_recorded", source: null }
  }
  return { stage, status: "recorded", recordedAt, count, source }
}

function stageInsufficient(
  stage: GrowthRecommendationHistoryStageRecord["stage"],
  reason: string,
): GrowthRecommendationHistoryStageRecord {
  return { stage, status: "insufficient_evidence", reason }
}

function resolveCurrentStatus(input: {
  recommendedCount: number
  acceptedCount: number
  implementedCount: number
  observedOutcomeCount: number
  dismissedOrDeferredCount: number
  pendingApprovals: number
}): GrowthRecommendationAccountabilityStatus {
  if (input.recommendedCount === 0) return "insufficient_history"
  if (input.dismissedOrDeferredCount > 0 && input.acceptedCount === 0) return "dismissed_or_deferred"
  if (input.acceptedCount === 0) return "awaiting_operator"
  if (input.implementedCount === 0) return "accepted_not_implemented"
  if (input.observedOutcomeCount === 0) return "implemented_awaiting_outcome"
  return "outcome_observed"
}

function resolveConfidenceEvolution(input: {
  acceptedCount: number
  implementedCount: number
  observedOutcomeCount: number
  packageApprovedInPeriod: number
}): { evolution: GrowthRecommendationConfidenceEvolution; reason: string } {
  if (input.acceptedCount < GROWTH_LEARNING_MIN_SAMPLE_SIZE) {
    return {
      evolution: "insufficient_evidence",
      reason: `Fewer than ${GROWTH_LEARNING_MIN_SAMPLE_SIZE} accepted recommendations in the observation window.`,
    }
  }

  if (input.observedOutcomeCount >= 2 && input.implementedCount >= 2 && input.packageApprovedInPeriod >= 1) {
    return {
      evolution: "increasing",
      reason:
        "Multiple accepted recommendations were implemented and correlated with package approvals — not proof of causation, but directionally supportive.",
    }
  }

  if (input.observedOutcomeCount === 1) {
    return {
      evolution: "stable",
      reason:
        "One observed outcome is not enough to increase confidence — a single success does not establish a pattern.",
    }
  }

  if (input.acceptedCount >= GROWTH_LEARNING_MIN_SAMPLE_SIZE && input.observedOutcomeCount === 0) {
    return {
      evolution: "declining",
      reason:
        "Accepted recommendations have not yet produced observable package outcomes in this window.",
    }
  }

  return {
    evolution: "unknown",
    reason: "Outcome linkage exists but the sample does not yet support a directional confidence change.",
  }
}

function topicOutcomeSignals(
  topic: string,
  snapshot: GrowthOrganizationalEvidenceCompletenessSnapshot,
): GrowthRecommendationOutcomeLinkage["signals"] {
  const signals: GrowthRecommendationOutcomeLinkage["signals"] = []
  const outcome = snapshot.recommendationOutcomes
  const operator = snapshot.operatorDecisionHistory
  const admission = snapshot.admissionEvidence
  const dm = snapshot.decisionMakerReadiness
  const research = snapshot.researchDuration

  const pushSignal = (
    signal: GrowthRecommendationOutcomeSignal,
    label: string,
    value: string | number | null,
    evidenceClassification: GrowthRecommendationOutcomeLinkage["signals"][number]["evidenceClassification"],
  ): void => {
    if (evidenceClassification === "unavailable" || evidenceClassification === "insufficient_evidence") return
    signals.push({ signal, label, value, evidenceClassification })
  }

  if (topic === "admission_yield") {
    pushSignal(
      "admission_improvement",
      "Leads admitted in window",
      admission.discoveryIntake.leadsAdmittedInWindow,
      admission.completeness,
    )
    pushSignal(
      "runtime_utilization",
      "Provider-to-lead yield (%)",
      admission.discoveryIntake.providerToLeadYieldPct,
      admission.discoveryIntake.completeness,
    )
  }

  if (topic === "decision_maker_readiness") {
    pushSignal(
      "decision_maker_readiness",
      "Leads waiting for decision-maker research",
      dm.waitingForDecisionMaker,
      dm.completeness,
    )
    pushSignal(
      "package_throughput",
      "Verified decision-maker IDs",
      dm.verifiedWithDecisionMakerId,
      dm.completeness,
    )
  }

  if (topic === "operator_review") {
    pushSignal(
      "approval_throughput",
      "Packages approved in window",
      operator.packageApprovedInPeriod,
      operator.completeness,
    )
    pushSignal(
      "package_throughput",
      "Packages awaiting approval",
      operator.pendingApprovals,
      operator.completeness,
    )
  }

  if (topic === "pipeline_coverage") {
    pushSignal(
      "research_throughput",
      "Completed research runs in window",
      research.completedSampleSize,
      research.completeness,
    )
    pushSignal(
      "admission_improvement",
      "Discovery runs in window",
      admission.discoveryIntake.discoveryRunsInWindow,
      admission.discoveryIntake.completeness,
    )
  }

  if (outcome.observedOutcomeCount > 0) {
    pushSignal(
      "business_outcome",
      "Observed package outcomes in window",
      outcome.observedOutcomeCount,
      outcome.completeness,
    )
  }

  return signals
}

export function buildOrganizationalLearningLine(input: {
  topic: string | null
  evolution: GrowthRecommendationConfidenceEvolution
  outcomeLinkage: GrowthRecommendationOutcomeLinkage | null
}): string | null {
  if (!input.topic) {
    return "There is not yet enough evidence to know whether recommendations like this consistently improve outcomes."
  }

  if (input.evolution === "insufficient_evidence" || input.evolution === "unknown") {
    return "There is not yet enough evidence to know whether this recommendation consistently improves outcomes."
  }

  const primarySignal = input.outcomeLinkage?.signals[0]?.signal ?? null

  if (input.evolution === "increasing") {
    if (primarySignal === "package_throughput" || primarySignal === "approval_throughput") {
      return "Recommendations like this have historically improved package throughput."
    }
    if (primarySignal === "admission_improvement") {
      return "Recommendations like this have historically improved admission yield."
    }
    if (primarySignal === "decision_maker_readiness") {
      return "Recommendations like this have historically improved decision-maker readiness."
    }
    return "Recommendations like this have historically correlated with improved organizational outcomes."
  }

  if (input.evolution === "stable") {
    return "There is early outcome evidence, but not yet enough to know whether this recommendation consistently improves results."
  }

  if (input.evolution === "declining") {
    return "Accepted recommendations in this category have not yet produced consistent observable outcomes — credibility remains unproven."
  }

  return null
}

export function buildGrowthHomeAvaRecommendationAccountabilityNext3d(input: {
  organizationId: string
  generatedAt: string
  evidenceCompleteness?: GrowthOrganizationalEvidenceCompletenessSnapshot | null
  executiveReasoning?: GrowthHomeAvaExecutiveReasoningPayload | null
  memoryEvents?: AvaMemoryEvent[]
  recommendationPreferences?: GrowthHomeAvaRecommendationPreferenceRecord[]
}): GrowthHomeAvaRecommendationAccountabilitySnapshot {
  const snapshot = input.evidenceCompleteness ?? null
  const primaryTopic = input.executiveReasoning?.primary?.topic ?? null
  const primaryRecommendation = input.executiveReasoning?.primary?.recommendation ?? null

  const memoryEvents = input.memoryEvents ?? []
  const parsedDecisions = memoryEvents
    .map((event) => parseGrowthHomeAvaOperatorDecisionFromMemoryEvent(event))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  const topicDecisions = primaryTopic
    ? parsedDecisions.filter(
        (row) => !row.recommendationTopic || row.recommendationTopic === primaryTopic,
      )
    : parsedDecisions

  const acceptedFromMemory = topicDecisions.filter(
    (row) => row.decisionType === "recommendation_accepted",
  ).length
  const skippedFromMemory = topicDecisions.filter(
    (row) => row.decisionType === "recommendation_skipped",
  ).length
  const dismissedFromMemory = topicDecisions.filter(
    (row) =>
      row.decisionType === "recommendation_dismissed" || row.decisionType === "recommendation_deferred",
  ).length

  const preferenceAccepted =
    input.recommendationPreferences?.reduce((sum, row) => sum + row.accepted, 0) ?? 0

  const outcomeFinding = snapshot?.recommendationOutcomes
  const operatorFinding = snapshot?.operatorDecisionHistory

  const recommendedCount = outcomeFinding?.recommendedCount ?? 0
  const acceptedCount = Math.max(outcomeFinding?.acceptedCount ?? 0, acceptedFromMemory, preferenceAccepted)
  const implementedCount = outcomeFinding?.implementedCount ?? 0
  const observedOutcomeCount = outcomeFinding?.observedOutcomeCount ?? 0
  const packageApprovedInPeriod = operatorFinding?.packageApprovedInPeriod ?? 0
  const pendingApprovals = operatorFinding?.pendingApprovals ?? 0

  const stages: GrowthRecommendationHistoryStageRecord[] = snapshot
    ? [
        recommendedCount > 0
          ? stageRecorded("created", recommendedCount, "revenue_director_workflow_requests")
          : primaryRecommendation
            ? stageRecorded("created", 1, "executive_reasoning_projection", input.generatedAt)
            : stageInsufficient(
                "created",
                "No durable recommendation issuance signal in the observation window.",
              ),
        acceptedCount > 0
          ? stageRecorded(
              "accepted",
              acceptedCount,
              acceptedFromMemory > 0
                ? "organization_memory_operator_decisions"
                : outcomeFinding && outcomeFinding.acceptedCount > 0
                  ? "revenue_director_workflow_requests"
                  : "browser_recommendation_preferences",
            )
          : stageInsufficient(
              "accepted",
              "No accepted recommendations recorded in Production evidence for this topic.",
            ),
        implementedCount > 0
          ? stageRecorded("implemented", implementedCount, "revenue_director_workflow_completion")
          : { stage: "implemented", status: "not_recorded", source: null },
        observedOutcomeCount > 0
          ? stageRecorded("observed_outcome", observedOutcomeCount, "draft_factory_package_approvals")
          : packageApprovedInPeriod > 0
            ? stageRecorded("observed_outcome", packageApprovedInPeriod, "draft_factory_package_approvals")
            : { stage: "observed_outcome", status: "not_recorded", source: null },
      ]
    : [
        stageInsufficient("created", "Evidence completeness snapshot unavailable."),
        stageInsufficient("accepted", "Evidence completeness snapshot unavailable."),
        stageInsufficient("implemented", "Evidence completeness snapshot unavailable."),
        stageInsufficient("observed_outcome", "Evidence completeness snapshot unavailable."),
      ]

  const currentStatus = resolveCurrentStatus({
    recommendedCount: recommendedCount || (primaryRecommendation ? 1 : 0),
    acceptedCount,
    implementedCount,
    observedOutcomeCount: Math.max(observedOutcomeCount, packageApprovedInPeriod > 0 ? packageApprovedInPeriod : 0),
    dismissedOrDeferredCount: dismissedFromMemory + skippedFromMemory,
    pendingApprovals,
  })

  const { evolution, reason: confidenceEvolutionReason } = resolveConfidenceEvolution({
    acceptedCount,
    implementedCount,
    observedOutcomeCount,
    packageApprovedInPeriod,
  })

  const outcomeLinkage: GrowthRecommendationOutcomeLinkage | null =
    snapshot && primaryTopic
      ? {
          topic: primaryTopic,
          linked: topicOutcomeSignals(primaryTopic, snapshot).length > 0,
          signals: topicOutcomeSignals(primaryTopic, snapshot),
          causationNote:
            outcomeFinding?.causationNote ??
            "Outcome signals are correlated with operational truth — not proof that a recommendation directly caused an outcome.",
        }
      : null

  const organizationalLearningLine = buildOrganizationalLearningLine({
    topic: primaryTopic,
    evolution,
    outcomeLinkage,
  })

  const durableServerEventsInWindow =
    (operatorFinding?.organizationalMemoryDecisionEvents ?? 0) + acceptedFromMemory + dismissedFromMemory

  return {
    qaMarker: GROWTH_AIOS_NEXT_3D_RECOMMENDATION_ACCOUNTABILITY_QA_MARKER,
    principle: GROWTH_AIOS_NEXT_3D_ACCOUNTABILITY_PRINCIPLE,
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    readOnly: true,
    primaryTopic,
    organizationalLearningLine,
    confidenceEvolution: evolution,
    confidenceEvolutionReason,
    history: primaryTopic
      ? {
          recommendationTopic: primaryTopic,
          recommendationSummary: primaryRecommendation,
          stages,
          confidence: outcomeFinding?.confidence ?? "unknown",
          evidenceQuality: outcomeFinding?.completeness ?? "insufficient_evidence",
          currentStatus,
        }
      : null,
    outcomeLinkage,
    operatorDecisionSummary: {
      durableServerEventsInWindow,
      browserLocalOnlyNote:
        preferenceAccepted > 0 && acceptedFromMemory === 0
          ? "Some operator accept/skip signals remain browser-local until mirrored to organizational memory."
          : null,
    },
    learningModel: {
      recommendationMade: Boolean(primaryRecommendation) || recommendedCount > 0,
      recommendationAccepted: acceptedCount > 0 ? true : recommendedCount > 0 ? false : null,
      outcomeObserved:
        observedOutcomeCount > 0 || packageApprovedInPeriod > 0
          ? true
          : acceptedCount > 0
            ? false
            : null,
      confidenceAdjusted: evolution !== "insufficient_evidence" && evolution !== "unknown",
      futureReasoningReady: Boolean(organizationalLearningLine),
    },
  }
}
