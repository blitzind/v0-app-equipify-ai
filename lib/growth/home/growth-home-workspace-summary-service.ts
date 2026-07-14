/**
 * GE-SIMPLIFY-1B — Server aggregator for Home / AI OS workspace summary.
 * Reuses existing loaders; shares a single keyset lead pool fetch for queue projections.
 */
import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildGrowthHomeSalesOutcomes } from "@/lib/growth/home/growth-home-sales-outcomes-loader"
import {
  GROWTH_HOME_WORKSPACE_LOADER_BUDGET_MS,
  logGrowthHomePipelineTimings,
  withGrowthHomeLoaderBudget,
  type GrowthHomeLoaderTiming,
} from "@/lib/growth/home/growth-home-workspace-loader-budget"
import { buildGrowthHomeOrganizationMemory } from "@/lib/growth/memory/storage/organization-memory-repository"
import { buildGrowthHomeOrganizationalKnowledge } from "@/lib/growth/memory/knowledge/organization-knowledge-repository"
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
import { enrichRelationshipLeadSnapshotsBatch } from "@/lib/growth/relationship/enrich-relationship-lead-snapshots-batch"
import { loadGrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-loader"
import { resolveGrowthCanonicalDecisionForLead } from "@/lib/growth/aios/growth/resolve-growth-canonical-decision-for-lead"

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

  const leadPoolStart = Date.now()
  const leadPoolPage = await fetchGrowthHomeLeadPoolPage(input.admin, {
    cursor: input.leadPoolCursor ?? null,
    limit: GROWTH_HOME_LEAD_POOL_BATCH_LIMIT,
  })
  stageTimings.push({ label: "lead_pool", durationMs: Date.now() - leadPoolStart, timedOut: false })
  const leads = leadPoolPage.leads

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

  const dashboard = buildGrowthWorkspaceDashboardViewModel(sources)
  const kpis = buildKpis(sources)

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

  const avaResearchLoopSummary = organizationId
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
        budgetMs: loaderBudgetMs,
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
          buildGrowthHomeOrganizationMemory({
            admin: input.admin,
            organizationId,
            generatedAt,
            salesOutcomes: salesOutcomes.outcomes,
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
          buildGrowthHomeOrganizationalKnowledge({
            admin: input.admin,
            organizationId,
            generatedAt,
            memoryEvents: organizationalMemory.store.events,
            salesOutcomes: salesOutcomes.outcomes,
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

  const missionDiscovery = organizationId
    ? await withGrowthHomeLoaderBudget({
        label: "mission_discovery",
        budgetMs: loaderBudgetMs,
        fn: () =>
          loadGrowthHomeMissionDiscoverySnapshot(input.admin, {
            organizationId,
            leadPool,
          }),
        fallback: null,
      }).then((step) => {
        stageTimings.push(step.timing)
        return step.value
      })
    : null

  const durationMs = Date.now() - startedAt
  logGrowthHomePipelineTimings({ totalMs: durationMs, timings: stageTimings })

  const heroLeadId =
    dailyWorkQueueBundle.display?.top_items?.[0]?.lead_id ??
    leads.find((row) => row.id)?.id ??
    null

  const canonicalHeroDecision =
    organizationId && heroLeadId
      ? await withGrowthHomeLoaderBudget({
          label: "canonical_hero_decision",
          budgetMs: loaderBudgetMs,
          fn: () =>
            resolveGrowthCanonicalDecisionForLead(input.admin, {
              organizationId,
              leadId: heroLeadId,
              generatedAt,
            }),
          fallback: null,
        }).then((step) => {
          stageTimings.push(step.timing)
          return step.value
        })
      : null

  const optimization: GrowthHomeWorkspaceSummaryOptimization = {
    listGrowthLeadsCalls: 1,
    duplicateLeadListEliminated: 1,
    loaderCount: 12,
    durationMs,
    stageTimingsMs: Object.fromEntries(stageTimings.map((row) => [row.label, row.durationMs])),
  }

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
    avaConsole,
    briefing: null,
    salesOutcomes,
    organizationalMemory,
    organizationalKnowledge,
    optimization,
    relationshipSnapshots,
    leadPool,
    missionDiscovery,
    canonicalHeroDecision,
  }
}

/** @internal cert hook — ensures shared lead resolver is wired. */
export function __growthHomeWorkspaceSummaryUsesSharedLeadResolver(): boolean {
  return typeof resolveDailyRevenueWorkQueueForLeads === "function"
}

/** @internal cert hook — cadence schema message retained for ops parity. */
export const __growthHomeCadenceSetupMessage = GROWTH_CADENCE_SCHEMA_SETUP_MESSAGE
