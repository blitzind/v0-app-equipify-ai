import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthOpportunityPipelineSettings } from "@/lib/growth/opportunity-pipeline/pipeline-settings-repository"
import { evaluateGrowthOpportunityPipelineSignals } from "@/lib/growth/opportunity-pipeline/mutate-opportunity"
import {
  buildOpportunityFingerprint,
  computeGrowthRevenueForecastTotals,
  computeGrowthRevenueGoalPacing,
  computeGrowthRevenueOwnerScorecards,
  type OpportunityRollupRow,
} from "@/lib/growth/revenue-operating/revenue-forecast-rollup"
import { detectGrowthRevenueMovements } from "@/lib/growth/revenue-operating/revenue-movement-detector"
import {
  isDateInRange,
  periodUsesQuarterlyGoal,
  resolveGrowthRevenueDateRange,
} from "@/lib/growth/revenue-operating/revenue-date-ranges"
import { fetchGrowthRevenueForecastSettings } from "@/lib/growth/revenue-operating/revenue-settings-repository"
import type {
  GrowthOpportunityFingerprint,
  GrowthRevenueAttentionDeal,
  GrowthRevenueExecutiveCommandSummary,
  GrowthRevenueForecastPeriod,
  GrowthRevenueMovementEvent,
  GrowthRevenueOperatingDashboard,
} from "@/lib/growth/revenue-operating/revenue-operating-types"
import { GROWTH_REVENUE_OPERATING_QA_MARKER } from "@/lib/growth/revenue-operating/revenue-operating-types"
import {
  emitGrowthCommitRiskNotification,
  emitGrowthForecastGapNotification,
  emitGrowthOwnerPipelineOverloadedNotification,
  emitGrowthOwnerPipelineUnderloadedNotification,
  emitGrowthPipelineCoverageLowNotification,
  emitGrowthStaleHighValueDealNotification,
} from "@/lib/growth/revenue-operating/revenue-notification-integrations"
import {
  applyDealIntelligenceForecastAdjustment,
} from "@/lib/growth/deal-intelligence/deal-intelligence-forecast"
import {
  fetchGrowthDealIntelligenceDashboard,
} from "@/lib/growth/deal-intelligence/deal-intelligence-service"

function opportunitiesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("opportunities")
}

function snapshotsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("revenue_forecast_snapshots")
}

function movementsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("revenue_forecast_movements")
}

async function loadOpportunityRollupRows(admin: SupabaseClient): Promise<OpportunityRollupRow[]> {
  const pipelineSettings = await fetchGrowthOpportunityPipelineSettings(admin)
  const stageOrder = new Map(pipelineSettings.stages.map((stage) => [stage.key, stage.sortOrder]))

  const { data, error } = await opportunitiesTable(admin).select(
    "id, lead_id, owner_user_id, company_name, title, stage_key, amount, weighted_amount, probability, forecast_category, expected_close_date, risk_score, is_stale, age_days, stage_entered_at, closed_won_at, closed_lost_at, created_at",
  )
  if (error) throw new Error(error.message)

  return ((data ?? []) as Omit<OpportunityRollupRow, "stage_order">[]).map((row) => ({
    ...row,
    amount: Number(row.amount),
    weighted_amount: Number(row.weighted_amount),
    stage_order: stageOrder.get(row.stage_key) ?? 0,
  }))
}

