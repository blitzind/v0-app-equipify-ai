import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  COMMAND_ACTION_EFFORT_MINUTES,
  COMMAND_BOSS_BATTLE_FOR_KIND,
  COMMAND_CTA_LABELS,
  COMMAND_ACTION_LABELS,
  commandLeadFocusHref,
  commandOutreachHref,
  commandSequenceExecutionHref,
  OPERATOR_RANK_THRESHOLDS,
} from "@/lib/growth/command/command-action-catalog"
import {
  computeCommandActionImpact,
  computeMomentumState,
  computeOperatorScore,
  estimateRevenueInfluence,
  rankCommandActions,
} from "@/lib/growth/command/command-action-engine"
import type {
  GrowthCommandAction,
  GrowthCommandActionKind,
  GrowthCommandDashboard,
} from "@/lib/growth/command/command-action-types"
import {
  buildBossBattles,
  buildCoachTips,
  buildHeatMap,
  detectComboChains,
} from "@/lib/growth/command/command-dashboard-helpers"
import { isForecastRegression } from "@/lib/growth/revenue-forecast-trajectory"
import { fetchProspectResearchCoverageSummary } from "@/lib/growth/research/research-repository"
import { fetchDealIntelligenceDashboardSummary } from "@/lib/growth/deal-intelligence/deal-intelligence-repository"
import { dealIntelligenceActionImpactBoost } from "@/lib/growth/deal-intelligence/nba-deal-intelligence-bridge"

const LEAD_SCAN_SELECT =
  "id, company_name, status, follow_up_at, next_best_action, next_best_action_reason, executive_priority_tier, revenue_probability_score, revenue_probability_tier, revenue_trajectory, revenue_probability_previous_score, forecast_contribution_weight, forecast_attention_level, conversation_urgency_level, conversation_health_tier, relationship_trend, engagement_tier, opportunity_readiness_tier, decision_maker_status, last_researched_at, operational_capacity_tier, workflow_health, contact_temperature, assigned_to, call_priority_tier, score"

const WIN_EVENT_TYPES = new Set([
  "sequence_step_executed",
  "sequence_enrollment_completed",
  "outreach_executed",
  "research_completed",
  "relationship_became_trusted",
  "relationship_became_strategic",
  "follow_up_completed",
  "call_copilot_summary_approved",
  "lead_became_forecasted",
  "forecast_regression_detected",
])

const EXECUTION_EVENT_TYPES = new Set([
  "outreach_executed",
  "outreach_approved",
  "sequence_step_executed",
  "sequence_step_queued",
  "call_started",
  "call_attempted",
  "call_copilot_session_completed",
  "manual_touch",
])

const PROTECTION_EVENT_TYPES = new Set([
  "relationship_cooled",
  "follow_up_completed",
  "executive_intervention_recommended",
  "operational_risk_detected",
  "conversation_risk_detected",
])

const GROWTH_EVENT_TYPES = new Set([
  "research_completed",
  "decision_maker_added",
  "sequence_enrollment_created",
  "lead_became_sales_ready",
])

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false
  return Date.parse(iso) <= Date.now()
}

function buildAction(partial: {
  id: string
  kind: GrowthCommandActionKind
  leadId: string
  companyName: string
  why: string
  ctaHref: string
  referenceId?: string | null
  impactInput?: Parameters<typeof computeCommandActionImpact>[0]
  revenueInput?: Parameters<typeof estimateRevenueInfluence>[0]
}): GrowthCommandAction {
  const impactInput = partial.impactInput ?? { kind: partial.kind }
  return {
    id: partial.id,
    kind: partial.kind,
    bossBattle: COMMAND_BOSS_BATTLE_FOR_KIND[partial.kind] ?? null,
    leadId: partial.leadId,
    companyName: partial.companyName,
    title: COMMAND_ACTION_LABELS[partial.kind],
    why: partial.why,
    impactScore: computeCommandActionImpact({ ...impactInput, kind: partial.kind }),
    effortMinutes: COMMAND_ACTION_EFFORT_MINUTES[partial.kind],
    revenueInfluence: estimateRevenueInfluence(partial.revenueInput ?? {}),
    ctaLabel: COMMAND_CTA_LABELS[partial.kind],
    ctaHref: partial.ctaHref,
    referenceId: partial.referenceId ?? null,
  }
}

