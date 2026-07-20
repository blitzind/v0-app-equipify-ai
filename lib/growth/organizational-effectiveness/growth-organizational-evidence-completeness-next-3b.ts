/** GE-AIOS-NEXT-3B — Evidence completeness snapshot assembler (client-safe read-model). */

import { buildAdmissionEvidenceFinding } from "./growth-organizational-admission-evidence-next-3b"
import { buildDecisionMakerReadinessFinding } from "./growth-organizational-decision-maker-evidence-next-3b"
import {
  GROWTH_AIOS_NEXT_3B_EVIDENCE_COMPLETENESS_PRINCIPLE,
  GROWTH_AIOS_NEXT_3B_EVIDENCE_COMPLETENESS_QA_MARKER,
  type GrowthEvidenceCompletenessMatrixEntry,
  type GrowthOrganizationalEvidenceCompletenessInput,
  type GrowthOrganizationalEvidenceCompletenessSnapshot,
} from "./growth-organizational-evidence-completeness-next-3b-types"
import { buildOperatorDecisionHistoryFinding } from "./growth-organizational-operator-history-next-3b"
import { buildRecommendationOutcomeFinding } from "./growth-organizational-recommendation-outcome-next-3b"
import { computeResearchDurationStats } from "./growth-organizational-research-duration-next-3b"

function buildCompletenessMatrix(
  input: GrowthOrganizationalEvidenceCompletenessInput,
  findings: {
    admission: ReturnType<typeof buildAdmissionEvidenceFinding>
    decisionMakers: ReturnType<typeof buildDecisionMakerReadinessFinding>
    research: ReturnType<typeof computeResearchDurationStats>
    operator: ReturnType<typeof buildOperatorDecisionHistoryFinding>
    recommendations: ReturnType<typeof buildRecommendationOutcomeFinding>
  },
): GrowthEvidenceCompletenessMatrixEntry[] {
  return [
    {
      measurementId: "admission_rejection_reasons",
      label: "Admission rejection reasons",
      classification: findings.admission.completeness,
      why: findings.admission.qualificationNote ?? "Categorized from 21C evaluator reasons and discovery intake counters.",
      priority: "highest",
    },
    {
      measurementId: "decision_maker_readiness",
      label: "Decision-maker readiness completeness",
      classification: findings.decisionMakers.completeness,
      why: findings.decisionMakers.completenessNote ?? "Draft-factory stage counts and blocking error codes.",
      priority: "highest",
    },
    {
      measurementId: "research_median_duration",
      label: "Median research duration",
      classification: findings.research.completeness,
      why: findings.research.completenessNote ?? "Computed from research_runs created/completed timestamps.",
      priority: "highest",
    },
    {
      measurementId: "operator_decision_history",
      label: "Durable operator decision history",
      classification: findings.operator.completeness,
      why: findings.operator.completenessNote ?? "Organization memory + revenue-director workflow requests + draft-factory approvals.",
      priority: "highest",
    },
    {
      measurementId: "recommendation_outcomes",
      label: "Recommendation outcome history",
      classification: findings.recommendations.completeness,
      why: findings.recommendations.completenessNote ?? findings.recommendations.causationNote,
      priority: "highest",
    },
    {
      measurementId: "duplicate_prevention",
      label: "Duplicate-prevention visibility",
      classification: input.admission.discoveryIntake.intakeExistingTotal > 0 ? "partially_available" : "unknown",
      why: "Discovery intake existing-lead counters from autonomous run metadata.",
      priority: "medium",
    },
    {
      measurementId: "package_progression_timing",
      label: "Package progression timing",
      classification: "unknown",
      why: "Stage latency normalization deferred — not required for current executive decisions.",
      priority: "medium",
    },
    {
      measurementId: "provider_cost",
      label: "Provider cost reporting",
      classification: "unavailable",
      why: "Provider cost telemetry not wired to organizational effectiveness read-model.",
      priority: "lower",
    },
    {
      measurementId: "segment_analytics",
      label: "Segment analytics",
      classification: "insufficient_evidence",
      why: "Segment comparison sample exists but validated segment analytics authority is not connected.",
      priority: "lower",
    },
  ]
}

