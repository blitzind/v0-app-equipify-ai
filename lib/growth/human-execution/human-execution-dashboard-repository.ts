import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { computeExecutionPriorityScore } from "@/lib/growth/execution/execution-priority-score"
import { commandLeadFocusHref } from "@/lib/growth/command/command-action-catalog"
import { evaluateHumanExecutionFatigue } from "@/lib/growth/human-execution/human-execution-fatigue-engine"
import { mapHumanExecutionApprovalRow } from "@/lib/growth/human-execution/human-execution-mapper"
import { listHumanExecutionApprovals } from "@/lib/growth/human-execution/human-execution-repository"
import {
  buildHumanExecutionSequencePlan,
  resolveHumanExecutionSequenceTemplate,
  suggestNextSequenceChannel,
  suggestNextSequenceTiming,
} from "@/lib/growth/human-execution/human-execution-sequence-builder"
import { computeHumanExecutionReadiness } from "@/lib/growth/human-execution/human-execution-readiness-score"
import type {
  GrowthHumanExecutionDashboard,
  GrowthHumanExecutionQueue,
  HumanExecutionApprovalItem,
  HumanExecutionDashboardMetrics,
  HumanExecutionLeadView,
  HumanExecutionQueueItem,
} from "@/lib/growth/human-execution/human-execution-types"
import {
  GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER,
  HUMAN_EXECUTION_APPROVAL_STATUS_LABELS,
  HUMAN_EXECUTION_CHANNEL_LABELS,
} from "@/lib/growth/human-execution/human-execution-types"
import {
  humanExecutionApprovalStatusLabel,
  humanExecutionPlanStatusLabel,
} from "@/lib/growth/human-execution/human-execution-mapper"

const LEAD_SELECT =
  "id, company_name, assigned_to, engagement_score, last_human_touch_at, latest_prospect_research_run_id, score"

type LeadRow = {
  id: string
  company_name: string
  assigned_to: string | null
  engagement_score: number | null
  last_human_touch_at: string | null
  latest_prospect_research_run_id: string | null
  score: number | null
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - Date.parse(iso)) / 86400000)
}

function mapQueueItem(input: {
  id: string
  leadId: string
  companyName: string
  title: string
  why: string
  readinessScore: number
  readinessBand: HumanExecutionQueueItem["readinessBand"]
  channel: HumanExecutionQueueItem["channel"]
  approvalStatus: HumanExecutionQueueItem["approvalStatus"]
  suggestedTiming: string | null
  callNowRecommended: boolean
  ownerUserId: string | null
}): HumanExecutionQueueItem {
  return {
    ...input,
    channelLabel: HUMAN_EXECUTION_CHANNEL_LABELS[input.channel],
    ctaHref: `/admin/growth/execution?leadId=${input.leadId}`,
  }
}

