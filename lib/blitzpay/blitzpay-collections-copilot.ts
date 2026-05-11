import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildCollectionsAutomationInsights,
  buildCustomerPaymentBehaviorProfile,
} from "@/lib/blitzpay/blitzpay-collections-automation-insights"
import type {
  BlitzpayCollectionsCopilotPayload,
  CustomerBehaviorSegment,
} from "@/lib/blitzpay/blitzpay-collections-copilot-types"
import { buildCollectionsPriorityQueue, type PriorityInvoiceInput } from "@/lib/blitzpay/blitzpay-collections-priority"
import { fetchCustomerPaymentBehaviorSummary } from "@/lib/blitzpay/blitzpay-customer-payment-behavior"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import {
  computeInvoicePaymentAllocation,
  invoiceGrandTotalCents,
} from "@/lib/billing/invoice-payment-allocation"
import { fetchBlitzpayOrgRevenueIntelligence } from "@/lib/blitzpay/blitzpay-revenue-intelligence"
import { fetchBlitzpayCollectionsAccelerationMetrics } from "@/lib/blitzpay/blitzpay-collections-acceleration-metrics"

const PRIORITY_SCAN = 60
const REMINDER_CHUNK = 40

function ymdTodayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function dayDiffFromDue(todayYmd: string, dueYmd: string): number {
  const a = Date.parse(`${todayYmd}T00:00:00Z`)
  const b = Date.parse(`${dueYmd.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.floor((a - b) / 86400_000)
}

export async function fetchBlitzpayCollectionsCopilot(
  admin: SupabaseClient,
  organizationId: string,
  options?: { reportingWindowDays?: number },
): Promise<BlitzpayCollectionsCopilotPayload> {
  assertUuid(organizationId, "organizationId")
  const reportingWindowDays = Math.min(90, Math.max(7, Math.round(Number(options?.reportingWindowDays ?? 30))))
  const sinceIso = new Date(Date.now() - reportingWindowDays * 86400_000).toISOString()
  const today = ymdTodayUtc()

  const [intelligence, customerSummary] = await Promise.all([
    fetchBlitzpayOrgRevenueIntelligence(admin, organizationId, { reportingWindowDays }),
    fetchCustomerPaymentBehaviorSummary(admin, organizationId),
  ])

  const d = intelligence.dashboard
  const c = intelligence.collections
  const reportingPulse = { reminderEffectivenessRatePct: c.reminderEffectivenessRatePct }

  const accel = await fetchBlitzpayCollectionsAccelerationMetrics(admin, organizationId, {
    sinceIso,
    paymentMethodMix: d.paymentMethodMix,
    activeInstallmentPlansCount: d.activeInstallmentPlansCount,
    collectionsPulse: reportingPulse,
  })

  const { data: overdueInv, error: invErr } = await admin
    .from("org_invoices")
    .select("id, customer_id, status, amount_cents, tax_amount_cents, due_date, work_order_id, updated_at")
    .eq("organization_id", organizationId)
    .not("due_date", "is", null)
    .lt("due_date", today)
    .in("status", ["sent", "unpaid", "overdue"])
    .order("due_date", { ascending: true })
    .limit(PRIORITY_SCAN)
  if (invErr) throw new Error(invErr.message)

  const invRows = (overdueInv ?? []) as Array<{
    id: string
    customer_id: string | null
    status: string
    amount_cents: number
    tax_amount_cents: number | null
    due_date: string
    work_order_id: string | null
  }>
  const invIds = invRows.map((r) => r.id)
  const payBy = new Map<string, number>()
  if (invIds.length > 0) {
    const { data: pays, error: pErr } = await admin
      .from("org_invoice_payments")
      .select("invoice_id, amount_cents")
      .eq("organization_id", organizationId)
      .in("invoice_id", invIds)
    if (pErr) throw new Error(pErr.message)
    for (const p of pays ?? []) {
      const row = p as { invoice_id: string; amount_cents: number }
      payBy.set(row.invoice_id, (payBy.get(row.invoice_id) ?? 0) + Math.round(Number(row.amount_cents)))
    }
  }

  const reminderCounts = new Map<string, number>()
  for (let i = 0; i < invIds.length; i += REMINDER_CHUNK) {
    const slice = invIds.slice(i, i + REMINDER_CHUNK)
    const { data: rems, error: rErr } = await admin
      .from("blitzpay_payment_reminders")
      .select("org_invoice_id, created_at")
      .eq("organization_id", organizationId)
      .in("org_invoice_id", slice)
      .gte("created_at", sinceIso)
    if (rErr) break
    for (const r of (rems ?? []) as Array<{ org_invoice_id: string }>) {
      reminderCounts.set(r.org_invoice_id, (reminderCounts.get(r.org_invoice_id) ?? 0) + 1)
    }
  }

  const abandonedSet = new Set<string>()
  {
    const { data: pis, error: piErr } = await admin
      .from("blitzpay_payment_intents")
      .select("org_invoice_id, status")
      .eq("organization_id", organizationId)
      .in("org_invoice_id", invIds)
    if (!piErr && pis) {
      for (const p of pis as Array<{ org_invoice_id: string | null; status: string }>) {
        const st = String(p.status || "").toLowerCase()
        if ((st === "requires_payment_method" || st === "canceled") && p.org_invoice_id) {
          abandonedSet.add(p.org_invoice_id)
        }
      }
    }
  }

  const planInvoices = new Set<string>()
  if (invIds.length > 0) {
    const { data: plans, error: plErr } = await admin
      .from("blitzpay_payment_plans")
      .select("org_invoice_id, status")
      .eq("organization_id", organizationId)
      .in("org_invoice_id", invIds)
      .in("status", ["active", "staged"])
    if (!plErr && plans) {
      for (const p of plans as Array<{ org_invoice_id: string | null }>) {
        if (p.org_invoice_id) planInvoices.add(p.org_invoice_id)
      }
    }
  }

  const schedSet = new Set<string>()
  {
    const { data: sp, error: sErr } = await admin
      .from("blitzpay_scheduled_invoice_payments")
      .select("org_invoice_id, status")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .limit(400)
    if (!sErr && sp) {
      for (const r of sp as Array<{ org_invoice_id: string }>) {
        schedSet.add(r.org_invoice_id)
      }
    }
  }

  const walletByCustomer = new Map<string, number>()
  const custIds = [...new Set(invRows.map((r) => r.customer_id).filter(Boolean))] as string[]
  for (let i = 0; i < custIds.length; i += REMINDER_CHUNK) {
    const slice = custIds.slice(i, i + REMINDER_CHUNK)
    const { data: wals, error: wErr } = await admin
      .from("blitzpay_customer_wallets")
      .select("customer_id, available_credit_cents")
      .eq("organization_id", organizationId)
      .in("customer_id", slice)
    if (wErr) break
    for (const w of (wals ?? []) as Array<{ customer_id: string; available_credit_cents: number }>) {
      walletByCustomer.set(
        w.customer_id,
        Math.max(0, Math.round(Number(w.available_credit_cents))),
      )
    }
  }

  const woIds = [...new Set(invRows.map((r) => r.work_order_id).filter(Boolean))] as string[]
  const woMeta = new Map<string, { status: string; scheduled_on: string | null; assigned_user_id: string | null; completed_at: string | null }>()
  for (let i = 0; i < woIds.length; i += 40) {
    const slice = woIds.slice(i, i + 40)
    const { data: wos, error: wErr } = await admin
      .from("work_orders")
      .select("id, status, scheduled_on, assigned_user_id, completed_at")
      .eq("organization_id", organizationId)
      .in("id", slice)
    if (wErr) break
    for (const w of (wos ?? []) as Array<{
      id: string
      status: string
      scheduled_on: string | null
      assigned_user_id: string | null
      completed_at: string | null
    }>) {
      woMeta.set(w.id, {
        status: String(w.status || "").toLowerCase(),
        scheduled_on: w.scheduled_on,
        assigned_user_id: w.assigned_user_id ?? null,
        completed_at: w.completed_at,
      })
    }
  }

  const horizon = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10)
  const fieldEligibleStatuses = new Set(["open", "scheduled", "in_progress", "pending", "dispatched"])
  const priorityInputs: PriorityInvoiceInput[] = []
  for (const inv of invRows) {
    const total = invoiceGrandTotalCents(inv)
    const gross = payBy.get(inv.id) ?? 0
    const alloc = computeInvoicePaymentAllocation({
      invoiceTotalCents: total,
      paymentsTotalCents: gross,
      dbInvoiceStatus: String(inv.status || ""),
    })
    const balanceDueCents = Math.max(0, alloc.balanceDueCents)
    if (balanceDueCents <= 0) continue

    const daysPastDue = Math.max(0, dayDiffFromDue(today, inv.due_date))
    const wo = inv.work_order_id ? woMeta.get(inv.work_order_id) : undefined
    const schedSoon = (() => {
      if (!wo?.scheduled_on) return false
      const s = wo.scheduled_on.slice(0, 10)
      return s >= today && s <= horizon && fieldEligibleStatuses.has(wo.status)
    })()

    const completed30 = Boolean(
      wo?.completed_at && Date.parse(wo.completed_at) >= Date.now() - 30 * 86400_000,
    )

    priorityInputs.push({
      invoiceId: inv.id,
      customerId: inv.customer_id,
      balanceDueCents,
      daysPastDue,
      hasActiveInstallment: planInvoices.has(inv.id),
      hasScheduledPayment: schedSet.has(inv.id),
      abandonedCheckout: abandonedSet.has(inv.id),
      walletCreditAvailableCents: inv.customer_id ? walletByCustomer.get(inv.customer_id) ?? 0 : 0,
      customerLateRatePct: customerSummary.latePaymentRatePct,
      customerAvgDaysToPayWhenPaid: customerSummary.averageDaysToPayWhenPaid,
      workOrderScheduledWithin14d: Boolean(schedSoon),
      workOrderCompletedWithin30d: Boolean(completed30),
      reminderDispatchesLast30d: reminderCounts.get(inv.id) ?? 0,
      hasTechnicianOnWorkOrder: Boolean(wo?.assigned_user_id),
      achHeavyCustomer: customerSummary.summaryLines.some((l) => l.toLowerCase().includes("ach")),
    })
  }

  const priorityQueue = buildCollectionsPriorityQueue(priorityInputs).slice(0, 25)

  const profile = buildCustomerPaymentBehaviorProfile(customerSummary, {
    card: d.paymentMethodMix.card,
    ach: d.paymentMethodMix.us_bank_account,
  })

  const segments: CustomerBehaviorSegment[] = []
  if (c.reminderEffectivenessRatePct >= 55 && d.overdueInvoiceCount > 0) {
    segments.push({
      segment: "reminder_responsive",
      countApprox: Math.min(d.overdueInvoiceCount, 12),
      note: "Reminder dispatch rate suggests a cohort may pay after a nudge — prioritize hosted pay links.",
    })
  }
  if (customerSummary.likelyFinancingBenefit === "high" || customerSummary.likelyFinancingBenefit === "medium") {
    segments.push({
      segment: "financing_candidate",
      countApprox: 3,
      note: "Payment behavior matches customers who often benefit from financing or staged installments.",
    })
  }
  if (profile.achVsCardHint === "card_heavy") {
    segments.push({
      segment: "ach_candidate",
      countApprox: 2,
      note: "Card-heavy mix on recent activity — ACH can reduce fees and speed settlement on large tickets.",
    })
  }
  if (d.walletLiabilityCents >= 25_000) {
    segments.push({
      segment: "wallet_credit",
      countApprox: 1,
      note: "Wallet credits are available — applying credits before dunning can preserve relationships.",
    })
  }
  if (customerSummary.trustSignal === "generally_on_time") {
    segments.push({
      segment: "stable",
      countApprox: Math.max(1, Math.min(8, customerSummary.invoicesSampled)),
      note: "A portion of the sample pays on time — keep cadence lighter for that cohort.",
    })
  }

  const automationInsights = buildCollectionsAutomationInsights({
    averageDaysToPayWhenPaid: customerSummary.averageDaysToPayWhenPaid,
    overdueCollectibleCents: d.overdueCollectibleCents,
    overdueInvoiceCount: d.overdueInvoiceCount,
    activeInstallmentPlansCount: d.activeInstallmentPlansCount,
    walletSpendableCreditTotalCents: d.customerWalletSpendableCreditTotalCents,
    achPendingSettlementCents: intelligence.forecasts.achPendingSettlementCents,
    paymentMethodMixCard: d.paymentMethodMix.card,
    paymentMethodMixAch: d.paymentMethodMix.us_bank_account,
    reminderEffectivenessRatePct: c.reminderEffectivenessRatePct,
    workOrdersFieldCollectibleApprox: accel.workOrdersWithCollectibleBalancesCount,
    fieldCollectibleCentsApprox: accel.likelyFieldCollectibleCents,
  })

  const recommendations: BlitzpayCollectionsCopilotPayload["recommendations"] = []
  let rid = 0
  if (d.overdueCollectibleCents >= 75_000) {
    recommendations.push({
      id: `c-${rid++}`,
      severity: "warning",
      message: `Overdue open balance is material (${fmtUsd(d.overdueCollectibleCents)}) — align office follow-up with field visits where scheduled.`,
    })
  }
  if (accel.likelyFieldCollectibleCents >= 25_000) {
    recommendations.push({
      id: `c-${rid++}`,
      severity: "info",
      message: `About ${fmtUsd(accel.likelyFieldCollectibleCents)} ties to upcoming field visits in the next two weeks — good window for collect-on-site.`,
    })
  }
  if (c.abandonedCheckoutInvoices >= 2) {
    recommendations.push({
      id: `c-${rid++}`,
      severity: "warning",
      message: `${c.abandonedCheckoutInvoices} invoice(s) show abandoned checkout attempts — resend a fresh hosted payment link with clearer payment options.`,
    })
  }

  return {
    reportingWindowDays,
    generatedAt: new Date().toISOString(),
    priorityQueue,
    overdueSummary: {
      overdueInvoiceCount: d.overdueInvoiceCount,
      overdueCollectibleCents: d.overdueCollectibleCents,
      abandonedCheckoutInvoices: c.abandonedCheckoutInvoices,
    },
    technicianCollections: {
      leaderboard: accel.technicianCollectionLeaderboard.slice(0, 6),
      fieldCollectionRecoveryRatePct: accel.fieldCollectionRecoveryRatePct,
      workOrdersWithCollectibleBalancesCount: accel.workOrdersWithCollectibleBalancesCount,
    },
    customerBehaviorSegments: segments.slice(0, 5),
    customerPaymentBehaviorProfile: profile,
    recommendations,
    recoveryForecasts: {
      estimatedRecoverableOverdueCents: accel.estimatedRecoverableOverdueCents,
      likelyFieldCollectibleCents: accel.likelyFieldCollectibleCents,
      next14dScheduledFieldOpportunityCents: accel.likelyFieldCollectibleCents,
    },
    automationInsights,
    acceleration: {
      estimatedRecoverableOverdueCents: accel.estimatedRecoverableOverdueCents,
      likelyFieldCollectibleCents: accel.likelyFieldCollectibleCents,
      achAccelerationOpportunityCents: accel.achAccelerationOpportunityCents,
      installmentConversionOpportunityCents: accel.installmentConversionOpportunityCents,
      technicianAssistedRecoveryRatePct: accel.technicianAssistedRecoveryRatePct,
      reminderConversionRatePct: accel.reminderConversionRatePct,
    },
  }
}

function fmtUsd(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}
