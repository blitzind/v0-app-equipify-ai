import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getPlatformAdminEmails } from "@/lib/platform-admin-policy"
import type {
  GrowthAssignmentSettings,
  GrowthRepRosterEntry,
  GrowthRepStatus,
} from "@/lib/growth/assignment/assignment-types"

type RepRow = {
  id: string
  user_id: string
  email: string
  display_name: string | null
  status: string
  max_active_leads: number
  max_daily_new_assignments: number
  industries: string[] | null
  territories: string[] | null
  lead_types: string[] | null
  round_robin_order: number
  last_assigned_at: string | null
  created_at: string
  updated_at: string
}

const REP_SELECT =
  "id, user_id, email, display_name, status, max_active_leads, max_daily_new_assignments, industries, territories, lead_types, round_robin_order, last_assigned_at, created_at, updated_at"

function repTable(admin: SupabaseClient) {
  return admin.schema("growth").from("rep_roster")
}

function leadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

async function countActiveLeadsForRep(admin: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await leadsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("assigned_to", userId)
    .not("status", "in", '("archived","converted","disqualified")')

  if (error) throw new Error(error.message)
  return count ?? 0
}

async function countDailyAssignmentsForRep(admin: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await leadsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("assigned_to", userId)
    .gte("assigned_at", startOfTodayIso())

  if (error) throw new Error(error.message)
  return count ?? 0
}

function mapRepRow(
  row: RepRow,
  counts: { activeLeadCount: number; dailyAssignmentCount: number },
): GrowthRepRosterEntry {
  const isOverCapacity = counts.activeLeadCount >= row.max_active_leads
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    status: row.status as GrowthRepStatus,
    maxActiveLeads: row.max_active_leads,
    maxDailyNewAssignments: row.max_daily_new_assignments,
    industries: row.industries ?? [],
    territories: row.territories ?? [],
    leadTypes: row.lead_types ?? [],
    roundRobinOrder: row.round_robin_order,
    lastAssignedAt: row.last_assigned_at,
    activeLeadCount: counts.activeLeadCount,
    dailyAssignmentCount: counts.dailyAssignmentCount,
    isOverCapacity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function resolveAuthUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(error.message)
  const match = data.users.find((user) => user.email?.trim().toLowerCase() === normalized)
  return match?.id ?? null
}

export async function syncGrowthRepRosterFromPlatformAdmins(admin: SupabaseClient): Promise<void> {
  const emails = getPlatformAdminEmails()
  const existing = await listGrowthRepRosterRaw(admin)
  const existingByEmail = new Map(existing.map((row) => [row.email.trim().toLowerCase(), row]))

  for (let index = 0; index < emails.length; index += 1) {
    const email = emails[index]
    if (existingByEmail.has(email)) continue

    const userId = await resolveAuthUserIdByEmail(admin, email)
    if (!userId) continue

    const { error } = await repTable(admin).insert({
      user_id: userId,
      email,
      display_name: email.split("@")[0] ?? email,
      round_robin_order: index,
    })
    if (error && error.code !== "23505") throw new Error(error.message)
  }
}

async function listGrowthRepRosterRaw(admin: SupabaseClient): Promise<RepRow[]> {
  const { data, error } = await repTable(admin).select(REP_SELECT).order("round_robin_order", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as RepRow[]
}

export async function listGrowthRepRoster(admin: SupabaseClient): Promise<GrowthRepRosterEntry[]> {
  await syncGrowthRepRosterFromPlatformAdmins(admin)
  const rows = await listGrowthRepRosterRaw(admin)
  const enriched: GrowthRepRosterEntry[] = []

  for (const row of rows) {
    const [activeLeadCount, dailyAssignmentCount] = await Promise.all([
      countActiveLeadsForRep(admin, row.user_id),
      countDailyAssignmentsForRep(admin, row.user_id),
    ])
    enriched.push(mapRepRow(row, { activeLeadCount, dailyAssignmentCount }))
  }

  return enriched
}

export async function fetchGrowthRepByUserId(
  admin: SupabaseClient,
  userId: string,
): Promise<GrowthRepRosterEntry | null> {
  const { data, error } = await repTable(admin).select(REP_SELECT).eq("user_id", userId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as RepRow
  const [activeLeadCount, dailyAssignmentCount] = await Promise.all([
    countActiveLeadsForRep(admin, row.user_id),
    countDailyAssignmentsForRep(admin, row.user_id),
  ])
  return mapRepRow(row, { activeLeadCount, dailyAssignmentCount })
}

export async function updateGrowthRepRosterEntry(
  admin: SupabaseClient,
  userId: string,
  input: Partial<{
    status: GrowthRepStatus
    maxActiveLeads: number
    maxDailyNewAssignments: number
    industries: string[]
    territories: string[]
    leadTypes: string[]
    roundRobinOrder: number
    displayName: string | null
  }>,
): Promise<GrowthRepRosterEntry | null> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.status !== undefined) patch.status = input.status
  if (input.maxActiveLeads !== undefined) patch.max_active_leads = input.maxActiveLeads
  if (input.maxDailyNewAssignments !== undefined) patch.max_daily_new_assignments = input.maxDailyNewAssignments
  if (input.industries !== undefined) patch.industries = input.industries
  if (input.territories !== undefined) patch.territories = input.territories
  if (input.leadTypes !== undefined) patch.lead_types = input.leadTypes
  if (input.roundRobinOrder !== undefined) patch.round_robin_order = input.roundRobinOrder
  if (input.displayName !== undefined) patch.display_name = input.displayName

  const { data, error } = await repTable(admin).update(patch).eq("user_id", userId).select(REP_SELECT).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as RepRow
  const [activeLeadCount, dailyAssignmentCount] = await Promise.all([
    countActiveLeadsForRep(admin, row.user_id),
    countDailyAssignmentsForRep(admin, row.user_id),
  ])
  return mapRepRow(row, { activeLeadCount, dailyAssignmentCount })
}

export async function touchGrowthRepLastAssigned(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await repTable(admin)
    .update({ last_assigned_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId)
  if (error) throw new Error(error.message)
}

export async function resolveGrowthRepLabels(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))]
  if (unique.length === 0) return new Map()

  const { data, error } = await repTable(admin).select("user_id, email, display_name").in("user_id", unique)
  if (error) throw new Error(error.message)

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    const label = (row.display_name as string | null)?.trim() || (row.email as string)
    map.set(row.user_id as string, label)
  }
  return map
}
