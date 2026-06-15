/** Phase GS-6A — Command Center Unification engine (client-safe). */

import type { GrowthAgentOrchestrationResponse } from "@/lib/growth/agent-orchestration/agent-orchestration-types"
import type { CampaignBuilderWizardResponse } from "@/lib/growth/campaign-builder/campaign-builder-types"
import type { CampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import type { ConversationalPlaybook } from "@/lib/growth/conversational-playbooks/conversational-playbook-types"
import {
  COMMAND_CENTER_UNIFICATION_QA_MARKER,
  COMMAND_CENTER_VIEW_IDS,
  VIEW_LABELS,
  type GrowthCommandCenterLeadWorkspace,
  type GrowthCommandCenterMetrics,
  type GrowthCommandCenterSection,
  type GrowthCommandCenterSectionType,
  type GrowthCommandCenterTimelineItem,
  type GrowthCommandCenterTimelineStage,
  type GrowthCommandCenterUnificationResponse,
  type GrowthCommandCenterView,
  type GrowthCommandCenterViewId,
  type GrowthCommandCenterViewItem,
  type GrowthCommandCenterWorkspace,
  type GrowthCommandCenterWorkspaceStatus,
} from "@/lib/growth/command-center-unification/command-center-unification-types"
import type { SmartFollowUpPoliciesResponse } from "@/lib/growth/follow-up-policies/follow-up-policy-types"
import type { HumanInterventionsResponse } from "@/lib/growth/human-interventions/human-intervention-types"
import type { GrowthHumanExecutionQueue } from "@/lib/growth/human-execution/human-execution-types"
import type { OperatorInboxQueueResponse } from "@/lib/growth/operator-inbox/operator-inbox-types"
import type { GrowthRealtimeEventsResponse } from "@/lib/growth/realtime-events/realtime-events-types"
import type { SequencePreviewStudioResponse } from "@/lib/growth/sequence-preview/sequence-preview-types"
import type { GrowthSignalFeedResponse } from "@/lib/growth/signal-intelligence/signal-feed-types"

const PRIORITY_RANK = { urgent: 4, high: 3, medium: 2, low: 1 }

function leadHref(leadId: string | null | undefined): string | null {
  return leadId ? `/admin/growth/command?leadId=${encodeURIComponent(leadId)}` : "/admin/growth/command"
}

function sectionStatusFromCount(blocked: number, needsReview: number): GrowthCommandCenterWorkspaceStatus {
  if (blocked > 0) return "blocked"
  if (needsReview > 0) return "needs_attention"
  return "healthy"
}

function buildSection(
  section_type: GrowthCommandCenterSectionType,
  label: string,
  item_count: number,
  summary: string,
  related_href: string | null,
  source_panel: string,
  blocked = 0,
  needsReview = 0,
): GrowthCommandCenterSection {
  return {
    section_id: `section_${section_type}`,
    section_type,
    label,
    status: sectionStatusFromCount(blocked, needsReview),
    item_count,
    summary,
    related_href,
    source_panel,
  }
}

export type CommandCenterAggregationContext = {
  signal_feed?: GrowthSignalFeedResponse | null
  operator_inbox?: OperatorInboxQueueResponse | null
  interventions?: HumanInterventionsResponse | null
  follow_up_policies?: SmartFollowUpPoliciesResponse | null
  sequence_previews?: SequencePreviewStudioResponse | null
  campaign_builder?: CampaignBuilderWizardResponse | null
  agent_orchestration?: GrowthAgentOrchestrationResponse | null
  realtime_events?: GrowthRealtimeEventsResponse | null
  human_execution_queue?: GrowthHumanExecutionQueue | null
  playbook?: ConversationalPlaybook | null
  campaign_readiness?: CampaignReadinessAssessment | null
  lead_id?: string | null
  company_name?: string | null
}

function buildMetrics(ctx: CommandCenterAggregationContext): GrowthCommandCenterMetrics {
  const signals = ctx.signal_feed?.items ?? []
  const inbox = ctx.operator_inbox?.items ?? []
  const interventions = ctx.interventions?.interventions ?? []
  const previews = ctx.sequence_previews?.previews ?? []
  const wizards = ctx.campaign_builder?.wizards ?? []
  const plans = ctx.agent_orchestration?.plans ?? []
  const approvals = ctx.human_execution_queue?.items ?? []

  const blockedCampaigns =
    wizards.filter((w) => w.wizard_status === "blocked").length +
    previews.filter((p) => p.sequence_status === "blocked").length +
    (ctx.campaign_readiness?.readiness_status === "not_ready" ? 1 : 0)

  const highIntent =
    interventions.filter((i) => i.intervention_type === "high_intent" || i.intervention_type === "opportunity")
      .length + signals.filter((s) => s.urgency === "hot" || s.priority === "urgent").length

  const needsAttention =
    inbox.filter((i) => i.priority === "urgent" || i.priority === "high").length +
    interventions.filter((i) => i.priority === "urgent" || i.priority === "high").length

  const readyForOutreach =
    (ctx.campaign_readiness?.readiness_status === "ready" ? 1 : 0) +
    previews.filter((p) => p.sequence_status === "ready_for_human_approval").length +
    wizards.filter((w) => w.wizard_status === "ready_for_human_approval").length

  const waitingForReview =
    interventions.filter((i) => i.resolution.resolution_status === "pending").length +
    plans.filter((p) => p.plan_status === "needs_review").length

  const activeConversations = inbox.filter((i) => i.source === "inbox_thread" || i.source === "reply_workflow").length

  return {
    total_signals: signals.length,
    inbox_items: inbox.length,
    interventions_count: interventions.length,
    blocked_campaigns: blockedCampaigns,
    needs_attention_count: needsAttention,
    ready_for_outreach_count: readyForOutreach,
    approval_queue_count: approvals.length,
    high_intent_count: highIntent,
    active_conversations_count: activeConversations,
    waiting_for_review_count: waitingForReview,
    agent_plans_count: plans.length,
    readiness_assessments_count: ctx.campaign_readiness ? 1 : 0,
  }
}

function resolveWorkspaceStatus(metrics: GrowthCommandCenterMetrics): GrowthCommandCenterWorkspaceStatus {
  if (metrics.blocked_campaigns > 0) return "blocked"
  if (metrics.approval_queue_count > 0 || metrics.waiting_for_review_count > 0) return "waiting_for_review"
  if (metrics.needs_attention_count > 0) return "needs_attention"
  return "healthy"
}

function buildGlobalViews(ctx: CommandCenterAggregationContext, metrics: GrowthCommandCenterMetrics): GrowthCommandCenterView[] {
  const items: GrowthCommandCenterViewItem[] = []

  for (const signal of ctx.signal_feed?.items ?? []) {
    items.push({
      item_id: `signal_${signal.id}`,
      view_id: signal.urgency === "hot" || signal.priority === "urgent" ? "high_intent" : "needs_attention",
      title: signal.signal_label,
      description: signal.recommended_action,
      priority: signal.priority === "urgent" ? "urgent" : signal.priority === "high" ? "high" : "medium",
      lead_id: signal.lead_id,
      company_name: signal.company_name,
      related_href: signal.cta.view_lead ?? leadHref(signal.lead_id),
      source_subsystem: "signal_feed",
    })
  }

  for (const intervention of ctx.interventions?.interventions ?? []) {
    const viewId: GrowthCommandCenterViewId =
      intervention.intervention_type === "campaign_blocked" || intervention.intervention_type === "risk_detected"
        ? "campaign_blocked"
        : intervention.intervention_type === "high_intent" || intervention.intervention_type === "opportunity"
          ? "high_intent"
          : intervention.intervention_type === "approval_required"
            ? "approval_queue"
            : "waiting_for_human_review"

    items.push({
      item_id: `intervention_${intervention.intervention_id}`,
      view_id: viewId,
      title: intervention.title,
      description: intervention.description,
      priority: intervention.priority,
      lead_id: intervention.lead_id,
      company_name: intervention.company_name,
      related_href: intervention.related_href ?? leadHref(intervention.lead_id),
      source_subsystem: "human_interventions",
    })
  }

  for (const inboxItem of ctx.operator_inbox?.items ?? []) {
    const viewId: GrowthCommandCenterViewId =
      inboxItem.source === "inbox_thread" || inboxItem.source === "reply_workflow"
        ? "active_conversations"
        : inboxItem.priority === "urgent" || inboxItem.priority === "high"
          ? "needs_attention"
          : "waiting_for_human_review"

    items.push({
      item_id: `inbox_${inboxItem.item_id}`,
      view_id: viewId,
      title: inboxItem.title,
      description: inboxItem.description,
      priority: inboxItem.priority,
      lead_id: inboxItem.lead_id,
      company_name: inboxItem.company_name,
      related_href: inboxItem.cta_href ?? leadHref(inboxItem.lead_id),
      source_subsystem: "operator_inbox",
    })
  }

  for (const preview of ctx.sequence_previews?.previews ?? []) {
    items.push({
      item_id: `preview_${preview.preview_id}`,
      view_id:
        preview.sequence_status === "blocked"
          ? "campaign_blocked"
          : preview.sequence_status === "ready_for_human_approval"
            ? "ready_for_outreach"
            : "waiting_for_human_review",
      title: `Sequence: ${preview.pattern_label}`,
      description: preview.sequence_status.replace(/_/g, " "),
      priority: preview.sequence_status === "blocked" ? "high" : "medium",
      lead_id: preview.lead_id,
      company_name: preview.company_name,
      related_href: preview.related_href,
      source_subsystem: "sequence_preview",
    })
  }

  for (const wizard of ctx.campaign_builder?.wizards ?? []) {
    items.push({
      item_id: `wizard_${wizard.wizard_id}`,
      view_id:
        wizard.wizard_status === "blocked"
          ? "campaign_blocked"
          : wizard.wizard_status === "ready_for_human_approval"
            ? "ready_for_outreach"
            : "waiting_for_human_review",
      title: `Campaign: ${wizard.configuration.suggested_pattern_label ?? "configuration"}`,
      description: wizard.wizard_status.replace(/_/g, " "),
      priority: wizard.wizard_status === "blocked" ? "high" : "medium",
      lead_id: wizard.lead_id,
      company_name: wizard.company_name,
      related_href: wizard.related_href,
      source_subsystem: "campaign_builder",
    })
  }

  for (const approval of ctx.human_execution_queue?.items ?? []) {
    items.push({
      item_id: `approval_${approval.id}`,
      view_id: "approval_queue",
      title: approval.title,
      description: approval.why,
      priority: "high",
      lead_id: approval.leadId,
      company_name: approval.companyName,
      related_href: approval.ctaHref,
      source_subsystem: "human_execution_queue",
    })
  }

  if (ctx.campaign_readiness) {
    items.push({
      item_id: `readiness_${ctx.campaign_readiness.assessment_id}`,
      view_id:
        ctx.campaign_readiness.readiness_status === "not_ready"
          ? "campaign_blocked"
          : ctx.campaign_readiness.readiness_status === "ready"
            ? "ready_for_outreach"
            : "waiting_for_human_review",
      title: `Readiness: ${ctx.campaign_readiness.readiness_status.replace(/_/g, " ")}`,
      description: `Score ${ctx.campaign_readiness.readiness_score}`,
      priority: ctx.campaign_readiness.readiness_status === "not_ready" ? "high" : "medium",
      lead_id: ctx.campaign_readiness.lead_id,
      company_name: ctx.campaign_readiness.company_name,
      related_href: leadHref(ctx.campaign_readiness.lead_id),
      source_subsystem: "campaign_readiness",
    })
  }

  const views: GrowthCommandCenterView[] = COMMAND_CENTER_VIEW_IDS.map((view_id) => {
    const viewItems = items
      .filter((item) => item.view_id === view_id)
      .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority])
      .slice(0, 15)

    return {
      view_id,
      label: VIEW_LABELS[view_id],
      item_count: viewItems.length,
      items: viewItems,
    }
  })

  void metrics
  return views
}

