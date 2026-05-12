import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { hashBlitzpaySupplierNetworkAudit } from "@/lib/blitzpay/blitzpay-supplier-network-audit"
import {
  mergePhase5bFromAggregateContext,
  zeroPhase5bReportingExtension,
  type BlitzpayPhase5bReportingExtension,
} from "@/lib/blitzpay/blitzpay-procurement-benchmarks"
import { sumActiveBulkPurchaseSavingsCents, sumPreferredPricingOpportunityCents } from "@/lib/blitzpay/blitzpay-bulk-purchasing"
import { averageOverallScoresDeterministic } from "@/lib/blitzpay/blitzpay-vendor-performance"
import type { BlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"

export const BLITZPAY_SUPPLIER_NETWORK_MAX = 5
export const BLITZPAY_SUPPLIER_NETWORK_LIST_CAP = 50
export const BLITZPAY_SUPPLIER_NETWORK_BENCHMARK_CAP = 40
export const BLITZPAY_SUPPLIER_NETWORK_PROGRAM_CAP = 30
export const BLITZPAY_SUPPLIER_NETWORK_BULK_CAP = 30
export const BLITZPAY_SUPPLIER_NETWORK_PERF_CAP = 24
export const BLITZPAY_SUPPLIER_NETWORK_FINANCING_CAP = 40
export const BLITZPAY_SUPPLIER_NETWORK_AUDIT_LIST_CAP = 60

export type BlitzpaySupplierNetworkRow = {
  id: string
  organization_id: string
  network_name: string
  network_type: string
  network_status: string
  visibility_scope: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type BlitzpaySupplierNetworkMemberRow = {
  id: string
  supplier_network_id: string
  organization_id: string
  membership_role: string
  member_status: string
  joined_at: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export async function insertBlitzpaySupplierNetworkAuditLog(
  admin: SupabaseClient,
  row: {
    supplier_network_id?: string | null
    organization_id?: string | null
    audit_type:
      | "network_created"
      | "member_joined"
      | "member_removed"
      | "preferred_program_created"
      | "bulk_opportunity_created"
      | "financing_offer_created"
      | "benchmark_generated"
      | "manual_override"
    actor_type: "system" | "admin" | "user"
    actor_id?: string | null
    audit_summary: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const hash = hashBlitzpaySupplierNetworkAudit({
    audit_type: row.audit_type,
    supplier_network_id: row.supplier_network_id ?? null,
    organization_id: row.organization_id ?? null,
    audit_summary: row.audit_summary,
    actor_type: row.actor_type,
    actor_id: row.actor_id ?? null,
    metadata: row.metadata ?? {},
  })
  const { error } = await admin.from("blitzpay_supplier_network_audit_log").insert({
    supplier_network_id: row.supplier_network_id ?? null,
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

export async function fetchSupplierNetworkById(
  admin: SupabaseClient,
  networkId: string,
): Promise<BlitzpaySupplierNetworkRow | null> {
  assertUuid(networkId, "networkId")
  const { data, error } = await admin.from("blitzpay_supplier_networks").select("*").eq("id", networkId).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as BlitzpaySupplierNetworkRow | null) ?? null
}

export async function assertSupplierNetworkVisibleToOrganization(
  admin: SupabaseClient,
  callerOrganizationId: string,
  networkId: string,
): Promise<BlitzpaySupplierNetworkRow> {
  const n = await fetchSupplierNetworkById(admin, networkId)
  if (!n) throw new Error("supplier_network_not_found")
  if (n.organization_id === callerOrganizationId) return n
  const { data, error } = await admin
    .from("blitzpay_supplier_network_members")
    .select("id")
    .eq("supplier_network_id", networkId)
    .eq("organization_id", callerOrganizationId)
    .eq("member_status", "active")
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error("supplier_network_forbidden")
  return n
}

export function assertAnchorOrgForSupplierNetworkMutation(callerOrganizationId: string, network: { organization_id: string }): void {
  assertUuid(callerOrganizationId, "callerOrganizationId")
  if (network.organization_id !== callerOrganizationId) {
    throw new Error("supplier_network_anchor_required")
  }
}

export async function listVisibleSupplierNetworksForOrganization(
  admin: SupabaseClient,
  organizationId: string,
): Promise<BlitzpaySupplierNetworkRow[]> {
  assertUuid(organizationId, "organizationId")
  const { data: anchorRows, error: aErr } = await admin
    .from("blitzpay_supplier_networks")
    .select("*")
    .eq("organization_id", organizationId)
    .neq("network_status", "archived")
    .order("created_at", { ascending: true })
    .limit(BLITZPAY_SUPPLIER_NETWORK_MAX)
  if (aErr) throw new Error(aErr.message)

  const { data: memberRows, error: mErr } = await admin
    .from("blitzpay_supplier_network_members")
    .select("supplier_network_id")
    .eq("organization_id", organizationId)
    .eq("member_status", "active")
    .order("supplier_network_id", { ascending: true })
    .limit(BLITZPAY_SUPPLIER_NETWORK_LIST_CAP)
  if (mErr) throw new Error(mErr.message)

  const ids = [...new Set((memberRows ?? []).map((r: { supplier_network_id: string }) => r.supplier_network_id))].sort(
    (x, y) => x.localeCompare(y),
  )
  let memberNets: BlitzpaySupplierNetworkRow[] = []
  if (ids.length) {
    const { data: nets, error: nErr } = await admin
      .from("blitzpay_supplier_networks")
      .select("*")
      .in("id", ids)
      .neq("network_status", "archived")
      .order("created_at", { ascending: true })
      .limit(BLITZPAY_SUPPLIER_NETWORK_MAX)
    if (nErr) throw new Error(nErr.message)
    memberNets = (nets ?? []) as BlitzpaySupplierNetworkRow[]
  }

  const merged = new Map<string, BlitzpaySupplierNetworkRow>()
  for (const r of (anchorRows ?? []) as BlitzpaySupplierNetworkRow[]) merged.set(r.id, r)
  for (const r of memberNets) merged.set(r.id, r)
  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id)).slice(0, BLITZPAY_SUPPLIER_NETWORK_MAX)
}

export async function listSupplierNetworkMembersVisible(
  admin: SupabaseClient,
  supplierNetworkId: string,
  limit = BLITZPAY_SUPPLIER_NETWORK_LIST_CAP,
): Promise<BlitzpaySupplierNetworkMemberRow[]> {
  assertUuid(supplierNetworkId, "supplierNetworkId")
  const lim = Math.min(BLITZPAY_SUPPLIER_NETWORK_LIST_CAP, Math.max(1, Math.round(limit)))
  const { data, error } = await admin
    .from("blitzpay_supplier_network_members")
    .select("*")
    .eq("supplier_network_id", supplierNetworkId)
    .neq("member_status", "removed")
    .order("organization_id", { ascending: true })
    .limit(lim)
  if (error) throw new Error(error.message)
  return (data ?? []) as BlitzpaySupplierNetworkMemberRow[]
}

export async function countActiveMembershipsForOrganizationOnNetworks(
  admin: SupabaseClient,
  organizationId: string,
  networkIds: string[],
): Promise<number> {
  if (!networkIds.length) return 0
  const sorted = [...new Set(networkIds)].sort((a, b) => a.localeCompare(b))
  const { count, error } = await admin
    .from("blitzpay_supplier_network_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("member_status", "active")
    .in("supplier_network_id", sorted)
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function createSupplierNetwork(
  admin: SupabaseClient,
  callerOrganizationId: string,
  input: { network_name: string; network_type: string; visibility_scope?: string; actorUserId?: string | null },
): Promise<BlitzpaySupplierNetworkRow> {
  assertUuid(callerOrganizationId, "callerOrganizationId")
  const { data, error } = await admin
    .from("blitzpay_supplier_networks")
    .insert({
      organization_id: callerOrganizationId,
      network_name: input.network_name.trim().slice(0, 200),
      network_type: input.network_type,
      network_status: "active",
      visibility_scope: input.visibility_scope ?? "private",
      metadata: {},
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  const row = data as BlitzpaySupplierNetworkRow
  await insertBlitzpaySupplierNetworkAuditLog(admin, {
    supplier_network_id: row.id,
    organization_id: callerOrganizationId,
    audit_type: "network_created",
    actor_type: input.actorUserId ? "user" : "system",
    actor_id: input.actorUserId ?? null,
    audit_summary: `Supplier network created (${row.network_type}): ${row.network_name}`,
    metadata: { network_id: row.id },
  })
  return row
}

export async function addSupplierNetworkMember(
  admin: SupabaseClient,
  callerOrganizationId: string,
  input: {
    supplier_network_id: string
    member_organization_id: string
    membership_role: string
    actorUserId?: string | null
  },
): Promise<BlitzpaySupplierNetworkMemberRow> {
  const network = await fetchSupplierNetworkById(admin, input.supplier_network_id)
  if (!network) throw new Error("supplier_network_not_found")
  assertAnchorOrgForSupplierNetworkMutation(callerOrganizationId, network)
  assertUuid(input.member_organization_id, "member_organization_id")
  const { data, error } = await admin
    .from("blitzpay_supplier_network_members")
    .upsert(
      {
        supplier_network_id: network.id,
        organization_id: input.member_organization_id,
        membership_role: input.membership_role,
        member_status: "active",
        metadata: {},
      },
      { onConflict: "supplier_network_id,organization_id" },
    )
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  const row = data as BlitzpaySupplierNetworkMemberRow
  await insertBlitzpaySupplierNetworkAuditLog(admin, {
    supplier_network_id: network.id,
    organization_id: input.member_organization_id,
    audit_type: "member_joined",
    actor_type: input.actorUserId ? "user" : "system",
    actor_id: input.actorUserId ?? null,
    audit_summary: `Organization joined supplier network as ${input.membership_role}`,
    metadata: { membership_id: row.id },
  })
  return row
}

export async function createPreferredVendorProgram(
  admin: SupabaseClient,
  callerOrganizationId: string,
  input: {
    supplier_network_id?: string | null
    vendor_id: string
    program_name: string
    pricing_structure: string
    estimated_savings_basis_points?: number | null
    minimum_volume_cents?: number | null
    effective_start_date?: string | null
    effective_end_date?: string | null
    actorUserId?: string | null
  },
): Promise<{ id: string }> {
  assertUuid(input.vendor_id, "vendor_id")
  const { data: vrow, error: vErr } = await admin
    .from("blitzpay_vendors")
    .select("organization_id")
    .eq("id", input.vendor_id)
    .maybeSingle()
  if (vErr) throw new Error(vErr.message)
  const vOrg = (vrow as { organization_id: string } | null)?.organization_id
  if (!vOrg) throw new Error("vendor_not_found")
  if (input.supplier_network_id) {
    const net = await fetchSupplierNetworkById(admin, input.supplier_network_id)
    if (!net) throw new Error("supplier_network_not_found")
    assertAnchorOrgForSupplierNetworkMutation(callerOrganizationId, net)
    if (vOrg !== callerOrganizationId) throw new Error("supplier_network_vendor_org_mismatch")
  } else if (vOrg !== callerOrganizationId) {
    throw new Error("supplier_network_vendor_org_mismatch")
  }

  const { data, error } = await admin
    .from("blitzpay_preferred_vendor_programs")
    .insert({
      supplier_network_id: input.supplier_network_id ?? null,
      vendor_id: input.vendor_id,
      program_name: input.program_name.trim().slice(0, 200),
      program_status: "active",
      pricing_structure: input.pricing_structure,
      estimated_savings_basis_points: input.estimated_savings_basis_points ?? null,
      minimum_volume_cents: input.minimum_volume_cents ?? null,
      effective_start_date: input.effective_start_date ?? null,
      effective_end_date: input.effective_end_date ?? null,
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  await insertBlitzpaySupplierNetworkAuditLog(admin, {
    supplier_network_id: input.supplier_network_id ?? null,
    organization_id: callerOrganizationId,
    audit_type: "preferred_program_created",
    actor_type: input.actorUserId ? "user" : "system",
    actor_id: input.actorUserId ?? null,
    audit_summary: `Preferred vendor program created: ${input.program_name}`,
    metadata: { program_id: (data as { id: string }).id, vendor_id: input.vendor_id },
  })
  return data as { id: string }
}

export async function createBulkPurchaseOpportunity(
  admin: SupabaseClient,
  callerOrganizationId: string,
  input: {
    supplier_network_id: string
    opportunity_type: string
    estimated_total_volume_cents?: number | null
    estimated_savings_cents?: number | null
    participating_organization_count?: number | null
    expiration_date?: string | null
    actorUserId?: string | null
  },
): Promise<{ id: string }> {
  const net = await fetchSupplierNetworkById(admin, input.supplier_network_id)
  if (!net) throw new Error("supplier_network_not_found")
  assertAnchorOrgForSupplierNetworkMutation(callerOrganizationId, net)
  const { data, error } = await admin
    .from("blitzpay_bulk_purchase_opportunities")
    .insert({
      supplier_network_id: net.id,
      opportunity_status: "active",
      opportunity_type: input.opportunity_type,
      estimated_total_volume_cents: input.estimated_total_volume_cents ?? null,
      estimated_savings_cents: input.estimated_savings_cents ?? null,
      participating_organization_count: input.participating_organization_count ?? null,
      expiration_date: input.expiration_date ?? null,
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  await insertBlitzpaySupplierNetworkAuditLog(admin, {
    supplier_network_id: net.id,
    organization_id: callerOrganizationId,
    audit_type: "bulk_opportunity_created",
    actor_type: input.actorUserId ? "user" : "system",
    actor_id: input.actorUserId ?? null,
    audit_summary: `Bulk purchase opportunity created (${input.opportunity_type})`,
    metadata: { opportunity_id: (data as { id: string }).id },
  })
  return data as { id: string }
}

export async function createVendorFinancingNetworkOffer(
  admin: SupabaseClient,
  callerOrganizationId: string,
  input: {
    supplier_network_id?: string | null
    vendor_id?: string | null
    financing_type: string
    estimated_financing_capacity_cents?: number | null
    estimated_cost_basis_points?: number | null
    estimated_term_days?: number | null
    actorUserId?: string | null
  },
): Promise<{ id: string }> {
  if (!input.supplier_network_id && !input.vendor_id) throw new Error("supplier_network_offer_ref_required")
  if (input.supplier_network_id) {
    const net = await fetchSupplierNetworkById(admin, input.supplier_network_id)
    if (!net) throw new Error("supplier_network_not_found")
    assertAnchorOrgForSupplierNetworkMutation(callerOrganizationId, net)
  }
  if (input.vendor_id) {
    const { data: vrow, error: vErr } = await admin
      .from("blitzpay_vendors")
      .select("organization_id")
      .eq("id", input.vendor_id)
      .maybeSingle()
    if (vErr) throw new Error(vErr.message)
    const vOrg = (vrow as { organization_id: string } | null)?.organization_id
    if (!vOrg || vOrg !== callerOrganizationId) throw new Error("supplier_network_vendor_org_mismatch")
  }
  const { data, error } = await admin
    .from("blitzpay_vendor_financing_network_offers")
    .insert({
      supplier_network_id: input.supplier_network_id ?? null,
      vendor_id: input.vendor_id ?? null,
      offer_status: "active",
      financing_type: input.financing_type,
      estimated_financing_capacity_cents: input.estimated_financing_capacity_cents ?? null,
      estimated_cost_basis_points: input.estimated_cost_basis_points ?? null,
      estimated_term_days: input.estimated_term_days ?? null,
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  await insertBlitzpaySupplierNetworkAuditLog(admin, {
    supplier_network_id: input.supplier_network_id ?? null,
    organization_id: callerOrganizationId,
    audit_type: "financing_offer_created",
    actor_type: input.actorUserId ? "user" : "system",
    actor_id: input.actorUserId ?? null,
    audit_summary: `Vendor financing network offer created (${input.financing_type})`,
    metadata: { offer_id: (data as { id: string }).id },
  })
  return data as { id: string }
}

async function loadPreferredProgramRowsForReporting(
  admin: SupabaseClient,
  organizationId: string,
  networkIds: string[],
): Promise<
  Array<{
    estimated_savings_basis_points: number | null
    minimum_volume_cents: number | null
    program_status: string
    id?: string
  }>
> {
  const out: Array<{
    estimated_savings_basis_points: number | null
    minimum_volume_cents: number | null
    program_status: string
    id?: string
  }> = []
  const seen = new Set<string>()
  if (networkIds.length) {
    const { data: pr, error } = await admin
      .from("blitzpay_preferred_vendor_programs")
      .select("id, estimated_savings_basis_points, minimum_volume_cents, program_status")
      .in("supplier_network_id", networkIds)
      .limit(BLITZPAY_SUPPLIER_NETWORK_PROGRAM_CAP)
    if (!error) {
      for (const r of pr ?? []) {
        const id = String((r as { id: string }).id)
        if (seen.has(id)) continue
        seen.add(id)
        out.push(r as (typeof out)[0])
      }
    }
  }
  const { data: vid } = await admin.from("blitzpay_vendors").select("id").eq("organization_id", organizationId).limit(50)
  const vids = (vid ?? []).map((x: { id: string }) => x.id)
  if (vids.length) {
    const { data: pr3, error: e3 } = await admin
      .from("blitzpay_preferred_vendor_programs")
      .select("id, estimated_savings_basis_points, minimum_volume_cents, program_status")
      .is("supplier_network_id", null)
      .in("vendor_id", vids)
      .limit(BLITZPAY_SUPPLIER_NETWORK_PROGRAM_CAP)
    if (!e3) {
      for (const r of pr3 ?? []) {
        const id = String((r as { id: string }).id)
        if (seen.has(id)) continue
        seen.add(id)
        out.push(r as (typeof out)[0])
      }
    }
  }
  return out.sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

export async function buildPhase5bSupplierNetworkReportingSlice(
  admin: SupabaseClient,
  organizationId: string,
  snapshot: Pick<
    BlitzpayOrgReportingSnapshot,
    | "rebateOpportunityCents"
    | "totalInventoryValueCents"
    | "procurementTreasuryImpactScore"
    | "inventoryTurnoverScore"
    | "inventoryMarginHealthScore"
    | "reorderExposureCents"
    | "payableAgingHealthScore"
    | "vendorConcentrationRisk"
    | "treasuryCoverageForPayables"
  >,
): Promise<BlitzpayPhase5bReportingExtension> {
  assertUuid(organizationId, "organizationId")
  try {
    const networks = await listVisibleSupplierNetworksForOrganization(admin, organizationId)
    const networkIds = networks.map((n) => n.id).sort((a, b) => a.localeCompare(b))
    const activeMembershipRows = await countActiveMembershipsForOrganizationOnNetworks(admin, organizationId, networkIds)

    let benchmarkRows: Array<{ benchmark_score: number | null; benchmark_type?: string }> = []
    if (networkIds.length) {
      const { data: br, error: bErr } = await admin
        .from("blitzpay_shared_procurement_benchmarks")
        .select("benchmark_score, benchmark_type, id")
        .in("supplier_network_id", networkIds)
        .order("id", { ascending: true })
        .limit(BLITZPAY_SUPPLIER_NETWORK_BENCHMARK_CAP)
      if (!bErr) benchmarkRows = (br ?? []) as typeof benchmarkRows
    }

    const preferredRows = await loadPreferredProgramRowsForReporting(admin, organizationId, networkIds)

    let bulkRows: Array<{
      estimated_savings_cents: number | null
      estimated_total_volume_cents: number | null
      opportunity_status: string
      id?: string
    }> = []
    if (networkIds.length) {
      const { data: br, error: bErr } = await admin
        .from("blitzpay_bulk_purchase_opportunities")
        .select("id, estimated_savings_cents, estimated_total_volume_cents, opportunity_status")
        .in("supplier_network_id", networkIds)
        .order("id", { ascending: true })
        .limit(BLITZPAY_SUPPLIER_NETWORK_BULK_CAP)
      if (!bErr) bulkRows = (br ?? []) as typeof bulkRows
    }

    let perfAvg: number | null = null
    {
      const { data: scores, error: sErr } = await admin
        .from("blitzpay_supplier_performance_scores")
        .select("overall_score, vendor_id")
        .eq("organization_id", organizationId)
        .order("vendor_id", { ascending: true })
        .limit(BLITZPAY_SUPPLIER_NETWORK_PERF_CAP)
      if (!sErr) perfAvg = averageOverallScoresDeterministic((scores ?? []) as Array<{ overall_score: number | null; vendor_id?: string }>)
    }

    let finSum = 0
    const { data: vid } = await admin.from("blitzpay_vendors").select("id").eq("organization_id", organizationId).limit(40)
    const vids = (vid ?? []).map((x: { id: string }) => x.id)
    if (networkIds.length) {
      const { data: fo, error: fErr } = await admin
        .from("blitzpay_vendor_financing_network_offers")
        .select("estimated_financing_capacity_cents, offer_status, id")
        .in("supplier_network_id", networkIds)
        .eq("offer_status", "active")
        .order("id", { ascending: true })
        .limit(BLITZPAY_SUPPLIER_NETWORK_FINANCING_CAP)
      if (!fErr) {
        for (const r of fo ?? []) {
          finSum += Math.max(0, Math.round(Number((r as { estimated_financing_capacity_cents: number | null }).estimated_financing_capacity_cents ?? 0)))
        }
      }
    }
    if (vids.length) {
      const { data: fo2, error: fErr2 } = await admin
        .from("blitzpay_vendor_financing_network_offers")
        .select("estimated_financing_capacity_cents, offer_status, id")
        .in("vendor_id", vids)
        .eq("offer_status", "active")
        .order("id", { ascending: true })
        .limit(BLITZPAY_SUPPLIER_NETWORK_FINANCING_CAP)
      if (!fErr2) {
        for (const r of fo2 ?? []) {
          finSum += Math.max(0, Math.round(Number((r as { estimated_financing_capacity_cents: number | null }).estimated_financing_capacity_cents ?? 0)))
        }
      }
    }

    const preferredPricingOpportunityCents = sumPreferredPricingOpportunityCents(preferredRows)
    const bulkPurchaseOpportunityCents = sumActiveBulkPurchaseSavingsCents(bulkRows)

    return mergePhase5bFromAggregateContext(snapshot, {
      visibleNetworkCount: networks.length,
      activeMembershipRows,
      benchmarkRows,
      preferredPricingOpportunityCents,
      bulkPurchaseOpportunityCents,
      supplierPerformanceAvg0to100: perfAvg,
      vendorFinancingCapacityCentsSum: finSum,
    })
  } catch {
    return zeroPhase5bReportingExtension()
  }
}

export async function buildSupplierNetworkHealthPayload(
  admin: SupabaseClient,
  organizationId: string,
  snapshot: Pick<
    BlitzpayOrgReportingSnapshot,
    | "rebateOpportunityCents"
    | "totalInventoryValueCents"
    | "procurementTreasuryImpactScore"
    | "inventoryTurnoverScore"
    | "inventoryMarginHealthScore"
    | "reorderExposureCents"
    | "payableAgingHealthScore"
    | "vendorConcentrationRisk"
    | "treasuryCoverageForPayables"
  >,
): Promise<{
  phase5b: BlitzpayPhase5bReportingExtension
  visibleNetworkCount: number
}> {
  const networks = await listVisibleSupplierNetworksForOrganization(admin, organizationId)
  const phase5b = await buildPhase5bSupplierNetworkReportingSlice(admin, organizationId, snapshot)
  return { phase5b, visibleNetworkCount: networks.length }
}
