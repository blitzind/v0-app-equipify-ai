import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  buildExecutionQueueItems,
  rankExecutionQueueItems,
  type ExecutionLeadContext,
} from "@/lib/growth/execution/execution-priority-engine"
import {
  computeExecutionCapacity,
  resolvePipelineMomentum,
} from "@/lib/growth/execution/execution-capacity-engine"
import {
  computeExecutionCompletionPercent,
  computeExecutionOperatorScore,
} from "@/lib/growth/execution/execution-operator-score"
import {
  buildExpansionOpportunities,
  type ExpansionContext,
} from "@/lib/growth/execution/execution-opportunity-engine"
import type {
  ExecutionSprintDuration,
  ExecutionSprintPlan,
  ExecutionSprintType,
  GrowthExecutionDashboard,
  GrowthExecutionDashboardSummary,
  GrowthExecutionQueue,
  GrowthExecutionSprintsResponse,
} from "@/lib/growth/execution/execution-priority-types"
import {
  EXECUTION_SPRINT_TYPE_LABELS,
  GROWTH_REVENUE_EXECUTION_QA_MARKER,
} from "@/lib/growth/execution/execution-priority-types"
import {
  buildRecommendedExecutionSprints,
  buildExecutionSprintPlan,
} from "@/lib/growth/execution/execution-sprint-engine"
import {
  countCriticalProtection,
  deriveRevenueProtectionFromQueue,
  sumRevenueProtected,
} from "@/lib/growth/execution/execution-revenue-protection"
import { balanceExecutionWorkload } from "@/lib/growth/execution/execution-workload-balancer"
import { listGrowthCustomerProfilesForScan } from "@/lib/growth/customer-lifecycle/customer-profile-repository"

const LEAD_SELECT =
  "id, company_name, assigned_to, follow_up_at, next_best_action, revenue_trajectory, workflow_health, score"

const DEAL_SCORE_SELECT =
  "lead_id, deal_risk_score, close_probability, predicted_close_window, risk_level"

const CALL_SCORE_SELECT =
  "lead_id, overall_score, next_step_score, competitor_risk_score, buying_signals, detected_objections, risk_level, computed_at"

const OPPORTUNITY_SELECT = "lead_id, amount, is_stale, owner_user_id, risk_score"

const REPLY_SELECT = "lead_id, unanswered, priority"

const MEETING_SELECT = "id, lead_id, follow_up_due_at, status, outcome, calendar_sync_status"

type SprintRow = {
  id: string
  sprint_type: string
  duration_minutes: number
  status: string
  expected_revenue_impact: number
  task_ids: unknown
  task_count: number
  estimated_effort_minutes: number
  operator_load_score: number
  started_at: string
  completed_at: string | null
}

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false
  return Date.parse(iso) <= Date.now()
}

function mapSprintRow(row: SprintRow, queueItems: GrowthExecutionQueue["items"]): ExecutionSprintPlan {
  const taskIds = Array.isArray(row.task_ids) ? (row.task_ids as string[]) : []
  const tasks = taskIds
    .map((id) => queueItems.find((item) => item.id === id))
    .filter(Boolean)
    .map((item) => ({
      queueItemId: item!.id,
      title: item!.title,
      companyName: item!.companyName,
      effortMinutes: item!.effortMinutes,
      ctaHref: item!.ctaHref,
    }))

  return {
    id: row.id,
    sprintType: row.sprint_type as ExecutionSprintType,
    sprintTypeLabel: EXECUTION_SPRINT_TYPE_LABELS[row.sprint_type as ExecutionSprintType],
    durationMinutes: row.duration_minutes as ExecutionSprintDuration,
    status: row.status === "active" ? "active" : row.status === "completed" ? "completed" : "cancelled",
    expectedRevenueImpact: Number(row.expected_revenue_impact ?? 0),
    tasks,
    taskCount: row.task_count,
    estimatedEffortMinutes: row.estimated_effort_minutes,
    operatorLoadScore: row.operator_load_score,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }
}

