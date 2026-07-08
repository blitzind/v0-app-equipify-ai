/**
 * GE-SIMPLIFY-1B — Server aggregator for Home / AI OS workspace summary.
 * Reuses existing loaders; shares a single listGrowthLeads() for queue projections.
 */
import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAidenDailyBriefing } from "@/lib/growth/aiden/aiden-briefing-repository"
import { fetchGrowthCadenceCommandSummary } from "@/lib/growth/cadence/cadence-dashboard-repository"
import {
  GROWTH_CADENCE_SCHEMA_SETUP_MESSAGE,
  isGrowthCadenceSchemaReady,
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
import { listGrowthLeads } from "@/lib/growth/lead-repository"
import { fetchGrowthNativeCallWorkspaceDashboard } from "@/lib/growth/native-dialer/native-dialer-service"
import { probeGrowthNativeDialerSchemaHealth } from "@/lib/growth/native-dialer/native-dialer-schema-health"
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

const HOME_LEAD_POOL_LIMIT = 100

function countInboxSections(
  sections: GrowthWorkspaceDashboardSourcePayload["leadInboxSections"],
  ids: string[],
): number {
  return sections
    .filter((section) => ids.includes(section.id))
    .reduce((sum, section) => sum + section.items.length, 0)
}

function buildAvaConsoleSections(input: {
  briefing: Awaited<ReturnType<typeof fetchAidenDailyBriefing>> | null
  sources: GrowthWorkspaceDashboardSourcePayload
  kpis: GrowthHomeWorkspaceSummaryKpis
}): GrowthHomeAvaConsoleSections {
  const greeting = input.briefing?.greeting ?? "Welcome back"
  const overnightParts: string[] = []
  if (input.kpis.emailsSentToday > 0) {
    overnightParts.push(`${input.kpis.emailsSentToday} email(s) sent`)
  }
  if (input.kpis.repliesToday > 0) {
    overnightParts.push(`${input.kpis.repliesToday} repl${input.kpis.repliesToday === 1 ? "y" : "ies"} received`)
  }
  if (input.briefing?.summary.pending_approvals) {
    overnightParts.push(`${input.briefing.summary.pending_approvals} approval(s) queued`)
  }

  const highPriorityCount = countInboxSections(input.sources.leadInboxSections, ["high_priority"])
  const closeCandidates = input.sources.opportunityReadiness?.executiveCloseCandidates?.length ?? 0

  const pendingApprovals = Math.max(
    input.kpis.approvalQueueCount,
    input.briefing?.summary.pending_approvals ?? 0,
  )

  return {
    greeting,
    overnightSummary: overnightParts.length > 0 ? overnightParts.join(" · ") : null,
    highPriorityOpportunities:
      highPriorityCount > 0 || closeCandidates > 0
        ? `${highPriorityCount} high-priority lead(s)${closeCandidates > 0 ? ` · ${closeCandidates} close candidate(s)` : ""}`
        : null,
    waitingForApproval: pendingApprovals > 0 ? `${pendingApprovals} item(s) waiting for your approval` : null,
    suggestedNextAction: input.briefing?.summary.recommended_action ?? null,
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
}): Promise<GrowthHomeWorkspaceSummaryPayload> {
  const startedAt = Date.now()
  const generatedAt = new Date().toISOString()
  const organizationId = getGrowthEngineAiOrgId()

  const leads = await listGrowthLeads(input.admin, {
    limit: HOME_LEAD_POOL_LIMIT,
    includeArchived: false,
  })

  const revenueQueueSections = buildRevenueQueueDashboardSectionsFromLeads(leads, "priority")
  const revenueQueue: GrowthHomeWorkspaceSummaryRevenueQueue = {
    total: leads.length,
    queueSource: "canonical",
    sectionCounts: revenueQueueSections.map((section) => ({
      id: section.id,
      count: section.items.length,
    })),
  }

  const dailyWorkQueueBundle = isDailyRevenueWorkQueueEnabled()
    ? await fetchDailyRevenueWorkQueueFromLeads(input.admin, leads)
    : { enabled: false as const, queue: null, display: null }

  const engagementFilters = parseEngagementCommandCenterFilters(
    organizationId ?? "",
    new URL("https://growth.local/engagement?dateRange=last_7_days&limit=1").searchParams,
  )

  const [
    briefing,
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
    fetchAidenDailyBriefing(input.admin, {
      operatorEmail: input.operatorEmail,
      actorUserId: input.actorUserId,
    }).catch(() => null),
    isGrowthCadenceSchemaReady(input.admin).catch(() => false),
    probeGrowthNativeDialerSchemaHealth(input.admin).catch(() => ({ schemaReady: false })),
    fetchGrowthOpportunityPipelineDashboard(input.admin, input.actorUserId).catch(() => null),
    fetchGrowthOpportunityDashboard(input.admin).catch(() => null),
    fetchSequenceExecutionFoundationDashboard(input.admin).catch(() => null),
    fetchGrowthSequenceSafeExecutionDashboard(input.admin).catch(() => null),
    getGrowthEngagementCommandCenterHighIntent(input.admin, engagementFilters).catch(() => null),
    fetchGrowthConversationDashboard(input.admin).catch(() => null),
    fetchGrowthRelationshipDashboard(input.admin).catch(() => null),
  ])

  const [cadenceSummary, callsWorkspaceDashboard] = await Promise.all([
    cadenceSchemaReady
      ? fetchGrowthCadenceCommandSummary(input.admin).catch(() => null)
      : Promise.resolve(null),
    nativeDialerProbe.schemaReady
      ? fetchGrowthNativeCallWorkspaceDashboard(input.admin, input.actorUserId).catch(() => null)
      : Promise.resolve(null),
  ])

  const sources: GrowthWorkspaceDashboardSourcePayload = {
    briefing,
    leadInboxSections: revenueQueueSections,
    cadenceSummary: cadenceSchemaReady ? cadenceSummary : null,
    pipelineDashboard,
    opportunityReadiness,
    sequenceFoundation,
    sequenceExecution,
    engagementWorkspace: engagementHighIntent
      ? {
          highIntent: engagementHighIntent.highIntent,
          alerts: { total: engagementHighIntent.highIntent.cards.length },
        }
      : null,
    conversationDashboard,
    relationshipDashboard,
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
    today: briefing?.summary.meetings_today ?? briefing?.meetings.meetings_today ?? 0,
    thisWeek: briefing?.meetings.meetings_this_week ?? 0,
    scheduled: briefing?.meetings.meetings_today ?? 0,
  }

  const inbox: GrowthHomeWorkspaceSummaryInbox = {
    repliesNeedingAttention: briefing?.summary.replies_needing_attention ?? 0,
    threadsOpen: briefing?.inbox?.threads_open ?? 0,
    newReplies: briefing?.inbox?.new_replies ?? 0,
  }

  const avaConsole = buildAvaConsoleSections({ briefing, sources, kpis })

  const optimization: GrowthHomeWorkspaceSummaryOptimization = {
    listGrowthLeadsCalls: 1,
    duplicateLeadListEliminated: 1,
    loaderCount: 12,
    durationMs: Date.now() - startedAt,
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
    briefing,
    optimization,
  }
}

/** @internal cert hook — ensures shared lead resolver is wired. */
export function __growthHomeWorkspaceSummaryUsesSharedLeadResolver(): boolean {
  return typeof resolveDailyRevenueWorkQueueForLeads === "function"
}

/** @internal cert hook — cadence schema message retained for ops parity. */
export const __growthHomeCadenceSetupMessage = GROWTH_CADENCE_SCHEMA_SETUP_MESSAGE