/**
 * Deterministic cross-system timeline — read-only aggregation.
 */
export function buildGrowthCommandCenterTimeline(ctx: CommandCenterAggregationContext): GrowthCommandCenterTimelineItem[] {
  const timeline: GrowthCommandCenterTimelineItem[] = []
  let order = 0

  const push = (
    stage: GrowthCommandCenterTimelineStage,
    title: string,
    description: string,
    occurred_at: string,
    lead_id: string | null,
    company_name: string | null,
    source_subsystem: string,
    related_href: string | null,
  ) => {
    timeline.push({
      timeline_id: `tl_${stage}_${order}`,
      stage,
      title,
      description,
      occurred_at,
      lead_id,
      company_name,
      source_subsystem,
      related_href,
      order: order++,
    })
  }

  for (const signal of ctx.signal_feed?.items ?? []) {
    push(
      "signal",
      signal.signal_label,
      signal.recommended_action,
      signal.occurred_at,
      signal.lead_id,
      signal.company_name,
      "signal_feed",
      signal.cta.view_lead,
    )
  }

  for (const intervention of ctx.interventions?.interventions ?? []) {
    push(
      "intervention",
      intervention.title,
      intervention.description,
      intervention.occurred_at,
      intervention.lead_id,
      intervention.company_name,
      "human_interventions",
      intervention.related_href,
    )
  }

  if (ctx.campaign_readiness) {
    push(
      "readiness_change",
      `Readiness ${ctx.campaign_readiness.readiness_status}`,
      `Score ${ctx.campaign_readiness.readiness_score}`,
      ctx.campaign_readiness.generated_at,
      ctx.campaign_readiness.lead_id,
      ctx.campaign_readiness.company_name,
      "campaign_readiness",
      leadHref(ctx.campaign_readiness.lead_id),
    )
  }

  for (const policy of ctx.follow_up_policies?.policies ?? []) {
    push(
      "follow_up_recommendation",
      policy.title,
      policy.description,
      policy.generated_at,
      policy.lead_id,
      policy.company_name,
      "follow_up_policies",
      policy.related_href,
    )
  }

  for (const preview of ctx.sequence_previews?.previews ?? []) {
    push(
      "sequence_preview",
      preview.pattern_label,
      preview.sequence_status.replace(/_/g, " "),
      preview.generated_at,
      preview.lead_id,
      preview.company_name,
      "sequence_preview",
      preview.related_href,
    )
  }

  for (const wizard of ctx.campaign_builder?.wizards ?? []) {
    push(
      "campaign_builder",
      wizard.configuration.suggested_pattern_label ?? "Campaign configuration",
      wizard.wizard_status.replace(/_/g, " "),
      wizard.generated_at,
      wizard.lead_id,
      wizard.company_name,
      "campaign_builder",
      wizard.related_href,
    )
  }

  for (const plan of ctx.agent_orchestration?.plans ?? []) {
    push(
      "agent_plan",
      `Agent plan: ${plan.plan_status.replace(/_/g, " ")}`,
      `${plan.tasks.length} tasks — planning only`,
      plan.generated_at,
      plan.lead_id,
      plan.company_name,
      "agent_orchestration",
      plan.related_href,
    )
  }

  for (const approval of ctx.human_execution_queue?.items ?? []) {
    push(
      "human_approval",
      approval.title,
      approval.why,
      ctx.human_execution_queue?.generatedAt ?? new Date().toISOString(),
      approval.leadId,
      approval.companyName,
      "human_execution_queue",
      approval.ctaHref,
    )
  }

  const stageOrder: Record<GrowthCommandCenterTimelineStage, number> = {
    signal: 1,
    intervention: 2,
    readiness_change: 3,
    follow_up_recommendation: 4,
    sequence_preview: 5,
    campaign_builder: 6,
    agent_plan: 7,
    human_approval: 8,
  }

  return timeline.sort((a, b) => {
    const stageDiff = stageOrder[a.stage] - stageOrder[b.stage]
    if (stageDiff !== 0) return stageDiff
    return b.occurred_at.localeCompare(a.occurred_at)
  })
}

