/**
 * AVA-GROWTH-HOTFIX-2B-1C — Home critical executive state contract (client-safe).
 */

import type { GrowthCanonicalOperatorApprovalSnapshot } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import type { GrowthCanonicalOperatorTask } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import type { GrowthCanonicalActiveMissionsProjection } from "@/lib/growth/aios/missions/growth-canonical-mission-1a-types"
import type { GrowthAvaActivationState } from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import type { GrowthCanonicalOrganizationTrainingProjection } from "@/lib/growth/training/growth-canonical-organization-training-projection-types"
import type { GrowthHomeExecutiveLoadMetadata } from "@/lib/growth/home/growth-home-critical-executive-load-2b-1a"
import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"

export const AVA_GROWTH_HOTFIX_2B_1C_QA_MARKER = "ava-growth-hotfix-2b-1c-home-critical-recovery-v1" as const

export const GROWTH_HOME_CRITICAL_EXECUTIVE_STATE_API_PATH =
  "/api/platform/growth/home/critical-executive-state" as const

export const GROWTH_HOME_CRITICAL_EXECUTIVE_CLIENT_TIMEOUT_MS = 10_000 as const

export const GROWTH_HOME_SECONDARY_WORKSPACE_SUMMARY_TIMEOUT_MS = 45_000 as const

export type GrowthHomeCriticalApprovalPackageSummary = {
  packageId: string
  leadId: string
  companyName: string
  reviewHref: string
  statusLabel: string
}

export type GrowthHomeCriticalExecutiveLoadConfirmed = {
  availability: "confirmed"
  pendingApprovalCount: number
  packages: GrowthHomeCriticalApprovalPackageSummary[]
}

export type GrowthHomeCriticalExecutiveLoadConfirmedEmpty = {
  availability: "confirmed_empty"
  pendingApprovalCount: 0
  packages: []
}

export type GrowthHomeCriticalExecutiveLoadPartial = {
  availability: "partial"
  pendingApprovalCount: number | null
  packages: GrowthHomeCriticalApprovalPackageSummary[]
  confirmedFields: string[]
  unavailableFields: string[]
}

export type GrowthHomeCriticalExecutiveLoadUnavailable = {
  availability: "unavailable"
  errorCode: string
  retryable: boolean
}

export type GrowthHomeCriticalExecutiveLoad =
  | GrowthHomeCriticalExecutiveLoadConfirmed
  | GrowthHomeCriticalExecutiveLoadConfirmedEmpty
  | GrowthHomeCriticalExecutiveLoadPartial
  | GrowthHomeCriticalExecutiveLoadUnavailable

export type GrowthHomeCriticalExecutiveStatePayload = {
  ok: true
  qaMarker: typeof AVA_GROWTH_HOTFIX_2B_1C_QA_MARKER
  generatedAt: string
  requestGeneration: number | null
  criticalLoad: GrowthHomeCriticalExecutiveLoad
  canonicalOperatorApproval: GrowthCanonicalOperatorApprovalSnapshot | null
  canonicalOperatorTask: GrowthCanonicalOperatorTask | null
  canonicalActiveMissions: GrowthCanonicalActiveMissionsProjection | null
  canonicalOrganizationTraining: GrowthCanonicalOrganizationTrainingProjection | null
  avaActivation: GrowthAvaActivationState | null
  executiveLoad: GrowthHomeExecutiveLoadMetadata
  stageTimingsMs: Record<string, number>
  retryAttempt: number | null
}

export type GrowthHomeCriticalExecutiveStateErrorPayload = {
  ok: false
  qaMarker: typeof AVA_GROWTH_HOTFIX_2B_1C_QA_MARKER
  errorCode: string
  message: string
  retryable: boolean
  requestGeneration: number | null
}

export function isGrowthHomeCriticalExecutiveLoadUnavailable(
  load: GrowthHomeCriticalExecutiveLoad,
): load is GrowthHomeCriticalExecutiveLoadUnavailable {
  return load.availability === "unavailable"
}

export function isGrowthHomeCriticalExecutiveLoadActionable(
  load: GrowthHomeCriticalExecutiveLoad,
): boolean {
  return (
    load.availability === "confirmed" ||
    load.availability === "confirmed_empty" ||
    load.availability === "partial"
  )
}

export function buildGrowthHomeCriticalApprovalPackageSummaries(
  snapshot: GrowthCanonicalOperatorApprovalSnapshot | null,
): GrowthHomeCriticalApprovalPackageSummary[] {
  if (!snapshot) return []
  return snapshot.packages.map((row) => ({
    packageId: row.packageId,
    leadId: row.leadId,
    companyName: row.companyName,
    reviewHref: row.reviewHref,
    statusLabel: row.statusLabel,
  }))
}