function deriveGapsClosed(
  matrix: GrowthEvidenceCompletenessMatrixEntry[],
): { closed: string[]; remaining: string[] } {
  const closed: string[] = []
  const remaining: string[] = []

  for (const entry of matrix) {
    if (entry.priority !== "highest") continue
    if (entry.classification === "available" || entry.classification === "partially_available") {
      closed.push(`${entry.label} — ${entry.classification}`)
    } else {
      remaining.push(`${entry.label} — ${entry.classification}: ${entry.why}`)
    }
  }

  return { closed, remaining }
}

export function buildGrowthOrganizationalEvidenceCompletenessSnapshot(
  input: GrowthOrganizationalEvidenceCompletenessInput,
): GrowthOrganizationalEvidenceCompletenessSnapshot {
  const admissionEvidence = buildAdmissionEvidenceFinding({
    driftRows: input.admission.driftRows,
    discoveryIntake: input.admission.discoveryIntake,
  })

  const decisionMakerReadiness = buildDecisionMakerReadinessFinding(input.decisionMakers)

  const researchDuration = computeResearchDurationStats({
    completedRuns: input.research.completedRuns,
    activeRuns: input.research.activeRuns,
    stalledThresholdHours: input.research.stalledThresholdHours,
  })

  const operatorDecisionHistory = buildOperatorDecisionHistoryFinding(input.operator)

  const recommendationOutcomes = buildRecommendationOutcomeFinding({
    workflowRequestsTotal: input.operator.workflowRequestsTotal,
    workflowRequestsAcceptedInPeriod: input.operator.workflowRequestsAcceptedInPeriod,
    workflowRequestsCompletedInPeriod: input.operator.workflowRequestsCompletedInPeriod,
    packageApprovedInPeriod: input.operator.packageApprovedInPeriod,
  })

  const completenessMatrix = buildCompletenessMatrix(input, {
    admission: admissionEvidence,
    decisionMakers: decisionMakerReadiness,
    research: researchDuration,
    operator: operatorDecisionHistory,
    recommendations: recommendationOutcomes,
  })

  const { closed: gapsClosed, remaining: remainingGaps } = deriveGapsClosed(completenessMatrix)

  const explanation = admissionEvidence.evidenceBackedExplanation
  const executiveConfidenceSummary = explanation
    ? `Evidence completeness improved for admission analysis. ${explanation}`
    : gapsClosed.length > 0
      ? `Evidence completeness improved for ${gapsClosed.length} highest-priority measurements; remaining gaps are documented honestly.`
      : "Evidence gaps remain — Ava should not optimize or speculate until completeness improves."

  return {
    qaMarker: GROWTH_AIOS_NEXT_3B_EVIDENCE_COMPLETENESS_QA_MARKER,
    principle: GROWTH_AIOS_NEXT_3B_EVIDENCE_COMPLETENESS_PRINCIPLE,
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    measurementPeriodLabel: input.measurementPeriodLabel,
    baselineSnapshot: input.baselineSnapshot,
    admissionEvidence,
    decisionMakerReadiness,
    researchDuration,
    operatorDecisionHistory,
    recommendationOutcomes,
    completenessMatrix,
    gapsClosed,
    remainingGaps,
    executiveConfidenceSummary,
  }
}

export function assertGrowthOrganizationalEvidenceCompletenessProjectionOnly(
  snapshot: GrowthOrganizationalEvidenceCompletenessSnapshot,
): { ok: true } {
  if (snapshot.qaMarker !== GROWTH_AIOS_NEXT_3B_EVIDENCE_COMPLETENESS_QA_MARKER) {
    throw new Error("Invalid evidence completeness QA marker — not a projection read-model.")
  }
  if (snapshot.baselineSnapshot.qaMarker !== "ge-aios-next-3a-organizational-effectiveness-baseline-v1") {
    throw new Error("Baseline snapshot must remain NEXT-3A projection authority.")
  }
  return { ok: true }
}