export function buildGrowthCommandCenterMetrics(ctx: CommandCenterAggregationContext): GrowthCommandCenterMetrics {
  return buildMetrics(ctx)
}

function buildSections(ctx: CommandCenterAggregationContext): GrowthCommandCenterSection[] {
  const signals = ctx.signal_feed?.items ?? []
  const inbox = ctx.operator_inbox?.items ?? []
  const interventions = ctx.interventions?.interventions ?? []
  const policies = ctx.follow_up_policies?.policies ?? []
  const previews = ctx.sequence_previews?.previews ?? []
  const wizards = ctx.campaign_builder?.wizards ?? []
  const plans = ctx.agent_orchestration?.plans ?? []
  const events = ctx.realtime_events?.events ?? []
  const approvals = ctx.human_execution_queue?.items ?? []

  return [
    buildSection(
      "signals",
      "Signals",
      signals.length,
      `${signals.length} signal(s) in feed`,
      "/admin/growth/command",
      "GrowthSignalFeedPanel",
    ),
    buildSection(
      "readiness",
      "Readiness",
      ctx.campaign_readiness ? 1 : 0,
      ctx.campaign_readiness
        ? `${ctx.campaign_readiness.readiness_status} (score ${ctx.campaign_readiness.readiness_score})`
        : "No readiness assessment",
      leadHref(ctx.lead_id),
      "GrowthCampaignReadinessPanel",
      ctx.campaign_readiness?.readiness_status === "not_ready" ? 1 : 0,
      ctx.campaign_readiness?.readiness_status === "partially_ready" ? 1 : 0,
    ),
    buildSection(
      "playbooks",
      "Playbooks",
      ctx.playbook ? 1 : 0,
      ctx.playbook ? `${ctx.playbook.playbook_type} playbook` : "No playbook loaded",
      leadHref(ctx.lead_id),
      "GrowthConversationalPlaybooksPanel",
    ),
    buildSection(
      "follow_up_policies",
      "Follow-Up Policies",
      policies.length,
      `${policies.length} polic${policies.length === 1 ? "y" : "ies"}`,
      leadHref(ctx.lead_id),
      "GrowthSmartFollowUpPoliciesPanel",
    ),
    buildSection(
      "sequence_preview",
      "Sequence Preview",
      previews.length,
      previews[0]?.pattern_label ?? "No previews",
      previews[0]?.related_href ?? "/admin/growth/sequences/builder",
      "GrowthSequencePreviewStudioPanel",
      previews.filter((p) => p.sequence_status === "blocked").length,
      previews.filter((p) => p.sequence_status === "needs_review").length,
    ),
    buildSection(
      "campaign_builder",
      "Campaign Builder",
      wizards.length,
      wizards[0]?.wizard_status.replace(/_/g, " ") ?? "No wizards",
      wizards[0]?.related_href ?? leadHref(ctx.lead_id),
      "GrowthCampaignBuilderWizardPanel",
      wizards.filter((w) => w.wizard_status === "blocked").length,
      wizards.filter((w) => w.wizard_status === "needs_review").length,
    ),
    buildSection(
      "agent_plan",
      "Agent Plan",
      plans.length,
      plans[0]?.plan_status.replace(/_/g, " ") ?? "No plans",
      plans[0]?.related_href ?? leadHref(ctx.lead_id),
      "GrowthAgentOrchestrationPanel",
      plans.filter((p) => p.plan_status === "blocked").length,
      plans.filter((p) => p.plan_status === "needs_review").length,
    ),
    buildSection(
      "inbox_activity",
      "Inbox Activity",
      inbox.length,
      `${inbox.length} inbox item(s)`,
      leadHref(ctx.lead_id),
      "GrowthOperatorInboxPanel",
      0,
      inbox.filter((i) => i.priority === "urgent").length,
    ),
    buildSection(
      "interventions",
      "Interventions",
      interventions.length,
      `${interventions.length} intervention(s)`,
      leadHref(ctx.lead_id),
      "GrowthHumanInterventionsPanel",
      interventions.filter((i) => i.intervention_type === "campaign_blocked").length,
      interventions.filter((i) => i.resolution.resolution_status === "pending").length,
    ),
    buildSection(
      "realtime_events",
      "Realtime Events",
      events.length,
      `${events.length} recent event(s)`,
      "/admin/growth/command",
      "GrowthRealtimeEventBusPanel",
    ),
    buildSection(
      "approvals",
      "Approvals",
      approvals.length,
      `${approvals.length} approval(s) in queue`,
      "/admin/growth/execution",
      "HumanExecutionQueue",
      0,
      approvals.length,
    ),
    buildSection(
      "audit_timeline",
      "Audit Timeline",
      buildGrowthCommandCenterTimeline(ctx).length,
      "Cross-system timeline",
      leadHref(ctx.lead_id),
      "GrowthCommandCenterTimelinePanel",
    ),
  ]
}

