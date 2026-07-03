/** GE-OPPORTUNITY-INTELLIGENCE-1A — Dependency graph for canonical intelligence sources. Client-safe. */

export type OpportunityIntelligenceDependencyNode = {
  id: string
  engine: string
  deterministic: boolean
  requiresLead: boolean
  requiresResearch: boolean
  requiresUnifiedRevenueWorkflow: boolean
  persistence: string
  publicApi: string[]
}

/**
 * Dependency graph — orchestration reads persisted outputs; never recomputes engine logic.
 *
 * ```text
 *                    buildOpportunityIntelligenceViewModel
 *                                    |
 *     +-----------+-----------+-------+--------+-----------+------------+
 *     |           |           |       |        |           |            |
 *  Lead row   metadata   AI OS    opportunity_  opportunity_  (no engine
 *  columns   revenue_   events   signals       recommendations invocation)
 *            workflow_v4         table         table
 *     |           |           |       |        |
 *  Workflow    Revenue     Research  Buying   Opportunity
 *  Signals     Readiness   Assessment Signals Recommendation
 *     |           |           |       |        |
 *  Lead NBA    Unified     Growth    CRM      CRM
 *              Revenue     Lead      intel    intel
 *              Workflow    Research
 *                          (1B)
 * ```
 */
export const OPPORTUNITY_INTELLIGENCE_DEPENDENCY_GRAPH: OpportunityIntelligenceDependencyNode[] = [
  {
    id: "pqe",
    engine: "Prospect Qualification Engine (PQE)",
    deterministic: true,
    requiresLead: true,
    requiresResearch: false,
    requiresUnifiedRevenueWorkflow: false,
    persistence: "lead.metadata.prospect_qualification_v1 (when written by intake)",
    publicApi: ["readProspectQualificationFromLeadMetadata"],
  },
  {
    id: "unified_revenue_workflow",
    engine: "Unified Revenue Workflow",
    deterministic: true,
    requiresLead: true,
    requiresResearch: false,
    requiresUnifiedRevenueWorkflow: true,
    persistence: "lead.metadata.revenue_workflow_v4 via recomputeGrowthLeadRevenueReadiness",
    publicApi: ["readRevenueReadinessSnapshotFromMetadata"],
  },
  {
    id: "revenue_readiness",
    engine: "Revenue Readiness",
    deterministic: true,
    requiresLead: true,
    requiresResearch: false,
    requiresUnifiedRevenueWorkflow: false,
    persistence: "lead.metadata.revenue_workflow_v4",
    publicApi: ["readRevenueReadinessSnapshotFromMetadata", "computeRevenueReadiness (engine — not invoked here)"],
  },
  {
    id: "growth_lead_research_assessment",
    engine: "Growth Lead Research Opportunity Assessment (GE-AIOS-GROWTH-1B)",
    deterministic: true,
    requiresLead: true,
    requiresResearch: true,
    requiresUnifiedRevenueWorkflow: false,
    persistence: "growth.ai_os_events (growth_lead_research workflow status payload)",
    publicApi: [
      "fetchLatestGrowthLeadResearchWorkflowSnapshot",
      "parsePersistedOpportunityAssessment",
      "assessGrowthLeadResearchOpportunity (engine — not invoked here)",
    ],
  },
  {
    id: "lead_nba",
    engine: "Lead Next Best Action",
    deterministic: true,
    requiresLead: true,
    requiresResearch: false,
    requiresUnifiedRevenueWorkflow: false,
    persistence: "growth.leads.next_best_action* columns via recomputeGrowthLeadNextBestAction",
    publicApi: ["readLeadNextBestActionFromLead", "computeGrowthLeadNextBestAction (engine — not invoked here)"],
  },
  {
    id: "research_nba",
    engine: "Growth Lead Research Next Best Action",
    deterministic: true,
    requiresLead: true,
    requiresResearch: true,
    requiresUnifiedRevenueWorkflow: false,
    persistence: "growth.ai_os_events (research workflow payload)",
    publicApi: ["parsePersistedResearchNextBestAction"],
  },
  {
    id: "workflow_signals",
    engine: "Workflow Signals",
    deterministic: true,
    requiresLead: true,
    requiresResearch: false,
    requiresUnifiedRevenueWorkflow: false,
    persistence: "growth.leads workflow / readiness / engagement columns via recomputeGrowthLeadWorkflowSignals",
    publicApi: ["readWorkflowSignalsFromLead"],
  },
  {
    id: "buying_signals",
    engine: "Buying Signals",
    deterministic: true,
    requiresLead: true,
    requiresResearch: false,
    requiresUnifiedRevenueWorkflow: false,
    persistence: "growth.opportunity_signals table",
    publicApi: ["listOpportunitySignals"],
  },
  {
    id: "opportunity_recommendation",
    engine: "Opportunity Recommendation",
    deterministic: true,
    requiresLead: true,
    requiresResearch: false,
    requiresUnifiedRevenueWorkflow: false,
    persistence: "growth.opportunity_recommendations table",
    publicApi: ["listOpportunityRecommendations", "scoreOpportunityRecommendation (engine — not invoked here)"],
  },
  {
    id: "research_evidence",
    engine: "Research Evidence",
    deterministic: true,
    requiresLead: true,
    requiresResearch: true,
    requiresUnifiedRevenueWorkflow: false,
    persistence: "growth.ai_os_events (research workflow evidence_summary payload)",
    publicApi: ["parsePersistedEvidenceSummary"],
  },
  {
    id: "revenue_execution_timeline",
    engine: "Revenue Execution Timeline",
    deterministic: true,
    requiresLead: true,
    requiresResearch: false,
    requiresUnifiedRevenueWorkflow: false,
    persistence: "lead.metadata.revenue_execution_timeline_v5",
    publicApi: ["readRevenueExecutionTimelineFromMetadata", "fetchRevenueExecutionTimeline (read-only aggregate — not invoked here)"],
  },
]
