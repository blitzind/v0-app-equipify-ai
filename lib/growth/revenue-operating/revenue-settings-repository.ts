import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthRevenueForecastSettings } from "@/lib/growth/revenue-operating/revenue-operating-types"

type SettingsRow = {
  id: string
  monthly_goal: number
  quarterly_goal: number
  default_forecast_period: string
  stale_deal_threshold_days: number
  coverage_target_multiplier: number
  high_value_deal_threshold: number
  updated_by: string | null
  created_at: string
  updated_at: string
}

function settingsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("revenue_forecast_settings")
}

function mapRow(row: SettingsRow): GrowthRevenueForecastSettings {
  return {
    id: row.id,
    monthlyGoal: Number(row.monthly_goal),
    quarterlyGoal: Number(row.quarterly_goal),
    defaultForecastPeriod: row.default_forecast_period as GrowthRevenueForecastSettings["defaultForecastPeriod"],
    staleDealThresholdDays: row.stale_deal_threshold_days,
    coverageTargetMultiplier: Number(row.coverage_target_multiplier),
    highValueDealThreshold: Number(row.high_value_deal_threshold),
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchGrowthRevenueForecastSettings(
  admin: SupabaseClient,
): Promise<GrowthRevenueForecastSettings> {
  const { data, error } = await settingsTable(admin).select("*").eq("singleton", true).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) {
    const { data: inserted, error: insertError } = await settingsTable(admin)
      .insert({ singleton: true })
      .select("*")
      .single()
    if (insertError) throw new Error(insertError.message)
    return mapRow(inserted as SettingsRow)
  }
  return mapRow(data as SettingsRow)
}

export async function updateGrowthRevenueForecastSettings(
  admin: SupabaseClient,
  input: Partial<Omit<GrowthRevenueForecastSettings, "id" | "createdAt" | "updatedAt">> & {
    updatedBy?: string | null
  },
): Promise<GrowthRevenueForecastSettings> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.monthlyGoal != null) patch.monthly_goal = input.monthlyGoal
  if (input.quarterlyGoal != null) patch.quarterly_goal = input.quarterlyGoal
  if (input.defaultForecastPeriod) patch.default_forecast_period = input.defaultForecastPeriod
  if (input.staleDealThresholdDays != null) patch.stale_deal_threshold_days = input.staleDealThresholdDays
  if (input.coverageTargetMultiplier != null) patch.coverage_target_multiplier = input.coverageTargetMultiplier
  if (input.highValueDealThreshold != null) patch.high_value_deal_threshold = input.highValueDealThreshold
  if (input.updatedBy !== undefined) patch.updated_by = input.updatedBy

  const { data, error } = await settingsTable(admin).update(patch).eq("singleton", true).select("*").single()
  if (error) throw new Error(error.message)
  return mapRow(data as SettingsRow)
}
