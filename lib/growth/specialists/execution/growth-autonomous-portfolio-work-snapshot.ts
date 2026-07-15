/**
 * GE-AIOS-HOME-RUNTIME-OPTIMIZATION-1A — Lightweight portfolio read model for Autonomous Sales Loop.
 * Not a planner — bounded inputs for existing Work Manager / Decision Engine only.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchLatestAvaResearchLoopSummary } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-service"
import { fetchDailyRevenueWorkQueueFromLeads } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-resolver"
import { buildGrowthHomeSalesOutcomes } from "@/lib/growth/home/growth-home-sales-outcomes-loader"
import { fetchGrowthHomeLeadPoolPage } from "@/lib/growth/lead-repository"
import { fetchOrganizationKnowledgeStore } from "@/lib/growth/memory/knowledge/organization-knowledge-repository"
import { fetchOrganizationMemoryStore } from "@/lib/growth/memory/storage/organization-memory-repository"
import { enrichRelationshipLeadSnapshotsBatch } from "@/lib/growth/relationship/enrich-relationship-lead-snapshots-batch"
import { GROWTH_HOME_LEAD_POOL_BATCH_LIMIT } from "@/lib/growth/relationship/relationship-scale-limits"
import { buildRevenueQueueDashboardSectionsFromLeads } from "@/lib/growth/revenue-queue/revenue-queue-section-projection"
import type { RunWorkManagerInput } from "@/lib/growth/work-manager/manager/run-work-manager"
import {
  buildGrowthWorkspaceDashboardViewModel,
  type GrowthWorkspaceDashboardSourcePayload,
} from "@/lib/growth/workspace/growth-workspace-dashboard-mapper"
import {
  buildDailyWorkQueueItems,
  buildWaitingOnYouFromDashboard,
} from "@/lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer"
import type { GrowthHomeSalesOutcomesPayload } from "@/lib/growth/specialists/execution/sales-outcome-types"
import type { GrowthHomeOrganizationMemoryPayload } from "@/lib/growth/memory/storage/organization-memory-types"
import type { GrowthHomeOrganizationalKnowledgePayload } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import type { RelationshipLeadSnapshotBatchResult } from "@/lib/growth/relationship/enrich-relationship-lead-snapshots-batch"

export const GROWTH_AUTONOMOUS_PORTFOLIO_WORK_SNAPSHOT_QA_MARKER =
  "ge-aios-home-runtime-optimization-1a-portfolio-snapshot-v1" as const

export type GrowthAutonomousPortfolioWorkSnapshot = {
  qaMarker: typeof GROWTH_AUTONOMOUS_PORTFOLIO_WORK_SNAPSHOT_QA_MARKER
  generatedAt: string
  organizationId: string
  workManagerInput: RunWorkManagerInput
  salesOutcomes: GrowthHomeSalesOutcomesPayload
  organizationalKnowledge: GrowthHomeOrganizationalKnowledgePayload
  organizationalMemory: GrowthHomeOrganizationMemoryPayload
  relationshipSnapshots: RelationshipLeadSnapshotBatchResult
  leadCount: number
  durationMs: number
}

function buildPortfolioKpis(sources: GrowthWorkspaceDashboardSourcePayload) {
  const queue = sources.dailyRevenueWorkQueueDisplay
  return {
    emailsSentToday: 0,
    repliesToday: queue?.top_items?.filter((row) => /reply/i.test(row.action_label)).length ?? 0,
    callsToday: 0,
    openOpportunities: sources.leadInboxSections.reduce((sum, section) => sum + section.items.length, 0),
    hotCompanies: queue?.top_items?.length ?? 0,
    approvalQueueCount: 0,
  }
}

export async function buildGrowthAutonomousPortfolioWorkSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    generatedAt?: string
  },
): Promise<GrowthAutonomousPortfolioWorkSnapshot | null> {
  const startedAt = Date.now()
  const generatedAt = input.generatedAt ?? new Date().toISOString()

  const leadPoolPage = await fetchGrowthHomeLeadPoolPage(admin, {
    cursor: null,
    limit: GROWTH_HOME_LEAD_POOL_BATCH_LIMIT,
  })
  const leads = leadPoolPage.leads
  const revenueQueueSections = buildRevenueQueueDashboardSectionsFromLeads(leads, "priority")

  const [dailyWorkQueueBundle, relationshipSnapshots, avaResearchLoopSummary, organizationalMemory, organizationalKnowledge] =
    await Promise.all([
      fetchDailyRevenueWorkQueueFromLeads(admin, leads),
      enrichRelationshipLeadSnapshotsBatch(admin, leads),
      fetchLatestAvaResearchLoopSummary(admin, input.organizationId).catch(() => null),
      fetchOrganizationMemoryStore(admin, {
        organizationId: input.organizationId,
        generatedAt,
      }),
      fetchOrganizationKnowledgeStore(admin, {
        organizationId: input.organizationId,
        generatedAt,
      }),
    ])

  const sources: GrowthWorkspaceDashboardSourcePayload = {
    briefing: null,
    leadInboxSections: revenueQueueSections,
    cadenceSummary: null,
    pipelineDashboard: null,
    opportunityReadiness: null,
    sequenceFoundation: null,
    sequenceExecution: null,
    engagementWorkspace: null,
    conversationDashboard: null,
    relationshipDashboard: null,
    callsDashboard: null,
    dailyRevenueWorkQueueEnabled: dailyWorkQueueBundle.enabled,
    dailyRevenueWorkQueue: dailyWorkQueueBundle.queue,
    dailyRevenueWorkQueueDisplay: dailyWorkQueueBundle.display,
  }

  const dashboard = buildGrowthWorkspaceDashboardViewModel(sources)
  const kpis = buildPortfolioKpis(sources)
  const waitingOnYou = buildWaitingOnYouFromDashboard(dashboard, []).items
  const dailyWorkQueue = buildDailyWorkQueueItems(dashboard)

  const salesOutcomes = await buildGrowthHomeSalesOutcomes({
    admin,
    organizationId: input.organizationId,
    generatedAt,
    researchLoopSummary: avaResearchLoopSummary,
    pendingApprovals: 0,
  })

  const workManagerInput: RunWorkManagerInput = {
    workspaceSummary: {
      kpis,
      meetings: { today: 0, thisWeek: 0, scheduled: 0 },
      inbox: { repliesNeedingAttention: kpis.repliesToday, threadsOpen: 0, newReplies: kpis.repliesToday },
      operatorTasks: {
        callTasksDue: 0,
        pendingApprovals: 0,
        leadsNeedingAction: revenueQueueSections.reduce(
          (sum, section) => sum + (section.id === "needs_review" ? section.items.length : 0),
          0,
        ),
      },
      avaConsole: {
        greeting: "",
        overnightSummary: null,
        highPriorityOpportunities: null,
        waitingForApproval: null,
        suggestedNextAction: dailyWorkQueueBundle.display?.top_items?.[0]?.action_label ?? null,
        researchLoopSummary: avaResearchLoopSummary,
      },
      dashboard,
      leadPool: leadPoolPage.leadPool,
      missionDiscovery: null,
    },
    waitingOnYou,
    dailyWorkQueue,
    accomplishments: [],
    timeline: [],
    generatedAt,
    leadSnapshotsById: relationshipSnapshots.byLeadId,
  }

  return {
    qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_WORK_SNAPSHOT_QA_MARKER,
    generatedAt,
    organizationId: input.organizationId,
    workManagerInput,
    salesOutcomes,
    organizationalKnowledge,
    organizationalMemory,
    relationshipSnapshots,
    leadCount: leads.length,
    durationMs: Date.now() - startedAt,
  }
}
