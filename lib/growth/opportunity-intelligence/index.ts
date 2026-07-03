/** GE-OPPORTUNITY-INTELLIGENCE-1A — Client-safe Opportunity Intelligence layer exports. */

export {
  OPPORTUNITY_INTELLIGENCE_SOURCES,
  type OpportunityIntelligenceSource,
} from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-sources"

export {
  availableOpportunityIntelligenceField,
  unavailableOpportunityIntelligenceField,
  type OpportunityIntelligenceField,
} from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-field"

export {
  GROWTH_OPPORTUNITY_INTELLIGENCE_LAYER_QA_MARKER,
  GROWTH_PROSPECT_QUALIFICATION_METADATA_KEY,
  type OpportunityIntelligenceConfidenceValue,
  type OpportunityIntelligenceLabeledItem,
  type OpportunityIntelligenceRecommendationValue,
  type OpportunityIntelligenceViewModel,
  type OpportunityIntelligenceWorkflowSignalsValue,
} from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-view-model-types"

export {
  GROWTH_LEAD_RESEARCH_WORKFLOW_KEY,
  GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
  hasAnyWorkflowSignal,
  parseGrowthLeadResearchWorkflowSnapshotFromEvent,
  parsePersistedEvidenceSummary,
  parsePersistedOpportunityAssessment,
  parsePersistedResearchNextBestAction,
  readLeadNextBestActionFromLead,
  readProspectQualificationFromLeadMetadata,
  readRevenueExecutionTimelineFromMetadata,
  readRevenueReadinessSnapshotFromMetadata,
  readWorkflowSignalsFromLead,
  workflowSignalsComputedAt,
} from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-readers"

export {
  OPPORTUNITY_INTELLIGENCE_DEPENDENCY_GRAPH,
  type OpportunityIntelligenceDependencyNode,
} from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-dependency-graph"

/** Server entry: import `@/lib/growth/opportunity-intelligence/opportunity-intelligence-aggregator`. */
