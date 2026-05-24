import type {
  GrowthOpportunityFingerprint,
  GrowthRevenueForecastTotals,
  GrowthRevenueGoalPacing,
  GrowthRevenueOwnerScorecard,
} from "@/lib/growth/revenue-operating/revenue-operating-types"
import type { GrowthRevenueDateRange } from "@/lib/growth/revenue-operating/revenue-date-ranges"
import { isDateInRange, periodUsesQuarterlyGoal } from "@/lib/growth/revenue-operating/revenue-date-ranges"
import type { GrowthRevenueForecastSettings } from "@/lib/growth/revenue-operating/revenue-operating-types"
import type { GrowthRevenueForecastPeriod } from "@/lib/growth/revenue-operating/revenue-operating-types"

export type OpportunityRollupRow = {
  id: string
  lead_id: string
  owner_user_id: string | null
  company_name: string
  title: string
  stage_key: string
  stage_order: number
  amount: number
  weighted_amount: number
  probability: number
  forecast_category: string
  expected_close_date: string | null
  risk_score: number
  is_stale: boolean
  age_days: number
  stage_entered_at: string
  closed_won_at: string | null
  closed_lost_at: string | null
  created_at: string
}

function daysSince(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / (24 * 60 * 60 * 1000)))
}

export function buildOpportunityFingerprint(row: OpportunityRollupRow): GrowthOpportunityFingerprint {
  return {
    id: row.id,
    leadId: row.lead_id,
    companyName: row.company_name,
    amount: Number(row.amount),
    weightedAmount: Number(row.weighted_amount),
    stageKey: row.stage_key,
    stageOrder: row.stage_order,
    forecastCategory: row.forecast_category,
    expectedCloseDate: row.expected_close_date,
    riskScore: row.risk_score,
    isStale: row.is_stale,
    ownerUserId: row.owner_user_id,
    closedWon: Boolean(row.closed_won_at),
    closedLost: Boolean(row.closed_lost_at),
  }
}

export function computeGrowthRevenueForecastTotals(input: {
  rows: OpportunityRollupRow[]
  range: GrowthRevenueDateRange
  previousWeightedPipeline?: number
  pipelineCreatedSinceSnapshot?: number
  pipelineClosedSinceSnapshot?: number
  now?: Date
}): GrowthRevenueForecastTotals {
  const now = input.now ?? new Date()
  const open = input.rows.filter((row) => !row.closed_won_at && !row.closed_lost_at)
  const inPeriodOpen = open.filter((row) => isDateInRange(row.expected_close_date, input.range))

  const closedWon = input.rows.filter(
    (row) => row.closed_won_at && isDateInRange(row.closed_won_at, input.range),
  )
  const closedLost = input.rows.filter(
    (row) => row.closed_lost_at && isDateInRange(row.closed_lost_at, input.range),
  )

  const sumAmount = (list: OpportunityRollupRow[]) =>
    list.reduce((sum, row) => sum + Number(row.amount), 0)
  const sumWeighted = (list: OpportunityRollupRow[]) =>
    list.reduce((sum, row) => sum + Number(row.weighted_amount), 0)

  const byCategory = (cat: string) => inPeriodOpen.filter((row) => row.forecast_category === cat)

  const weightedPipeline = sumWeighted(inPeriodOpen)
  const previousWeighted = input.previousWeightedPipeline ?? weightedPipeline

  const staleRows = inPeriodOpen.filter((row) => row.is_stale)
  const atRiskRows = inPeriodOpen.filter((row) => row.risk_score >= 40)
  const overdueRows = inPeriodOpen.filter(
    (row) => row.expected_close_date && Date.parse(row.expected_close_date) < now.getTime(),
  )

  const avgProbability =
    inPeriodOpen.length > 0
      ? Math.round(inPeriodOpen.reduce((sum, row) => sum + row.probability, 0) / inPeriodOpen.length)
      : 0

  const avgDealAge =
    inPeriodOpen.length > 0
      ? Math.round(inPeriodOpen.reduce((sum, row) => sum + row.age_days, 0) / inPeriodOpen.length)
      : 0

  const avgStageAge =
    inPeriodOpen.length > 0
      ? Math.round(
          inPeriodOpen.reduce((sum, row) => sum + daysSince(row.stage_entered_at, now), 0) /
            inPeriodOpen.length,
        )
      : 0

  return {
    openPipelineAmount: sumAmount(inPeriodOpen),
    weightedPipelineAmount: weightedPipeline,
    commitForecast: sumWeighted(byCategory("commit")),
    bestCaseForecast: sumWeighted(byCategory("best_case")),
    pipelineForecast: sumWeighted(byCategory("pipeline")),
    omittedAmount: sumAmount(byCategory("omitted")),
    closedWonAmount: sumAmount(closedWon),
    closedLostAmount: sumAmount(closedLost),
    netNewPipeline: input.pipelineCreatedSinceSnapshot ?? 0,
    pipelineCreated: input.pipelineCreatedSinceSnapshot ?? 0,
    pipelineClosed: input.pipelineClosedSinceSnapshot ?? 0,
    forecastMovement: weightedPipeline - previousWeighted,
    pipelineCoverageRatio: 0,
    averageDealAgeDays: avgDealAge,
    averageStageAgeDays: avgStageAge,
    averageProbability: avgProbability,
    stalePipelineAmount: sumWeighted(staleRows),
    atRiskPipelineAmount: sumWeighted(atRiskRows),
    overdueCloseDateAmount: sumWeighted(overdueRows),
  }
}

