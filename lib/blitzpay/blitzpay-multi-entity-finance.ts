import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { hashBlitzpayMultiEntityAudit } from "@/lib/blitzpay/blitzpay-multi-entity-audit"
import {
  mergePhase5aFromSnapshotsAndIntercompany,
  zeroPhase5aOrgReportingExtension,
  type BlitzpayPhase5aOrgReportingExtension,
} from "@/lib/blitzpay/blitzpay-consolidated-reporting"
import { sortIntercompanyBalancesDeterministic, type BlitzpayIntercompanyBalanceRow } from "@/lib/blitzpay/blitzpay-intercompany-balances"
import { ensureBlitzpayDefaultIntercompanyAccounts } from "@/lib/blitzpay/blitzpay-general-ledger-service"

export const BLITZPAY_MULTI_ENTITY_MAX_GROUPS = 5
export const BLITZPAY_MULTI_ENTITY_MEMBERS_PER_GROUP = 20
export const BLITZPAY_MULTI_ENTITY_MAX_DISTINCT_ORGS = 40
export const BLITZPAY_MULTI_ENTITY_LIST_CAP = 50
export const BLITZPAY_MULTI_ENTITY_IC_CAP = 200
export const BLITZPAY_MULTI_ENTITY_SNAPSHOT_LIST_CAP = 30
export const BLITZPAY_MULTI_ENTITY_AUDIT_LIST_CAP = 60

export type BlitzpayFinancialGroupRow = {
  id: string
  organization_id: string
  group_name: string
  group_type: string
  group_status: string
  parent_group_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type BlitzpayFinancialGroupMemberRow = {
  id: string
  financial_group_id: string
  organization_id: string
  membership_role: string
  member_status: string
  joined_at: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export async function insertBlitzpayMultiEntityAuditLog(
  admin: SupabaseClient,
  row: {
    financial_group_id?: string | null
    organization_id?: string | null
    audit_type:
      | "group_created"
      | "org_linked"
      | "org_removed"
      | "rollup_generated"
      | "intercompany_balance_created"
      | "intercompany_balance_settled"
      | "permissions_changed"
      | "manual_override"
    actor_type: "system" | "admin" | "user"
    actor_id?: string | null
    audit_summary: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const hash = hashBlitzpayMultiEntityAudit({
    audit_type: row.audit_type,
    financial_group_id: row.financial_group_id ?? null,
    organization_id: row.organization_id ?? null,
    audit_summary: row.audit_summary,
    actor_type: row.actor_type,
    actor_id: row.actor_id ?? null,
    metadata: row.metadata ?? {},
  })
  const { error } = await admin.from("blitzpay_multi_entity_audit_log").insert({
    financial_group_id: row.financial_group_id ?? null,
    organization_id: row.organization_id ?? null,
    audit_type: row.audit_type,
    actor_type: row.actor_type,
    actor_id: row.actor_id ?? null,
    audit_summary: row.audit_summary,
    immutable_hash: hash,
    metadata: row.metadata ?? {},
  })
  if (error) throw new Error(error.message)
}

export function assertAnchorOrgForGroupMutation(callerOrganizationId: string, group: { organization_id: string }): void {
  assertUuid(callerOrganizationId, "callerOrganizationId")
  if (group.organization_id !== callerOrganizationId) {
    throw new Error("multi_entity_anchor_required")
  }
}

export async function fetchFinancialGroupById(
  admin: SupabaseClient,
  groupId: string,
): Promise<BlitzpayFinancialGroupRow | null> {
  assertUuid(groupId, "groupId")
  const { data, error } = await admin.from("blitzpay_financial_groups").select("*").eq("id", groupId).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as BlitzpayFinancialGroupRow | null) ?? null
}

export async function assertGroupVisibleToOrganization(
  admin: SupabaseClient,
  callerOrganizationId: string,
  groupId: string,
): Promise<BlitzpayFinancialGroupRow> {
  const g = await fetchFinancialGroupById(admin, groupId)
  if (!g) throw new Error("multi_entity_group_not_found")
  if (g.organization_id === callerOrganizationId) return g
  const { data, error } = await admin
    .from("blitzpay_financial_group_members")
    .select("id")
    .eq("financial_group_id", groupId)
    .eq("organization_id", callerOrganizationId)
    .eq("member_status", "active")
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error("multi_entity_forbidden")
  return g
}

export async function listVisibleFinancialGroupsForOrganization(
  admin: SupabaseClient,
  organizationId: string,
): Promise<BlitzpayFinancialGroupRow[]> {
  assertUuid(organizationId, "organizationId")
  const { data: anchorRows, error: aErr } = await admin
    .from("blitzpay_financial_groups")
    .select("*")
    .eq("organization_id", organizationId)
    .neq("group_status", "archived")
    .order("created_at", { ascending: true })
    .limit(BLITZPAY_MULTI_ENTITY_MAX_GROUPS)
  if (aErr) throw new Error(aErr.message)

  const { data: memberRows, error: mErr } = await admin
    .from("blitzpay_financial_group_members")
    .select("financial_group_id")
    .eq("organization_id", organizationId)
    .eq("member_status", "active")
    .order("financial_group_id", { ascending: true })
    .limit(BLITZPAY_MULTI_ENTITY_LIST_CAP)
  if (mErr) throw new Error(mErr.message)

  const memberGroupIds = [...new Set((memberRows ?? []).map((r: { financial_group_id: string }) => r.financial_group_id))].sort(
    (x, y) => x.localeCompare(y),
  )

  let memberGroups: BlitzpayFinancialGroupRow[] = []
  if (memberGroupIds.length) {
    const { data: gRows, error: gErr } = await admin
      .from("blitzpay_financial_groups")
      .select("*")
      .in("id", memberGroupIds)
      .neq("group_status", "archived")
      .order("created_at", { ascending: true })
      .limit(BLITZPAY_MULTI_ENTITY_MAX_GROUPS)
    if (gErr) throw new Error(gErr.message)
    memberGroups = (gRows ?? []) as BlitzpayFinancialGroupRow[]
  }

  const merged = new Map<string, BlitzpayFinancialGroupRow>()
  for (const r of (anchorRows ?? []) as BlitzpayFinancialGroupRow[]) merged.set(r.id, r)
  for (const r of memberGroups) merged.set(r.id, r)
  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id)).slice(0, BLITZPAY_MULTI_ENTITY_MAX_GROUPS)
}

