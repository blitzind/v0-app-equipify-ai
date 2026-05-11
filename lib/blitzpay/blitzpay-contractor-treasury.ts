import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import {
  averagePayoutDelayDaysFromPaidRows,
  classifyPayoutSpeedLaneFromRecentMethods,
  computeHeldReserveCents,
  computeInstantTransferEligibility,
  computeOperatingBalanceCents,
  estimateUpcomingTransferCents,
  partitionBlitzpayActivityNetByAvailability,
  utcTodayYmd,
  type BlitzpayPayoutSpeedLane,
} from "@/lib/blitzpay/blitzpay-treasury-math"
import { buildBlitzpayTreasuryInsights } from "@/lib/blitzpay/blitzpay-treasury-insights"

const BT_PAGE = 800

export type BlitzpayTreasuryMetricsCore = {
  availableBalanceCents: number
  pendingBalanceCents: number
  heldReserveCents: number
  reserveTargetCents: number
  operatingBalanceCents: number
  payoutInTransitCents: number
  pendingPayoutTotalCents: number
  failedPayoutCount30d: number
  avgPayoutDelayDays: number | null
  payoutVelocityPaidCents7d: number
  payoutVelocityPaidCents30d: number
  instantTransferEligible: boolean
  payoutSpeedLane: BlitzpayPayoutSpeedLane
  usedInstantPayoutInWindow: boolean
  estimateUpcomingTransferCents: number
}

export type BlitzpayTreasurySanitizedPayout = {
  id: string
  payoutRefTail: string
  status: string
  amountCents: number
  currency: string
  arrivalDate: string | null
  stripeCreatedAt: string
  method: string | null
  failureSummary: string | null
}

