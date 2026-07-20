/** GE-AIOS-NEXT-3A — Organizational effectiveness baseline types (client-safe read-model). */

export const GROWTH_AIOS_NEXT_3A_ORGANIZATIONAL_EFFECTIVENESS_QA_MARKER =
  "ge-aios-next-3a-organizational-effectiveness-baseline-v1" as const

export const GROWTH_AIOS_NEXT_3A_ORGANIZATIONAL_EFFECTIVENESS_PRINCIPLE =
  "Measure selling results and organizational improvement from existing operational truth — never duplicate analytics authority." as const

export const GROWTH_AIOS_NEXT_3A_ARCHITECTURAL_RULE =
  "Every capability should help Ava sell more or become better at selling." as const

export type GrowthOrganizationalEffectivenessDimensionId =
  | "pipeline_creation"
  | "research_effectiveness"
  | "qualification_effectiveness"
  | "decision_maker_readiness"
  | "opportunity_package_throughput"
  | "operator_decision_throughput"
  | "outreach_readiness"
  | "meeting_opportunity_progression"
  | "runtime_efficiency"
  | "strategic_learning"

export type GrowthOrganizationalEffectivenessDataAvailability =
  | "available"
  | "partially_available"
  | "unavailable"
  | "unreliable"

export type GrowthOrganizationalEffectivenessConfidence = "high" | "moderate" | "low"

export type GrowthOrganizationalEffectivenessTrend =
  | "improving"
  | "declining"
  | "stable"
  | "unknown"
  | "establishing_baseline"

export type GrowthOrganizationalEffectivenessTimeWindow = {
  id: string
  label: string
  start: string
  end: string
  sampleSizeNote: string | null
  sufficientForComparison: boolean
}

export type GrowthOrganizationalEffectivenessMetric = {
  id: string
  label: string
  value: number | string | null
  unit: string | null
  delta: number | null
  deltaLabel: string | null
  availability: GrowthOrganizationalEffectivenessDataAvailability
  qualificationNote: string | null
  evidenceRef: string | null
}

export type GrowthOrganizationalEffectivenessDimension = {
  id: GrowthOrganizationalEffectivenessDimensionId
  label: string
  availability: GrowthOrganizationalEffectivenessDataAvailability
  metrics: GrowthOrganizationalEffectivenessMetric[]
  summaryLine: string | null
  confidence: GrowthOrganizationalEffectivenessConfidence
}

export type GrowthOrganizationalEffectivenessBottleneckClassification =
  | "expected"
  | "policy_based"
  | "configuration"
  | "possible_engineering_defect"
  | "unknown"

export type GrowthOrganizationalEffectivenessBottleneckCandidate = {
  stage: string
  evidence: string[]
  affectedVolume: number | null
  durationNote: string | null
  downstreamImpact: string | null
  classification: GrowthOrganizationalEffectivenessBottleneckClassification
  confidence: GrowthOrganizationalEffectivenessConfidence
}

export type GrowthOrganizationalEffectivenessSnapshot = {
  qaMarker: typeof GROWTH_AIOS_NEXT_3A_ORGANIZATIONAL_EFFECTIVENESS_QA_MARKER
  principle: typeof GROWTH_AIOS_NEXT_3A_ORGANIZATIONAL_EFFECTIVENESS_PRINCIPLE
  architecturalRule: typeof GROWTH_AIOS_NEXT_3A_ARCHITECTURAL_RULE
  organizationId: string
  generatedAt: string
  measurementPeriod: GrowthOrganizationalEffectivenessTimeWindow
  comparisonPeriod: GrowthOrganizationalEffectivenessTimeWindow | null
  baselineStatus: "establishing" | "comparable" | "insufficient_data"
  improvementTrend: GrowthOrganizationalEffectivenessTrend
  dimensions: GrowthOrganizationalEffectivenessDimension[]
  bottleneckCandidates: GrowthOrganizationalEffectivenessBottleneckCandidate[]
  highestConfidenceBottleneck: GrowthOrganizationalEffectivenessBottleneckCandidate | null
  unavailableMeasurements: string[]
  dataCompletenessSummary: string
  canonicalDefinitions: Record<string, string>
}

export type GrowthOrganizationalEffectivenessEvidenceInput = {
  organizationId: string
  generatedAt: string
  measurementPeriod: GrowthOrganizationalEffectivenessTimeWindow
  comparisonPeriod: GrowthOrganizationalEffectivenessTimeWindow | null
  outboundSendExecutionEnabled: boolean
  pipeline: {
    discoveryRuns: number
    providerRecords: number | null
    leadsAdmitted: number
    leadsRejected: number
    duplicatesPrevented: number | null
    admissionYield: number | null
    pipelineCoverage: number | null
    comparisonDiscoveryRuns: number | null
    comparisonLeadsAdmitted: number | null
  }
  research: {
    researchRuns: number
    researchCompleted: number | null
    leadsWithResearch: number | null
    stalledResearch: number | null
    medianCompletionHours: number | null
    comparisonResearchRuns: number | null
  }
  qualification: {
    qualifiedCount: number | null
    rejectedCount: number | null
    unresolvedCount: number | null
    qualificationYield: number | null
    operatorAgreementRate: number | null
    comparisonQualificationYield: number | null
  }
  decisionMakers: {
    verified: number | null
    contactable: number | null
    unresolved: number | null
    verificationRate: number | null
    waitingForDecisionMaker: number | null
  }
  packages: {
    draftFactoryActive: number | null
    draftReady: number | null
    waitingForApproval: number | null
    packagesBlocked: number | null
    packagesApproved: number | null
    comparisonDraftReady: number | null
  }
  operator: {
    pendingApprovals: number | null
    recommendationsAccepted: number | null
    recommendationsSkipped: number | null
    strategicOverrideCount: number | null
    comparisonPendingApprovals: number | null
  }
  outreach: {
    outboundDisabled: boolean
    approvedPackages: number | null
    draftsReady: number | null
    sendWindowEligible: number | null
    transportAuthorized: boolean
    outboundMessagesInPeriod: number
  }
  meetings: {
    replies: number | null
    meetingsBooked: number | null
    opportunitiesOpened: number | null
    packageToMeetingRate: number | null
    outboundDisabledNote: string | null
  }
  runtime: {
    schedulerRuns: number
    schedulerSuccessRate: number | null
    schedulerFailures: number
    draftFactoryUpdates: number | null
    queueDepth: number | null
    comparisonSchedulerRuns: number | null
  }
  strategicLearning: {
    organizationalKnowledgeItems: number | null
    validatedFindings: number | null
    overridePatterns: number | null
    segmentSamples: number | null
  }
  admissionAnalysisAvailable: boolean
  salesOutcomesAvailable: boolean
  segmentAnalyticsAvailable: boolean
}