export async function listActiveMembersForGroup(
  admin: SupabaseClient,
  financialGroupId: string,
): Promise<BlitzpayFinancialGroupMemberRow[]> {
  assertUuid(financialGroupId, "financialGroupId")
  const { data, error } = await admin
    .from("blitzpay_financial_group_members")
    .select("*")
    .eq("financial_group_id", financialGroupId)
    .eq("member_status", "active")
    .order("organization_id", { ascending: true })
    .limit(BLITZPAY_MULTI_ENTITY_MEMBERS_PER_GROUP)
  if (error) throw new Error(error.message)
  return (data ?? []) as BlitzpayFinancialGroupMemberRow[]
}

export async function listFinancialGroupMembersVisible(
  admin: SupabaseClient,
  financialGroupId: string,
  limit = BLITZPAY_MULTI_ENTITY_LIST_CAP,
): Promise<BlitzpayFinancialGroupMemberRow[]> {
  assertUuid(financialGroupId, "financialGroupId")
  const lim = Math.min(BLITZPAY_MULTI_ENTITY_LIST_CAP, Math.max(1, Math.round(limit)))
  const { data, error } = await admin
    .from("blitzpay_financial_group_members")
    .select("*")
    .eq("financial_group_id", financialGroupId)
    .neq("member_status", "removed")
    .order("organization_id", { ascending: true })
    .limit(lim)
  if (error) throw new Error(error.message)
  return (data ?? []) as BlitzpayFinancialGroupMemberRow[]
}

export async function listIntercompanyBalancesForGroupIds(
  admin: SupabaseClient,
  groupIds: string[],
): Promise<BlitzpayIntercompanyBalanceRow[]> {
  if (!groupIds.length) return []
  const sorted = [...new Set(groupIds)].sort((a, b) => a.localeCompare(b))
  const { data, error } = await admin
    .from("blitzpay_intercompany_balances")
    .select("id, financial_group_id, source_organization_id, target_organization_id, balance_amount_cents, balance_status")
    .in("financial_group_id", sorted)
    .order("id", { ascending: true })
    .limit(BLITZPAY_MULTI_ENTITY_IC_CAP)
  if (error) throw new Error(error.message)
  return sortIntercompanyBalancesDeterministic((data ?? []) as BlitzpayIntercompanyBalanceRow[])
}

