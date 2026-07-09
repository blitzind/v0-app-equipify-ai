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
}