async function loadExecutionContexts(admin: SupabaseClient): Promise<ExecutionLeadContext[]> {
  const [leadsRes, dealRes, callRes, oppRes, replyRes, meetingRes, outreachRes, enrollmentRes] = await Promise.all([
    admin.schema("growth").from("leads").select(LEAD_SELECT).limit(300),
    admin.schema("growth").from("deal_intelligence_scores").select(DEAL_SCORE_SELECT).eq("score_status", "active").limit(300),
    admin
      .schema("growth")
      .from("call_intelligence_scorecards")
      .select(CALL_SCORE_SELECT)
      .order("computed_at", { ascending: false })
      .limit(300),
    admin.schema("growth").from("opportunities").select(OPPORTUNITY_SELECT).is("closed_won_at", null).is("closed_lost_at", null).limit(200),
    admin.schema("growth").from("outbound_replies").select(REPLY_SELECT).eq("unanswered", true).limit(100),
    admin.schema("growth").from("meetings").select(MEETING_SELECT).limit(200),
    admin.schema("growth").from("outreach_queue").select("id, lead_id, status").in("status", ["pending_approval", "draft"]).limit(80),
    admin
      .schema("growth")
      .from("sequence_enrollments")
      .select("id, lead_id, enrollment_stalled")
      .in("status", ["draft", "active", "paused"])
      .limit(100),
  ])

  if (leadsRes.error) throw new Error(leadsRes.error.message)

  const leads = leadsRes.data ?? []
  const dealByLead = new Map((dealRes.data ?? []).map((row) => [row.lead_id as string, row]))
  const callByLead = new Map<string, (typeof callRes.data extends Array<infer T> ? T : never)>()
  for (const row of callRes.data ?? []) {
    if (!callByLead.has(row.lead_id as string)) callByLead.set(row.lead_id as string, row)
  }
  const oppByLead = new Map((oppRes.data ?? []).map((row) => [row.lead_id as string, row]))
  const repliesByLead = new Map<string, number>()
  for (const row of replyRes.data ?? []) {
    const leadId = row.lead_id as string
    repliesByLead.set(leadId, (repliesByLead.get(leadId) ?? 0) + 1)
  }
  const meetingsByLead = new Map<string, typeof meetingRes.data>()
  for (const row of meetingRes.data ?? []) {
    const leadId = row.lead_id as string
    const list = meetingsByLead.get(leadId) ?? []
    list.push(row)
    meetingsByLead.set(leadId, list)
  }
  const outreachByLead = new Map<string, string>()
  for (const row of outreachRes.data ?? []) {
    if (!outreachByLead.has(row.lead_id as string)) outreachByLead.set(row.lead_id as string, row.id as string)
  }
  const enrollmentByLead = new Map<string, string>()
  for (const row of enrollmentRes.data ?? []) {
    if (row.enrollment_stalled && !enrollmentByLead.has(row.lead_id as string)) {
      enrollmentByLead.set(row.lead_id as string, row.id as string)
    }
  }

  const customerProfiles = await listGrowthCustomerProfilesForScan(admin).catch(() => [])
  const renewalRiskLeadIds = new Set(
    customerProfiles
      .filter((p) => ["churn_risk", "renewal_due", "inactive"].includes(p.lifecycleStage))
      .map((p) => p.leadId)
      .filter(Boolean) as string[],
  )
  const expansionLeadIds = new Set(
    customerProfiles
      .filter((p) => p.lifecycleStage === "expansion_candidate")
      .map((p) => p.leadId)
      .filter(Boolean) as string[],
  )
  const onboardingStalledLeadIds = new Set(
    customerProfiles
      .filter((p) => ["onboarding_pending", "onboarding_active"].includes(p.lifecycleStage) && p.healthScore < 45)
      .map((p) => p.leadId)
      .filter(Boolean) as string[],
  )

  return leads.map((lead) => {
    const leadId = lead.id as string
    const deal = dealByLead.get(leadId)
    const call = callByLead.get(leadId)
    const opp = oppByLead.get(leadId)
    const meetings = meetingsByLead.get(leadId) ?? []
    const meetingFollowUpOverdue = meetings.some(
      (m) =>
        m.status === "completed" &&
        m.follow_up_due_at &&
        isOverdue(m.follow_up_due_at as string) &&
        !m.outcome,
    )
    const calendarConflict = meetings.some((m) => m.calendar_sync_status === "conflict")
    const buyingSignals = Array.isArray(call?.buying_signals) ? call!.buying_signals.length : 0
    const objections = Array.isArray(call?.detected_objections) ? call!.detected_objections.length : 0
    const competitorDetected =
      (call?.competitor_risk_score as number | null ?? 0) >= 55 ||
      (deal?.risk_level as string | null) === "critical"

    return {
      id: leadId,
      companyName: (lead.company_name as string) ?? "Unknown",
      assignedTo: (lead.assigned_to as string | null) ?? null,
      followUpAt: (lead.follow_up_at as string | null) ?? null,
      workflowHealth: (lead.workflow_health as string | null) ?? null,
      nextBestAction: (lead.next_best_action as string | null) ?? null,
      revenueTrajectory: (lead.revenue_trajectory as string | null) ?? null,
      dealRiskScore: (deal?.deal_risk_score as number | null) ?? null,
      closeWindow: (deal?.predicted_close_window as string | null) ?? null,
      closeProbability: (deal?.close_probability as number | null) ?? null,
      callOverallScore: (call?.overall_score as number | null) ?? null,
      callNextStepScore: (call?.next_step_score as number | null) ?? null,
      callCompetitorRisk: (call?.competitor_risk_score as number | null) ?? null,
      callBuyingSignals: buyingSignals,
      callObjections: objections,
      meetingFollowUpOverdue,
      unansweredReplies: repliesByLead.get(leadId) ?? 0,
      isStaleOpportunity: opp?.is_stale === true,
      competitorDetected,
      buyingSignalDetected: buyingSignals > 0 || (deal?.close_probability as number | null ?? 0) >= 60,
      renewalRisk: renewalRiskLeadIds.has(leadId),
      expansionCandidate: expansionLeadIds.has(leadId),
      openObjections: objections > 0,
      onboardingStalled: onboardingStalledLeadIds.has(leadId),
      providerFailure: false,
      calendarConflict,
      callQualityDecline:
        call?.risk_level === "critical" ||
        ((call?.overall_score as number | null) !== null && (call!.overall_score as number) < 40),
      opportunityAmount: Number(opp?.amount ?? 0),
      referenceIds: {
        outreachQueueId: outreachByLead.get(leadId) ?? null,
        enrollmentId: enrollmentByLead.get(leadId) ?? null,
        meetingId: meetings.find((m) => isOverdue(m.follow_up_due_at as string | null))?.id as string | null,
        replyId: null,
      },
    } satisfies ExecutionLeadContext
  })
}