export async function buildPhase5aLinkedOrgReportingSlice(
  admin: SupabaseClient,
  organizationId: string,
  sinceIso: string | null,
): Promise<BlitzpayPhase5aOrgReportingExtension> {
  assertUuid(organizationId, "organizationId")
  const groups = await listVisibleFinancialGroupsForOrganization(admin, organizationId)
  if (!groups.length) return zeroPhase5aOrgReportingExtension()

  const orgSet = new Set<string>()
  orgSet.add(organizationId)
  for (const g of groups) {
    orgSet.add(g.organization_id)
    const members = await listActiveMembersForGroup(admin, g.id)
    for (const m of members) orgSet.add(m.organization_id)
  }
  const sortedOrgIds = [...orgSet].sort((a, b) => a.localeCompare(b)).slice(0, BLITZPAY_MULTI_ENTITY_MAX_DISTINCT_ORGS)

  const { fetchBlitzpayOrgReportingSnapshot } = await import("@/lib/blitzpay/blitzpay-reporting-snapshot")
  const snaps = []
  for (const oid of sortedOrgIds) {
    snaps.push(
      await fetchBlitzpayOrgReportingSnapshot(admin, oid, {
        sinceIso,
        skipMultiEntity: true,
      }),
    )
  }
  const pairs = sortedOrgIds.map((oid, i) => ({ oid, snap: snaps[i]! }))
  pairs.sort((a, b) => a.oid.localeCompare(b.oid))
  const orderedSnaps = pairs.map((p) => p.snap)

  const groupIds = groups.map((g) => g.id).sort((a, b) => a.localeCompare(b))
  const icRows = await listIntercompanyBalancesForGroupIds(admin, groupIds)
  return mergePhase5aFromSnapshotsAndIntercompany(orderedSnaps, icRows, sortedOrgIds.length)
}

