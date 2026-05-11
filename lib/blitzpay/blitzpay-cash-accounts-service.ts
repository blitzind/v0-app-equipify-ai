import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { aggregateBlitzpayTreasuryMetrics } from "@/lib/blitzpay/blitzpay-contractor-treasury"
import {
  buildCashAccountHealth,
  buildCashAccountSummary,
  buildCashRunwaySnapshot,
  deriveBlitzpayCashPlanningMetrics,
  type BlitzpayCashAccountType,
  type BlitzpayCashReserveRuleInput,
  type BlitzpayCashRunwayStatus,
} from "@/lib/blitzpay/blitzpay-cash-accounts"
import { fetchBlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"

/** Bounded list reads for org cash planning. */
export const CASH_ACCOUNTS_ROW_CAP = 48
export const CASH_RESERVE_RULES_CAP = 48
export const CASH_ALLOCATIONS_SCAN_CAP = 120
export const PLATFORM_CASH_ORG_SAMPLE_CAP = 80

export type BlitzpayCashReserveRuleRow = {
  id: string
  organization_id: string
  rule_name: string
  rule_type: string
  basis_points: number | null
  fixed_amount_cents: number | null
  active: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type BlitzpayOrgCashPlanningPayload = {
  generatedAt: string
  summary: ReturnType<typeof buildCashAccountSummary>
  runway: {
    status: BlitzpayCashRunwayStatus
    expectedInflows7dCents: number
    expectedInflows30dCents: number
    expectedOutflows7dCents: number
    expectedOutflows30dCents: number
    reserveTargetCents: number
    cushion7dCents: number
    cushion30dCents: number
  }
  health: ReturnType<typeof buildCashAccountHealth>
  reserveRules: BlitzpayCashReserveRuleRow[]
  treasuryOperatingCents: number
  treasuryHeldReserveCents: number
  pendingPayoutTotalCents: number
  /** Internal planning only — not a bank balance. */
  disclosures: string[]
}

function mapRules(rows: unknown[]): BlitzpayCashReserveRuleInput[] {
  return (rows as BlitzpayCashReserveRuleRow[]).map((r) => ({
    ruleType: r.rule_type as BlitzpayCashReserveRuleInput["ruleType"],
    basisPoints: r.basis_points != null ? Math.round(Number(r.basis_points)) : null,
    fixedAmountCents: r.fixed_amount_cents != null ? Math.round(Number(r.fixed_amount_cents)) : null,
    active: Boolean(r.active),
  }))
}

export async function fetchBlitzpayOrgCashPlanningPayload(
  admin: SupabaseClient,
  organizationId: string,
  options?: { reportingWindowDays?: number },
): Promise<BlitzpayOrgCashPlanningPayload> {
  assertUuid(organizationId, "organizationId")
  const reportingWindowDays = Math.min(90, Math.max(7, Math.round(Number(options?.reportingWindowDays ?? 30))))
  const sinceIso = new Date(Date.now() - reportingWindowDays * 86400_000).toISOString()

  const [{ data: accRows, error: aErr }, { data: ruleRows, error: rErr }] = await Promise.all([
    admin
      .from("blitzpay_cash_accounts")
      .select("id, account_type, display_name, status, target_balance_cents, current_estimated_balance_cents")
      .eq("organization_id", organizationId)
      .neq("status", "archived")
      .order("created_at", { ascending: true })
      .limit(CASH_ACCOUNTS_ROW_CAP),
    admin
      .from("blitzpay_cash_reserve_rules")
      .select("id, organization_id, rule_name, rule_type, basis_points, fixed_amount_cents, active, metadata, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true })
      .limit(CASH_RESERVE_RULES_CAP),
  ])
  if (aErr) throw new Error(aErr.message)
  if (rErr) throw new Error(rErr.message)

  const [reporting, tm] = await Promise.all([
    fetchBlitzpayOrgReportingSnapshot(admin, organizationId, { sinceIso }),
    aggregateBlitzpayTreasuryMetrics(admin, organizationId).catch(() => null),
  ])
  const disputeExposureCents = reporting.openDisputesAmountCents

  const wallet = reporting.customerWalletSpendableCreditTotalCents
  const deposits = reporting.customerUnappliedEstimateDepositTotalCents
  const overlap = Math.min(wallet, deposits)

  const rulesIn = mapRules((ruleRows ?? []) as unknown[])
  const derived = deriveBlitzpayCashPlanningMetrics({
    treasuryOperatingCents: tm?.operatingBalanceCents ?? 0,
    heldReserveCents: tm?.heldReserveCents ?? 0,
    reserveTargetFromSettingsCents: tm?.reserveTargetCents ?? 0,
    pendingPayoutTotalCents: tm?.pendingPayoutTotalCents ?? 0,
    walletSpendableLiabilityCents: wallet,
    unappliedEstimateDepositCents: deposits,
    walletDepositOverlapCents: overlap,
    netCollectedWindowCents: reporting.netCollectedCents,
    payrollLiabilityCents: reporting.payrollLiabilityCents,
    apOpenOutstandingCents: reporting.apOpenOutstandingCents,
    disputeExposureCents,
    reserveRules: rulesIn,
    apDue7OpenCents: reporting.apDue7OpenCents,
    apDue30OpenCents: reporting.apDue30OpenCents,
    treasuryPendingPayoutTotalsCents: reporting.treasuryPendingPayoutTotalsCents,
    treasuryEstimateUpcomingTransferCents: reporting.treasuryEstimateUpcomingTransferCents,
    recurringPlannedInflow30dCents: reporting.blitzpayRecurringPlannedInflow30dCents,
  })
  const operatingEstimate = derived.estimatedOperatingCashCents
  const reserveTargetCents = derived.cashReserveTargetCents

  const runwayCore = buildCashRunwaySnapshot({
    estimatedOperatingCashCents: operatingEstimate,
    expectedInflows7dCents: derived.expectedInflows7dCents,
    expectedInflows30dCents: derived.expectedInflows30dCents,
    expectedOutflows7dCents: derived.expectedOutflows7dCents,
    expectedOutflows30dCents: derived.expectedOutflows30dCents,
    reserveTargetCents,
  })

  const health = buildCashAccountHealth({
    runway: runwayCore,
    reserveTargetCents,
    operatingEstimateCents: operatingEstimate,
    payrollLiabilityCents: reporting.payrollLiabilityCents,
    apOpenOutstandingCents: reporting.apOpenOutstandingCents,
    disputeExposureCents,
    recurringInflow30dCents: reporting.blitzpayRecurringPlannedInflow30dCents,
  })

  const dbAccounts = (accRows ?? []) as Array<{
    id: string
    account_type: string
    display_name: string
    status: string
    target_balance_cents: number
    current_estimated_balance_cents: number
  }>
  const summary = buildCashAccountSummary({
    dbAccounts: dbAccounts.map((a) => ({
      id: a.id,
      accountType: a.account_type as BlitzpayCashAccountType,
      displayName: a.display_name,
      status: a.status as "active" | "paused" | "archived",
      targetBalanceCents: Math.round(Number(a.target_balance_cents)),
      currentEstimatedBalanceCents: Math.round(Number(a.current_estimated_balance_cents)),
    })),
    operatingEstimateCents: operatingEstimate,
    reserveTargetCents,
    heldReserveCents: tm?.heldReserveCents ?? 0,
    syntheticFill: dbAccounts.length === 0,
  })

  return {
    generatedAt: new Date().toISOString(),
    summary,
    runway: {
      status: runwayCore.runwayStatus,
      expectedInflows7dCents: derived.expectedInflows7dCents,
      expectedInflows30dCents: derived.expectedInflows30dCents,
      expectedOutflows7dCents: derived.expectedOutflows7dCents,
      expectedOutflows30dCents: derived.expectedOutflows30dCents,
      reserveTargetCents,
      cushion7dCents: runwayCore.cushion7dCents,
      cushion30dCents: runwayCore.cushion30dCents,
    },
    health,
    reserveRules: (ruleRows ?? []) as BlitzpayCashReserveRuleRow[],
    treasuryOperatingCents: tm?.operatingBalanceCents ?? 0,
    treasuryHeldReserveCents: tm?.heldReserveCents ?? 0,
    pendingPayoutTotalCents: tm?.pendingPayoutTotalCents ?? 0,
    disclosures: [
      "Balances shown are internal planning estimates. Stripe Connect remains the source of truth for funds movement.",
      "This is not a bank account, not FDIC insurance, and not custodial stored money.",
    ],
  }
}

export async function persistBlitzpayCashRunwaySnapshot(
  admin: SupabaseClient,
  organizationId: string,
  payload: Pick<BlitzpayOrgCashPlanningPayload, "runway"> & { availableCashCents: number },
): Promise<void> {
  assertUuid(organizationId, "organizationId")
  const snapshotDate = new Date().toISOString().slice(0, 10)
  const { error } = await admin.from("blitzpay_cash_runway_snapshots").upsert(
    {
      organization_id: organizationId,
      snapshot_date: snapshotDate,
      available_cash_cents: payload.availableCashCents,
      expected_inflows_7d_cents: payload.runway.expectedInflows7dCents,
      expected_inflows_30d_cents: payload.runway.expectedInflows30dCents,
      expected_outflows_7d_cents: payload.runway.expectedOutflows7dCents,
      expected_outflows_30d_cents: payload.runway.expectedOutflows30dCents,
      reserve_target_cents: payload.runway.reserveTargetCents,
      runway_status: payload.runway.status,
    },
    { onConflict: "organization_id,snapshot_date" },
  )
  if (error) throw new Error(error.message)
}

export async function insertBlitzpayCashReserveRule(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    ruleName: string
    ruleType: string
    basisPoints?: number | null
    fixedAmountCents?: number | null
    active?: boolean
    metadata?: Record<string, unknown>
  },
): Promise<BlitzpayCashReserveRuleRow> {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_cash_reserve_rules")
    .insert({
      organization_id: organizationId,
      rule_name: input.ruleName.trim().slice(0, 200),
      rule_type: input.ruleType,
      basis_points: input.basisPoints ?? null,
      fixed_amount_cents: input.fixedAmountCents ?? null,
      active: input.active !== false,
      metadata: input.metadata ?? {},
    })
    .select("id, organization_id, rule_name, rule_type, basis_points, fixed_amount_cents, active, metadata, created_at, updated_at")
    .single()
  if (error) throw new Error(error.message)
  return data as BlitzpayCashReserveRuleRow
}

export async function updateBlitzpayCashReserveRule(
  admin: SupabaseClient,
  organizationId: string,
  ruleId: string,
  patch: Partial<{
    ruleName: string
    ruleType: string
    basisPoints: number | null
    fixedAmountCents: number | null
    active: boolean
    metadata: Record<string, unknown>
  }>,
): Promise<BlitzpayCashReserveRuleRow> {
  assertUuid(organizationId, "organizationId")
  assertUuid(ruleId, "ruleId")
  const row: Record<string, unknown> = {}
  if (patch.ruleName != null) row.rule_name = patch.ruleName.trim().slice(0, 200)
  if (patch.ruleType != null) row.rule_type = patch.ruleType
  if (patch.basisPoints !== undefined) row.basis_points = patch.basisPoints
  if (patch.fixedAmountCents !== undefined) row.fixed_amount_cents = patch.fixedAmountCents
  if (patch.active !== undefined) row.active = patch.active
  if (patch.metadata !== undefined) row.metadata = patch.metadata
  const { data, error } = await admin
    .from("blitzpay_cash_reserve_rules")
    .update(row)
    .eq("organization_id", organizationId)
    .eq("id", ruleId)
    .select("id, organization_id, rule_name, rule_type, basis_points, fixed_amount_cents, active, metadata, created_at, updated_at")
    .single()
  if (error) throw new Error(error.message)
  return data as BlitzpayCashReserveRuleRow
}

export async function fetchRecentCashAllocations(
  admin: SupabaseClient,
  organizationId: string,
): Promise<
  Array<{
    id: string
    cash_account_id: string
    source_type: string
    source_id: string
    allocation_cents: number
    allocation_status: string
    created_at: string
  }>
> {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_cash_account_allocations")
    .select("id, cash_account_id, source_type, source_id, allocation_cents, allocation_status, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(CASH_ALLOCATIONS_SCAN_CAP)
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{
    id: string
    cash_account_id: string
    source_type: string
    source_id: string
    allocation_cents: number
    allocation_status: string
    created_at: string
  }>
}