async function loadLeadContext(admin: SupabaseClient, leadId: string) {
  const [leadRes, dealRes, callRes, oppRes, replyRes, meetingRes, researchRes] = await Promise.all([
    admin.schema("growth").from("leads").select(LEAD_SELECT).eq("id", leadId).maybeSingle(),
    admin
      .schema("growth")
      .from("deal_intelligence_scores")
      .select("deal_risk_score, close_probability, predicted_close_window")
      .eq("lead_id", leadId)
      .eq("score_status", "active")
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .schema("growth")
      .from("call_intelligence_scorecards")
      .select("overall_score, next_step_score")
      .eq("lead_id", leadId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .schema("growth")
      .from("opportunities")
      .select("amount")
      .eq("lead_id", leadId)
      .is("closed_won_at", null)
      .is("closed_lost_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .schema("growth")
      .from("outbound_replies")
      .select("intent, priority")
      .eq("lead_id", leadId)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .schema("growth")
      .from("meetings")
      .select("outcome, follow_up_due_at, status")
      .eq("lead_id", leadId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .schema("growth")
      .from("research_runs")
      .select("website_maturity_score")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const lead = leadRes.data as LeadRow | null
  if (!lead) return null

  const revenueExecution = computeExecutionPriorityScore({
    stalled_opportunity: (lead.score ?? 0) < 40,
    missing_follow_up: daysSince(lead.last_human_touch_at) !== null && (daysSince(lead.last_human_touch_at) ?? 0) >= 7,
  })

  const readiness = computeHumanExecutionReadiness({
    dealCloseProbability: dealRes.data?.close_probability as number | null,
    dealRiskScore: dealRes.data?.deal_risk_score as number | null,
    revenueExecutionScore: revenueExecution.executionPriorityScore,
    callOverallScore: callRes.data?.overall_score as number | null,
    callNextStepScore: callRes.data?.next_step_score as number | null,
    engagementScore: lead.engagement_score,
    replyIntent: replyRes.data?.intent as string | null,
    replyPriority: replyRes.data?.priority as string | null,
    meetingOutcome: meetingRes.data?.outcome as string | null,
    meetingFollowUpOverdue:
      meetingRes.data?.follow_up_due_at != null && Date.parse(meetingRes.data.follow_up_due_at as string) <= Date.now(),
    researchMaturityScore: researchRes.data?.website_maturity_score as number | null,
    opportunityAmount: oppRes.data?.amount as number | null,
    daysSinceLastTouch: daysSince(lead.last_human_touch_at),
    expansionCandidate: false,
  })

  return { lead, readiness, replyIntent: replyRes.data?.intent as string | null }
}

export async function fetchHumanExecutionLeadView(
  admin: SupabaseClient,
  leadId: string,
): Promise<HumanExecutionLeadView | null> {
  const context = await loadLeadContext(admin, leadId)
  if (!context) return null

  const templateKey = resolveHumanExecutionSequenceTemplate(context.readiness, context.replyIntent)
  const recommendedSequence = buildHumanExecutionSequencePlan(templateKey)

  const [pendingApprovals, planRes, touchRes] = await Promise.all([
    listHumanExecutionApprovals(admin, { leadId, status: ["draft", "review", "approved"], limit: 10 }),
    admin
      .schema("growth")
      .from("human_execution_plans")
      .select("id, status, created_at")
      .eq("lead_id", leadId)
      .in("status", ["draft", "active", "paused"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .schema("growth")
      .from("outreach_queue")
      .select("id, created_at")
      .eq("lead_id", leadId)
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
  ])

  const fatigue = evaluateHumanExecutionFatigue({
    recentTouchCount7d: (touchRes.data ?? []).length,
    recentTouchCount24h: (touchRes.data ?? []).filter(
      (row) => Date.parse(row.created_at as string) >= Date.now() - 86400000,
    ).length,
    lastTouchAt: context.lead.last_human_touch_at,
    rules: recommendedSequence.rules,
  })

  const completedStepOrders: number[] = []
  const suggestedChannel = suggestNextSequenceChannel(recommendedSequence.steps, [])
  const suggestedTiming = planRes.data?.created_at
    ? suggestNextSequenceTiming(recommendedSequence.steps, new Date(planRes.data.created_at as string), completedStepOrders)
    : null

  const topApproval = pendingApprovals[0] ?? null

  return {
    qaMarker: GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER,
    leadId,
    companyName: context.lead.company_name,
    readiness: context.readiness,
    recommendedSequence,
    approvalStatus: topApproval?.approvalStatus ?? null,
    approvalStatusLabel: topApproval ? humanExecutionApprovalStatusLabel(topApproval.approvalStatus) : null,
    suggestedChannel: fatigue.blocked ? null : suggestedChannel,
    suggestedChannelLabel:
      fatigue.blocked || !suggestedChannel ? null : HUMAN_EXECUTION_CHANNEL_LABELS[suggestedChannel],
    suggestedTiming: fatigue.blocked ? fatigue.nextEligibleAt : suggestedTiming,
    pendingApprovals,
    activePlanStatus: (planRes.data?.status as HumanExecutionLeadView["activePlanStatus"]) ?? null,
  }
}

async function buildMetrics(admin: SupabaseClient): Promise<HumanExecutionDashboardMetrics> {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const [pendingRes, approvedRes, activePlansRes, meetingsRes, outreachRes, fatigueRes, approvalAgesRes] =
    await Promise.all([
      admin
        .schema("growth")
        .from("human_execution_approvals")
        .select("id", { count: "exact", head: true })
        .in("approval_status", ["draft", "review"]),
      admin
        .schema("growth")
        .from("human_execution_approvals")
        .select("id", { count: "exact", head: true })
        .eq("approval_status", "approved"),
      admin
        .schema("growth")
        .from("human_execution_plans")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      admin
        .schema("growth")
        .from("meetings")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo),
      admin
        .schema("growth")
        .from("outreach_queue")
        .select("id, status", { count: "exact" })
        .gte("created_at", weekAgo),
      admin
        .schema("growth")
        .from("human_execution_plan_steps")
        .select("id", { count: "exact", head: true })
        .eq("fatigue_protected", true),
      admin
        .schema("growth")
        .from("human_execution_approvals")
        .select("created_at")
        .in("approval_status", ["draft", "review"])
        .limit(50),
    ])

  const outreachRows = outreachRes.data ?? []
  const executed = outreachRows.filter((row) => row.status === "executed").length
  const totalOutreach = outreachRows.length
  const replyRatePercent = totalOutreach > 0 ? Math.round((executed / totalOutreach) * 100) : 0

  const ages = (approvalAgesRes.data ?? []).map((row) => (Date.now() - Date.parse(row.created_at as string)) / 3600000)
  const humanApprovalSlaHours =
    ages.length > 0 ? Math.round(ages.reduce((sum, hours) => sum + hours, 0) / ages.length) : 0

  return {
    approvalPending: pendingRes.count ?? 0,
    readyNow: approvedRes.count ?? 0,
    revenueInfluenced: 0,
    sequencesActive: activePlansRes.count ?? 0,
    replyRatePercent,
    meetingsCreated: meetingsRes.count ?? 0,
    humanApprovalSlaHours,
    callNowOpportunities: 0,
    contactFatiguePrevented: fatigueRes.count ?? 0,
  }
}

export async function fetchHumanExecutionDashboard(
  admin: SupabaseClient,
): Promise<GrowthHumanExecutionDashboard> {
  const [metrics, approvalQueue, leadsRes] = await Promise.all([
    buildMetrics(admin),
    listHumanExecutionApprovals(admin, { status: ["draft", "review"], limit: 20 }),
    admin.schema("growth").from("leads").select(LEAD_SELECT).limit(80),
  ])

  const queueItems: HumanExecutionQueueItem[] = []
  let callNowCount = 0
  let revenueInfluence = 0

  for (const lead of (leadsRes.data ?? []) as LeadRow[]) {
    const context = await loadLeadContext(admin, lead.id)
    if (!context || context.readiness.readinessScore < 40) continue

    if (context.readiness.callNowRecommended) callNowCount += 1
    revenueInfluence += Math.round((context.readiness.readinessScore / 100) * 10000)

    const channel = suggestNextSequenceChannel(buildHumanExecutionSequencePlan("standard_outreach").steps, []) ?? "email"
    queueItems.push(
      mapQueueItem({
        id: `human-exec:${lead.id}`,
        leadId: lead.id,
        companyName: lead.company_name,
        title: "Execution ready",
        why: context.readiness.signals[0]?.label ?? "Multi-channel execution recommended",
        readinessScore: context.readiness.readinessScore,
        readinessBand: context.readiness.readinessBand,
        channel,
        approvalStatus: "draft",
        suggestedTiming: null,
        callNowRecommended: context.readiness.callNowRecommended,
        ownerUserId: lead.assigned_to,
      }),
    )
  }

  queueItems.sort((a, b) => b.readinessScore - a.readinessScore)
  const readyQueue = queueItems.filter((item) => item.readinessScore >= 60).slice(0, 15)
  const criticalOpportunities = queueItems.filter((item) => item.readinessBand === "critical").slice(0, 10)
  const callNowRecommendations = queueItems.filter((item) => item.callNowRecommended).slice(0, 10)

  return {
    qaMarker: GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER,
    generatedAt: new Date().toISOString(),
    metrics: {
      ...metrics,
      revenueInfluenced: revenueInfluence,
      callNowOpportunities: callNowCount,
    },
    approvalQueue,
    readyQueue,
    criticalOpportunities,
    callNowRecommendations,
  }
}

export async function fetchHumanExecutionQueue(admin: SupabaseClient): Promise<GrowthHumanExecutionQueue> {
  const dashboard = await fetchHumanExecutionDashboard(admin)
  return {
    qaMarker: GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER,
    generatedAt: dashboard.generatedAt,
    items: [...dashboard.readyQueue, ...dashboard.criticalOpportunities].slice(0, 30),
  }
}

export async function mapOutreachPendingToApprovalItems(
  admin: SupabaseClient,
): Promise<HumanExecutionApprovalItem[]> {
  const { data, error } = await admin
    .schema("growth")
    .from("outreach_queue")
    .select("id, lead_id, channel, status, created_at, updated_at, leads(company_name)")
    .in("status", ["draft", "pending_approval"])
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) return []

  return (data ?? []).map((row) => {
    const leadJoin = Array.isArray(row.leads) ? row.leads[0] : row.leads
    return {
      id: `outreach:${row.id as string}`,
      leadId: row.lead_id as string,
      companyName: leadJoin?.company_name ?? "Lead",
      planId: null,
      planStepId: null,
      channel: row.channel === "email" ? "email" : "manual_call",
      channelLabel: row.channel === "email" ? "Email" : "Call task",
      approvalStatus: row.status === "pending_approval" ? "review" : "draft",
      readinessScore: 50,
      readinessBand: "normal",
      title: "Outreach approval pending",
      why: "Existing outreach queue item awaiting operator approval.",
      suggestedChannel: row.channel === "email" ? "email" : "manual_call",
      suggestedTiming: null,
      ownerUserId: null,
      replyRouting: null,
      replyRoutingLabel: null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      ctaHref: `/admin/growth/sequences/execution?queueId=${row.id as string}`,
    } satisfies HumanExecutionApprovalItem
  })
}

export function humanExecutionLeadFocusHref(leadId: string): string {
  return commandLeadFocusHref(leadId, "execution")
}

export { HUMAN_EXECUTION_APPROVAL_STATUS_LABELS, humanExecutionPlanStatusLabel }