export function mergeGrowthHomeWorkspaceSummaryWithCriticalState(input: {
  existing: GrowthHomeWorkspaceSummaryPayload | null
  critical: GrowthHomeCriticalExecutiveStatePayload
}): GrowthHomeWorkspaceSummaryPayload {
  const base = input.existing
  const pending =
    input.critical.criticalLoad.availability === "unavailable"
      ? null
      : input.critical.criticalLoad.availability === "confirmed_empty"
        ? 0
        : input.critical.criticalLoad.pendingApprovalCount

  const kpis = {
    ...(base?.kpis ?? {
      emailsSentToday: 0,
      repliesToday: 0,
      callsToday: 0,
      openOpportunities: 0,
      hotCompanies: 0,
      approvalQueueCount: 0,
    }),
    approvalQueueCount: pending ?? base?.kpis.approvalQueueCount ?? 0,
  }

  const operatorTasks = {
    ...(base?.operatorTasks ?? {
      callTasksDue: 0,
      pendingApprovals: 0,
      leadsNeedingAction: 0,
    }),
    pendingApprovals: pending ?? base?.operatorTasks.pendingApprovals ?? 0,
  }

  const avaConsole = {
    ...(base?.avaConsole ?? {
      greeting: "Good morning",
      overnightSummary: null,
      highPriorityOpportunities: null,
      waitingForApproval: null,
      suggestedNextAction: null,
      researchLoopSummary: null,
    }),
    waitingForApproval:
      pending != null && pending > 0
        ? `${pending} ${pending === 1 ? "package" : "packages"} ready for review`
        : base?.avaConsole?.waitingForApproval ?? null,
  }

  return {
    ...(base ?? {
      ok: true as const,
      qaMarker: "ge-simplify-1b-home-workspace-summary-v1" as const,
      generatedAt: input.critical.generatedAt,
      sources: {
        briefing: null,
        leadInboxSections: [],
        cadenceSummary: null,
        pipelineDashboard: null,
        opportunityReadiness: null,
        sequenceFoundation: null,
        sequenceExecution: null,
        engagementWorkspace: null,
        conversationDashboard: null,
        relationshipDashboard: null,
        callsDashboard: null,
        dailyRevenueWorkQueueEnabled: false,
        dailyRevenueWorkQueue: null,
        dailyRevenueWorkQueueDisplay: null,
      },
      revenueQueue: { total: 0, queueSource: "canonical" as const, sectionCounts: [] },
      callQueue: { readyCount: 0, nextLabel: null },
      meetings: { today: 0, thisWeek: 0, scheduled: 0 },
      inbox: { repliesNeedingAttention: 0, threadsOpen: 0, newReplies: 0 },
      operatorTasks,
      dailyRevenueWorkQueue: { enabled: false, queue: null, display: null },
      kpis,
      avaConsole,
      briefing: null,
      salesOutcomes: {
        qaMarker: "growth-sales-specialist-execution-bridge-v1" as const,
        outcomes: [],
        dailySummary: {
          qaMarker: "growth-sales-specialist-execution-bridge-v1" as const,
          generatedAt: input.critical.generatedAt,
          researched: 0,
          qualified: 0,
          strong_opportunities: 0,
          outreach_prepared: 0,
          meetings_prepared: 0,
          approvals_pending: pending ?? 0,
        },
      },
      organizationalMemory: null,
      organizationalKnowledge: null,
      optimization: {
        listGrowthLeadsCalls: 0,
        duplicateLeadListEliminated: 0,
        loaderCount: 0,
        durationMs: 0,
        stageTimingsMs: input.critical.stageTimingsMs,
      },
      relationshipSnapshots: null,
      leadPool: null,
      missionDiscovery: null,
      canonicalHeroDecision: null,
      canonicalOperatorFocus: null,
      portfolioLeads: [],
      eligibleLeadCount: 0,
      portfolioManager: null,
      strategicAdvisorContext: null,
      businessObjectiveLeadership: null,
      productionMissionAuthority: null,
      organizationalEvidenceCompleteness: null,
      runtimeTrust: null,
      executiveGrowthIntelligence: null,
      canonicalPortfolioAuthority: null,
    }),
    ok: true,
    generatedAt: input.critical.generatedAt,
    canonicalOperatorApproval: input.critical.canonicalOperatorApproval,
    canonicalOperatorTask: input.critical.canonicalOperatorTask,
    canonicalActiveMissions: input.critical.canonicalActiveMissions,
    canonicalOrganizationTraining:
      input.critical.canonicalOrganizationTraining ?? base?.canonicalOrganizationTraining ?? null,
    avaActivation: input.critical.avaActivation ?? base?.avaActivation ?? null,
    executiveLoad: input.critical.executiveLoad,
    kpis,
    operatorTasks,
    avaConsole,
    optimization: {
      ...(base?.optimization ?? {
        listGrowthLeadsCalls: 0,
        duplicateLeadListEliminated: 0,
        loaderCount: 0,
        durationMs: 0,
      }),
      stageTimingsMs: {
        ...(base?.optimization?.stageTimingsMs ?? {}),
        ...input.critical.stageTimingsMs,
      },
    },
  } as GrowthHomeWorkspaceSummaryPayload
}