/**
 * Build unified global command center workspace — read-only aggregation.
 */
export function buildGrowthCommandCenterWorkspace(
  ctx: CommandCenterAggregationContext,
): GrowthCommandCenterWorkspace {
  const metrics = buildMetrics(ctx)
  const views = buildGlobalViews(ctx, metrics)
  const timeline = buildGrowthCommandCenterTimeline(ctx)
  const attention_queue = views.find((v) => v.view_id === "needs_attention")?.items ?? []
  const approval_queue = views.find((v) => v.view_id === "approval_queue")?.items ?? []

  return {
    qa_marker: COMMAND_CENTER_UNIFICATION_QA_MARKER,
    workspace_id: `workspace:global:${Date.now()}`,
    workspace_status: resolveWorkspaceStatus(metrics),
    generated_at: new Date().toISOString(),
    sections: buildSections(ctx),
    views,
    timeline,
    metrics,
    attention_queue,
    approval_queue,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  }
}

/**
 * Build unified lead workspace — all sections powered by existing subsystem data.
 */
export function buildGrowthLeadWorkspace(ctx: CommandCenterAggregationContext): GrowthCommandCenterLeadWorkspace {
  if (!ctx.lead_id) {
    throw new Error("lead_id_required")
  }

  const metrics = buildMetrics(ctx)
  const timeline = buildGrowthCommandCenterTimeline(ctx)

  return {
    qa_marker: COMMAND_CENTER_UNIFICATION_QA_MARKER,
    workspace_id: `workspace:lead:${ctx.lead_id}:${Date.now()}`,
    lead_id: ctx.lead_id,
    company_name: ctx.company_name ?? null,
    workspace_status: resolveWorkspaceStatus(metrics),
    generated_at: new Date().toISOString(),
    sections: buildSections(ctx),
    timeline,
    metrics,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  }
}

export function buildGrowthCommandCenterUnificationResponse(
  ctx: CommandCenterAggregationContext,
  leadWorkspaces: GrowthCommandCenterLeadWorkspace[] = [],
): GrowthCommandCenterUnificationResponse {
  const workspace = buildGrowthCommandCenterWorkspace(ctx)
  return {
    ...workspace,
    lead_workspaces: leadWorkspaces,
  }
}