async function loadFollowupsByOwner(admin: SupabaseClient): Promise<Map<string | null, number>> {
  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("assigned_to")
    .not("follow_up_at", "is", null)
    .lt("follow_up_at", now)
    .not("assigned_to", "is", null)
    .not("status", "in", '("archived","converted","disqualified")')

  if (error) throw new Error(error.message)

  const map = new Map<string | null, number>()
  for (const row of data ?? []) {
    const key = row.assigned_to as string
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

async function loadActivityGapsByOwner(admin: SupabaseClient): Promise<Map<string | null, number>> {
  const threshold = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await opportunitiesTable(admin)
    .select("owner_user_id")
    .is("closed_won_at", null)
    .is("closed_lost_at", null)
    .lt("last_activity_at", threshold)

  if (error) throw new Error(error.message)

  const map = new Map<string | null, number>()
  for (const row of data ?? []) {
    const key = row.owner_user_id as string | null
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

async function fetchLatestSnapshot(
  admin: SupabaseClient,
  periodKey: string,
): Promise<{ fingerprints: GrowthOpportunityFingerprint[]; totals: Record<string, number> } | null> {
  const { data, error } = await snapshotsTable(admin)
    .select("opportunity_fingerprints, totals")
    .eq("period_key", periodKey)
    .order("snapshot_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    fingerprints: (data.opportunity_fingerprints ?? []) as GrowthOpportunityFingerprint[],
    totals: (data.totals ?? {}) as Record<string, number>,
  }
}

async function persistSnapshot(
  admin: SupabaseClient,
  periodKey: string,
  fingerprints: GrowthOpportunityFingerprint[],
  totals: Record<string, number>,
): Promise<void> {
  const { error } = await snapshotsTable(admin).insert({
    period_key: periodKey,
    opportunity_fingerprints: fingerprints,
    totals,
    qa_marker: GROWTH_REVENUE_OPERATING_QA_MARKER,
  })
  if (error) throw new Error(error.message)

  const { data: oldSnapshots, error: listError } = await snapshotsTable(admin)
    .select("id")
    .eq("period_key", periodKey)
    .order("snapshot_at", { ascending: false })
    .range(5, 100)

  if (listError) throw new Error(listError.message)
  if (oldSnapshots?.length) {
    await snapshotsTable(admin).delete().in(
      "id",
      oldSnapshots.map((row) => row.id),
    )
  }
}

async function persistMovements(
  admin: SupabaseClient,
  movements: ReturnType<typeof detectGrowthRevenueMovements>,
): Promise<GrowthRevenueMovementEvent[]> {
  if (movements.length === 0) return []

  const rows = movements.slice(0, 50).map((movement) => ({
    movement_type: movement.movementType,
    opportunity_id: movement.opportunityId,
    lead_id: movement.leadId,
    title: movement.title,
    summary: movement.summary,
    metadata: movement.metadata,
  }))

  const { data, error } = await movementsTable(admin).insert(rows).select("*")
  if (error) throw new Error(error.message)

  return ((data ?? []) as Array<{
    id: string
    movement_type: string
    opportunity_id: string | null
    lead_id: string | null
    title: string
    summary: string
    metadata: Record<string, unknown>
    created_at: string
  }>).map((row) => ({
    id: row.id,
    movementType: row.movement_type as GrowthRevenueMovementEvent["movementType"],
    opportunityId: row.opportunity_id,
    leadId: row.lead_id,
    title: row.title,
    summary: row.summary,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }))
}

async function listRecentMovements(admin: SupabaseClient, limit = 20): Promise<GrowthRevenueMovementEvent[]> {
  const { data, error } = await movementsTable(admin)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return ((data ?? []) as Array<{
    id: string
    movement_type: string
    opportunity_id: string | null
    lead_id: string | null
    title: string
    summary: string
    metadata: Record<string, unknown>
    created_at: string
  }>).map((row) => ({
    id: row.id,
    movementType: row.movement_type as GrowthRevenueMovementEvent["movementType"],
    opportunityId: row.opportunity_id,
    leadId: row.lead_id,
    title: row.title,
    summary: row.summary,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }))
}

function toAttentionDeal(row: OpportunityRollupRow, reason: string): GrowthRevenueAttentionDeal {
  return {
    opportunityId: row.id,
    leadId: row.lead_id,
    companyName: row.company_name,
    title: row.title,
    amount: Number(row.amount),
    weightedAmount: Number(row.weighted_amount),
    reason,
    ownerUserId: row.owner_user_id,
  }
}

async function evaluateRevenueOperatingNotifications(input: {
  admin: SupabaseClient
  settings: Awaited<ReturnType<typeof fetchGrowthRevenueForecastSettings>>
  goalPacing: ReturnType<typeof computeGrowthRevenueGoalPacing>
  totals: ReturnType<typeof computeGrowthRevenueForecastTotals>
  ownerScorecards: ReturnType<typeof computeGrowthRevenueOwnerScorecards>
  staleHighValue: GrowthRevenueAttentionDeal[]
  period: GrowthRevenueForecastPeriod
}): Promise<void> {
  if (input.goalPacing.gapToGoal > 0 && input.goalPacing.activeGoal > 0) {
    await emitGrowthForecastGapNotification(input.admin, {
      gapToGoal: input.goalPacing.gapToGoal,
      activeGoal: input.goalPacing.activeGoal,
      periodLabel: periodUsesQuarterlyGoal(input.period) ? "quarter" : "month",
    })
  }

  const targetCoverage = input.settings.coverageTargetMultiplier
  if (input.goalPacing.coverageRatio < targetCoverage && input.goalPacing.activeGoal > 0) {
    await emitGrowthPipelineCoverageLowNotification(input.admin, {
      coverageRatio: input.goalPacing.coverageRatio,
      targetCoverage,
    })
  }

  if (
    input.totals.commitForecast > 0 &&
    input.totals.commitForecast < input.goalPacing.activeGoal * 0.5 &&
    input.goalPacing.activeGoal > 0
  ) {
    await emitGrowthCommitRiskNotification(input.admin, {
      commitForecast: input.totals.commitForecast,
      activeGoal: input.goalPacing.activeGoal,
    })
  }

  for (const deal of input.staleHighValue.slice(0, 10)) {
    await emitGrowthStaleHighValueDealNotification(input.admin, {
      opportunityId: deal.opportunityId,
      leadId: deal.leadId,
      companyName: deal.companyName,
      amount: deal.amount,
      ownerUserId: deal.ownerUserId,
    })
  }

  if (input.ownerScorecards.length >= 2) {
    const sorted = [...input.ownerScorecards].sort((a, b) => b.weightedPipeline - a.weightedPipeline)
    const max = sorted[0]
    const min = sorted[sorted.length - 1]
    if (max.weightedPipeline - min.weightedPipeline >= input.settings.highValueDealThreshold) {
      await emitGrowthOwnerPipelineOverloadedNotification(input.admin, {
        ownerUserId: max.ownerUserId,
        weightedPipeline: max.weightedPipeline,
      })
      await emitGrowthOwnerPipelineUnderloadedNotification(input.admin, {
        ownerUserId: min.ownerUserId,
        weightedPipeline: min.weightedPipeline,
      })
    }
  }
}

export async function recomputeGrowthRevenueOperatingDashboard(
  admin: SupabaseClient,
  input?: {
    period?: GrowthRevenueForecastPeriod
    customRange?: { start: string; end: string }
    refresh?: boolean
  },
): Promise<GrowthRevenueOperatingDashboard> {
  if (input?.refresh) {
    await evaluateGrowthOpportunityPipelineSignals(admin)
  }

  const settings = await fetchGrowthRevenueForecastSettings(admin)
  const pipelineSettings = await fetchGrowthOpportunityPipelineSettings(admin)
  const period = input?.period ?? settings.defaultForecastPeriod
  const range = resolveGrowthRevenueDateRange(period, new Date(), input?.customRange)
  const periodKey = `${period}:${range.start.toISOString().slice(0, 10)}:${range.end.toISOString().slice(0, 10)}`

  const rows = await loadOpportunityRollupRows(admin)
  const fingerprints = rows.map(buildOpportunityFingerprint)
  const previousSnapshot = await fetchLatestSnapshot(admin, periodKey)

  const pipelineCreated = previousSnapshot
    ? fingerprints.filter((row) => !previousSnapshot.fingerprints.some((prev) => prev.id === row.id) && !row.closedWon && !row.closedLost).length
    : 0
  const pipelineClosed = previousSnapshot
    ? fingerprints.filter((row) => {
        const prev = previousSnapshot.fingerprints.find((p) => p.id === row.id)
        return prev && !prev.closedWon && !prev.closedLost && (row.closedWon || row.closedLost)
      }).length
    : 0

  const totals = computeGrowthRevenueForecastTotals({
    rows,
    range,
    previousWeightedPipeline: previousSnapshot?.totals.weightedPipelineAmount,
    pipelineCreatedSinceSnapshot: pipelineCreated,
    pipelineClosedSinceSnapshot: pipelineClosed,
  })

  const goalPacing = computeGrowthRevenueGoalPacing({ totals, settings, period })
  totals.pipelineCoverageRatio = goalPacing.coverageRatio

  const followupsByOwner = await loadFollowupsByOwner(admin)
  const activityGapsByOwner = await loadActivityGapsByOwner(admin)
  const ownerScorecards = computeGrowthRevenueOwnerScorecards({
    rows,
    range,
    followupsByOwner,
    activityGapsByOwner,
  })

  const openInPeriod = rows.filter(
    (row) => !row.closed_won_at && !row.closed_lost_at && isDateInRange(row.expected_close_date, range),
  )

  const stageDistribution = pipelineSettings.stages
    .filter((stage) => !stage.isClosed)
    .map((stage) => {
      const stageRows = openInPeriod.filter((row) => row.stage_key === stage.key)
      return {
        stageKey: stage.key,
        stageLabel: stage.label,
        count: stageRows.length,
        weightedAmount: stageRows.reduce((sum, row) => sum + Number(row.weighted_amount), 0),
      }
    })

  const atRiskDeals = openInPeriod
    .filter((row) => row.risk_score >= 50)
    .slice(0, 15)
    .map((row) => toAttentionDeal(row, `At risk (score ${row.risk_score})`))

  const staleHighValueDeals = openInPeriod
    .filter((row) => row.is_stale && Number(row.amount) >= settings.highValueDealThreshold)
    .slice(0, 15)
    .map((row) => toAttentionDeal(row, "Stale high-value deal"))

  const dealsNeedingAction = openInPeriod
    .filter((row) => row.is_stale || row.risk_score >= 50 || row.expected_close_date && Date.parse(row.expected_close_date) < Date.now())
    .slice(0, 15)
    .map((row) => toAttentionDeal(row, "Needs executive attention"))

  const attentionFeed = [...atRiskDeals, ...staleHighValueDeals].slice(0, 20)

  let movements: GrowthRevenueMovementEvent[] = []
  if (input?.refresh && previousSnapshot) {
    const detected = detectGrowthRevenueMovements({
      previous: previousSnapshot.fingerprints,
      current: fingerprints,
    })
    movements = await persistMovements(admin, detected)
  } else {
    movements = await listRecentMovements(admin)
  }

  if (input?.refresh) {
    await persistSnapshot(admin, periodKey, fingerprints, {
      weightedPipelineAmount: totals.weightedPipelineAmount,
      commitForecast: totals.commitForecast,
      openPipelineAmount: totals.openPipelineAmount,
    })

    await evaluateRevenueOperatingNotifications({
      admin,
      settings,
      goalPacing,
      totals,
      ownerScorecards,
      staleHighValue: staleHighValueDeals,
      period,
    })
  }

  logGrowthEngine("revenue_operating_recomputed", {
    period,
    weightedPipeline: totals.weightedPipelineAmount,
    coverageRatio: goalPacing.coverageRatio,
    movementCount: movements.length,
  })

  let dealIntelligenceForecast = applyDealIntelligenceForecastAdjustment({
    baseForecastConfidence: goalPacing.forecastConfidence,
    averageDealForecastConfidence: 0,
    scoredOpportunities: 0,
    criticalRiskDeals: 0,
  })
  try {
    const dealSummary = await fetchGrowthDealIntelligenceDashboard(admin)
    dealIntelligenceForecast = applyDealIntelligenceForecastAdjustment({
      baseForecastConfidence: goalPacing.forecastConfidence,
      averageDealForecastConfidence: dealSummary.averageForecastConfidence,
      scoredOpportunities: dealSummary.scoredOpportunities,
      criticalRiskDeals: dealSummary.criticalRiskDeals,
    })
  } catch {
    // Deal intelligence schema optional until migration applied.
  }

  return {
    qaMarker: GROWTH_REVENUE_OPERATING_QA_MARKER,
    period,
    periodLabel: range.label,
    totals,
    goalPacing,
    ownerScorecards,
    stageDistribution,
    movements,
    atRiskDeals,
    staleHighValueDeals,
    dealsNeedingAction,
    attentionFeed,
    dealIntelligenceForecast,
  }
}

export async function fetchGrowthRevenueExecutiveCommandSummary(
  admin: SupabaseClient,
): Promise<GrowthRevenueExecutiveCommandSummary> {
  const dashboard = await recomputeGrowthRevenueOperatingDashboard(admin)
  const ownerGaps = dashboard.ownerScorecards.map((s) => Math.abs(s.weightedPipeline - s.commitForecast))
  const topOwnerGap = ownerGaps.length ? Math.max(...ownerGaps) : 0

  return {
    forecastToGoalRatio:
      dashboard.goalPacing.activeGoal > 0
        ? Math.round((dashboard.totals.weightedPipelineAmount / dashboard.goalPacing.activeGoal) * 100)
        : 0,
    pipelineCoverage: dashboard.goalPacing.coverageRatio,
    revenueRiskCount: dashboard.atRiskDeals.length + dashboard.dealsNeedingAction.length,
    topOwnerGap,
    highValueStaleCount: dashboard.staleHighValueDeals.length,
    commitForecast: dashboard.totals.commitForecast,
    activeGoal: dashboard.goalPacing.activeGoal,
  }
}