async function loadExpansionContexts(admin: SupabaseClient): Promise<ExpansionContext[]> {
  const profiles = await listGrowthCustomerProfilesForScan(admin).catch(() => [])
  return profiles.map((profile) => ({
    leadId: profile.leadId,
    customerProfileId: profile.id,
    companyName: profile.companyName,
    healthScore: profile.healthScore,
    lifecycleStage: profile.lifecycleStage,
    expansionScore: profile.expansionScore,
    engagementTier: profile.healthScore >= 70 ? "high" : profile.healthScore >= 45 ? "medium" : "low",
    contactsEngaged: Math.max(1, profile.expansionOpportunityCount + (profile.lastEngagementAt ? 1 : 0)),
    meetingQualityScore: profile.healthScore,
    callOverallScore: null,
    renewalPosture: profile.healthScore >= 70 ? "strong" : profile.healthScore >= 45 ? "neutral" : "weak",
    reviewStatus: profile.reviewStatus,
    referralStatus: profile.referralStatus,
  }))
}

async function loadTimelineEvents(admin: SupabaseClient): Promise<Array<{ eventType: string; occurredAt: string }>> {
  const day30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("event_type, occurred_at")
    .gte("occurred_at", day30)
    .order("occurred_at", { ascending: false })
    .limit(500)
  if (error) return []
  return (data ?? []).map((row) => ({
    eventType: row.event_type as string,
    occurredAt: row.occurred_at as string,
  }))
}

async function loadActiveSprint(
  admin: SupabaseClient,
  orgId: string,
  queueItems: GrowthExecutionQueue["items"],
): Promise<ExecutionSprintPlan | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("execution_sprints")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return mapSprintRow(data as SprintRow, queueItems)
}

function buildDashboardSummary(input: {
  queueItems: GrowthExecutionQueue["items"]
  protectionQueue: ReturnType<typeof deriveRevenueProtectionFromQueue>
  operatorScore: ReturnType<typeof computeExecutionOperatorScore>
  followUpDebt: number
}): GrowthExecutionDashboardSummary {
  const criticalExecutionItems = input.queueItems.filter(
    (item) => item.priorityBand === "critical" || item.priorityBand === "high",
  ).length
  const revenueProtected = sumRevenueProtected(input.protectionQueue)
  const riskReduction = countCriticalProtection(input.protectionQueue)
  const executionCompletionPercent = computeExecutionCompletionPercent({
    queueItems: input.queueItems.length,
    criticalCompleted: input.operatorScore.current.criticalTasksCompleted,
    actionsCompletedToday:
      input.operatorScore.current.followUpsCompleted + input.operatorScore.current.repliesHandled,
  })

  return {
    criticalExecutionItems,
    revenueProtected,
    followUpDebt: input.followUpDebt,
    riskReduction,
    executionCompletionPercent,
  }
}

export async function fetchGrowthExecutionQueue(admin: SupabaseClient): Promise<GrowthExecutionQueue> {
  const contexts = await loadExecutionContexts(admin)
  const rawItems = buildExecutionQueueItems(contexts)
  const { balanced } = balanceExecutionWorkload(rawItems)
  const items = rankExecutionQueueItems(balanced, 50)
  const capacity = computeExecutionCapacity(items)

  return {
    qaMarker: GROWTH_REVENUE_EXECUTION_QA_MARKER,
    generatedAt: new Date().toISOString(),
    items,
    capacity,
  }
}

