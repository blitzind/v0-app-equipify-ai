import type { AidenDailyBriefing } from "@/lib/growth/aiden/aiden-daily-briefing"
import type { GrowthCadenceCommandSummary } from "@/lib/growth/cadence/cadence-types"
import type { GrowthOpportunityPipelineDashboard } from "@/lib/growth/opportunity-pipeline/pipeline-types"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import { GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTIONS } from "@/lib/growth/workspace/growth-workspace-dashboard-quick-actions"
import {
  GROWTH_WORKSPACE_DASHBOARD_QA_MARKER,
  type GrowthWorkspaceDashboardViewModel,
} from "@/lib/growth/workspace/growth-workspace-dashboard-types"

type LeadInboxSection = { id: string; items: unknown[] }

type OpportunityReadinessDashboard = {
  averageReadiness?: number
  executiveCloseCandidates?: unknown[]
}

type SequenceFoundationResponse = {
  dashboard?: { active_count?: number }
  templates?: Array<{ status?: string }>
  enrollments?: unknown[]
}

type SequenceExecutionDashboard = {
  pendingApproval?: number
  sent24h?: number
}

type EngagementCommandCenterWorkspace = {
  highIntent?: { cards?: unknown[] }
  alerts?: { total?: number }
}

type ConversationDashboard = {
  conversationRisk?: unknown[]
}

type RelationshipDashboard = {
  executiveAttentionRequired?: unknown[]
  relationshipCooling?: unknown[]
}

type CallsDashboardResponse = {
  workspaceDashboard?: { stats?: { callsToday?: number } }
}

export type GrowthWorkspaceDashboardSourcePayload = {
  briefing: AidenDailyBriefing | null
  leadInboxSections: LeadInboxSection[]
  cadenceSummary: GrowthCadenceCommandSummary | null
  pipelineDashboard: GrowthOpportunityPipelineDashboard | null
  opportunityReadiness: OpportunityReadinessDashboard | null
  sequenceFoundation: SequenceFoundationResponse | null
  sequenceExecution: SequenceExecutionDashboard | null
  engagementWorkspace: EngagementCommandCenterWorkspace | null
  conversationDashboard: ConversationDashboard | null
  relationshipDashboard: RelationshipDashboard | null
  callsDashboard: CallsDashboardResponse | null
}

function countInboxSections(sections: LeadInboxSection[], ids: string[]): number {
  return sections
    .filter((section) => ids.includes(section.id))
    .reduce((sum, section) => sum + section.items.length, 0)
}

function openOpportunityCount(pipeline: GrowthOpportunityPipelineDashboard | null): number {
  if (!pipeline) return 0
  return pipeline.pipelineByStage.reduce((sum, stage) => sum + stage.count, 0)
}

function sectionIsEmpty(metrics: Array<{ value: number }>): boolean {
  return metrics.every((metric) => metric.value <= 0)
}

