import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { hashBlitzpayClaimsAudit, hashBlitzpayClaimPayoutReference } from "@/lib/blitzpay/blitzpay-claims-audit"
import {
  claimsReserveCoverageScore0to100,
  sumActiveReserveBalanceCents,
  warrantyReserveExposureCents,
  type WarrantyReserveRow,
} from "@/lib/blitzpay/blitzpay-warranty-reserves"
import {
  protectionPlanAnnualizedRecurringCents,
  protectionPlanCoverageRate0to100,
  sumActiveEstimatedExposureCents,
  type ProtectionPlanRow,
} from "@/lib/blitzpay/blitzpay-protection-plans"
import { maxStormTreasuryPressure0to100, sumStormClaimExposureCents, type StormEventRow } from "@/lib/blitzpay/blitzpay-storm-financials"
import type { BlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"

export const BLITZPAY_CLAIMS_RESERVE_CAP = 28
export const BLITZPAY_CLAIMS_LIST_CAP = 40
export const BLITZPAY_CLAIMS_PAYOUT_CAP = 36
export const BLITZPAY_PROTECTION_PLAN_CAP = 30
export const BLITZPAY_STORM_EVENT_CAP = 18
export const BLITZPAY_CLAIM_MOVEMENT_CAP = 40

export type BlitzpayPhase5cReportingExtension = {
  warrantyReserveExposure: number
  claimsExposureCents: number
  claimsReserveCoverageScore: number
  protectionPlanRecurringRevenue: number
  stormEventTreasuryPressure: number
  contractorProtectionHealthScore: number
  claimsPayoutExposure: number
  protectionPlanCoverageRate: number
}

export function zeroPhase5cReportingExtension(): BlitzpayPhase5cReportingExtension {
  return {
    warrantyReserveExposure: 0,
    claimsExposureCents: 0,
    claimsReserveCoverageScore: 0,
    protectionPlanRecurringRevenue: 0,
    stormEventTreasuryPressure: 0,
    contractorProtectionHealthScore: 0,
    claimsPayoutExposure: 0,
    protectionPlanCoverageRate: 0,
  }
}

const OPEN_CLAIM = new Set(["draft", "submitted", "reviewing", "approved", "partially_approved"])
const PAYOUT_OPEN = new Set(["pending", "scheduled", "processing"])

function clampInt(n: number, lo: number, hi: number): number {
  const x = Math.round(Number(n))
  if (!Number.isFinite(x)) return lo
  return Math.min(hi, Math.max(lo, x))
}

export async function insertBlitzpayClaimsAuditLog(
  admin: SupabaseClient,
  row: {
    organization_id: string
    claim_id?: string | null
    audit_type:
      | "claim_created"
      | "claim_submitted"
      | "reserve_adjusted"
      | "payout_scheduled"
      | "payout_completed"
      | "protection_plan_created"
      | "storm_event_created"
      | "manual_override"
    actor_type: "system" | "admin" | "user"
    actor_id?: string | null
    audit_summary: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const hash = hashBlitzpayClaimsAudit({
    audit_type: row.audit_type,
    organization_id: row.organization_id,
    claim_id: row.claim_id ?? null,
    audit_summary: row.audit_summary,
    actor_type: row.actor_type,
    actor_id: row.actor_id ?? null,
    metadata: row.metadata ?? {},
  })
  const { error } = await admin.from("blitzpay_claims_audit_log").insert({
    organization_id: row.organization_id,
    claim_id: row.claim_id ?? null,
    audit_type: row.audit_type,
    actor_type: row.actor_type,
    actor_id: row.actor_id ?? null,
    audit_summary: row.audit_summary,
    immutable_hash: hash,
    metadata: row.metadata ?? {},
  })
  if (error) throw new Error(error.message)
}

/** Deterministic claim ordering for staff queues (id tie-break). */
export function prioritizeClaimsDeterministic<T extends { id: string; claim_status: string; estimated_claim_amount_cents?: number | null; submitted_at?: string | null }>(
  rows: ReadonlyArray<T>,
): T[] {
  const statusRank: Record<string, number> = {
    submitted: 0,
    reviewing: 1,
    approved: 2,
    partially_approved: 3,
    draft: 4,
    denied: 5,
    settled: 6,
    archived: 7,
  }
  return [...rows].sort((a, b) => {
    const ra = statusRank[String(a.claim_status)] ?? 99
    const rb = statusRank[String(b.claim_status)] ?? 99
    if (ra !== rb) return ra - rb
    const ea = Math.max(0, Math.round(Number(a.estimated_claim_amount_cents ?? 0)))
    const eb = Math.max(0, Math.round(Number(b.estimated_claim_amount_cents ?? 0)))
    if (ea !== eb) return eb - ea
    const sa = String(a.submitted_at ?? "")
    const sb = String(b.submitted_at ?? "")
    if (sa !== sb) return sb.localeCompare(sa)
    return a.id.localeCompare(b.id)
  })
}

export async function createWarrantyReserve(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    reserve_name: string
    reserve_type: string
    reserve_balance_cents?: number
    projected_exposure_cents?: number | null
    linked_account_id?: string | null
    actorUserId?: string | null
  },
): Promise<{ id: string }> {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_warranty_reserves")
    .insert({
      organization_id: organizationId,
      reserve_status: "active",
      reserve_type: input.reserve_type,
      reserve_name: input.reserve_name.trim().slice(0, 200),
      reserve_balance_cents: Math.max(0, Math.round(Number(input.reserve_balance_cents ?? 0))),
      projected_exposure_cents: input.projected_exposure_cents != null ? Math.max(0, Math.round(Number(input.projected_exposure_cents))) : null,
      reserve_utilization_rate: null,
      linked_account_id: input.linked_account_id ?? null,
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  await insertBlitzpayClaimsAuditLog(admin, {
    organization_id: organizationId,
    audit_type: "reserve_adjusted",
    actor_type: input.actorUserId ? "user" : "system",
    actor_id: input.actorUserId ?? null,
    audit_summary: `Warranty reserve created: ${input.reserve_name}`,
    metadata: { warranty_reserve_id: id },
  })
  return { id }
}

export async function createClaim(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    claim_reference: string
    claim_type: string
    claim_status?: string
    estimated_claim_amount_cents?: number | null
    customer_id?: string | null
    equipment_id?: string | null
    linked_invoice_id?: string | null
    linked_work_order_id?: string | null
    actorUserId?: string | null
  },
): Promise<{ id: string }> {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_claims")
    .insert({
      organization_id: organizationId,
      customer_id: input.customer_id ?? null,
      equipment_id: input.equipment_id ?? null,
      linked_invoice_id: input.linked_invoice_id ?? null,
      linked_work_order_id: input.linked_work_order_id ?? null,
      claim_status: input.claim_status ?? "draft",
      claim_type: input.claim_type,
      claim_reference: input.claim_reference.trim().slice(0, 200),
      estimated_claim_amount_cents: input.estimated_claim_amount_cents != null ? Math.max(0, Math.round(Number(input.estimated_claim_amount_cents))) : null,
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  await insertBlitzpayClaimsAuditLog(admin, {
    organization_id: organizationId,
    claim_id: id,
    audit_type: "claim_created",
    actor_type: input.actorUserId ? "user" : "system",
    actor_id: input.actorUserId ?? null,
    audit_summary: `Claim created (${input.claim_type}): ${input.claim_reference}`,
    metadata: { claim_id: id },
  })
  return { id }
}

export async function createClaimsPayoutTracking(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    claim_id: string
    payout_type: string
    payout_amount_cents: number
    payout_status?: string
    actorUserId?: string | null
  },
): Promise<{ id: string; payout_reference_hash: string }> {
  assertUuid(organizationId, "organizationId")
  assertUuid(input.claim_id, "claim_id")
  const createdAtIso = new Date().toISOString()
  const payout_reference_hash = hashBlitzpayClaimPayoutReference({
    organizationId,
    claimId: input.claim_id,
    amountCents: Math.max(0, Math.round(input.payout_amount_cents)),
    createdAtIso,
  })
  const { data, error } = await admin
    .from("blitzpay_claims_payout_tracking")
    .insert({
      organization_id: organizationId,
      claim_id: input.claim_id,
      payout_status: input.payout_status ?? "pending",
      payout_type: input.payout_type,
      payout_amount_cents: Math.max(0, Math.round(input.payout_amount_cents)),
      payout_reference_hash,
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  await insertBlitzpayClaimsAuditLog(admin, {
    organization_id: organizationId,
    claim_id: input.claim_id,
    audit_type: "payout_scheduled",
    actor_type: input.actorUserId ? "user" : "system",
    actor_id: input.actorUserId ?? null,
    audit_summary: `Payout tracking row created (${input.payout_type})`,
    metadata: { payout_tracking_id: id },
  })
  return { id, payout_reference_hash }
}

export async function createProtectionPlan(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    plan_type: string
    plan_status?: string
    monthly_price_cents?: number | null
    estimated_exposure_cents?: number | null
    customer_id?: string | null
    equipment_id?: string | null
    linked_membership_id?: string | null
    actorUserId?: string | null
  },
): Promise<{ id: string }> {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_equipment_protection_plans")
    .insert({
      organization_id: organizationId,
      customer_id: input.customer_id ?? null,
      equipment_id: input.equipment_id ?? null,
      plan_status: input.plan_status ?? "active",
      plan_type: input.plan_type,
      monthly_price_cents: input.monthly_price_cents != null ? Math.max(0, Math.round(Number(input.monthly_price_cents))) : null,
      estimated_exposure_cents: input.estimated_exposure_cents != null ? Math.max(0, Math.round(Number(input.estimated_exposure_cents))) : null,
      linked_membership_id: input.linked_membership_id ?? null,
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  await insertBlitzpayClaimsAuditLog(admin, {
    organization_id: organizationId,
    audit_type: "protection_plan_created",
    actor_type: input.actorUserId ? "user" : "system",
    actor_id: input.actorUserId ?? null,
    audit_summary: `Protection plan created (${input.plan_type})`,
    metadata: { protection_plan_id: id },
  })
  return { id }
}

export async function createStormEventFinancial(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    event_name: string
    event_region?: string | null
    event_status?: string
    estimated_revenue_opportunity_cents?: number | null
    estimated_claim_exposure_cents?: number | null
    estimated_response_cost_cents?: number | null
    estimated_treasury_pressure?: number | null
    actorUserId?: string | null
  },
): Promise<{ id: string }> {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_storm_event_financials")
    .insert({
      organization_id: organizationId,
      event_status: input.event_status ?? "active",
      event_name: input.event_name.trim().slice(0, 200),
      event_region: input.event_region?.trim().slice(0, 120) ?? null,
      estimated_revenue_opportunity_cents:
        input.estimated_revenue_opportunity_cents != null ? Math.max(0, Math.round(Number(input.estimated_revenue_opportunity_cents))) : null,
      estimated_claim_exposure_cents:
        input.estimated_claim_exposure_cents != null ? Math.max(0, Math.round(Number(input.estimated_claim_exposure_cents))) : null,
      estimated_response_cost_cents:
        input.estimated_response_cost_cents != null ? Math.max(0, Math.round(Number(input.estimated_response_cost_cents))) : null,
      estimated_treasury_pressure:
        input.estimated_treasury_pressure != null ? clampInt(input.estimated_treasury_pressure, 0, 100) : null,
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  await insertBlitzpayClaimsAuditLog(admin, {
    organization_id: organizationId,
    audit_type: "storm_event_created",
    actor_type: input.actorUserId ? "user" : "system",
    actor_id: input.actorUserId ?? null,
    audit_summary: `Storm event financial row created: ${input.event_name}`,
    metadata: { storm_event_id: id },
  })
  return { id }
}

export async function buildPhase5cClaimsReportingSlice(
  admin: SupabaseClient,
  organizationId: string,
  snapshot: Pick<
    BlitzpayOrgReportingSnapshot,
    "openDisputesAmountCents" | "treasuryPendingPayoutTotalsCents" | "apDue30OpenCents" | "estimatedOperatingCashCents"
  >,
): Promise<BlitzpayPhase5cReportingExtension> {
  assertUuid(organizationId, "organizationId")
  try {
    const { data: resRows, error: rErr } = await admin
      .from("blitzpay_warranty_reserves")
      .select("id, reserve_status, reserve_balance_cents, projected_exposure_cents")
      .eq("organization_id", organizationId)
      .order("id", { ascending: true })
      .limit(BLITZPAY_CLAIMS_RESERVE_CAP)
    if (rErr) throw new Error(rErr.message)
    const reserves = (resRows ?? []) as WarrantyReserveRow[]
    const warrantyReserveExposure = warrantyReserveExposureCents(reserves)
    const reserveBalanceSum = sumActiveReserveBalanceCents(reserves)

    const { data: claimRows, error: cErr } = await admin
      .from("blitzpay_claims")
      .select("id, claim_status, estimated_claim_amount_cents, submitted_at")
      .eq("organization_id", organizationId)
      .order("id", { ascending: true })
      .limit(BLITZPAY_CLAIMS_LIST_CAP)
    if (cErr) throw new Error(cErr.message)
    let claimsExposureCents = 0
    for (const r of claimRows ?? []) {
      const st = String((r as { claim_status: string }).claim_status)
      if (!OPEN_CLAIM.has(st)) continue
      claimsExposureCents += Math.max(0, Math.round(Number((r as { estimated_claim_amount_cents: number | null }).estimated_claim_amount_cents ?? 0)))
    }
    claimsExposureCents = Math.min(500_000_000, claimsExposureCents)

    const claimsReserveCoverageScore = claimsReserveCoverageScore0to100(reserveBalanceSum, claimsExposureCents)

    const { data: planRows, error: pErr } = await admin
      .from("blitzpay_equipment_protection_plans")
      .select("id, plan_status, monthly_price_cents, estimated_exposure_cents")
      .eq("organization_id", organizationId)
      .order("id", { ascending: true })
      .limit(BLITZPAY_PROTECTION_PLAN_CAP)
    if (pErr) throw new Error(pErr.message)
    const plans = (planRows ?? []) as ProtectionPlanRow[]
    const protectionPlanRecurringRevenue = protectionPlanAnnualizedRecurringCents(plans)
    const planExposure = sumActiveEstimatedExposureCents(plans)
    const activePlanCount = plans.filter((p) => String(p.plan_status) === "active").length
    const protectionPlanCoverageRate = protectionPlanCoverageRate0to100(activePlanCount)

    const { data: stormRows, error: sErr } = await admin
      .from("blitzpay_storm_event_financials")
      .select("id, event_status, estimated_claim_exposure_cents, estimated_treasury_pressure")
      .eq("organization_id", organizationId)
      .order("id", { ascending: true })
      .limit(BLITZPAY_STORM_EVENT_CAP)
    if (sErr) throw new Error(sErr.message)
    const storms = (stormRows ?? []) as StormEventRow[]
    const stormEventTreasuryPressure = maxStormTreasuryPressure0to100(storms)
    const stormClaimCents = sumStormClaimExposureCents(storms)

    const { data: payRows, error: payErr } = await admin
      .from("blitzpay_claims_payout_tracking")
      .select("id, payout_status, payout_amount_cents")
      .eq("organization_id", organizationId)
      .order("id", { ascending: true })
      .limit(BLITZPAY_CLAIMS_PAYOUT_CAP)
    if (payErr) throw new Error(payErr.message)
    let claimsPayoutExposure = 0
    for (const r of payRows ?? []) {
      const st = String((r as { payout_status: string }).payout_status)
      if (!PAYOUT_OPEN.has(st)) continue
      claimsPayoutExposure += Math.max(0, Math.round(Number((r as { payout_amount_cents: number }).payout_amount_cents)))
    }
    claimsPayoutExposure = Math.min(500_000_000, claimsPayoutExposure)

    const treasuryHint = clampInt(
      Math.round(
        (Math.max(0, snapshot.treasuryPendingPayoutTotalsCents) + Math.max(0, snapshot.apDue30OpenCents)) /
          Math.max(1, Math.max(100_000, Math.max(0, snapshot.estimatedOperatingCashCents))),
      ),
      0,
      100,
    )
    const contractorProtectionHealthScore = clampInt(
      Math.round((claimsReserveCoverageScore + protectionPlanCoverageRate + (100 - stormEventTreasuryPressure) + (100 - treasuryHint)) / 4) -
        clampInt(Math.round(planExposure / 5_000_000), 0, 20) -
        clampInt(Math.round(stormClaimCents / 5_000_000), 0, 20),
      0,
      100,
    )

    return {
      warrantyReserveExposure: Math.min(500_000_000, warrantyReserveExposure),
      claimsExposureCents,
      claimsReserveCoverageScore,
      protectionPlanRecurringRevenue,
      stormEventTreasuryPressure,
      contractorProtectionHealthScore,
      claimsPayoutExposure,
      protectionPlanCoverageRate,
    }
  } catch {
    return zeroPhase5cReportingExtension()
  }
}

export async function buildClaimsProtectionHealthPayload(
  admin: SupabaseClient,
  organizationId: string,
  snapshot: Pick<
    BlitzpayOrgReportingSnapshot,
    "openDisputesAmountCents" | "treasuryPendingPayoutTotalsCents" | "apDue30OpenCents" | "estimatedOperatingCashCents"
  >,
): Promise<{ phase5c: BlitzpayPhase5cReportingExtension }> {
  const phase5c = await buildPhase5cClaimsReportingSlice(admin, organizationId, snapshot)
  return { phase5c }
}
