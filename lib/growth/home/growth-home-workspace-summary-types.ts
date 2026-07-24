/**
 * GE-SIMPLIFY-1B — Canonical Home Workspace Summary read model.
 * Client-safe types for Ava operating console sections (future autonomy).
 */

import type { GrowthHomeSalesOutcomesPayload } from "@/lib/growth/specialists/execution/sales-outcome-types"
import type { GrowthHomeOrganizationMemoryPayload } from "@/lib/growth/memory/storage/organization-memory-types"
import type { GrowthHomeOrganizationalKnowledgePayload } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import type { DailyRevenueWorkQueue } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"
import type { DailyRevenueWorkQueueDisplaySummary } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-view"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import type { GrowthWorkspaceDashboardSourcePayload } from "@/lib/growth/workspace/growth-workspace-dashboard-mapper"
import type { GrowthAvaResearchLoopSummary } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"
import type { RelationshipLeadSnapshotMap } from "@/lib/growth/relationship/relationship-lead-snapshot-types"
import type { GrowthHomeLeadPoolSummary } from "@/lib/growth/home/growth-home-lead-pool-pagination"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthCanonicalDecisionResolution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import type {
  GrowthCanonicalOperatorApprovalSnapshot,
  GrowthCanonicalOperatorTask,
} from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import type { GrowthCanonicalActiveMissionsProjection } from "@/lib/growth/aios/missions/growth-canonical-mission-1a-types"
import type { GrowthHomeAvaStrategicAdvisorContextPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-context-next-1c"
import type { GrowthHomeAvaBusinessObjectiveLeadershipPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-business-objective-next-1e-types"
import type { GrowthProductionMissionAuthority } from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import type { GrowthOrganizationalEvidenceCompletenessSnapshot } from "@/lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b-types"
import type { GrowthHomeRuntimeTrustServerPayload } from "@/lib/growth/home/growth-home-runtime-trust-types-1b"
import type { GrowthAvaActivationState } from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import type { GrowthCanonicalOpportunityAuthorityMap } from "@/lib/growth/aios/authority/growth-canonical-opportunity-authority-types-1b"
import type { GrowthExecutiveGrowthIntelligenceReadModel } from "@/lib/growth/aios/growth-intelligence/growth-executive-growth-intelligence-types-1e"
import type { GrowthCanonicalPortfolioAuthoritySnapshot } from "@/lib/growth/aios/authority/growth-canonical-portfolio-authority-snapshot-1f-types"
import { buildGrowthExecutiveGrowthIntelligenceReadModel } from "@/lib/growth/aios/growth-intelligence/growth-executive-growth-intelligence-server-1e"

export const GROWTH_HOME_WORKSPACE_SUMMARY_QA_MARKER = "ge-simplify-1b-home-workspace-summary-v1" as const

export const GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH =
  "/api/platform/growth/home/workspace-summary" as const

export type GrowthHomeWorkspaceSummaryCallQueue = {
  readyCount: number
  nextLabel: string | null
}

export type GrowthHomeWorkspaceSummaryMeetings = {
  today: number
  thisWeek: number
  scheduled: number
}

export type GrowthHomeWorkspaceSummaryInbox = {
  repliesNeedingAttention: number
  threadsOpen: number
  newReplies: number
}

export type GrowthHomeWorkspaceSummaryOperatorTasks = {
  callTasksDue: number
  pendingApprovals: number
  leadsNeedingAction: number
}

export type GrowthHomeWorkspaceSummaryRevenueQueue = {
  total: number
  queueSource: "canonical"
  sectionCounts: Array<{ id: string; count: number }>
}

export type GrowthHomeWorkspaceSummaryKpis = {
  emailsSentToday: number
  repliesToday: number
  callsToday: number
  openOpportunities: number
  hotCompanies: number
  approvalQueueCount: number
}

/** Ava-ready console sections — populated from live data; autonomy wiring deferred. */
export type GrowthHomeAvaConsoleSections = {
  greeting: string
  overnightSummary: string | null
  highPriorityOpportunities: string | null
  waitingForApproval: string | null
  suggestedNextAction: string | null
  /** Latest Ava Research Orchestrator batch summary (GE-AIOS-6B). */
  researchLoopSummary: GrowthAvaResearchLoopSummary | null
}

export type GrowthHomeWorkspaceSummaryOptimization = {
  listGrowthLeadsCalls: number
  duplicateLeadListEliminated: number
  loaderCount: number
  durationMs: number
  /** GE-AIOS-HOTFIX-LIVE-1A — per-stage timings for Home pipeline diagnostics. */
  stageTimingsMs?: Record<string, number>
}

export const GROWTH_HOME_RELATIONSHIP_SNAPSHOT_15E_QA_MARKER =
  "ge-aios-15e-server-relationship-snapshots-v1" as const

export type GrowthHomeRelationshipSnapshotEnrichment = {
  qaMarker: typeof GROWTH_HOME_RELATIONSHIP_SNAPSHOT_15E_QA_MARKER
  byLeadId: RelationshipLeadSnapshotMap
  meta: {
    attempted: number
    enriched: number
    degraded: boolean
    warning: string | null
    queryCount: number
  }
}

export type GrowthHomeWorkspaceSummaryPayload = {
  ok: true
  qaMarker: typeof GROWTH_HOME_WORKSPACE_SUMMARY_QA_MARKER
  generatedAt: string
  sources: GrowthWorkspaceDashboardSourcePayload
  dashboard: GrowthWorkspaceDashboardViewModel
  revenueQueue: GrowthHomeWorkspaceSummaryRevenueQueue
  callQueue: GrowthHomeWorkspaceSummaryCallQueue
  meetings: GrowthHomeWorkspaceSummaryMeetings
  inbox: GrowthHomeWorkspaceSummaryInbox
  operatorTasks: GrowthHomeWorkspaceSummaryOperatorTasks
  dailyRevenueWorkQueue: {
    enabled: boolean
    queue: DailyRevenueWorkQueue | null
    display: DailyRevenueWorkQueueDisplaySummary | null
  }
  kpis: GrowthHomeWorkspaceSummaryKpis
  avaConsole: GrowthHomeAvaConsoleSections
  /** GE-AIOS-17A — Sales Specialist validated workflow outcomes for Memory → Narrative */
  salesOutcomes: GrowthHomeSalesOutcomesPayload
  /** GE-AIOS-17B — Durable server-side organizational memory read model */
  organizationalMemory: GrowthHomeOrganizationMemoryPayload
  /** GE-AIOS-17C — Durable organizational knowledge (Evidence → BI → Memory conclusions) */
  organizationalKnowledge: GrowthHomeOrganizationalKnowledgePayload
  /** @deprecated GE-AIOS-17A — retained for backward compatibility; always null on Home */
  briefing: null
  optimization: GrowthHomeWorkspaceSummaryOptimization
  /** GE-AIOS-15E — bounded relationship snapshots for Home lead pool */
  relationshipSnapshots: GrowthHomeRelationshipSnapshotEnrichment
  /** GE-AIOS-15F — lead pool pagination + scale metadata */
  leadPool: GrowthHomeLeadPoolSummary
  /** GE-AIOS-18G — Active mission discovery runtime for Home narrative + decisions */
  missionDiscovery: GrowthHomeMissionDiscoverySnapshot | null
  /** GE-AIOS-DECISION-ENGINE-1B — canonical hero decision for top-priority lead */
  canonicalHeroDecision: GrowthCanonicalDecisionResolution | null
  /** GE-AIOS-OPERATOR-EXPERIENCE-1A — canonical approval queue snapshot (HAC + Growth 5F) */
  canonicalOperatorApproval: GrowthCanonicalOperatorApprovalSnapshot | null
  /** GE-AIOS-OPERATOR-EXPERIENCE-1A — single prioritized operator task */
  canonicalOperatorTask: GrowthCanonicalOperatorTask | null
  /** GE-AIOS-MISSION-ORCHESTRATION-1A — active account missions (projection only) */
  canonicalActiveMissions: GrowthCanonicalActiveMissionsProjection | null
  /** GE-AIOS-OPERATOR-STORY-IMPLEMENTATION-1A — single prioritized operator focus */
  canonicalOperatorFocus: import("@/lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a-types").GrowthCanonicalOperatorFocus | null
  /** GE-AIOS-PORTFOLIO-ELIGIBILITY-CLOSURE-1A — bounded lead pool for portfolio eligibility */
  portfolioLeads?: import("@/lib/growth/types").GrowthLead[]
  eligibleLeadCount?: number
  /** GE-AIOS-AUTONOMOUS-PORTFOLIO-MANAGER-1A — autonomous portfolio health + replenishment projection */
  portfolioManager?: import("@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types").GrowthPortfolioManagerSnapshot | null
  /** GE-AIOS-NEXT-1C — Approved profile + knowledge slice for Ava strategic evaluation (no duplicate ICP engine) */
  strategicAdvisorContext?: GrowthHomeAvaStrategicAdvisorContextPayload | null
  /** GE-AIOS-NEXT-1E — Primary business objective leadership projection (existing objective authority) */
  businessObjectiveLeadership?: GrowthHomeAvaBusinessObjectiveLeadershipPayload | null
  /** GE-AIOS-LIVE-1A — Production mission authority for Home / Operations */
  productionMissionAuthority?: GrowthProductionMissionAuthority | null
  /** GE-AIOS-LAUNCH-1A — Production evidence completeness for executive reasoning (NEXT-3B) */
  organizationalEvidenceCompleteness?: GrowthOrganizationalEvidenceCompletenessSnapshot | null
  /** GE-AIOS-LAUNCH-1B — Production runtime trust signals (kill switches, scheduler, autonomy tick health) */
  runtimeTrust?: GrowthHomeRuntimeTrustServerPayload | null
  /** GE-AIOS-LAUNCH-1C — Ava one-time activation + employment history */
  avaActivation?: GrowthAvaActivationState | null
  /** AVA-GROWTH-OPERATOR-1E — Executive growth intelligence + strategic recommendations */
  executiveGrowthIntelligence?: GrowthExecutiveGrowthIntelligenceReadModel | null
  /** AVA-GROWTH-OPERATOR-1F — Portfolio-wide canonical authority hydration (shared read model) */
  canonicalPortfolioAuthority?: GrowthCanonicalPortfolioAuthoritySnapshot | null
  /** AVA-GROWTH-HOTFIX-1F-1D — Canonical organization training + activation readiness projection */
  canonicalOrganizationTraining?: import("@/lib/growth/training/growth-canonical-organization-training-projection-types").GrowthCanonicalOrganizationTrainingProjection | null
  /** AVA-GROWTH-HOTFIX-2B-1A — critical vs secondary load availability */
  executiveLoad?: import("@/lib/growth/home/growth-home-critical-executive-load-2b-1a").GrowthHomeExecutiveLoadMetadata
}
