/** GE-OPPORTUNITY-INTELLIGENCE-1A — Canonical source labels for aggregated read model fields. Client-safe. */

export const OPPORTUNITY_INTELLIGENCE_SOURCES = {
  prospectQualificationEngine: "Prospect Qualification Engine",
  unifiedRevenueWorkflow: "Unified Revenue Workflow",
  revenueReadiness: "Revenue Readiness",
  growthLeadResearchOpportunityAssessment: "Growth Lead Research Opportunity Assessment",
  growthLeadResearchQualification: "Growth Lead Research Qualification",
  leadNextBestAction: "Lead Next Best Action",
  growthLeadResearchNextBestAction: "Growth Lead Research Next Best Action",
  workflowSignals: "Workflow Signals",
  buyingSignals: "Buying Signals",
  opportunityRecommendation: "Opportunity Recommendation",
  researchEvidence: "Research Evidence",
  revenueExecutionTimeline: "Revenue Execution Timeline",
} as const

export type OpportunityIntelligenceSource =
  (typeof OPPORTUNITY_INTELLIGENCE_SOURCES)[keyof typeof OPPORTUNITY_INTELLIGENCE_SOURCES]