export function buildGrowthWorkspaceDashboardViewModel(
  input: GrowthWorkspaceDashboardSourcePayload,
): GrowthWorkspaceDashboardViewModel {
  const leadsNeedingAction = countInboxSections(input.leadInboxSections, ["high_priority", "needs_review"])
  const callReadyLeads = input.cadenceSummary?.callTasksDueCount ?? 0
  const inboxRequiringReplies = input.briefing?.summary.replies_needing_attention ?? 0
  const opportunitiesRequiringFollowUp =
    input.pipelineDashboard?.dealsNeedingAction ?? input.briefing?.meetings.opportunities_pending ?? 0

  const emailsSentToday = input.briefing?.revenue.emails_sent ?? 0
  const repliesToday = input.briefing?.revenue.replies ?? 0
  const callsToday = input.callsDashboard?.workspaceDashboard?.stats?.callsToday ?? 0
  const meetingsToday = input.briefing?.summary.meetings_today ?? 0

  const openOpportunities = openOpportunityCount(input.pipelineDashboard)
  const forecastValue = input.pipelineDashboard?.forecastTotals.commit.amount ?? 0
  const weightedPipeline = input.pipelineDashboard?.weightedPipeline ?? 0
  const closeCandidates = input.opportunityReadiness?.executiveCloseCandidates?.length ?? 0

  const activeTemplates =
    input.sequenceFoundation?.templates?.filter((template) => template.status === "active").length ?? 0
  const activeEnrollments = input.sequenceFoundation?.dashboard?.active_count ?? 0
  const executionsToday = input.sequenceExecution?.sent24h ?? 0
  const approvalQueueCount =
    input.sequenceExecution?.pendingApproval ?? input.briefing?.summary.pending_approvals ?? 0

  const engagementScore = Math.round(input.opportunityReadiness?.averageReadiness ?? 0)
  const hotCompanies = input.engagementWorkspace?.highIntent?.cards?.length ?? 0
  const relationshipAlerts =
    (input.relationshipDashboard?.executiveAttentionRequired?.length ?? 0) +
    (input.relationshipDashboard?.relationshipCooling?.length ?? 0)
  const conversationAlerts = input.conversationDashboard?.conversationRisk?.length ?? 0

  const myQueueMetrics = [
    {
      label: "Leads needing action",
      value: leadsNeedingAction,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/leads`,
      emptyHint: "Queue is clear",
    },
    {
      label: "Call-ready leads",
      value: callReadyLeads,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/calls`,
      emptyHint: "No calls due",
    },
    {
      label: "Inbox requiring replies",
      value: inboxRequiringReplies,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
      emptyHint: "Inbox is caught up",
    },
    {
      label: "Opportunities needing follow-up",
      value: opportunitiesRequiringFollowUp,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline`,
      emptyHint: "Pipeline is current",
    },
  ]

  const activityMetrics = [
    {
      label: "Emails sent today",
      value: emailsSentToday,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/campaigns`,
      emptyHint: "No sends yet today",
    },
    {
      label: "Replies today",
      value: repliesToday,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
      emptyHint: "No replies yet today",
    },
    {
      label: "Calls today",
      value: callsToday,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/calls`,
      emptyHint: "No calls logged today",
    },
    {
      label: "Meetings today",
      value: meetingsToday,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/meetings`,
      emptyHint: "No meetings scheduled today",
    },
  ]

  const pipelineMetrics = [
    {
      label: "Open opportunities",
      value: openOpportunities,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline`,
      emptyHint: "No open deals",
    },
    {
      label: "Forecast value",
      value: forecastValue,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline`,
      emptyHint: "Forecast not configured",
    },
    {
      label: "Weighted pipeline",
      value: weightedPipeline,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline`,
      emptyHint: "No weighted pipeline",
    },
    {
      label: "Close candidates",
      value: closeCandidates,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/opportunities`,
      emptyHint: "No close candidates",
    },
  ]

  const campaignMetrics = [
    {
      label: "Active campaigns",
      value: activeTemplates,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/campaigns`,
      emptyHint: "No active campaigns",
    },
    {
      label: "Enrollments",
      value: activeEnrollments,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/campaigns`,
      emptyHint: "No active enrollments",
    },
    {
      label: "Executions today",
      value: executionsToday,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/campaigns`,
      emptyHint: "No executions today",
    },
    {
      label: "Approval queue",
      value: approvalQueueCount,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/campaigns`,
      emptyHint: "Approval queue clear",
    },
  ]

  const intelligenceMetrics = [
    {
      label: "Engagement score",
      value: engagementScore,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/engagement`,
      emptyHint: "Engagement data unavailable",
    },
    {
      label: "Hot companies",
      value: hotCompanies,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/engagement`,
      emptyHint: "No hot signals",
    },
    {
      label: "Relationship alerts",
      value: relationshipAlerts,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/relationships`,
      emptyHint: "Relationships stable",
    },
    {
      label: "Conversation alerts",
      value: conversationAlerts,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/conversations`,
      emptyHint: "No conversation risks",
    },
  ]

  return {
    qaMarker: GROWTH_WORKSPACE_DASHBOARD_QA_MARKER,
    generatedAt: new Date().toISOString(),
    briefing: input.briefing,
    operatorName: input.briefing?.operator_name ?? null,
    recommendedAction: input.briefing?.summary.recommended_action ?? null,
    welcome: {
      greeting: input.briefing?.greeting ?? "Welcome back",
      operatorName: input.briefing?.operator_name ?? null,
      recommendedAction: input.briefing?.summary.recommended_action ?? null,
      todaysFocus:
        input.briefing?.priorities?.[0]?.title ??
        input.briefing?.section_summaries?.inbox ??
        "Keep your queue, inbox, and pipeline moving.",
    },
    quickActions: GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTIONS.map(({ id, label, href, description, shortcut }) => ({
      id,
      label,
      href,
      description,
      shortcut,
    })),
    sections: [
      {
        id: "my-queue",
        title: "My Queue",
        metrics: myQueueMetrics,
        emptyMessage: sectionIsEmpty(myQueueMetrics) ? "Your operator queue is clear for now." : undefined,
      },
      {
        id: "activity",
        title: "Activity",
        metrics: activityMetrics,
        emptyMessage: sectionIsEmpty(activityMetrics) ? "No outbound activity recorded yet today." : undefined,
      },
      {
        id: "pipeline-snapshot",
        title: "Pipeline Snapshot",
        metrics: pipelineMetrics,
        emptyMessage: sectionIsEmpty(pipelineMetrics) ? "Pipeline intelligence will appear once opportunities exist." : undefined,
      },
      {
        id: "campaign-snapshot",
        title: "Campaign Snapshot",
        metrics: campaignMetrics,
        emptyMessage: sectionIsEmpty(campaignMetrics) ? "Launch a campaign to see execution metrics here." : undefined,
      },
      {
        id: "intelligence",
        title: "Intelligence",
        metrics: intelligenceMetrics,
        emptyMessage: sectionIsEmpty(intelligenceMetrics) ? "Intelligence signals will populate as engagement accrues." : undefined,
      },
      {
        id: "quick-actions",
        title: "Quick Actions",
        metrics: [],
      },
    ],
  }
}
