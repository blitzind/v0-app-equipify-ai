import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export type GrowthOutreachSettings = {
  id: string
  timezone: string
  businessHoursStartMinutes: number
  businessHoursEndMinutes: number
  respectBusinessHours: boolean
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

type SettingsRow = {
  id: string
  timezone: string
  business_hours_start_minutes: number
  business_hours_end_minutes: number
  respect_business_hours: boolean
  updated_by: string | null
  created_at: string
  updated_at: string
}

const SELECT =
  "id, timezone, business_hours_start_minutes, business_hours_end_minutes, respect_business_hours, updated_by, created_at, updated_at"

function settingsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("outreach_settings")
}

function mapRow(row: SettingsRow): GrowthOutreachSettings {
  return {
    id: row.id,
    timezone: row.timezone,
    businessHoursStartMinutes: row.business_hours_start_minutes,
    businessHoursEndMinutes: row.business_hours_end_minutes,
    respectBusinessHours: row.respect_business_hours,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchGrowthOutreachSettings(admin: SupabaseClient): Promise<GrowthOutreachSettings> {
  const { data, error } = await settingsTable(admin).select(SELECT).limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return mapRow(data as SettingsRow)

  const { data: inserted, error: insertError } = await settingsTable(admin)
    .insert({ singleton: true })
    .select(SELECT)
    .single()
  if (insertError) throw new Error(insertError.message)
  return mapRow(inserted as SettingsRow)
}

export async function updateGrowthOutreachSettings(
  admin: SupabaseClient,
  input: Partial<{
    timezone: string
    businessHoursStartMinutes: number
    businessHoursEndMinutes: number
    respectBusinessHours: boolean
    updatedBy: string
  }>,
): Promise<GrowthOutreachSettings> {
  const existing = await fetchGrowthOutreachSettings(admin)
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.timezone !== undefined) patch.timezone = input.timezone
  if (input.businessHoursStartMinutes !== undefined) patch.business_hours_start_minutes = input.businessHoursStartMinutes
  if (input.businessHoursEndMinutes !== undefined) patch.business_hours_end_minutes = input.businessHoursEndMinutes
  if (input.respectBusinessHours !== undefined) patch.respect_business_hours = input.respectBusinessHours
  if (input.updatedBy !== undefined) patch.updated_by = input.updatedBy

  const { data, error } = await settingsTable(admin).update(patch).eq("id", existing.id).select(SELECT).single()
  if (error) throw new Error(error.message)
  return mapRow(data as SettingsRow)
}
