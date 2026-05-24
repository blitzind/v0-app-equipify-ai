import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthOpportunityPipelineSettings } from "@/lib/growth/opportunity-pipeline/pipeline-settings-repository"
import type { GrowthOpportunityCommandSummary, GrowthOpportunityPipelineDashboard } from "@/lib/growth/opportunity-pipeline/pipeline-types"
import { GROWTH_OPPORTUNITY_PIPELINE_QA_MARKER } from "@/lib/growth/opportunity-pipeline/pipeline-types"

type OppRow = {
  id: string
  owner_user_id: string | null
  stage_key: string
  amount: number
  weighted_amount: number
  forecast_category: string
  risk_score: number
  is_stale: boolean
  age_days: number
  next_required_action: string | null
  closed_won_at: string | null
  closed_lost_at: string | null
}

function opportunitiesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("opportunities")
}

export async function fetchGrowthOpportunityPipelineDashboard(
  admin: SupabaseClient,
  ownerUserId?: string | null,
): Promise<GrowthOpportunityPipelineDashboard> {
  const settings = await fetchGrowthOpportunityPipelineSettings(admin)
  const { data, error } = await opportunitiesTable(admin).select(
    "id, owner_user_id, stage_key, amount, weighted_amount, forecast_category, risk_score, is_stale, age_days, next_required_action, closed_won_at, closed_lost_at",
  )
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as OppRow[]
  const openRows = rows.filter((row) => !row.closed_won_at && !row.closed_lost_at)
  const scopedOpen = ownerUserId ? openRows.filter((row) => row.owner_user_id === ownerUserId) : openRows

  const pipelineByStage = settings.stages
    .filter((stage) => !stage.isClosed)
    .map((stage) => {
      const stageRows = scopedOpen.filter((row) => row.stage_key === stage.key)
      return {
        stageKey: stage.key,
        stageLabel: stage.label,
        count: stageRows.length,
        amount: stageRows.reduce((sum, row) => sum + Number(row.amount), 0),
        weightedAmount: stageRows.reduce((sum, row) => sum + Number(row.weighted_amount), 0),
      }
    })

  const forecastTotals = {
    commit: { count: 0, amount: 0, weightedAmount: 0 },
    best_case: { count: 0, amount: 0, weightedAmount: 0 },
    pipeline: { count: 0, amount: 0, weightedAmount: 0 },
    omitted: { count: 0, amount: 0, weightedAmount: 0 },
  } as GrowthOpportunityPipelineDashboard["forecastTotals"]

  for (const row of scopedOpen) {
    const cat = row.forecast_category as keyof typeof forecastTotals
    if (!forecastTotals[cat]) continue
    forecastTotals[cat].count += 1
    forecastTotals[cat].amount += Number(row.amount)
    forecastTotals[cat].weightedAmount += Number(row.weighted_amount)
  }

  const wonRevenue = rows
    .filter((row) => row.closed_won_at)
    .reduce((sum, row) => sum + Number(row.amount), 0)
  const lostRevenue = rows
    .filter((row) => row.closed_lost_at)
    .reduce((sum, row) => sum + Number(row.amount), 0)

  const ownerMap = new Map<string | null, { openCount: number; wonAmount: number; weightedPipeline: number }>()
  for (const row of rows) {
    const key = row.owner_user_id
    const entry = ownerMap.get(key) ?? { openCount: 0, wonAmount: 0, weightedPipeline: 0 }
    if (!row.closed_won_at && !row.closed_lost_at) {
      entry.openCount += 1
      entry.weightedPipeline += Number(row.weighted_amount)
    }
    if (row.closed_won_at) entry.wonAmount += Number(row.amount)
    ownerMap.set(key, entry)
  }

  const dealsNeedingAction = scopedOpen.filter(
    (row) => row.is_stale || row.risk_score >= 50 || row.next_required_action,
  ).length

  return {
    qaMarker: GROWTH_OPPORTUNITY_PIPELINE_QA_MARKER,
    pipelineByStage,
    forecastTotals,
    weightedPipeline: scopedOpen.reduce((sum, row) => sum + Number(row.weighted_amount), 0),
    openPipeline: scopedOpen.reduce((sum, row) => sum + Number(row.amount), 0),
    wonRevenue,
    lostRevenue,
    averageDealAgeDays:
      scopedOpen.length > 0
        ? Math.round(scopedOpen.reduce((sum, row) => sum + row.age_days, 0) / scopedOpen.length)
        : 0,
    dealsNeedingAction,
    staleOpportunityCount: scopedOpen.filter((row) => row.is_stale).length,
    atRiskCount: scopedOpen.filter((row) => row.risk_score >= 40).length,
    ownerPerformance: Array.from(ownerMap.entries()).map(([ownerUserId, stats]) => ({
      ownerUserId,
      ...stats,
    })),
  }
}

export async function fetchGrowthOpportunityCommandSummary(
  admin: SupabaseClient,
): Promise<GrowthOpportunityCommandSummary> {
  const dashboard = await fetchGrowthOpportunityPipelineDashboard(admin)
  return {
    pipelineRiskCount: dashboard.atRiskCount,
    forecastCommit: dashboard.forecastTotals.commit.weightedAmount,
    forecastBestCase: dashboard.forecastTotals.best_case.weightedAmount,
    forecastPipeline: dashboard.forecastTotals.pipeline.weightedAmount,
    revenueMovementWon: dashboard.wonRevenue,
    revenueMovementLost: dashboard.lostRevenue,
    dealsNeedingAction: dashboard.dealsNeedingAction,
  }
}