export async function fetchGrowthExecutionSprints(
  admin: SupabaseClient,
): Promise<GrowthExecutionSprintsResponse> {
  const queue = await fetchGrowthExecutionQueue(admin)
  const orgId = getGrowthEngineAiOrgId()
  const recommended = buildRecommendedExecutionSprints(queue.items)
  const active = orgId ? await loadActiveSprint(admin, orgId, queue.items) : null

  return {
    qaMarker: GROWTH_REVENUE_EXECUTION_QA_MARKER,
    generatedAt: new Date().toISOString(),
    recommended,
    active,
  }
}

export async function fetchGrowthExecutionDashboard(admin: SupabaseClient): Promise<GrowthExecutionDashboard> {
  const [queue, expansionContexts, timelineEvents, orgId] = await Promise.all([
    fetchGrowthExecutionQueue(admin),
    loadExpansionContexts(admin),
    loadTimelineEvents(admin),
    getGrowthEngineAiOrgId(),
  ])

  const protectionQueue = deriveRevenueProtectionFromQueue(queue.items)
  const expansionOpportunities = buildExpansionOpportunities(expansionContexts)
  const operatorScore = computeExecutionOperatorScore(timelineEvents)
  const recommendedSprints = buildRecommendedExecutionSprints(queue.items)
  const activeSprint = orgId ? await loadActiveSprint(admin, orgId, queue.items) : null

  const followUpDebt = queue.items.filter((item) =>
    item.signals.some((s) => s.key === "missing_follow_up" || s.key === "unanswered_reply"),
  ).length

  const todayEvents = timelineEvents.filter((e) => e.occurredAt >= startOfTodayIso())
  const momentum = resolvePipelineMomentum({
    criticalItems: queue.capacity.criticalItems,
    highItems: queue.capacity.highItems,
    actionsCompletedToday: todayEvents.length,
    revenueAtRisk: protectionQueue.filter((p) => p.priorityBand === "critical").length,
  })

  const summary = buildDashboardSummary({
    queueItems: queue.items,
    protectionQueue,
    operatorScore,
    followUpDebt,
  })

  return {
    qaMarker: GROWTH_REVENUE_EXECUTION_QA_MARKER,
    generatedAt: new Date().toISOString(),
    morningFocus: {
      topRevenuePriorities: queue.items.slice(0, 3),
      revenueProtectedToday: summary.revenueProtected,
      pipelineMomentum: momentum.pipelineMomentum,
      pipelineMomentumLabel: momentum.pipelineMomentumLabel,
      executionCapacity: queue.capacity,
    },
    summary,
    operatorScore,
    revenueProtectionQueue: protectionQueue.slice(0, 20),
    expansionOpportunities: expansionOpportunities.slice(0, 15),
    recommendedSprints,
    activeSprint,
  }
}

export async function startGrowthExecutionSprint(
  admin: SupabaseClient,
  input: {
    startedByUserId: string | null
    sprintType: ExecutionSprintType
    durationMinutes: ExecutionSprintDuration
  },
): Promise<ExecutionSprintPlan> {
  const orgId = getGrowthEngineAiOrgId()
  if (!orgId) throw new Error("Growth organization not configured.")

  const queue = await fetchGrowthExecutionQueue(admin)
  const plan = buildExecutionSprintPlan({
    sprintType: input.sprintType,
    durationMinutes: input.durationMinutes,
    queueItems: queue.items,
    status: "active",
  })

  if (plan.taskCount === 0) {
    throw new Error("No execution tasks available for this sprint type.")
  }

  await admin
    .schema("growth")
    .from("execution_sprints")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("status", "active")

  const taskIds = plan.tasks.map((task) => task.queueItemId)
  const { data, error } = await admin
    .schema("growth")
    .from("execution_sprints")
    .insert({
      organization_id: orgId,
      started_by_user_id: input.startedByUserId,
      sprint_type: input.sprintType,
      duration_minutes: input.durationMinutes,
      status: "active",
      expected_revenue_impact: plan.expectedRevenueImpact,
      task_ids: taskIds,
      task_count: plan.taskCount,
      estimated_effort_minutes: plan.estimatedEffortMinutes,
      operator_load_score: plan.operatorLoadScore,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapSprintRow(data as SprintRow, queue.items)
}

export async function fetchGrowthExecutionCommandSummary(
  admin: SupabaseClient,
): Promise<GrowthExecutionDashboardSummary & { morningFocus: GrowthExecutionDashboard["morningFocus"] }> {
  const dashboard = await fetchGrowthExecutionDashboard(admin)
  return {
    ...dashboard.summary,
    morningFocus: dashboard.morningFocus,
  }
}