export function computeGrowthRevenueGoalPacing(input: {
  totals: GrowthRevenueForecastTotals
  settings: GrowthRevenueForecastSettings
  period: GrowthRevenueForecastPeriod
}): GrowthRevenueGoalPacing {
  const useQuarter = periodUsesQuarterlyGoal(input.period)
  const activeGoal = useQuarter ? input.settings.quarterlyGoal : input.settings.monthlyGoal
  const weightedPipeline = input.totals.weightedPipelineAmount
  const coverageRatio =
    activeGoal > 0 ? Math.round((weightedPipeline / activeGoal) * 100) / 100 : weightedPipeline > 0 ? 999 : 0
  const gapToGoal = Math.max(0, activeGoal - weightedPipeline)
  const requiredPipeline = gapToGoal * input.settings.coverageTargetMultiplier

  const commitWeight = input.totals.commitForecast
  const bestCaseWeight = input.totals.bestCaseForecast
  const confidenceBase =
    weightedPipeline > 0
      ? Math.round(((commitWeight * 1.0 + bestCaseWeight * 0.7) / weightedPipeline) * 100)
      : 0
  const coverageBoost = Math.min(20, Math.round(coverageRatio * 10))
  const forecastConfidence = Math.min(100, Math.max(0, confidenceBase + coverageBoost))

  return {
    activeGoal,
    goalLabel: useQuarter ? "Quarterly goal" : "Monthly goal",
    weightedPipeline,
    coverageRatio,
    gapToGoal,
    requiredPipeline,
    forecastConfidence,
  }
}

export function computeGrowthRevenueOwnerScorecards(input: {
  rows: OpportunityRollupRow[]
  range: GrowthRevenueDateRange
  followupsByOwner: Map<string | null, number>
  activityGapsByOwner: Map<string | null, number>
  now?: Date
}): GrowthRevenueOwnerScorecard[] {
  const open = input.rows.filter((row) => !row.closed_won_at && !row.closed_lost_at)
  const inPeriod = open.filter((row) => isDateInRange(row.expected_close_date, input.range))
  const owners = new Set<string | null>(input.rows.map((row) => row.owner_user_id))

  return Array.from(owners).map((ownerUserId) => {
    const ownedOpen = inPeriod.filter((row) => row.owner_user_id === ownerUserId)
    const ownedAll = input.rows.filter((row) => row.owner_user_id === ownerUserId)
    const won = ownedAll.filter((row) => row.closed_won_at)
    const lost = ownedAll.filter((row) => row.closed_lost_at)

    const avgAge =
      ownedOpen.length > 0
        ? Math.round(ownedOpen.reduce((sum, row) => sum + row.age_days, 0) / ownedOpen.length)
        : 0

    return {
      ownerUserId,
      openPipeline: ownedOpen.reduce((sum, row) => sum + Number(row.amount), 0),
      weightedPipeline: ownedOpen.reduce((sum, row) => sum + Number(row.weighted_amount), 0),
      commitForecast: ownedOpen
        .filter((row) => row.forecast_category === "commit")
        .reduce((sum, row) => sum + Number(row.weighted_amount), 0),
      closedWon: won.reduce((sum, row) => sum + Number(row.amount), 0),
      closedLost: lost.reduce((sum, row) => sum + Number(row.amount), 0),
      opportunitiesOwned: ownedOpen.length,
      staleOpportunities: ownedOpen.filter((row) => row.is_stale).length,
      atRiskOpportunities: ownedOpen.filter((row) => row.risk_score >= 40).length,
      averageDealAgeDays: avgAge,
      followupsDue: input.followupsByOwner.get(ownerUserId) ?? 0,
      activityGapCount: input.activityGapsByOwner.get(ownerUserId) ?? 0,
    }
  })
}
