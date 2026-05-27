import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthInboxAssignmentRule,
  GrowthInboxAssignmentRuleType,
  GrowthInboxAssignmentSettings,
} from "@/lib/growth/inbox-team-ownership/inbox-team-ownership-types"
import { maskInboxOwnerLabel } from "@/lib/growth/inbox-team-ownership/inbox-team-ownership-types"

type Row = Record<string, unknown>

function settingsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("inbox_assignment_settings")
}

function rulesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("inbox_assignment_rules")
}

function mapSettings(row: Row): GrowthInboxAssignmentSettings {
  return {
    id: String(row.id),
    autoAssignEnabled: Boolean(row.auto_assign_enabled),
    slaAlertsEnabled: Boolean(row.sla_alerts_enabled),
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapRule(row: Row, userLabels: Map<string, string>): GrowthInboxAssignmentRule {
  const targetUserId = row.target_user_id ? String(row.target_user_id) : null
  return {
    id: String(row.id),
    enabled: Boolean(row.enabled),
    priorityOrder: Number(row.priority_order ?? 100),
    ruleType: String(row.rule_type) as GrowthInboxAssignmentRuleType,
    classification: row.classification ? String(row.classification) : null,
    priorityTier: row.priority_tier ? String(row.priority_tier) : null,
    targetUserId,
    targetUserLabel: targetUserId ? userLabels.get(targetUserId) ?? maskInboxOwnerLabel(targetUserId) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

async function loadRepLabels(admin: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>()
  if (userIds.length === 0) return labels
  const { data } = await admin
    .schema("growth")
    .from("rep_roster")
    .select("user_id, display_name, email")
    .in("user_id", userIds)
  for (const row of data ?? []) {
    const record = row as Row
    const userId = String(record.user_id)
    labels.set(userId, maskInboxOwnerLabel(userId, String(record.display_name ?? ""), String(record.email ?? "")))
  }
  return labels
}

export async function fetchInboxAssignmentSettings(admin: SupabaseClient): Promise<GrowthInboxAssignmentSettings> {
  const { data, error } = await settingsTable(admin).select("*").limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return mapSettings(data as Row)

  const { data: inserted, error: insertError } = await settingsTable(admin)
    .insert({ singleton: true })
    .select("*")
    .single()
  if (insertError) throw new Error(insertError.message)
  return mapSettings(inserted as Row)
}

export async function updateInboxAssignmentSettings(
  admin: SupabaseClient,
  input: Partial<{ autoAssignEnabled: boolean; slaAlertsEnabled: boolean; updatedBy: string }>,
): Promise<GrowthInboxAssignmentSettings> {
  const existing = await fetchInboxAssignmentSettings(admin)
  const now = new Date().toISOString()
  const patch: Row = { updated_at: now }
  if (input.autoAssignEnabled !== undefined) patch.auto_assign_enabled = input.autoAssignEnabled
  if (input.slaAlertsEnabled !== undefined) patch.sla_alerts_enabled = input.slaAlertsEnabled
  if (input.updatedBy !== undefined) patch.updated_by = input.updatedBy

  const { data, error } = await settingsTable(admin).update(patch).eq("id", existing.id).select("*").single()
  if (error) throw new Error(error.message)
  return mapSettings(data as Row)
}

export async function listInboxAssignmentRules(admin: SupabaseClient): Promise<GrowthInboxAssignmentRule[]> {
  const { data, error } = await rulesTable(admin)
    .select("*")
    .order("priority_order", { ascending: true })
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)

  const userIds = [...new Set((data ?? []).map((row) => (row as Row).target_user_id).filter(Boolean).map(String))]
  const labels = await loadRepLabels(admin, userIds)
  return (data ?? []).map((row) => mapRule(row as Row, labels))
}

export async function upsertInboxAssignmentRules(
  admin: SupabaseClient,
  input: {
    settings?: Partial<{ autoAssignEnabled: boolean; slaAlertsEnabled: boolean; updatedBy: string }>
    rules?: Array<{
      id?: string
      enabled?: boolean
      priorityOrder?: number
      ruleType?: GrowthInboxAssignmentRuleType
      classification?: string | null
      priorityTier?: string | null
      targetUserId?: string | null
      metadata?: Record<string, unknown>
    }>
  },
): Promise<{ settings: GrowthInboxAssignmentSettings; rules: GrowthInboxAssignmentRule[] }> {
  const settings = input.settings
    ? await updateInboxAssignmentSettings(admin, input.settings)
    : await fetchInboxAssignmentSettings(admin)

  if (input.rules) {
    const now = new Date().toISOString()
    for (const rule of input.rules) {
      const row = {
        enabled: rule.enabled ?? true,
        priority_order: rule.priorityOrder ?? 100,
        rule_type: rule.ruleType ?? "lead_owner",
        classification: rule.classification ?? null,
        priority_tier: rule.priorityTier ?? null,
        target_user_id: rule.targetUserId ?? null,
        metadata: rule.metadata ?? {},
        updated_at: now,
      }
      if (rule.id) {
        const { error } = await rulesTable(admin).update(row).eq("id", rule.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await rulesTable(admin).insert({ ...row, created_at: now })
        if (error) throw new Error(error.message)
      }
    }
  }

  const rules = await listInboxAssignmentRules(admin)
  return { settings, rules }
}

export async function createInboxAssignmentRule(
  admin: SupabaseClient,
  input: {
    enabled?: boolean
    priorityOrder?: number
    ruleType?: GrowthInboxAssignmentRuleType
    classification?: string | null
    priorityTier?: string | null
    targetUserId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<GrowthInboxAssignmentRule> {
  const now = new Date().toISOString()
  const { data, error } = await rulesTable(admin)
    .insert({
      enabled: input.enabled ?? true,
      priority_order: input.priorityOrder ?? 100,
      rule_type: input.ruleType ?? "lead_owner",
      classification: input.classification ?? null,
      priority_tier: input.priorityTier ?? null,
      target_user_id: input.targetUserId ?? null,
      metadata: input.metadata ?? {},
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  const labels = input.targetUserId ? await loadRepLabels(admin, [input.targetUserId]) : new Map()
  return mapRule(data as Row, labels)
}
