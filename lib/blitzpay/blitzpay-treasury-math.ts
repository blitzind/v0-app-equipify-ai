/**
 * Pure treasury / contractor balance helpers (Stripe ledger semantics, tests).
 */

import { isBlitzpayConnectedAccountActivityType } from "@/lib/blitzpay/blitzpay-reconciliation-math"

export type BlitzpayTreasuryAvailableOnRow = {
  balance_type: string
  net_cents: number
  available_on: string | null
}

export function utcTodayYmd(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Splits synced **activity** balance-transaction rows into available vs pending
 * using `available_on` vs today (UTC). Rows with null `available_on` count as pending.
 */
export function partitionBlitzpayActivityNetByAvailability(
  rows: BlitzpayTreasuryAvailableOnRow[],
  todayYmd: string,
): { availableCents: number; pendingCents: number } {
  let availableCents = 0
  let pendingCents = 0
  for (const r of rows) {
    if (!isBlitzpayConnectedAccountActivityType(String(r.balance_type || ""))) continue
    const net = Math.round(Number(r.net_cents))
    if (!Number.isFinite(net)) continue
    const ao = r.available_on?.trim() || null
    if (!ao || ao > todayYmd) pendingCents += net
    else availableCents += net
  }
  return { availableCents, pendingCents }
}

export function computeHeldReserveCents(input: {
  reserveTargetCents: number
  ledgerAvailableCents: number
}): number {
  const target = Math.max(0, Math.round(Number(input.reserveTargetCents)))
  const avail = Math.round(Number(input.ledgerAvailableCents))
  if (!Number.isFinite(avail)) return 0
  return Math.min(target, Math.max(0, avail))
}

export function computeOperatingBalanceCents(input: {
  ledgerAvailableCents: number
  heldReserveCents: number
}): number {
  const avail = Math.max(0, Math.round(Number(input.ledgerAvailableCents)))
  const held = Math.max(0, Math.round(Number(input.heldReserveCents)))
  return Math.max(0, avail - held)
}

export function averagePayoutDelayDaysFromPaidRows(
  rows: Array<{ stripe_created_at: string; arrival_date: string | null }>,
): number | null {
  const delays: number[] = []
  for (const r of rows) {
    const arr = r.arrival_date?.trim()
    if (!arr) continue
    const created = Date.parse(r.stripe_created_at)
    const arrival = Date.parse(`${arr}T12:00:00.000Z`)
    if (!Number.isFinite(created) || !Number.isFinite(arrival)) continue
    const days = (arrival - created) / 86400000
    if (Number.isFinite(days)) delays.push(days)
  }
  if (delays.length === 0) return null
  return delays.reduce((a, b) => a + b, 0) / delays.length
}

/** Heuristic upcoming bank movement from in-flight payouts + pending ledger funds (not a Stripe cash forecast). */
export function estimateUpcomingTransferCents(input: {
  payoutInTransitCents: number
  pendingLedgerCents: number
}): number {
  const a = Math.max(0, Math.round(Number(input.payoutInTransitCents)))
  const b = Math.max(0, Math.round(Number(input.pendingLedgerCents)))
  return a + b
}

export type BlitzpayPayoutSpeedLane = "standard" | "accelerated" | "unknown"

export function classifyPayoutSpeedLaneFromRecentMethods(methods: ReadonlyArray<string | null | undefined>): BlitzpayPayoutSpeedLane {
  const set = new Set(methods.map((m) => String(m ?? "").toLowerCase()).filter(Boolean))
  if (set.has("instant")) return "accelerated"
  if (set.has("standard") || set.has("wire")) return "standard"
  if (set.size === 0) return "unknown"
  return "standard"
}

export function computeInstantTransferEligibility(input: {
  stripePayoutsEnabled: boolean
  usedInstantPayoutInWindow: boolean
  instantPayoutInterest: boolean
}): boolean {
  if (!input.stripePayoutsEnabled) return false
  return input.usedInstantPayoutInWindow || Boolean(input.instantPayoutInterest)
}