async function fetchAllBalanceTransactionsForTreasury(
  admin: SupabaseClient,
  organizationId: string,
): Promise<Array<{ balance_type: string; net_cents: number; available_on: string | null }>> {
  const out: Array<{ balance_type: string; net_cents: number; available_on: string | null }> = []
  let from = 0
  while (true) {
    const { data, error } = await admin
      .from("blitzpay_balance_transactions")
      .select("balance_type, net_cents, available_on")
      .eq("organization_id", organizationId)
      .order("id", { ascending: true })
      .range(from, from + BT_PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<{ balance_type: string; net_cents: number; available_on: string | null }>
    out.push(...rows)
    if (rows.length < BT_PAGE) break
    from += BT_PAGE
    if (from > 500_000) break
  }
  return out
}

/**
 * Aggregates Stripe-mirrored ledger rows + payouts into contractor treasury metrics (org-scoped).
 */
export async function aggregateBlitzpayTreasuryMetrics(
  admin: SupabaseClient,
  organizationId: string,
  options?: {
    stripePayoutsEnabled?: boolean
    reserveTargetCents?: number
    instantPayoutInterest?: boolean
  },
): Promise<BlitzpayTreasuryMetricsCore> {
  assertUuid(organizationId, "organizationId")
  const todayYmd = utcTodayYmd()
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString()
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString()

  let stripePayoutsEnabled = Boolean(options?.stripePayoutsEnabled)
  let reserveTargetCents = Math.max(0, Math.round(Number(options?.reserveTargetCents ?? 0)))
  let instantPayoutInterest = Boolean(options?.instantPayoutInterest)

  if (
    options?.stripePayoutsEnabled === undefined ||
    options?.reserveTargetCents === undefined ||
    options?.instantPayoutInterest === undefined
  ) {
    const [{ data: org, error: orgErr }, { data: settings, error: sErr }] = await Promise.all([
      admin.from("organizations").select("stripe_payouts_enabled").eq("id", organizationId).maybeSingle(),
      admin
        .from("blitzpay_org_settings")
        .select("blitzpay_reserve_target_cents, blitzpay_instant_payout_interest")
        .eq("organization_id", organizationId)
        .maybeSingle(),
    ])
    if (orgErr) throw new Error(orgErr.message)
    if (sErr) throw new Error(sErr.message)
    if (options?.stripePayoutsEnabled === undefined) {
      stripePayoutsEnabled = Boolean((org as { stripe_payouts_enabled?: boolean } | null)?.stripe_payouts_enabled)
    }
    if (options?.reserveTargetCents === undefined) {
      reserveTargetCents = Math.max(
        0,
        Math.round(
          Number((settings as { blitzpay_reserve_target_cents?: number } | null)?.blitzpay_reserve_target_cents ?? 0),
        ),
      )
    }
    if (options?.instantPayoutInterest === undefined) {
      instantPayoutInterest = Boolean(
        (settings as { blitzpay_instant_payout_interest?: boolean } | null)?.blitzpay_instant_payout_interest,
      )
    }
  }

  const btRows = await fetchAllBalanceTransactionsForTreasury(admin, organizationId)
  const { availableCents, pendingCents } = partitionBlitzpayActivityNetByAvailability(btRows, todayYmd)
  const heldReserveCents = computeHeldReserveCents({
    reserveTargetCents,
    ledgerAvailableCents: availableCents,
  })
  const operatingBalanceCents = computeOperatingBalanceCents({
    ledgerAvailableCents: availableCents,
    heldReserveCents,
  })

  const { data: payoutAgg, error: pErr } = await admin
    .from("blitzpay_payouts")
    .select("status, amount_cents, stripe_created_at, arrival_date, method")
    .eq("organization_id", organizationId)
  if (pErr) throw new Error(pErr.message)
  const payouts = (payoutAgg ?? []) as Array<{
    status: string
    amount_cents: number
    stripe_created_at: string
    arrival_date: string | null
    method: string | null
  }>

  let payoutInTransitCents = 0
  let pendingPayoutTotalCents = 0
  let failedPayoutCount30d = 0
  let payoutVelocityPaidCents7d = 0
  let payoutVelocityPaidCents30d = 0
  const paidForDelay: Array<{ stripe_created_at: string; arrival_date: string | null }> = []
  const recentMethods: string[] = []
  let usedInstantPayoutInWindow = false

  for (const p of payouts) {
    const st = String(p.status || "").toLowerCase()
    const amt = Math.round(Number(p.amount_cents))
    const created = p.stripe_created_at
    const m = String(p.method || "").toLowerCase()

    if (st === "pending" || st === "in_transit") {
      payoutInTransitCents += Math.max(0, amt)
      pendingPayoutTotalCents += Math.max(0, amt)
    }
    if (st === "paid") {
      paidForDelay.push({ stripe_created_at: created, arrival_date: p.arrival_date })
      if (created >= since7d) payoutVelocityPaidCents7d += Math.max(0, amt)
      if (created >= since30d) payoutVelocityPaidCents30d += Math.max(0, amt)
      if (m === "instant" && created >= since30d) usedInstantPayoutInWindow = true
    }
    if (st === "failed" && created >= since30d) {
      failedPayoutCount30d += 1
    }
  }

  paidForDelay.sort((a, b) => Date.parse(b.stripe_created_at) - Date.parse(a.stripe_created_at))
  const avgPayoutDelayDays = averagePayoutDelayDaysFromPaidRows(paidForDelay.slice(0, 40))

  const sortedByCreated = [...payouts].sort(
    (a, b) => Date.parse(b.stripe_created_at) - Date.parse(a.stripe_created_at),
  )
  const methodsForLane = sortedByCreated.slice(0, 25).map((x) => x.method)
  const payoutSpeedLane = classifyPayoutSpeedLaneFromRecentMethods(methodsForLane)

  const instantTransferEligible = computeInstantTransferEligibility({
    stripePayoutsEnabled,
    usedInstantPayoutInWindow,
    instantPayoutInterest: instantPayoutInterest,
  })

  const estimateUpcoming = estimateUpcomingTransferCents({
    payoutInTransitCents,
    pendingLedgerCents: pendingCents,
  })

  return {
    availableBalanceCents: availableCents,
    pendingBalanceCents: pendingCents,
    heldReserveCents,
    reserveTargetCents,
    operatingBalanceCents,
    payoutInTransitCents,
    pendingPayoutTotalCents,
    failedPayoutCount30d,
    avgPayoutDelayDays,
    payoutVelocityPaidCents7d,
    payoutVelocityPaidCents30d,
    instantTransferEligible,
    payoutSpeedLane,
    usedInstantPayoutInWindow,
    estimateUpcomingTransferCents: estimateUpcoming,
  }
}

function payoutFailurePublicSummary(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null
  const s = String(raw).trim().slice(0, 240)
  return s.length > 0 ? s : null
}

export type BlitzpayTreasuryDashboardPayload = BlitzpayTreasuryMetricsCore & {
  recentPayouts: BlitzpayTreasurySanitizedPayout[]
  insights: ReturnType<typeof buildBlitzpayTreasuryInsights>
  /** ISO when `blitzpay_org_balances` was last computed (after refresh). */
  orgBalanceRowComputedAt: string | null
}

export async function persistBlitzpayOrgTreasury(
  admin: SupabaseClient,
  organizationId: string,
  metrics: BlitzpayTreasuryMetricsCore,
): Promise<{ snapshotInserted: boolean }> {
  assertUuid(organizationId, "organizationId")
  const now = new Date().toISOString()

  const { error: upErr } = await admin.from("blitzpay_org_balances").upsert(
    {
      organization_id: organizationId,
      available_balance_cents: metrics.availableBalanceCents,
      pending_balance_cents: metrics.pendingBalanceCents,
      held_reserve_cents: metrics.heldReserveCents,
      reserve_target_cents: metrics.reserveTargetCents,
      operating_balance_cents: metrics.operatingBalanceCents,
      payout_in_transit_cents: metrics.payoutInTransitCents,
      pending_payout_total_cents: metrics.pendingPayoutTotalCents,
      failed_payout_count_30d: metrics.failedPayoutCount30d,
      avg_payout_delay_days: metrics.avgPayoutDelayDays,
      payout_velocity_paid_cents_7d: metrics.payoutVelocityPaidCents7d,
      payout_velocity_paid_cents_30d: metrics.payoutVelocityPaidCents30d,
      instant_transfer_eligible: metrics.instantTransferEligible,
      payout_speed_lane: metrics.payoutSpeedLane,
      computed_at: now,
      updated_at: now,
    },
    { onConflict: "organization_id" },
  )
  if (upErr) throw new Error(upErr.message)

  let snapshotInserted = false
  const { data: lastSnap, error: lsErr } = await admin
    .from("blitzpay_balance_snapshots")
    .select("captured_at")
    .eq("organization_id", organizationId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lsErr) throw new Error(lsErr.message)
  const lastAt = lastSnap ? Date.parse(String((lastSnap as { captured_at: string }).captured_at)) : 0
  if (!Number.isFinite(lastAt) || Date.now() - lastAt > 24 * 3600_000) {
    const { error: insErr } = await admin.from("blitzpay_balance_snapshots").insert({
      organization_id: organizationId,
      captured_at: now,
      available_balance_cents: metrics.availableBalanceCents,
      pending_balance_cents: metrics.pendingBalanceCents,
      held_reserve_cents: metrics.heldReserveCents,
      payout_in_transit_cents: metrics.payoutInTransitCents,
    })
    if (!insErr) snapshotInserted = true
  }

  return { snapshotInserted }
}

export async function refreshBlitzpayOrgTreasuryState(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ metrics: BlitzpayTreasuryMetricsCore; snapshotInserted: boolean }> {
  assertUuid(organizationId, "organizationId")
  const metrics = await aggregateBlitzpayTreasuryMetrics(admin, organizationId)
  const { snapshotInserted } = await persistBlitzpayOrgTreasury(admin, organizationId, metrics)
  return { metrics, snapshotInserted }
}

export async function fetchBlitzpayTreasuryDashboard(
  admin: SupabaseClient,
  organizationId: string,
  options?: { achPendingCount?: number; openDisputeCount?: number },
): Promise<BlitzpayTreasuryDashboardPayload> {
  assertUuid(organizationId, "organizationId")
  const metrics = await aggregateBlitzpayTreasuryMetrics(admin, organizationId)
  await persistBlitzpayOrgTreasury(admin, organizationId, metrics)

  const { data: balRow, error: bErr } = await admin
    .from("blitzpay_org_balances")
    .select("computed_at")
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (bErr) throw new Error(bErr.message)
  const orgBalanceRowComputedAt = (balRow as { computed_at?: string } | null)?.computed_at ?? null

  const { data: pr, error: prErr } = await admin
    .from("blitzpay_payouts")
    .select(
      "id, stripe_payout_id, status, amount_cents, currency, arrival_date, stripe_created_at, method, failure_message",
    )
    .eq("organization_id", organizationId)
    .order("stripe_created_at", { ascending: false })
    .limit(12)
  if (prErr) throw new Error(prErr.message)

  const recentPayouts: BlitzpayTreasurySanitizedPayout[] = (pr ?? []).map((raw) => {
    const p = raw as {
      id: string
      stripe_payout_id: string
      status: string
      amount_cents: number
      currency: string
      arrival_date: string | null
      stripe_created_at: string
      method: string | null
      failure_message: string | null
    }
    const sid = String(p.stripe_payout_id ?? "")
    return {
      id: p.id,
      payoutRefTail: sid.length > 6 ? sid.slice(-6) : sid,
      status: p.status,
      amountCents: Math.round(Number(p.amount_cents)),
      currency: String(p.currency || "usd").toLowerCase(),
      arrivalDate: p.arrival_date,
      stripeCreatedAt: p.stripe_created_at,
      method: p.method,
      failureSummary: payoutFailurePublicSummary(p.failure_message),
    }
  })

  const { data: snaps, error: snErr } = await admin
    .from("blitzpay_balance_snapshots")
    .select("payout_in_transit_cents, pending_balance_cents, captured_at")
    .eq("organization_id", organizationId)
    .order("captured_at", { ascending: false })
    .limit(2)
  if (snErr) throw new Error(snErr.message)
  const snapRows = (snaps ?? []) as Array<{
    payout_in_transit_cents: number
    pending_balance_cents: number
    captured_at: string
  }>
  const prev =
    snapRows.length > 1 ?
      estimateUpcomingTransferCents({
        payoutInTransitCents: Math.round(Number(snapRows[1].payout_in_transit_cents ?? 0)),
        pendingLedgerCents: Math.round(Number(snapRows[1].pending_balance_cents ?? 0)),
      })
    : 0

  let openDisputeCount = options?.openDisputeCount ?? 0
  if (options?.openDisputeCount === undefined) {
    const { data: dRows, error: dErr } = await admin
      .from("blitzpay_invoice_disputes")
      .select("status")
      .eq("organization_id", organizationId)
      .limit(500)
    if (!dErr && dRows) {
      const terminal = new Set(["won", "lost", "charge_refunded", "closed"])
      for (const r of dRows as Array<{ status?: string }>) {
        const st = String(r.status ?? "").toLowerCase()
        if (!terminal.has(st)) openDisputeCount += 1
      }
    }
  }

  const achPending = options?.achPendingCount ?? 0

  const insights = buildBlitzpayTreasuryInsights({
    avgPayoutDelayDays: metrics.avgPayoutDelayDays,
    avgPayoutDelayBaselineDays: 3,
    pendingAchSettlementCount: achPending,
    pendingLedgerCents: metrics.pendingBalanceCents,
    instantTransferEligible: metrics.instantTransferEligible,
    usedInstantPayoutRecently: metrics.usedInstantPayoutInWindow,
    openDisputeCount,
    openDisputeBaseline: 0,
    estimateUpcomingTransferCents: metrics.estimateUpcomingTransferCents,
    upcomingTransferBaselineCents: prev,
    failedPayoutCount30d: metrics.failedPayoutCount30d,
  })

  return {
    ...metrics,
    recentPayouts,
    insights,
    orgBalanceRowComputedAt,
  }
}
