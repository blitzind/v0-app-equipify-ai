import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthAssignmentSettings } from "@/lib/growth/assignment/assignment-types"

type SettingsRow = {
  id: string
  round_robin_enabled: boolean
  industry_specialization_enabled: boolean
  territory_matching_enabled: boolean
  capacity_balancing_enabled: boolean
  priority_routing_enabled: boolean
  round_robin_cursor_user_id: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

const SELECT =
  "id, round_robin_enabled, industry_specialization_enabled, territory_matching_enabled, capacity_balancing_enabled, priority_routing_enabled, round_robin_cursor_user_id, updated_by, created_at, updated_at"

function settingsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("assignment_settings")
}

function mapRow(row: SettingsRow): GrowthAssignmentSettings {
  return {
    id: row.id,
    roundRobinEnabled: row.round_robin_enabled,
    industrySpecializationEnabled: row.industry_specialization_enabled,
    territoryMatchingEnabled: row.territory_matching_enabled,
    capacityBalancingEnabled: row.capacity_balancing_enabled,
    priorityRoutingEnabled: row.priority_routing_enabled,
    roundRobinCursorUserId: row.round_robin_cursor_user_id,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchGrowthAssignmentSettings(admin: SupabaseClient): Promise<GrowthAssignmentSettings> {
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

export async function updateGrowthAssignmentSettings(
  admin: SupabaseClient,
  input: Partial<{
    roundRobinEnabled: boolean
    industrySpecializationEnabled: boolean
    territoryMatchingEnabled: boolean
    capacityBalancingEnabled: boolean
    priorityRoutingEnabled: boolean
    roundRobinCursorUserId: string | null
    updatedBy: string
  }>,
): Promise<GrowthAssignmentSettings> {
  const existing = await fetchGrowthAssignmentSettings(admin)
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.roundRobinEnabled !== undefined) patch.round_robin_enabled = input.roundRobinEnabled
  if (input.industrySpecializationEnabled !== undefined) {
    patch.industry_specialization_enabled = input.industrySpecializationEnabled
  }
  if (input.territoryMatchingEnabled !== undefined) patch.territory_matching_enabled = input.territoryMatchingEnabled
  if (input.capacityBalancingEnabled !== undefined) patch.capacity_balancing_enabled = input.capacityBalancingEnabled
  if (input.priorityRoutingEnabled !== undefined) patch.priority_routing_enabled = input.priorityRoutingEnabled
  if (input.roundRobinCursorUserId !== undefined) patch.round_robin_cursor_user_id = input.roundRobinCursorUserId
  if (input.updatedBy !== undefined) patch.updated_by = input.updatedBy

  const { data, error } = await settingsTable(admin).update(patch).eq("id", existing.id).select(SELECT).single()
  if (error) throw new Error(error.message)
  return mapRow(data as SettingsRow)
}