export async function fetchGrowthCommandDashboard(admin: SupabaseClient): Promise<GrowthCommandDashboard> {
  const todayIso = startOfTodayIso()
  const now = new Date().toISOString()

  const [leadsRes, enrollmentsRes, stepsRes, outreachRes, copilotRes, timelineRes, researchCoverage, dealIntelligence] = await Promise.all([
    admin.schema("growth").from("leads").select(LEAD_SCAN_SELECT).limit(300),
    admin
      .schema("growth")
      .from("sequence_enrollments")
      .select("id, lead_id, status, enrollment_stalled, enrollment_health_score, current_step_order")
      .in("status", ["draft", "active", "paused"])
      .limit(100),
    admin
      .schema("growth")
      .from("sequence_enrollment_steps")
      .select("id, enrollment_id, lead_id, status, step_order, channel")
      .in("status", ["pending", "draft_created", "queued", "approved", "failed"])
      .limit(100),
    admin
      .schema("growth")
      .from("outreach_queue")
      .select("id, lead_id, status, channel, priority")
      .in("status", ["pending_approval", "draft"])
      .limit(80),
    admin
      .schema("growth")
      .from("call_copilot_sessions")
      .select("id, lead_id, status, summary_approved_at, disposition_approved_at")
      .in("status", ["pre_call", "in_call", "completed"])
      .limit(80),
    admin
      .schema("growth")
      .from("lead_timeline_events")
      .select("id, lead_id, event_type, title, occurred_at")
      .gte("occurred_at", todayIso)
      .order("occurred_at", { ascending: false })
      .limit(200),
    fetchProspectResearchCoverageSummary(admin),
    fetchDealIntelligenceDashboardSummary(admin).catch(() => ({
      qaMarker: "predictive-deal-intelligence-v1" as const,
      scoredOpportunities: 0,
      highProbabilityDeals: 0,
      criticalRiskDeals: 0,
      averageForecastConfidence: 0,
      dealsNeedingAction: 0,
      topRecommendedActions: [],
      averageCloseProbability: 0,
    })),
  ])

  if (leadsRes.error) throw new Error(leadsRes.error.message)

  const leads = ((leadsRes.data ?? []) as Array<Record<string, unknown>>).filter(
    (lead) => !["disqualified", "archived"].includes(lead.status as string),
  )
  const leadById = new Map(leads.map((lead) => [lead.id as string, lead]))
  const companyName = (leadId: string) => (leadById.get(leadId)?.company_name as string) ?? "Lead"

  const dealScoreByLead = new Map<
    string,
    { closeProbability: number; riskLevel: string | null; recommendedOperatorAction: string | null }
  >()
  try {
    const { data: dealScores } = await admin
      .schema("growth")
      .from("deal_intelligence_scores")
      .select("lead_id, close_probability, risk_level, recommended_operator_action")
      .eq("score_status", "active")
      .limit(300)
    for (const row of dealScores ?? []) {
      dealScoreByLead.set(row.lead_id as string, {
        closeProbability: Number(row.close_probability ?? 0),
        riskLevel: row.risk_level as string | null,
        recommendedOperatorAction: row.recommended_operator_action as string | null,
      })
    }
  } catch {
    // Schema may not be migrated yet — command center remains usable.
  }

  const actions: GrowthCommandAction[] = []

  for (const lead of leads) {
    const leadId = lead.id as string
    const dealScore = dealScoreByLead.get(leadId)
    const baseImpact = {
      executivePriorityTier: lead.executive_priority_tier as string | null,
      revenueTrajectory: lead.revenue_trajectory as string | null,
      revenueProbabilityScore: lead.revenue_probability_score as number | null,
      conversationUrgency: lead.conversation_urgency_level as string | null,
      overdueFollowUp: isOverdue(lead.follow_up_at as string | null),
      dealIntelligenceBoost: dealScore
        ? dealIntelligenceActionImpactBoost({
            dealCloseProbability: dealScore.closeProbability,
            dealRiskLevel: dealScore.riskLevel,
            recommendedOperatorAction: dealScore.recommendedOperatorAction as Parameters<
              typeof dealIntelligenceActionImpactBoost
            >[0]["recommendedOperatorAction"],
          })
        : 0,
    }
    const revenueInput = {
      revenueProbabilityScore: lead.revenue_probability_score as number | null,
      forecastContributionWeight: lead.forecast_contribution_weight as number | null,
      executivePriorityTier: lead.executive_priority_tier as string | null,
    }

    if (lead.executive_priority_tier === "executive_now") {
      actions.push(
        buildAction({
          id: `exec:${leadId}`,
          kind: "executive_intervention",
          leadId,
          companyName: lead.company_name as string,
          why: "Executive Now tier requires immediate leadership attention.",
          ctaHref: commandLeadFocusHref(leadId, "executive"),
          impactInput: baseImpact,
          revenueInput,
        }),
      )
    }

    const revenueRegression = isForecastRegression({
      previousScore: lead.revenue_probability_previous_score as number | null,
      currentScore: (lead.revenue_probability_score as number | null) ?? 0,
      previousTier: null,
      currentTier: (lead.revenue_probability_tier as string | null) ?? "unlikely",
      trajectory: (lead.revenue_trajectory as string | null) ?? "steady",
    })

    if (
      revenueRegression ||
      lead.revenue_trajectory === "at_risk" ||
      lead.revenue_probability_tier === "commit_candidate"
    ) {
      actions.push(
        buildAction({
          id: `rev:${leadId}`,
          kind: "revenue_rescue",
          leadId,
          companyName: lead.company_name as string,
          why: (lead.next_best_action_reason as string | null) ?? "Revenue trajectory needs operator rescue.",
          ctaHref: commandLeadFocusHref(leadId, "revenue"),
          impactInput: baseImpact,
          revenueInput,
        }),
      )
    }

    if (lead.conversation_urgency_level === "critical" || lead.conversation_urgency_level === "high") {
      actions.push(
        buildAction({
          id: `conv:${leadId}`,
          kind: "conversation_recovery",
          leadId,
          companyName: lead.company_name as string,
          why: "Conversation urgency is elevated.",
          ctaHref: commandLeadFocusHref(leadId, "conversation"),
          impactInput: baseImpact,
          revenueInput,
        }),
      )
    }

    if (lead.relationship_trend === "cooling") {
      actions.push(
        buildAction({
          id: `rel:${leadId}`,
          kind: "relationship_recovery",
          leadId,
          companyName: lead.company_name as string,
          why: "Relationship trend is cooling.",
          ctaHref: commandLeadFocusHref(leadId, "relationship"),
          impactInput: baseImpact,
          revenueInput,
        }),
      )
    }

    if (lead.decision_maker_status === "missing" || lead.decision_maker_status === "unknown") {
      actions.push(
        buildAction({
          id: `dm:${leadId}`,
          kind: "add_decision_maker",
          leadId,
          companyName: lead.company_name as string,
          why: "Decision maker coverage is incomplete.",
          ctaHref: commandLeadFocusHref(leadId, "decision-makers"),
          impactInput: baseImpact,
          revenueInput,
        }),
      )
    }

    const lastResearched = lead.last_researched_at as string | null
    const researchStale =
      !lastResearched || Date.now() - Date.parse(lastResearched) > 30 * 24 * 60 * 60 * 1000
    if (researchStale && (lead.next_best_action === "run_research" || lead.next_best_action === "refresh_research")) {
      actions.push(
        buildAction({
          id: `research:${leadId}`,
          kind: "run_research",
          leadId,
          companyName: lead.company_name as string,
          why: "Research is stale or recommended by NBA.",
          ctaHref: commandLeadFocusHref(leadId, "research"),
          impactInput: baseImpact,
          revenueInput,
        }),
      )
    }

    if (lead.operational_capacity_tier === "critical") {
      actions.push(
        buildAction({
          id: `cap:${leadId}`,
          kind: "capacity_action",
          leadId,
          companyName: lead.company_name as string,
          why: "Operational capacity is critical for this account.",
          ctaHref: commandLeadFocusHref(leadId, "capacity"),
          impactInput: baseImpact,
          revenueInput,
        }),
      )
    }

    if (isOverdue(lead.follow_up_at as string | null)) {
      actions.push(
        buildAction({
          id: `follow:${leadId}`,
          kind: "follow_up_now",
          leadId,
          companyName: lead.company_name as string,
          why: "Follow-up date is overdue.",
          ctaHref: commandLeadFocusHref(leadId, "command"),
          impactInput: baseImpact,
          revenueInput,
        }),
      )
    }
  }

  for (const row of enrollmentsRes.data ?? []) {
    const leadId = row.lead_id as string
    if (row.status === "draft") {
      actions.push(
        buildAction({
          id: `seq-confirm:${row.id}`,
          kind: "confirm_sequence",
          leadId,
          companyName: companyName(leadId),
          why: "Draft sequence is ready for confirmation.",
          ctaHref: commandLeadFocusHref(leadId, "sequence", row.id as string),
          referenceId: row.id as string,
          impactInput: { kind: "confirm_sequence", enrollmentStalled: row.enrollment_stalled as boolean },
        }),
      )
    }
  }

  for (const row of stepsRes.data ?? []) {
    const leadId = row.lead_id as string
    if (["draft_created", "queued", "approved", "pending"].includes(row.status as string)) {
      actions.push(
        buildAction({
          id: `seq-step:${row.id}`,
          kind: "queue_sequence_step",
          leadId,
          companyName: companyName(leadId),
          why: `Sequence step ${row.step_order} awaits operator approval.`,
          ctaHref: commandLeadFocusHref(leadId, "sequence", row.id as string),
          referenceId: row.id as string,
          impactInput: { kind: "queue_sequence_step" },
        }),
      )
    }
  }

  for (const row of outreachRes.data ?? []) {
    const leadId = row.lead_id as string
    actions.push(
      buildAction({
        id: `outreach:${row.id}`,
        kind: "approve_outreach",
        leadId,
        companyName: companyName(leadId),
        why: `${row.channel} outreach awaits human approval.`,
        ctaHref: commandOutreachHref(row.id as string),
        referenceId: row.id as string,
        impactInput: { kind: "approve_outreach" },
      }),
    )
  }

  for (const row of copilotRes.data ?? []) {
    const leadId = row.lead_id as string
    const needsFollowUp =
      row.status === "pre_call" ||
      row.status === "in_call" ||
      (row.status === "completed" && !row.summary_approved_at)
    if (needsFollowUp) {
      actions.push(
        buildAction({
          id: `copilot:${row.id}`,
          kind: "start_call_copilot",
          leadId,
          companyName: companyName(leadId),
          why: "Call Copilot session needs operator follow-through.",
          ctaHref: commandLeadFocusHref(leadId, "call-copilot", row.id as string),
          referenceId: row.id as string,
          impactInput: { kind: "start_call_copilot" },
        }),
      )
    }
  }

  const rankedActions = rankCommandActions(actions)
  const bossBattles = buildBossBattles(rankedActions)
  const heatMap = buildHeatMap(
    leads.map((lead) => ({
      id: lead.id as string,
      engagementTier: lead.engagement_tier as string | null,
      opportunityReadinessTier: lead.opportunity_readiness_tier as string | null,
      revenueProbabilityScore: lead.revenue_probability_score as number | null,
      conversationHealthTier: lead.conversation_health_tier as string | null,
      relationshipTrend: lead.relationship_trend as string | null,
      revenueTrajectory: lead.revenue_trajectory as string | null,
    })),
  )

  const timeline = timelineRes.data ?? []
  const todayEvents = timeline.map((row) => row.event_type as string)
  const todayStats = {
    actionsCompleted: todayEvents.filter((event) => EXECUTION_EVENT_TYPES.has(event)).length,
    sequencesAdvanced: todayEvents.filter((event) => event.startsWith("sequence_")).length,
    relationshipsRecovered: todayEvents.filter((event) => event === "follow_up_completed" || event === "relationship_became_trusted").length,
    forecastProtected: todayEvents.filter((event) => event === "lead_became_forecasted").length,
    researchCompleted: todayEvents.filter((event) => event === "research_completed").length,
    outreachExecuted: todayEvents.filter((event) => event === "outreach_executed").length,
  }

  const approvalsWaiting =
    (outreachRes.data?.length ?? 0) +
    (stepsRes.data?.filter((row) => ["draft_created", "queued", "approved", "pending"].includes(row.status as string)).length ?? 0)

  const revenueAtRisk = rankedActions.filter((action) => action.kind === "revenue_rescue").length
  const criticalActions = rankedActions.filter((action) => action.impactScore >= 85).length
  const stalledOpportunities =
    (enrollmentsRes.data?.filter((row) => row.enrollment_stalled).length ?? 0) +
    leads.filter((lead) => lead.workflow_health === "stalled").length

  const momentum = computeMomentumState({
    actionsCompletedToday: todayStats.actionsCompleted,
    approvalsWaiting,
    revenueAtRisk,
    criticalActions,
  })

  const operatorScore = computeOperatorScore({
    actionsCompleted: todayStats.actionsCompleted,
    sequencesAdvanced: todayStats.sequencesAdvanced,
    forecastProtected: todayStats.forecastProtected,
    relationshipsRecovered: todayStats.relationshipsRecovered,
    approvalsWaiting,
    executiveAlertsIgnored: Math.max(0, leads.filter((l) => l.executive_priority_tier === "executive_now").length - todayStats.actionsCompleted),
  })

  const operatorRankEntry =
    OPERATOR_RANK_THRESHOLDS.find((entry) => operatorScore >= entry.min) ??
    OPERATOR_RANK_THRESHOLDS[OPERATOR_RANK_THRESHOLDS.length - 1]!

  const winFeed = timeline
    .filter((row) => WIN_EVENT_TYPES.has(row.event_type as string))
    .slice(0, 12)
    .map((row) => ({
      id: row.id as string,
      label: row.title as string,
      companyName: companyName(row.lead_id as string),
      occurredAt: row.occurred_at as string,
    }))

  const comboChains = detectComboChains([todayEvents])
  const coachTips = buildCoachTips({
    approvalsWaiting,
    revenueRescueCount: revenueAtRisk,
    researchActions: rankedActions.filter((action) => action.kind === "run_research").length,
    executionActions: rankedActions.filter((action) =>
      ["approve_outreach", "start_call_copilot", "follow_up_now", "queue_sequence_step"].includes(action.kind),
    ).length,
    relationshipRecoveryCount: rankedActions.filter((action) => action.kind === "relationship_recovery").length,
    relationshipRecoveryCompleted: todayStats.relationshipsRecovered,
  })

  const executionCurrent = todayStats.actionsCompleted
  const protectionCurrent = todayStats.relationshipsRecovered + todayStats.forecastProtected
  const growthCurrent = todayStats.researchCompleted + todayStats.sequencesAdvanced

  const unassignedHighPriority = leads.filter(
    (lead) =>
      !lead.assigned_to &&
      (lead.executive_priority_tier === "executive_now" ||
        lead.executive_priority_tier === "priority" ||
        lead.call_priority_tier === "critical" ||
        lead.call_priority_tier === "high" ||
        (lead.score ?? 0) >= 70),
  ).length
  const ownershipGaps = leads.filter((lead) => !lead.assigned_to).length

  return {
    generatedAt: now,
    missionControl: {
      criticalActions,
      revenueAtRisk,
      approvalsWaiting,
      stalledOpportunities,
      pipelineProtected: protectionCurrent + growthCurrent,
      unassignedHighPriority,
      ownershipGaps,
      momentumState: momentum.state,
      momentumLabel: momentum.label,
    },
    topWinOpportunity: rankedActions[0] ?? null,
    actions: rankedActions.slice(0, 50),
    pipelineRings: {
      execution: { current: executionCurrent, target: 8, label: "Execution" },
      protection: { current: protectionCurrent, target: 5, label: "Protection" },
      growth: { current: growthCurrent, target: 5, label: "Growth" },
    },
    bossBattles,
    revenueRescueQueue: rankedActions.filter((action) => action.kind === "revenue_rescue").slice(0, 12),
    heatMap,
    operatorScore,
    operatorRank: operatorRankEntry.rank,
    operatorRankLabel: operatorRankEntry.label,
    comboChains,
    coachTips,
    winFeed,
    debrief: {
      impactScore: operatorScore,
      actionsCompleted: todayStats.actionsCompleted,
      sequencesAdvanced: todayStats.sequencesAdvanced,
      relationshipsRecovered: todayStats.relationshipsRecovered,
      pipelineProtected: protectionCurrent + growthCurrent,
      tomorrowTopActions: rankedActions.slice(0, 3),
    },
    todayStats,
    researchCoverage,
    dealIntelligence,
  }
}