export async function createFinancialGroup(
  admin: SupabaseClient,
  callerOrganizationId: string,
  input: { group_name: string; group_type: string; parent_group_id?: string | null; actorUserId?: string | null },
): Promise<BlitzpayFinancialGroupRow> {
  assertUuid(callerOrganizationId, "callerOrganizationId")
  await ensureBlitzpayDefaultIntercompanyAccounts(admin, callerOrganizationId)
  const { data, error } = await admin
    .from("blitzpay_financial_groups")
    .insert({
      organization_id: callerOrganizationId,
      group_name: input.group_name.trim().slice(0, 200),
      group_type: input.group_type,
      group_status: "active",
      parent_group_id: input.parent_group_id ?? null,
      metadata: {},
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  const row = data as BlitzpayFinancialGroupRow
  await insertBlitzpayMultiEntityAuditLog(admin, {
    financial_group_id: row.id,
    organization_id: callerOrganizationId,
    audit_type: "group_created",
    actor_type: input.actorUserId ? "user" : "system",
    actor_id: input.actorUserId ?? null,
    audit_summary: `Financial group created (${row.group_type}): ${row.group_name}`,
    metadata: { group_id: row.id },
  })
  return row
}

export async function addFinancialGroupMember(
  admin: SupabaseClient,
  callerOrganizationId: string,
  input: {
    financial_group_id: string
    member_organization_id: string
    membership_role: string
    actorUserId?: string | null
  },
): Promise<BlitzpayFinancialGroupMemberRow> {
  const group = await fetchFinancialGroupById(admin, input.financial_group_id)
  if (!group) throw new Error("multi_entity_group_not_found")
  assertAnchorOrgForGroupMutation(callerOrganizationId, group)
  assertUuid(input.member_organization_id, "member_organization_id")

  const { data, error } = await admin
    .from("blitzpay_financial_group_members")
    .upsert(
      {
        financial_group_id: group.id,
        organization_id: input.member_organization_id,
        membership_role: input.membership_role,
        member_status: "active",
        metadata: {},
      },
      { onConflict: "financial_group_id,organization_id" },
    )
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  const row = data as BlitzpayFinancialGroupMemberRow
  await insertBlitzpayMultiEntityAuditLog(admin, {
    financial_group_id: group.id,
    organization_id: input.member_organization_id,
    audit_type: "org_linked",
    actor_type: input.actorUserId ? "user" : "system",
    actor_id: input.actorUserId ?? null,
    audit_summary: `Organization linked to financial group as ${input.membership_role}`,
    metadata: { membership_id: row.id },
  })
  return row
}

export async function createIntercompanyBalance(
  admin: SupabaseClient,
  callerOrganizationId: string,
  input: {
    financial_group_id: string
    source_organization_id: string
    target_organization_id: string
    balance_type: string
    balance_amount_cents: number
    originating_entry_reference?: string | null
    settlement_due_date?: string | null
    actorUserId?: string | null
  },
): Promise<{ id: string }> {
  const group = await fetchFinancialGroupById(admin, input.financial_group_id)
  if (!group) throw new Error("multi_entity_group_not_found")
  assertAnchorOrgForGroupMutation(callerOrganizationId, group)
  if (input.source_organization_id === input.target_organization_id) {
    throw new Error("multi_entity_ic_distinct_orgs_required")
  }
  const cents = Math.max(0, Math.round(Number(input.balance_amount_cents)))
  const { data, error } = await admin
    .from("blitzpay_intercompany_balances")
    .insert({
      financial_group_id: group.id,
      source_organization_id: input.source_organization_id,
      target_organization_id: input.target_organization_id,
      balance_type: input.balance_type,
      balance_status: "active",
      balance_amount_cents: cents,
      originating_entry_reference: input.originating_entry_reference ?? null,
      settlement_due_date: input.settlement_due_date ?? null,
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  await insertBlitzpayMultiEntityAuditLog(admin, {
    financial_group_id: group.id,
    organization_id: callerOrganizationId,
    audit_type: "intercompany_balance_created",
    actor_type: input.actorUserId ? "user" : "system",
    actor_id: input.actorUserId ?? null,
    audit_summary: `Inter-company balance recorded (${input.balance_type})`,
    metadata: {
      intercompany_id: (data as { id: string }).id,
      source_organization_id: input.source_organization_id,
      target_organization_id: input.target_organization_id,
      balance_amount_cents: cents,
    },
  })
  return data as { id: string }
}

export async function listConsolidatedSnapshotsForGroups(
  admin: SupabaseClient,
  groupIds: string[],
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  if (!groupIds.length) return []
  const lim = Math.min(BLITZPAY_MULTI_ENTITY_SNAPSHOT_LIST_CAP, Math.max(1, Math.round(limit)))
  const sorted = [...new Set(groupIds)].sort((a, b) => a.localeCompare(b))
  const { data, error } = await admin
    .from("blitzpay_consolidated_snapshots")
    .select("*")
    .in("financial_group_id", sorted)
    .order("snapshot_date", { ascending: false })
    .limit(lim)
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<Record<string, unknown>>
}

export async function listSharedBenchmarksForGroups(
  admin: SupabaseClient,
  groupIds: string[],
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  if (!groupIds.length) return []
  const lim = Math.min(BLITZPAY_MULTI_ENTITY_LIST_CAP, Math.max(1, Math.round(limit)))
  const sorted = [...new Set(groupIds)].sort((a, b) => a.localeCompare(b))
  const { data, error } = await admin
    .from("blitzpay_shared_operational_benchmarks")
    .select("*")
    .in("financial_group_id", sorted)
    .order("created_at", { ascending: false })
    .limit(lim)
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<Record<string, unknown>>
}

export async function listMultiEntityAuditForOrganizationContext(
  admin: SupabaseClient,
  organizationId: string,
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  assertUuid(organizationId, "organizationId")
  const lim = Math.min(BLITZPAY_MULTI_ENTITY_AUDIT_LIST_CAP, Math.max(1, Math.round(limit)))
  const groups = await listVisibleFinancialGroupsForOrganization(admin, organizationId)
  const groupIds = groups.map((g) => g.id).sort((a, b) => a.localeCompare(b))

  const { data: byOrg, error: e1 } = await admin
    .from("blitzpay_multi_entity_audit_log")
    .select("id, financial_group_id, organization_id, audit_type, actor_type, audit_summary, immutable_hash, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(lim)
  if (e1) throw new Error(e1.message)

  let byGroup: Array<Record<string, unknown>> = []
  if (groupIds.length) {
    const { data: gRows, error: e2 } = await admin
      .from("blitzpay_multi_entity_audit_log")
      .select("id, financial_group_id, organization_id, audit_type, actor_type, audit_summary, immutable_hash, created_at")
      .in("financial_group_id", groupIds)
      .order("created_at", { ascending: false })
      .limit(lim)
    if (e2) throw new Error(e2.message)
    byGroup = (gRows ?? []) as Array<Record<string, unknown>>
  }

  const seen = new Set<string>()
  const merged: Array<Record<string, unknown>> = []
  for (const row of [...(byOrg ?? []), ...byGroup]) {
    const id = String((row as { id?: string }).id ?? "")
    if (!id || seen.has(id)) continue
    seen.add(id)
    merged.push(row)
  }
  merged.sort((a, b) => String((b as { created_at: string }).created_at).localeCompare(String((a as { created_at: string }).created_at)))
  return merged.slice(0, lim)
}

export async function buildMultiEntityHealthPayload(
  admin: SupabaseClient,
  organizationId: string,
  sinceIso: string | null,
): Promise<{
  phase5a: BlitzpayPhase5aOrgReportingExtension
  visibleGroupCount: number
  activeMemberOrgApprox: number
}> {
  const groups = await listVisibleFinancialGroupsForOrganization(admin, organizationId)
  const orgSet = new Set<string>()
  orgSet.add(organizationId)
  for (const g of groups) {
    orgSet.add(g.organization_id)
    const members = await listActiveMembersForGroup(admin, g.id)
    for (const m of members) orgSet.add(m.organization_id)
  }
  const phase5a = await buildPhase5aLinkedOrgReportingSlice(admin, organizationId, sinceIso)
  return {
    phase5a,
    visibleGroupCount: groups.length,
    activeMemberOrgApprox: orgSet.size,
  }
}
