/** GE-AIOS-LIVE-1 — Live production operations types (client-safe). */

export const GE_AIOS_LIVE_1_QA_MARKER = "ge-aios-live-1-autonomous-production-operations-v1" as const

export const GE_AIOS_LIVE_1_PHASE = "GE-AIOS-LIVE-1" as const

export type GeAiosLive1DeploymentGate = {
  id: string
  status: "pass" | "warn" | "fail" | "blocked"
  detail: string
}

export type GeAiosLive1PipelineMetrics = {
  totalActiveLeads: number
  withAdmissionMetadata: number
  researchedLeads: number
  withCompanyEvidence: number
  inReviewAdmission: number
  rejectedOrInvalid: number
  acceptedAdmission: number
  pendingApprovals: number
  duplicateActiveResearchRuns: number
}

export type GeAiosLive1DailyAvaReport = {
  qaMarker: typeof GE_AIOS_LIVE_1_QA_MARKER
  generatedAt: string
  organizationId: string
  greeting: string
  researchCompletedLast24h: number
  newLeadsLast24h: number
  leadsRejectedLast24h: number
  leadsAwaitingReview: number
  highPriorityAccounts: string[]
  followUpsDue: number
  pipelineRisks: string[]
  recommendedActions: string[]
  operatorApprovalsWaiting: number
  metrics: GeAiosLive1PipelineMetrics
  deploymentGates: GeAiosLive1DeploymentGate[]
}

export type GeAiosLive1BugSeverity = "blocker" | "incorrect" | "needs_improvement" | "minor" | "configuration"

export type GeAiosLive1BugEntry = {
  id: string
  severity: GeAiosLive1BugSeverity
  frequency: "once" | "intermittent" | "always"
  businessImpact: string
  suggestedFix: string
  rootCause: "configuration" | "data_quality" | "ux" | "production_bug" | "architectural_gap"
  architectureAffected: string
  status: "open" | "watching" | "resolved"
}
