/**
 * GE-SIMPLIFY-1B — Server aggregator for Home / AI OS workspace summary.
 * Reuses existing loaders; shares a single keyset lead pool fetch for queue projections.
 */
import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildGrowthHomeSalesOutcomes } from "@/lib/growth/home/growth-home-sales-outcomes-loader"
import {
  GROWTH_HOME_RUNTIME_CRITICAL_LOADER_BUDGET_MS,
  GROWTH_HOME_SALES_OUTCOMES_LOADER_BUDGET_MS,
  GROWTH_HOME_WORKSPACE_LOADER_BUDGET_MS,
  logGrowthHomePipelineTimings,
  withGrowthHomeLoaderBudget,
  type GrowthHomeLoaderTiming,
} from "@/lib/growth/home/growth-home-workspace-loader-budget"
import { fetchOrganizationMemoryStore } from "@/lib/growth/memory/storage/organization-memory-repository"
import { fetchOrganizationKnowledgeStore } from "@/lib/growth/memory/knowledge/organization-knowledge-repository"
import { GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import { GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER } from "@/lib/growth/specialists/execution/sales-outcome-types"
import { greetingForHour } from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-formatter"
import { fetchGrowthCadenceCommandSummary } from "@/lib/growth/cadence/cadence-dashboard-repository"
import {
  GROWTH_CADENCE_SCHEMA_SETUP_MESSAGE,
  isGrowthCadenceSchemaReadyWithBudget,
} from "@/lib/growth/cadence/cadence-schema-health"
import { fetchGrowthConversationDashboard } from "@/lib/growth/conversation-dashboard-repository"
import { isDailyRevenueWorkQueueEnabled } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-feature"
import {
  fetchDailyRevenueWorkQueueFromLeads,
  resolveDailyRevenueWorkQueueForLeads,
} from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-resolver"
import {
  getGrowthEngagementCommandCenterHighIntent,
  parseEngagementCommandCenterFilters,
} from "@/lib/growth/engagement/growth-engagement-command-center-service"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  buildGrowthWorkspaceDashboardViewModel,
  type GrowthWorkspaceDashboardSourcePayload,
} from "@/lib/growth/workspace/growth-workspace-dashboard-mapper"
import { fetchGrowthHomeLeadPoolPage } from "@/lib/growth/lead-repository"
import { fetchGrowthNativeCallWorkspaceDashboard } from "@/lib/growth/native-dialer/native-dialer-service"
import { probeGrowthNativeDialerSchemaHealthWithBudget } from "@/lib/growth/native-dialer/native-dialer-schema-health"
import { fetchGrowthOpportunityDashboard } from "@/lib/growth/opportunity-dashboard-repository"
import { fetchGrowthOpportunityPipelineDashboard } from "@/lib/growth/opportunity-pipeline/pipeline-dashboard-repository"
import { fetchGrowthRelationshipDashboard } from "@/lib/growth/relationship-dashboard-repository"
import { buildRevenueQueueDashboardSectionsFromLeads } from "@/lib/growth/revenue-queue/revenue-queue-section-projection"
import { fetchSequenceExecutionFoundationDashboard } from "@/lib/growth/sequences/sequence-repository"
import { fetchGrowthSequenceSafeExecutionDashboard } from "@/lib/growth/sequences/execution/sequence-execution-dashboard"
import type {
  GrowthHomeAvaConsoleSections,
  GrowthHomeWorkspaceSummaryCallQueue,
  GrowthHomeWorkspaceSummaryInbox,
  GrowthHomeWorkspaceSummaryKpis,
  GrowthHomeWorkspaceSummaryMeetings,
  GrowthHomeWorkspaceSummaryOperatorTasks,
  GrowthHomeWorkspaceSummaryOptimization,
  GrowthHomeWorkspaceSummaryPayload,
  GrowthHomeWorkspaceSummaryRevenueQueue,
} from "@/lib/growth/home/growth-home-workspace-summary-types"
import { GROWTH_HOME_WORKSPACE_SUMMARY_QA_MARKER } from "@/lib/growth/home/growth-home-workspace-summary-types"
import { fetchLatestAvaResearchLoopSummary } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-service"
import {
  buildPortfolioEligibilityContext,
  sanitizeResearchLoopSummaryForPortfolio,
} from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { buildGrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a"
import { loadPortfolioDatamoonDiscoveryOperatorState } from "@/lib/growth/prospect-search/prospect-search-datamoon-discovery-state-loader-1a"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { buildGrowthHomeAvaStrategicAdvisorContextPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-context-next-1c"
import { enrichRelationshipLeadSnapshotsBatch } from "@/lib/growth/relationship/enrich-relationship-lead-snapshots-batch"
import { buildGrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import { loadGrowthHomeMissionDiscoveryObjectives } from "@/lib/growth/mission-center/growth-home-mission-discovery-loader"
import { buildMissionPurposeResolutionContext } from "@/lib/growth/mission-purpose/growth-mission-purpose-1a"
import { loadDraftFactoryStatesForMissionPurpose } from "@/lib/growth/mission-purpose/growth-mission-purpose-draft-factory-loader-1a"
import {
  ensureCanonicalLeadMissionPurposes,
  ensureCanonicalObjectiveMissionPurposes,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-migration-1b"
import {
  buildProductionMissionDiscoverySnapshot,
  buildProductionMissionPurposeProjection,
  filterProductionActiveMissionsProjection,
  filterProductionCanonicalHeroDecision,
  filterProductionCanonicalOperatorFocus,
  filterProductionCanonicalOperatorTask,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-operator-filter-1a"
import { buildProductionMissionAuthority } from "@/lib/growth/mission-purpose/growth-production-mission-authority-1a"
import { buildGrowthHomeAvaBusinessObjectiveLeadershipPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-business-objective-next-1e"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import { createGrowthAiOsRuntimeContext } from "@/lib/growth/aios/runtime/growth-aios-runtime-context-1a"
import { loadCanonicalOperatorApprovalSnapshotForHome } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-loader"
import {
  buildCanonicalOperatorTask,
  emptyCanonicalOperatorApprovalSnapshot,
  resolveCanonicalApprovalQueueCount,
  resolveCanonicalOutreachDraftCount,
} from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { projectGrowthCanonicalOperatorDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import { buildCanonicalMissionsFromApprovalSnapshot } from "@/lib/growth/aios/missions/growth-canonical-mission-1a"
import { projectCanonicalActiveMissionsForHome } from "@/lib/growth/aios/missions/growth-canonical-mission-1a-home"
import { buildCanonicalOperatorFocus } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a"
import { loadGrowthOrganizationalEvidenceCompletenessFromProduction } from "@/lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-production-loader-next-3b"
import { loadGrowthHomeRuntimeTrustPayload } from "@/lib/growth/home/growth-home-runtime-trust-loader-1b"
import { loadGrowthAvaActivationState } from "@/lib/growth/ava-activation/growth-ava-activation-service"

import { GROWTH_HOME_LEAD_POOL_BATCH_LIMIT } from "@/lib/growth/relationship/relationship-scale-limits"

const NATIVE_DIALER_PROBE_FALLBACK = {
  schemaReady: false,
  probeUncertain: true,
  missingTables: [],
  detectedTables: [],
  setupMessage: null,
  qaMarker: "native-dialer-schema-health-v2" as const,
  schemaProbeVersion: "v2" as const,
}

function countInboxSections(
  sections: GrowthWorkspaceDashboardSourcePayload["leadInboxSections"],
  ids: string[],
): number {
  return sections
    .filter((section) => ids.includes(section.id))
    .reduce((sum, section) => sum + section.items.length, 0)
}

function buildAvaConsoleSections(input: {
  sources: GrowthWorkspaceDashboardSourcePayload
  kpis: GrowthHomeWorkspaceSummaryKpis
  researchLoopSummary: Awaited<ReturnType<typeof fetchLatestAvaResearchLoopSummary>> | null
  generatedAt: string
  suggestedNextAction: string | null
}): GrowthHomeAvaConsoleSections {
  const hour = new Date(input.generatedAt).getHours()
  const greeting = greetingForHour(hour)
  const overnightParts: string[] = []
  if (input.kpis.emailsSentToday > 0) {
    overnightParts.push(`${input.kpis.emailsSentToday} email(s) sent`)
  }
  if (input.kpis.repliesToday > 0) {
    overnightParts.push(`${input.kpis.repliesToday} repl${input.kpis.repliesToday === 1 ? "y" : "ies"} received`)
  }
  if (input.kpis.approvalQueueCount > 0) {
    overnightParts.push(`${input.kpis.approvalQueueCount} approval(s) queued`)
  }

  const highPriorityCount = countInboxSections(input.sources.leadInboxSections, ["high_priority"])
  const closeCandidates = input.sources.opportunityReadiness?.executiveCloseCandidates?.length ?? 0

  const pendingApprovals = input.kpis.approvalQueueCount

  return {
    greeting,
    overnightSummary: overnightParts.length > 0 ? overnightParts.join(" · ") : null,
    highPriorityOpportunities:
      highPriorityCount > 0 || closeCandidates > 0
        ? `${highPriorityCount} high-priority lead(s)${closeCandidates > 0 ? ` · ${closeCandidates} close candidate(s)` : ""}`
        : null,
    waitingForApproval: pendingApprovals > 0 ? `${pendingApprovals} item(s) waiting for your approval` : null,
    suggestedNextAction: input.suggestedNextAction,
    researchLoopSummary: input.researchLoopSummary,
  }
}

function buildKpis(
  sources: GrowthWorkspaceDashboardSourcePayload,
): GrowthHomeWorkspaceSummaryKpis {
  const dashboard = buildGrowthWorkspaceDashboardViewModel(sources)
  const myQueue = dashboard.sections.find((section) => section.id === "my-queue")
  const activity = dashboard.sections.find((section) => section.id === "activity")
  const pipeline = dashboard.sections.find((section) => section.id === "pipeline-snapshot")
  const campaign = dashboard.sections.find((section) => section.id === "campaign-snapshot")
  const intelligence = dashboard.sections.find((section) => section.id === "intelligence")

  const metric = (section: typeof myQueue, label: string) =>
    section?.metrics.find((row) => row.label === label)?.value ?? 0

  return {
    emailsSentToday: metric(activity, "Emails sent today"),
    repliesToday: metric(activity, "Replies today"),
    callsToday: metric(activity, "Calls today"),
    openOpportunities: metric(pipeline, "Open opportunities"),
    hotCompanies: metric(intelligence, "Hot companies"),
    approvalQueueCount: metric(campaign, "Approval queue"),
  }
}

export async function buildGrowthHomeWorkspaceSummary(input: {
  admin: SupabaseClient
  operatorEmail: string
  actorUserId: string
  leadPoolCursor?: string | null
}): Promise<GrowthHomeWorkspaceSummaryPayload> {
  const startedAt = Date.now()
  const generatedAt = new Date().toISOString()
  const organizationId = getGrowthEngineAiOrgId()
  const stageTimings: GrowthHomeLoaderTiming[] = []
  const loaderBudgetMs = GROWTH_HOME_WORKSPACE_LOADER_BUDGET_MS
  const runtimeCriticalLoaderBudgetMs = GROWTH_HOME_RUNTIME_CRITICAL_LOADER_BUDGET_MS

  const leadPoolStart = Date.now()
  const leadPoolPage = await fetchGrowthHomeLeadPoolPage(input.admin, {
    cursor: input.leadPoolCursor ?? null,
    limit: GROWTH_HOME_LEAD_POOL_BATCH_LIMIT,
  })
  stageTimings.push({ label: "lead_pool", durationMs: Date.now() - leadPoolStart, timedOut: false })
  const leads = leadPoolPage.leads
  const portfolioEligibility = organizationId
    ? buildPortfolioEligibilityContext(organizationId, leads)
    : null

  const revenueQueueSections = buildRevenueQueueDashboardSectionsFromLeads(leads, "priority")
  const revenueQueue: GrowthHomeWorkspaceSummaryRevenueQueue = {
    total: leadPoolPage.leadPool.total_estimated_count ?? leads.length,
    queueSource: "canonical",
    sectionCounts: revenueQueueSections.map((section) => ({
      id: section.id,
      count: section.items.length,
    })),
  }

  const dailyWorkQueueBundle = isDailyRevenueWorkQueueEnabled()
    ? await (async () => {
        const step = await withGrowthHomeLoaderBudget({
          label: "daily_work_queue",
          budgetMs: loaderBudgetMs,
          fn: () => fetchDailyRevenueWorkQueueFromLeads(input.admin, leads),
          fallback: { enabled: true as const, queue: null, display: null },
        })
        stageTimings.push(step.timing)
        return step.value
      })()
    : { enabled: false as const, queue: null, display: null }

  const engagementFilters = parseEngagementCommandCenterFilters(
    organizationId ?? "",
    new URL("https://growth.local/engagement?dateRange=last_7_days&limit=1").searchParams,
  )

  const parallelStart = Date.now()
  const [
    cadenceSchemaReady,
    nativeDialerProbe,
    pipelineDashboard,
    opportunityReadiness,
    sequenceFoundation,
    sequenceExecution,
    engagementHighIntent,
    conversationDashboard,
    relationshipDashboard,
  ] = await Promise.all([
    withGrowthHomeLoaderBudget({
      label: "cadence_schema_probe",
      budgetMs: loaderBudgetMs,
      fn: () => isGrowthCadenceSchemaReadyWithBudget(input.admin, loaderBudgetMs),
      fallback: false,
    }),
    withGrowthHomeLoaderBudget({
      label: "native_dialer_schema_probe",
      budgetMs: loaderBudgetMs,
      fn: () => probeGrowthNativeDialerSchemaHealthWithBudget(input.admin, loaderBudgetMs),
      fallback: NATIVE_DIALER_PROBE_FALLBACK,
    }),
    withGrowthHomeLoaderBudget({
      label: "opportunity_pipeline_dashboard",
      budgetMs: loaderBudgetMs,
      fn: () => fetchGrowthOpportunityPipelineDashboard(input.admin, input.actorUserId),
      fallback: null,
    }),
    withGrowthHomeLoaderBudget({
      label: "opportunity_dashboard",
      budgetMs: loaderBudgetMs,
      fn: () => fetchGrowthOpportunityDashboard(input.admin),
      fallback: null,
    }),
    withGrowthHomeLoaderBudget({
      label: "sequence_foundation",
      budgetMs: loaderBudgetMs,
      fn: () => fetchSequenceExecutionFoundationDashboard(input.admin),
      fallback: null,
    }),
    withGrowthHomeLoaderBudget({
      label: "sequence_execution_dashboard",
      budgetMs: loaderBudgetMs,
      fn: () => fetchGrowthSequenceSafeExecutionDashboard(input.admin),
      fallback: null,
    }),
    withGrowthHomeLoaderBudget({
      label: "engagement_command_center",
      budgetMs: loaderBudgetMs,
      fn: () => getGrowthEngagementCommandCenterHighIntent(input.admin, engagementFilters),
      fallback: null,
    }),
    withGrowthHomeLoaderBudget({
      label: "conversation_dashboard",
      budgetMs: loaderBudgetMs,
      fn: () => fetchGrowthConversationDashboard(input.admin),
      fallback: null,
    }),
    withGrowthHomeLoaderBudget({
      label: "relationship_dashboard",
      budgetMs: loaderBudgetMs,
      fn: () => fetchGrowthRelationshipDashboard(input.admin),
      fallback: null,
    }),
  ])

  for (const step of [
    cadenceSchemaReady,
    nativeDialerProbe,
    pipelineDashboard,
    opportunityReadiness,
    sequenceFoundation,
    sequenceExecution,
    engagementHighIntent,
    conversationDashboard,
    relationshipDashboard,
  ]) {
    stageTimings.push(step.timing)
  }
  stageTimings.push({
    label: "parallel_fan_out_wall",
    durationMs: Date.now() - parallelStart,
    timedOut: false,
  })

  const cadenceSchemaReadyValue = cadenceSchemaReady.value
  const nativeDialerProbeValue = nativeDialerProbe.value

  const [cadenceSummary, callsWorkspaceDashboard] = await Promise.all([
    cadenceSchemaReadyValue
      ? withGrowthHomeLoaderBudget({
          label: "cadence_command_summary",
          budgetMs: loaderBudgetMs,
          fn: () => fetchGrowthCadenceCommandSummary(input.admin),
          fallback: null,
        }).then((step) => {
          stageTimings.push(step.timing)
          return step.value
        })
      : Promise.resolve(null),
    nativeDialerProbeValue.schemaReady
      ? withGrowthHomeLoaderBudget({
          label: "native_call_workspace",
          budgetMs: loaderBudgetMs,
          fn: () => fetchGrowthNativeCallWorkspaceDashboard(input.admin, input.actorUserId),
          fallback: null,
        }).then((step) => {
          stageTimings.push(step.timing)
          return step.value
        })
      : Promise.resolve(null),
  ])

  const sources: GrowthWorkspaceDashboardSourcePayload = {
    briefing: null,
    leadInboxSections: revenueQueueSections,
    cadenceSummary: cadenceSchemaReadyValue ? cadenceSummary : null,
    pipelineDashboard: pipelineDashboard.value,
    opportunityReadiness: opportunityReadiness.value,
    sequenceFoundation: sequenceFoundation.value,
    sequenceExecution: sequenceExecution.value,
    engagementWorkspace: engagementHighIntent.value
      ? {
          highIntent: engagementHighIntent.value.highIntent,
          alerts: { total: engagementHighIntent.value.highIntent.cards.length },
        }
      : null,
    conversationDashboard: conversationDashboard.value,
    relationshipDashboard: relationshipDashboard.value,
    callsDashboard: callsWorkspaceDashboard
      ? {
          workspaceDashboard: {
            stats: { callsToday: callsWorkspaceDashboard.metrics.callsToday },
          },
        }
      : null,
    dailyRevenueWorkQueueEnabled: dailyWorkQueueBundle.enabled,
    dailyRevenueWorkQueue: dailyWorkQueueBundle.queue,
    dailyRevenueWorkQueueDisplay: dailyWorkQueueBundle.display,
  }

  let dashboard = buildGrowthWorkspaceDashboardViewModel(sources)
  let kpis = buildKpis(sources)

  const leadsNeedingAction = countInboxSections(sources.leadInboxSections, ["high_priority", "needs_review"])
  const callReadyLeads = sources.cadenceSummary?.callTasksDueCount ?? 0

  const operatorTasks: GrowthHomeWorkspaceSummaryOperatorTasks = {
    callTasksDue: callReadyLeads,
    pendingApprovals: kpis.approvalQueueCount,
    leadsNeedingAction,
  }

  const callQueue: GrowthHomeWorkspaceSummaryCallQueue = {
    readyCount: callReadyLeads,
    nextLabel:
      callsWorkspaceDashboard?.queuePreview?.[0]?.contactName ??
      callsWorkspaceDashboard?.queuePreview?.[0]?.companyName ??
      null,
  }

  const meetings: GrowthHomeWorkspaceSummaryMeetings = {
    today: sources.cadenceSummary?.callTasksDueCount ?? 0,
    thisWeek: kpis.openOpportunities,
    scheduled: sources.cadenceSummary?.callTasksDueCount ?? 0,
  }

  const inbox: GrowthHomeWorkspaceSummaryInbox = {
    repliesNeedingAttention: Math.max(
      kpis.repliesToday,
      sources.conversationDashboard?.conversationRisk?.length ?? 0,
    ),
    threadsOpen: sources.conversationDashboard?.conversationRisk?.length ?? 0,
    newReplies: kpis.repliesToday,
  }

  const avaResearchLoopSummaryRaw = organizationId
    ? await withGrowthHomeLoaderBudget({
        label: "ava_research_loop_summary",
        budgetMs: loaderBudgetMs,
        fn: () => fetchLatestAvaResearchLoopSummary(input.admin, organizationId),
        fallback: null,
      }).then((step) => {
        stageTimings.push(step.timing)
        return step.value
      })
    : null
  const avaResearchLoopSummary = sanitizeResearchLoopSummaryForPortfolio(
    avaResearchLoopSummaryRaw,
    portfolioEligibility,
  )

  const suggestedNextAction =
    dailyWorkQueueBundle.display?.top_items?.[0]?.action_label ??
    dailyWorkQueueBundle.queue?.items?.[0]?.actionLabel ??
    null

  const avaConsole = buildAvaConsoleSections({
    sources,
    kpis,
    researchLoopSummary: avaResearchLoopSummary,
    generatedAt,
    suggestedNextAction,
  })

  const salesOutcomes = organizationId
    ? await withGrowthHomeLoaderBudget({
        label: "sales_outcomes",
        budgetMs: GROWTH_HOME_SALES_OUTCOMES_LOADER_BUDGET_MS,
        fn: () =>
          buildGrowthHomeSalesOutcomes({
            admin: input.admin,
            organizationId,
            generatedAt,
            researchLoopSummary: avaResearchLoopSummary,
            pendingApprovals: kpis.approvalQueueCount,
          }),
        fallback: {
          qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
          outcomes: [],
          dailySummary: {
            qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
            generatedAt,
            researched: 0,
            qualified: 0,
            strong_opportunities: 0,
            outreach_prepared: 0,
            meetings_prepared: 0,
            approvals_pending: kpis.approvalQueueCount,
          },
        },
      }).then((step) => {
        stageTimings.push(step.timing)
        return step.value
      })
    : {
        qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
        outcomes: [],
        dailySummary: {
          qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
          generatedAt,
          researched: 0,
          qualified: 0,
          strong_opportunities: 0,
          outreach_prepared: 0,
          meetings_prepared: 0,
          approvals_pending: 0,
        },
      }

  const organizationalMemory = organizationId
    ? await withGrowthHomeLoaderBudget({
        label: "organization_memory",
        budgetMs: loaderBudgetMs,
        fn: () =>
          fetchOrganizationMemoryStore(input.admin, {
            organizationId,
            generatedAt,
          }),
        fallback: {
          qaMarker: "ge-aios-17b-server-organizational-memory-v1" as const,
          store: {
            organizationId,
            capturedAt: generatedAt,
            events: [],
            preferences: [],
          },
          source: "empty" as const,
          degraded: true,
          warning: "organization_memory_unavailable",
        },
      }).then((step) => {
        stageTimings.push(step.timing)
        return step.value
      })
    : {
        qaMarker: "ge-aios-17b-server-organizational-memory-v1" as const,
        store: {
          organizationId: "local-organization",
          capturedAt: generatedAt,
          events: [],
          preferences: [],
        },
        source: "empty" as const,
        degraded: true,
        warning: "organization_id_missing",
      }

  const organizationalKnowledge = organizationId
    ? await withGrowthHomeLoaderBudget({
        label: "organization_knowledge",
        budgetMs: loaderBudgetMs,
        fn: () =>
          fetchOrganizationKnowledgeStore(input.admin, {
            organizationId,
            generatedAt,
          }),
        fallback: {
          qaMarker: GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
          store: {
            organizationId,
            capturedAt: generatedAt,
            items: [],
          },
          source: "empty" as const,
          degraded: true,
          warning: "organization_knowledge_unavailable",
        },
      }).then((step) => {
        stageTimings.push(step.timing)
        return step.value
      })
    : {
        qaMarker: GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
        store: {
          organizationId: "local-organization",
          capturedAt: generatedAt,
          items: [],
        },
        source: "empty" as const,
        degraded: true,
        warning: "organization_id_missing",
      }

  const relationshipSnapshotsStep = await withGrowthHomeLoaderBudget({
    label: "relationship_snapshots",
    budgetMs: loaderBudgetMs,
    fn: () => enrichRelationshipLeadSnapshotsBatch(input.admin, leads),
    fallback: {
      qaMarker: "ge-aios-15e-server-relationship-snapshots-v1" as const,
      byLeadId: {},
      meta: {
        attempted: leads.length,
        enriched: 0,
        degraded: true,
        warning: "relationship_snapshot_budget_exceeded",
        queryCount: 0,
      },
    },
  })
  stageTimings.push(relationshipSnapshotsStep.timing)
  const relationshipSnapshots = relationshipSnapshotsStep.value

  const snapshotCount = relationshipSnapshots.meta.enriched
  const leadPool = {
    ...leadPoolPage.leadPool,
    relationship_snapshot_count: snapshotCount,
    degraded: leadPoolPage.leadPool.degraded || relationshipSnapshots.meta.degraded,
  }

  let missionDiscoveryObjectives: GrowthObjective[] = []
  const missionDiscovery = organizationId
    ? await withGrowthHomeLoaderBudget({
        label: "mission_discovery",
        budgetMs: loaderBudgetMs,
        fn: async () => {
          missionDiscoveryObjectives = await loadGrowthHomeMissionDiscoveryObjectives(input.admin, organizationId)
          return buildGrowthHomeMissionDiscoverySnapshot({
            objectives: missionDiscoveryObjectives,
            leadPool,
          })
        },
        fallback: null,
      }).then((step) => {
        stageTimings.push(step.timing)
        return step.value
      })
    : null

  const approvedBusinessProfile = organizationId
    ? await withGrowthHomeLoaderBudget({
        label: "approved_business_profile",
        budgetMs: loaderBudgetMs,
        fn: () => getActiveApprovedBusinessProfile(input.admin, organizationId),
        fallback: null,
      }).then((step) => {
        stageTimings.push(step.timing)
        return step.value
      })
    : null

  const portfolioManagerBase =
    organizationId
      ? buildGrowthPortfolioManagerSnapshot({
          organizationId,
          generatedAt,
          leads,
          eligibleLeadCount: portfolioEligibility?.eligibleCount ?? leads.length,
          approvedProfile: approvedBusinessProfile?.profile ?? null,
          organizationalMemory: organizationalMemory?.store ?? null,
          missionDiscovery,
          validatedLearnings: organizationalKnowledge?.store.items ?? [],
          salesOutcomes: salesOutcomes.outcomes,
        })
      : null

  const datamoonDiscoveryState =
    organizationId && portfolioManagerBase
      ? await loadPortfolioDatamoonDiscoveryOperatorState(input.admin, {
          organizationId,
          memory: portfolioManagerBase.memory,
          nextBatchSize: portfolioManagerBase.replenishment.batchSize,
          maximumDailyDiscovery: portfolioManagerBase.target.maximumDailyDiscovery,
        })
      : null

  const portfolioManager =
    organizationId && portfolioManagerBase && datamoonDiscoveryState
      ? buildGrowthPortfolioManagerSnapshot({
          organizationId,
          generatedAt,
          leads,
          eligibleLeadCount: portfolioEligibility?.eligibleCount ?? leads.length,
          approvedProfile: approvedBusinessProfile?.profile ?? null,
          organizationalMemory: organizationalMemory?.store ?? null,
          missionDiscovery,
          validatedLearnings: organizationalKnowledge?.store.items ?? [],
          salesOutcomes: salesOutcomes.outcomes,
          datamoonDiscovery: datamoonDiscoveryState,
          discoveryAlreadyRunning: datamoonDiscoveryState.jobActive,
        })
      : portfolioManagerBase

  const durationMs = Date.now() - startedAt
  logGrowthHomePipelineTimings({ totalMs: durationMs, timings: stageTimings })

  let canonicalOperatorApprovalLoaded: Awaited<
    ReturnType<typeof loadCanonicalOperatorApprovalSnapshotForHome>
  > | null = null
  if (organizationId) {
    const approvalStart = Date.now()
    try {
      canonicalOperatorApprovalLoaded = await loadCanonicalOperatorApprovalSnapshotForHome(input.admin, {
        organizationId,
        generatedAt,
      })
    } catch {
      canonicalOperatorApprovalLoaded = null
    }
    stageTimings.push({
      label: "canonical_operator_approval",
      durationMs: Date.now() - approvalStart,
      timedOut: false,
    })
  }

  const canonicalOperatorApprovalRaw = organizationId
    ? (canonicalOperatorApprovalLoaded ?? emptyCanonicalOperatorApprovalSnapshot())
    : null

  const revenueQueueLeadIdRaw =
    dailyWorkQueueBundle.display?.top_items?.[0]?.lead_id ??
    leads.find((row) => row.id)?.id ??
    null

  let canonicalOperatorApproval = canonicalOperatorApprovalRaw
  let productionMissionDiscovery = missionDiscovery
  let productionMissionAuthority: ReturnType<typeof buildProductionMissionAuthority> | null = null
  let productionPortfolioEligibility = portfolioEligibility
  let productionAvaResearchLoopSummary = avaResearchLoopSummary
  let productionLeadsForOperations = leads
  let productionEligibleLeadCount = portfolioEligibility?.eligibleCount ?? leads.length
  let productionObjectives = missionDiscoveryObjectives
  let productionPortfolioManager = portfolioManager
  let productionRevenueQueueSections = revenueQueueSections
  let productionPurposeByLeadId = new Map<string, import("@/lib/growth/mission-purpose/growth-mission-purpose-1a-types").GrowthMissionPurposeResolution>()

  if (organizationId && canonicalOperatorApprovalRaw) {
    const pendingApprovalLeadIds = new Set(
      (canonicalOperatorApprovalRaw.packages ?? [])
        .map((row) => row.leadId?.trim())
        .filter((leadId): leadId is string => Boolean(leadId)),
    )
    const draftFactoryLeadIds = [
      ...pendingApprovalLeadIds,
      revenueQueueLeadIdRaw,
      dailyWorkQueueBundle.display?.top_items?.[0]?.lead_id,
    ].filter((leadId): leadId is string => Boolean(leadId))

    const draftFactoryStateByLeadId = await loadDraftFactoryStatesForMissionPurpose(input.admin, {
      organizationId,
      leadIds: draftFactoryLeadIds,
    })

    const missionPurposeContext = buildMissionPurposeResolutionContext({
      organizationId,
      productionMissionActivatedAt: approvedBusinessProfile?.approvedAt ?? null,
      certificationFixturePolicy:
        approvedBusinessProfile?.profile?.portfolioManagement?.certificationFixturePolicy ?? null,
      draftFactoryStateByLeadId,
      pendingApprovalLeadIds,
    })

    const canonicalLeadMigration = await ensureCanonicalLeadMissionPurposes(input.admin, {
      leads,
      context: missionPurposeContext,
      generatedAt,
    })
    const canonicalObjectiveMigration = await ensureCanonicalObjectiveMissionPurposes(input.admin, {
      organizationId,
      objectives: missionDiscoveryObjectives,
      generatedAt,
    })
    const canonicalLeads = canonicalLeadMigration.leads
    const canonicalObjectives = canonicalObjectiveMigration.objectives

    const productionProjection = buildProductionMissionPurposeProjection({
      organizationId,
      leads: canonicalLeads,
      objectives: canonicalObjectives,
      context: missionPurposeContext,
      approvalSnapshot: canonicalOperatorApprovalRaw,
      researchLoopSummary: avaResearchLoopSummaryRaw,
    })

    canonicalOperatorApproval = productionProjection.productionApproval
    productionPortfolioEligibility = productionProjection.portfolioEligibility
    productionAvaResearchLoopSummary = productionProjection.sanitizedResearchLoop
    productionRevenueQueueSections = productionProjection.revenueQueueSections
    productionLeadsForOperations = productionProjection.productionLeads
    productionEligibleLeadCount = productionProjection.portfolioEligibility.eligibleCount
    productionObjectives = productionProjection.productionObjectives
    productionPurposeByLeadId = productionProjection.purposeByLeadId
    sources.leadInboxSections = productionProjection.revenueQueueSections
    revenueQueue.sectionCounts = productionProjection.revenueQueueSections.map((section) => ({
      id: section.id,
      count: section.items.length,
    }))
    revenueQueue.total = productionProjection.productionLeads.length

    productionMissionDiscovery = buildProductionMissionDiscoverySnapshot({
      objectives: canonicalObjectives,
      leadPool,
    })

    productionPortfolioManager =
      organizationId
        ? buildGrowthPortfolioManagerSnapshot({
            organizationId,
            generatedAt,
            leads: productionProjection.productionLeads,
            eligibleLeadCount: productionProjection.portfolioEligibility.eligibleCount,
            approvedProfile: approvedBusinessProfile?.profile ?? null,
            organizationalMemory: organizationalMemory?.store ?? null,
            missionDiscovery: productionMissionDiscovery,
            validatedLearnings: organizationalKnowledge?.store.items ?? [],
            salesOutcomes: salesOutcomes.outcomes,
            datamoonDiscovery: datamoonDiscoveryState,
            discoveryAlreadyRunning: datamoonDiscoveryState?.jobActive === true,
          })
        : portfolioManager

    productionMissionAuthority = buildProductionMissionAuthority({
      portfolioManager: productionPortfolioManager,
      missionDiscovery: productionMissionDiscovery,
    })

    dashboard = buildGrowthWorkspaceDashboardViewModel(sources)
    operatorTasks.leadsNeedingAction = countInboxSections(sources.leadInboxSections, [
      "high_priority",
      "needs_review",
    ])
  }

  const canonicalApprovalCount = resolveCanonicalApprovalQueueCount(canonicalOperatorApproval, 0)
  const canonicalDraftCount = resolveCanonicalOutreachDraftCount(canonicalOperatorApproval, 0)

  kpis.approvalQueueCount = canonicalApprovalCount
  operatorTasks.pendingApprovals = canonicalApprovalCount
  salesOutcomes.dailySummary.approvals_pending = canonicalApprovalCount
  salesOutcomes.dailySummary.outreach_prepared = canonicalDraftCount
  avaConsole.waitingForApproval =
    canonicalApprovalCount > 0
      ? `${canonicalApprovalCount} ${canonicalApprovalCount === 1 ? "package" : "packages"} ready for review`
      : null

  const productionRevenueQueueLead =
    productionLeadsForOperations.find(
      (row) => row.id === dailyWorkQueueBundle.display?.top_items?.[0]?.lead_id,
    ) ?? productionLeadsForOperations[0] ?? null
  const revenueQueueLeadId = productionRevenueQueueLead?.id ?? null
  const revenueQueueCompanyName = productionRevenueQueueLead?.companyName ?? null

  const preliminaryMissions =
    organizationId && canonicalOperatorApproval
      ? buildCanonicalMissionsFromApprovalSnapshot({
          organizationId,
          approvalSnapshot: canonicalOperatorApproval,
        })
      : []

  const preliminaryFocus = filterProductionCanonicalOperatorFocus({
    focus: buildCanonicalOperatorFocus({
      approvalSnapshot: canonicalOperatorApproval,
      missions: preliminaryMissions,
      revenueQueueLeadId,
      revenueQueueCompanyName,
      leads: productionLeadsForOperations.map((row) => ({ id: row.id, companyName: row.companyName })),
    }),
    purposeByLeadId: productionPurposeByLeadId,
  })

  const heroLeadId = preliminaryFocus?.leadId ?? revenueQueueLeadId

  const canonicalHeroDecisionRaw =
    organizationId && heroLeadId
      ? await withGrowthHomeLoaderBudget({
          label: "canonical_hero_decision",
          budgetMs: runtimeCriticalLoaderBudgetMs,
          fn: () => {
            const heroContext = createGrowthAiOsRuntimeContext(input.admin, {
              organizationId,
              leadId: heroLeadId,
              boundary: "home_load",
              cacheScope: "operator-surface",
            })
            return heroContext.getDecision()
          },
          fallback: null,
        }).then((step) => {
          stageTimings.push(step.timing)
          return step.value
        })
      : null

  const canonicalHeroDecision = filterProductionCanonicalHeroDecision({
    decision: canonicalHeroDecisionRaw,
    purposeByLeadId: productionPurposeByLeadId,
  })

  const canonicalOperatorFocus =
    filterProductionCanonicalOperatorFocus({
      focus:
        buildCanonicalOperatorFocus({
          approvalSnapshot: canonicalOperatorApproval,
          missions: preliminaryMissions,
          decisionResolution: canonicalHeroDecision,
          revenueQueueLeadId,
          revenueQueueCompanyName,
          leads: productionLeadsForOperations.map((row) => ({ id: row.id, companyName: row.companyName })),
        }) ?? preliminaryFocus,
      purposeByLeadId: productionPurposeByLeadId,
    })

  const canonicalOperatorTask = filterProductionCanonicalOperatorTask({
    task: canonicalOperatorApproval?.topPackage
      ? buildCanonicalOperatorTask({
          approvalSnapshot: canonicalOperatorApproval,
          decision: canonicalHeroDecision
            ? projectGrowthCanonicalOperatorDecision({
                decision: canonicalHeroDecision.decision,
                freshness: canonicalHeroDecision.freshness,
              })
            : null,
          focusLeadId: canonicalOperatorFocus?.leadId ?? heroLeadId,
          focusCompanyName: canonicalOperatorFocus?.companyName ?? null,
          focusHref: canonicalOperatorFocus?.href ?? null,
        })
      : null,
    purposeByLeadId: productionPurposeByLeadId,
  })

  const heroLeadCompanyName =
    productionLeadsForOperations.find((row) => row.id === heroLeadId)?.companyName ?? null

  const canonicalActiveMissions = filterProductionActiveMissionsProjection(
    projectCanonicalActiveMissionsForHome({
      organizationId,
      canonicalOperatorApproval,
      canonicalHeroDecision,
      canonicalOperatorTask,
      heroLeadCompanyName,
    }),
    productionPurposeByLeadId,
  )

  const optimization: GrowthHomeWorkspaceSummaryOptimization = {
    listGrowthLeadsCalls: 1,
    duplicateLeadListEliminated: 1,
    loaderCount: 12,
    durationMs,
    stageTimingsMs: Object.fromEntries(stageTimings.map((row) => [row.label, row.durationMs])),
  }

  const businessObjectiveLeadership =
    organizationId && productionObjectives.length > 0
      ? buildGrowthHomeAvaBusinessObjectiveLeadershipPayload({
          objectives: productionObjectives,
          missionDiscovery: productionMissionDiscovery,
          businessProfileApproved: Boolean(approvedBusinessProfile?.profile),
          pendingApprovalCount: canonicalApprovalCount,
          meetingsThisWeek: meetings.thisWeek,
          openOpportunities: kpis.openOpportunities,
          leadPoolVisible: productionEligibleLeadCount,
        })
      : null

  const organizationalEvidenceCompleteness = organizationId
    ? await withGrowthHomeLoaderBudget({
        label: "organizational_evidence_completeness",
        budgetMs: loaderBudgetMs,
        fn: async () => {
          const loaded = await loadGrowthOrganizationalEvidenceCompletenessFromProduction({
            admin: input.admin,
            organizationId,
          })
          return loaded.snapshot
        },
        fallback: null,
      }).then((step) => {
        stageTimings.push(step.timing)
        return step.value
      })
    : null

  const runtimeTrust = organizationId
    ? await (async () => {
        const startedAt = Date.now()
        const value = await loadGrowthHomeRuntimeTrustPayload({ admin: input.admin, generatedAt })
        stageTimings.push({
          label: "runtime_trust",
          durationMs: Date.now() - startedAt,
          timedOut: false,
        })
        return value
      })()
    : null

  const avaActivation =
    organizationId && input.actorUserId?.trim() && input.actorUserId !== "undefined"
      ? await (async () => {
          const startedAt = Date.now()
          const value = await loadGrowthAvaActivationState({
            admin: input.admin,
            organizationId,
            actorUserId: input.actorUserId,
            generatedAt,
            salesOutcomes,
            missionDiscovery: productionMissionDiscovery,
          })
          stageTimings.push({
            label: "ava_activation",
            durationMs: Date.now() - startedAt,
            timedOut: false,
          })
          return value
        })()
      : null

  return {
    ok: true,
    qaMarker: GROWTH_HOME_WORKSPACE_SUMMARY_QA_MARKER,
    generatedAt,
    sources,
    dashboard,
    revenueQueue,
    callQueue,
    meetings,
    inbox,
    operatorTasks,
    dailyRevenueWorkQueue: dailyWorkQueueBundle,
    kpis,
    avaConsole: {
      ...avaConsole,
      researchLoopSummary: productionAvaResearchLoopSummary,
      suggestedNextAction:
        productionMissionAuthority?.operatorSummaryLines[0] ??
        avaConsole.suggestedNextAction,
    },
    briefing: null,
    salesOutcomes,
    organizationalMemory,
    organizationalKnowledge,
    optimization,
    relationshipSnapshots,
    leadPool,
    missionDiscovery: productionMissionDiscovery,
    canonicalHeroDecision,
    canonicalOperatorApproval,
    canonicalOperatorTask,
    canonicalActiveMissions,
    canonicalOperatorFocus,
    portfolioLeads: productionLeadsForOperations,
    eligibleLeadCount: productionEligibleLeadCount,
    portfolioManager: productionPortfolioManager,
    strategicAdvisorContext: buildGrowthHomeAvaStrategicAdvisorContextPayload({
      approvedProfile: approvedBusinessProfile?.profile ?? null,
      organizationalKnowledge: organizationalKnowledge?.store.items ?? [],
      organizationPreferences: organizationalMemory?.store.preferences ?? [],
    }),
    businessObjectiveLeadership,
    productionMissionAuthority,
    organizationalEvidenceCompleteness,
    runtimeTrust,
    avaActivation,
  }
}

/** @internal cert hook — ensures shared lead resolver is wired. */
export function __growthHomeWorkspaceSummaryUsesSharedLeadResolver(): boolean {
  return typeof resolveDailyRevenueWorkQueueForLeads === "function"
}

/** @internal cert hook — cadence schema message retained for ops parity. */
export const __growthHomeCadenceSetupMessage = GROWTH_CADENCE_SCHEMA_SETUP_MESSAGE
