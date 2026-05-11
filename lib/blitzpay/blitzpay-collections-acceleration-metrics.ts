import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import {
  computeInvoicePaymentAllocation,
  invoiceGrandTotalCents,
} from "@/lib/billing/invoice-payment-allocation"
import type { TechnicianCollectionRow } from "@/lib/blitzpay/blitzpay-collections-copilot-types"
import { blitzpayOverdueRecoveryMultiplier } from "@/lib/blitzpay/blitzpay-revenue-forecast-math"

const OVERDUE_INVOICE_CAP = 200
const PAID_SAMPLE_CAP = 120
const PROFILE_CHUNK = 40

function ymdTodayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDaysYmd(ymd: string, days: number): string {
  const t = Date.parse(`${ymd}T00:00:00Z`) + days * 86400_000
  return new Date(t).toISOString().slice(0, 10)
}

function dayDiff(aYmd: string, bYmd: string): number {
  const a = Date.parse(`${aYmd.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${bYmd.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.floor((a - b) / (86400_000))
}

const FIELD_ELIGIBLE_WO = new Set([
  "open",
  "scheduled",
  "in_progress",
  "pending",
  "dispatched",
])

/**
 * Bounded collections acceleration metrics for reporting + intelligence surfaces.
 */
export type CollectionsPulseForAcceleration = {
  reminderEffectivenessRatePct: number
}

export async function fetchBlitzpayCollectionsAccelerationMetrics(
  admin: SupabaseClient,
  organizationId: string,
  opts: {
    sinceIso?: string | null
    paymentMethodMix: { card: number; us_bank_account: number; unknown: number }
    activeInstallmentPlansCount: number
    collectionsPulse: CollectionsPulseForAcceleration
  },
): Promise<{
  estimatedRecoverableOverdueCents: number
  likelyFieldCollectibleCents: number
  achAccelerationOpportunityCents: number
  installmentConversionOpportunityCents: number
  technicianAssistedRecoveryRatePct: number
  reminderConversionRatePct: number
  fieldCollectionRecoveryRatePct: number
  workOrdersWithCollectibleBalancesCount: number
  overdueCollectibleCents: number
  overdueInvoiceCount: number
  technicianCollectionLeaderboard: TechnicianCollectionRow[]
}> {
  assertUuid(organizationId, "organizationId")
  const today = ymdTodayUtc()
  const horizon = addDaysYmd(today, 14)
  const since60 = opts?.sinceIso ?? new Date(Date.now() - 60 * 86400_000).toISOString()

  const collections = opts.collectionsPulse
  const overdueRows = await admin
    .from("org_invoices")
    .select("id, customer_id, status, amount_cents, tax_amount_cents, due_date, work_order_id")
    .eq("organization_id", organizationId)
    .not("due_date", "is", null)
    .lt("due_date", today)
    .in("status", ["sent", "unpaid", "overdue"])
    .limit(OVERDUE_INVOICE_CAP)
  if (overdueRows.error) throw new Error(overdueRows.error.message)

  const rows = (overdueRows.data ?? []) as Array<{
    id: string
    customer_id: string | null
    status: string
    amount_cents: number
    tax_amount_cents: number | null
    due_date: string
    work_order_id: string | null
  }>

  const ids = rows.map((r) => r.id)
  const payBy = new Map<string, number>()
  if (ids.length > 0) {
    const chunk = 80
    for (let i = 0; i < ids.length; i += chunk) {
      const slice = ids.slice(i, i + chunk)
      const { data: pays, error: pErr } = await admin
        .from("org_invoice_payments")
        .select("invoice_id, amount_cents")
        .eq("organization_id", organizationId)
        .in("invoice_id", slice)
      if (pErr) throw new Error(pErr.message)
      for (const p of pays ?? []) {
        const row = p as { invoice_id: string; amount_cents: number }
        payBy.set(row.invoice_id, (payBy.get(row.invoice_id) ?? 0) + Math.round(Number(row.amount_cents)))
      }
    }
  }

  let overdueCollectibleCents = 0
  let overdueInvoiceCount = 0
  const woIds = new Set<string>()
  const balanceByInvoice = new Map<string, number>()
  for (const inv of rows) {
    const total = invoiceGrandTotalCents(inv)
    const gross = payBy.get(inv.id) ?? 0
    const alloc = computeInvoicePaymentAllocation({
      invoiceTotalCents: total,
      paymentsTotalCents: gross,
      dbInvoiceStatus: String(inv.status || ""),
    })
    const bal = Math.max(0, alloc.balanceDueCents)
    if (bal <= 0) continue
    overdueInvoiceCount += 1
    overdueCollectibleCents += bal
    balanceByInvoice.set(inv.id, bal)
    if (inv.work_order_id) woIds.add(inv.work_order_id)
  }

  const recoveryMult = blitzpayOverdueRecoveryMultiplier(collections.reminderEffectivenessRatePct)
  const estimatedRecoverableOverdueCents = Math.round(overdueCollectibleCents * recoveryMult)

  const woList = [...woIds]
  const woById = new Map<string, { status: string; scheduled_on: string | null; assigned_user_id: string | null }>()
  for (let i = 0; i < woList.length; i += 80) {
    const slice = woList.slice(i, i + 80)
    const { data: wos, error: wErr } = await admin
      .from("work_orders")
      .select("id, status, scheduled_on, assigned_user_id")
      .eq("organization_id", organizationId)
      .in("id", slice)
    if (wErr) break
    for (const w of (wos ?? []) as Array<{
      id: string
      status: string
      scheduled_on: string | null
      assigned_user_id: string | null
    }>) {
      woById.set(w.id, {
        status: String(w.status || "").toLowerCase(),
        scheduled_on: w.scheduled_on,
        assigned_user_id: w.assigned_user_id ?? null,
      })
    }
  }

  let likelyFieldCollectibleCents = 0
  const collectibleWo = new Set<string>()
  for (const inv of rows) {
    const bal = balanceByInvoice.get(inv.id) ?? 0
    if (bal <= 0 || !inv.work_order_id) continue
    const wo = woById.get(inv.work_order_id)
    if (!wo) continue
    const st = wo.status
    if (!FIELD_ELIGIBLE_WO.has(st)) continue
    const sched = wo.scheduled_on
    if (!sched) continue
    const s = sched.slice(0, 10)
    if (s >= today && s <= horizon) {
      likelyFieldCollectibleCents += bal
      collectibleWo.add(inv.work_order_id)
    }
  }

  const mix = opts.paymentMethodMix
  const denom = mix.card + mix.us_bank_account + mix.unknown
  const cardHeavy = denom > 0 && mix.card >= mix.us_bank_account * 2
  const achAccelerationOpportunityCents =
    overdueCollectibleCents > 0 && cardHeavy
      ? Math.min(Math.round(overdueCollectibleCents * 0.1), 200_000)
      : Math.min(Math.round(overdueCollectibleCents * 0.04), 120_000)

  const plans = opts.activeInstallmentPlansCount
  const installmentConversionOpportunityCents =
    overdueCollectibleCents > 0 && plans < 4
      ? Math.min(Math.round(overdueCollectibleCents * 0.16), 250_000)
      : Math.min(Math.round(overdueCollectibleCents * 0.06), 120_000)

  const fieldCollectionRecoveryRatePct =
    overdueCollectibleCents > 0
      ? Math.min(100, Math.round((likelyFieldCollectibleCents / overdueCollectibleCents) * 1000) / 10)
      : 0

  let fastPaid = 0
  let paidSample = 0
  {
    const { data: paid, error } = await admin
      .from("org_invoices")
      .select("id, work_order_id, paid_at, due_date")
      .eq("organization_id", organizationId)
      .eq("status", "paid")
      .not("work_order_id", "is", null)
      .not("paid_at", "is", null)
      .gte("paid_at", since60)
      .order("paid_at", { ascending: false })
      .limit(PAID_SAMPLE_CAP)
    if (!error && paid?.length) {
      const prow = paid as Array<{ id: string; work_order_id: string; paid_at: string; due_date: string | null }>
      const wids = [...new Set(prow.map((p) => p.work_order_id))]
      const woComplete = new Map<string, string | null>()
      for (let i = 0; i < wids.length; i += 80) {
        const slice = wids.slice(i, i + 80)
        const { data: wos, error: wErr } = await admin
          .from("work_orders")
          .select("id, completed_at")
          .eq("organization_id", organizationId)
          .in("id", slice)
        if (wErr) break
        for (const w of (wos ?? []) as Array<{ id: string; completed_at: string | null }>) {
          woComplete.set(w.id, w.completed_at)
        }
      }
      for (const p of prow) {
        paidSample += 1
        const cAt = woComplete.get(p.work_order_id)
        if (!cAt || !p.due_date) continue
        const paidDay = p.paid_at.slice(0, 10)
        const compDay = cAt.slice(0, 10)
        if (dayDiff(paidDay, compDay) >= 0 && dayDiff(paidDay, compDay) <= 14) fastPaid += 1
      }
    }
  }
  const technicianAssistedRecoveryRatePct =
    paidSample > 0 ? Math.min(100, Math.round((fastPaid / paidSample) * 1000) / 10) : 0

  const leaderboard = await buildTechnicianLeaderboard(admin, organizationId, since60)

  return {
    estimatedRecoverableOverdueCents,
    likelyFieldCollectibleCents,
    achAccelerationOpportunityCents,
    installmentConversionOpportunityCents,
    technicianAssistedRecoveryRatePct,
    reminderConversionRatePct: collections.reminderEffectivenessRatePct,
    fieldCollectionRecoveryRatePct,
    workOrdersWithCollectibleBalancesCount: collectibleWo.size,
    overdueCollectibleCents,
    overdueInvoiceCount,
    technicianCollectionLeaderboard: leaderboard,
  }
}

async function buildTechnicianLeaderboard(
  admin: SupabaseClient,
  organizationId: string,
  sinceIso: string,
): Promise<TechnicianCollectionRow[]> {
  const { data: paid, error } = await admin
    .from("org_invoices")
    .select("id, work_order_id, amount_cents, tax_amount_cents, paid_at")
    .eq("organization_id", organizationId)
    .eq("status", "paid")
    .not("work_order_id", "is", null)
    .not("paid_at", "is", null)
    .gte("paid_at", sinceIso)
    .order("paid_at", { ascending: false })
    .limit(PAID_SAMPLE_CAP)
  if (error || !paid?.length) return []

  const prow = paid as Array<{
    id: string
    work_order_id: string
    amount_cents: number
    tax_amount_cents: number | null
    paid_at: string
  }>
  const wids = [...new Set(prow.map((p) => p.work_order_id))]
  const assignee = new Map<string, string | null>()
  for (let i = 0; i < wids.length; i += 80) {
    const slice = wids.slice(i, i + 80)
    const { data: wos, error: wErr } = await admin
      .from("work_orders")
      .select("id, assigned_user_id")
      .eq("organization_id", organizationId)
      .in("id", slice)
    if (wErr) break
    for (const w of (wos ?? []) as Array<{ id: string; assigned_user_id: string | null }>) {
      assignee.set(w.id, w.assigned_user_id ?? null)
    }
  }

  const centsByUser = new Map<string, number>()
  let nByUser = new Map<string, number>()
  for (const p of prow) {
    const uid = assignee.get(p.work_order_id) ?? "__unassigned__"
    const cents = Math.max(0, Math.round(p.amount_cents) + Math.max(0, Math.round(Number(p.tax_amount_cents ?? 0))))
    centsByUser.set(uid, (centsByUser.get(uid) ?? 0) + cents)
    nByUser.set(uid, (nByUser.get(uid) ?? 0) + 1)
  }

  const sorted = [...centsByUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const userIds = sorted.map(([k]) => k).filter((k) => k !== "__unassigned__" && k.length > 10)
  const names = new Map<string, string>()
  for (let i = 0; i < userIds.length; i += PROFILE_CHUNK) {
    const slice = userIds.slice(i, i + PROFILE_CHUNK)
    const { data: profs, error: pErr } = await admin.from("profiles").select("id, full_name, email").in("id", slice)
    if (pErr) continue
    for (const pr of (profs ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      const label = (pr.full_name && pr.full_name.trim()) || pr.email || "Team member"
      names.set(pr.id, label)
    }
  }

  return sorted.map(([uid, cents], idx) => ({
    rank: idx + 1,
    displayName: uid === "__unassigned__" ? "Unassigned route" : names.get(uid) ?? "Team member",
    windowCollectedCents: cents,
    attributedInvoiceSample: nByUser.get(uid) ?? 0,
  }))
}
