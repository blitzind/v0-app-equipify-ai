/** Operator scale forecasting (Phase 13G). */

import type {
  ApolloOperatorQueueStage,
  ApolloOperatorQueueThroughput,
  ApolloOperatorScaleForecastRow,
} from "@/lib/growth/apollo/apollo-operator-scale-types"
import { resolveApolloOperatorPrimaryBottleneck } from "@/lib/growth/apollo/apollo-operator-bottleneck-detector"
import type { ApolloOperatorBottleneckReport } from "@/lib/growth/apollo/apollo-operator-scale-types"

const FORECAST_COMPANY_TARGETS = [25, 50, 100, 250] as const
const AVG_REVIEW_MINUTES = 4
const BASELINE_COMPANIES = 1

export function buildApolloOperatorScaleForecast(input: {
  throughput: ApolloOperatorQueueThroughput[]
  bottlenecks: ApolloOperatorBottleneckReport
  baseline_companies?: number
  avg_review_minutes?: number
}): ApolloOperatorScaleForecastRow[] {
  const baseline = input.baseline_companies ?? BASELINE_COMPANIES
  const avgMinutes = input.avg_review_minutes ?? AVG_REVIEW_MINUTES
  const dailyItems = input.throughput.reduce((sum, row) => sum + row.items_created_per_day, 0)
  const itemsPerCompanyPerDay = baseline > 0 ? dailyItems / baseline : dailyItems
  const primaryBottleneck = resolveApolloOperatorPrimaryBottleneck(input.bottlenecks)

  return FORECAST_COMPANY_TARGETS.map((target_companies) => {
    const estimated_daily_queue_items = Math.round(itemsPerCompanyPerDay * target_companies * 10) / 10
    const estimated_approval_load_per_day = estimated_daily_queue_items
    const estimated_operator_hours_per_day =
      Math.round(((estimated_approval_load_per_day * avgMinutes) / 60) * 10) / 10

    return {
      target_companies,
      estimated_daily_queue_items,
      estimated_operator_hours_per_day,
      estimated_approval_load_per_day,
      primary_bottleneck_stage: primaryBottleneck,
    }
  })
}

export function estimateApolloOperatorCapacityItemsPerDay(
  throughput: ApolloOperatorQueueThroughput[],
): number {
  return Math.round(
    throughput.reduce((sum, row) => sum + row.items_approved_per_day, 0) * 10,
  ) / 10
}

export function estimateApolloOperatorCapacityAtCompanies(
  itemsPerDayPerCompany: number,
  companies: number,
): number {
  return Math.round(itemsPerDayPerCompany * companies * 10) / 10
}
