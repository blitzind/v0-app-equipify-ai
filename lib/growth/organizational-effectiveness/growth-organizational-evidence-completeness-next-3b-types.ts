/** GE-AIOS-NEXT-3B — Evidence completeness & decision confidence types (client-safe). */

import type { GrowthOrganizationalEffectivenessSnapshot } from "./growth-organizational-effectiveness-baseline-next-3a-types"

export const GROWTH_AIOS_NEXT_3B_EVIDENCE_COMPLETENESS_QA_MARKER =
  "ge-aios-next-3b-evidence-completeness-decision-confidence-v1" as const

export const GROWTH_AIOS_NEXT_3B_EVIDENCE_COMPLETENESS_PRINCIPLE =
  "Close only measurement gaps that materially improve executive judgment — not completeness for its own sake." as const

export type GrowthEvidenceCompletenessClassification =
  | "available"
  | "partially_available"
  | "unavailable"
  | "estimated"
  | "insufficient_evidence"
  | "unknown"

export type GrowthAdmissionEvidenceCategory =
  | "policy"
  | "icp_mismatch"
  | "geography"
  | "industry"
  | "data_quality"
  | "duplicate"
  | "missing_evidence"
  | "unknown"

export type GrowthAdmissionReasonCategoryCount = {
  category: GrowthAdmissionEvidenceCategory
  label: string
  count: number
  exampleReasons: string[]
}

export type GrowthDiscoveryIntakeEvidence = {
  discoveryRunsInWindow: number
  providerRecordsInWindow: number
  intakeSelectedTotal: number
  intakePushedTotal: number
  intakeExistingTotal: number
  intakeRejectedTotal: number
  intakeSkippedInvalidTotal: number
  intakeErrorTotal: number
  leadsAdmittedInWindow: number
  providerToLeadYieldPct: number | null
  completeness: GrowthEvidenceCompletenessClassification
  completenessNote: string | null
}

export type GrowthAdmissionEvidenceFinding = {
  completeness: GrowthEvidenceCompletenessClassification
  leadPoolReasonCategories: GrowthAdmissionReasonCategoryCount[]
  discoveryIntake: GrowthDiscoveryIntakeEvidence
  primaryCategory: GrowthAdmissionEvidenceCategory | null
  primaryCategorySharePct: number | null
  evidenceBackedExplanation: string | null
  qualificationNote: string | null
}

export type GrowthDecisionMakerReadinessFinding = {
  completeness: GrowthEvidenceCompletenessClassification
  waitingForDecisionMaker: number
  waitingForContactVerification: number
  verifiedWithDecisionMakerId: number
  contactVerificationFailed: number
  verificationRatePct: number | null
  averageProgressionHours: number | null
  blockingReasons: Array<{ reason: string; count: number }>
  completenessNote: string | null
}

export type GrowthResearchDurationFinding = {
  completeness: GrowthEvidenceCompletenessClassification
  completedSampleSize: number
  medianCompletionHours: number | null
  averageCompletionHours: number | null
  p90CompletionHours: number | null
  stalledBeyondThreshold: number
  stalledThresholdHours: number
  completenessNote: string | null
}

export type GrowthOperatorDecisionHistoryFinding = {
  completeness: GrowthEvidenceCompletenessClassification
  packageApprovedInPeriod: number
  packageRejectedInPeriod: number
  pendingApprovals: number
  organizationalMemoryDecisionEvents: number
  workflowRequestsAcceptedInPeriod: number
  workflowRequestsCompletedInPeriod: number
  strategicOverrideEvents: number
  completenessNote: string | null
}

export type GrowthRecommendationOutcomeFinding = {
  completeness: GrowthEvidenceCompletenessClassification
  recommendedCount: number
  acceptedCount: number
  implementedCount: number
  observedOutcomeCount: number
  confidence: "high" | "moderate" | "low"
  causationNote: string
  completenessNote: string | null
}

export type GrowthEvidenceCompletenessMatrixEntry = {
  measurementId: string
  label: string
  classification: GrowthEvidenceCompletenessClassification
  why: string
  priority: "highest" | "medium" | "lower"
}

export type GrowthOrganizationalEvidenceCompletenessSnapshot = {
  qaMarker: typeof GROWTH_AIOS_NEXT_3B_EVIDENCE_COMPLETENESS_QA_MARKER
  principle: typeof GROWTH_AIOS_NEXT_3B_EVIDENCE_COMPLETENESS_PRINCIPLE
  organizationId: string
  generatedAt: string
  measurementPeriodLabel: string
  baselineSnapshot: GrowthOrganizationalEffectivenessSnapshot
  admissionEvidence: GrowthAdmissionEvidenceFinding
  decisionMakerReadiness: GrowthDecisionMakerReadinessFinding
  researchDuration: GrowthResearchDurationFinding
  operatorDecisionHistory: GrowthOperatorDecisionHistoryFinding
  recommendationOutcomes: GrowthRecommendationOutcomeFinding
  completenessMatrix: GrowthEvidenceCompletenessMatrixEntry[]
  gapsClosed: string[]
  remainingGaps: string[]
  executiveConfidenceSummary: string
}

export type GrowthOrganizationalEvidenceCompletenessInput = {
  organizationId: string
  generatedAt: string
  measurementPeriodLabel: string
  baselineSnapshot: GrowthOrganizationalEffectivenessSnapshot
  admission: {
    driftRows: Array<{ evaluatedState: string; reasons: string[] }>
    discoveryIntake: GrowthDiscoveryIntakeEvidence
  }
  decisionMakers: {
    waitingForDm: number
    waitingForContactVerification: number
    verifiedWithDecisionMakerId: number
    contactVerificationFailed: number
    draftFactoryActive: number
    progressionHoursSamples: number[]
    blockingReasons: Array<{ reason: string; count: number }>
  }
  research: {
    completedRuns: Array<{ createdAt: string; completedAt: string }>
    activeRuns: number
    stalledThresholdHours: number
  }
  operator: {
    packageApprovedInPeriod: number
    packageRejectedInPeriod: number
    pendingApprovals: number
    memoryDecisionEvents: number
    memoryApprovalEvents: number
    workflowRequestsAcceptedInPeriod: number
    workflowRequestsCompletedInPeriod: number
    workflowRequestsTotal: number
  }
}
