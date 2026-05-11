import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildRetentionRecommendationLines,
  churnRiskScore0to100,
  scoreMembershipHealthFromSignals,
} from "@/lib/blitzpay/blitzpay-membership-health"
import {
  countContractsExpiringBetween,
  countExpiredStatusRiskContracts,
  countMaintenancePlansDueWithinDays,
  maintenanceIntervalMonthsEquivalent,
  projectedRenewalInflowNextDaysCents,
} from "@/lib/blitzpay/blitzpay-renewal-forecast"
import type { BlitzpayRecurringRevenueMetrics, BlitzpayRecurringRevenuePulsePayload } from "@/lib/blitzpay/blitzpay-recurring-revenue-types"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"

export type { BlitzpayRecurringRevenueMetrics, BlitzpayRecurringRevenuePulsePayload } from "@/lib/blitzpay/blitzpay-recurring-revenue-types"

export const RECURRING_MAINTENANCE_SCAN_CAP = 400
export const RECURRING_CONTRACT_SCAN_CAP = 250
export const RECURRING_SCHEDULE_SCAN_CAP = 320
export const RECURRING_PROFILE_SCAN_CAP = 1600
export const RECURRING_FAILED_SCHEDULE_CAP = 40
export const RECURRING_INSTALLMENT_PLAN_CAP = 120

function ymdTodayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400_000).toISOString()
}

async function sumScheduledPendingBetween(
  admin: SupabaseClient,
  organizationId: string,
  startIso: string,
  endIso: string,
): Promise<number> {
  const { data, error } = await admin
    .from("blitzpay_scheduled_invoice_payments")
    .select("invoice_portion_cents")
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .gte("scheduled_for", startIso)
    .lte("scheduled_for", endIso)
  if (error) throw new Error(error.message)
  return (data ?? []).reduce(
    (s, r) => s + Math.max(0, Math.round(Number((r as { invoice_portion_cents: number }).invoice_portion_cents))),
    0,
  )
}

async function sumInstallmentRemainingDueInRange(
  admin: SupabaseClient,
  organizationId: string,
  startYmd: string,
  endYmd: string,
): Promise<number> {
  const { data: plans, error: pErr } = await admin
    .from("blitzpay_payment_plans")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .limit(RECURRING_INSTALLMENT_PLAN_CAP)
  if (pErr) throw new Error(pErr.message)
  const ids = (plans ?? []).map((p) => (p as { id: string }).id)
  if (ids.length === 0) return 0
  let sum = 0
  const chunk = 80
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk)
    const { data: rows, error } = await admin
      .from("blitzpay_payment_plan_installments")
      .select("target_cents, paid_cents, due_on, status")
      .in("payment_plan_id", slice)
      .not("due_on", "is", null)
      .gte("due_on", startYmd)
      .lte("due_on", endYmd)
    if (error) throw new Error(error.message)
    for (const r of rows ?? []) {
      const row = r as { target_cents: number; paid_cents: number; status: string }
      const st = String(row.status || "").toLowerCase()
      if (st === "paid" || st === "canceled" || st === "waived") continue
      const rem = Math.max(0, Math.round(Number(row.target_cents)) - Math.round(Number(row.paid_cents)))
      sum += rem
    }
  }
  return sum
}

export async function fetchBlitzpayRecurringRevenueMetrics(
  admin: SupabaseClient,
  organizationId: string,
  options?: { reportingWindowDays?: number; grossCollectedWindowCents?: number; overdueInvoiceCount?: number },
): Promise<BlitzpayRecurringRevenueMetrics> {
  assertUuid(organizationId, "organizationId")
  const reportingWindowDays = Math.min(90, Math.max(7, Math.round(Number(options?.reportingWindowDays ?? 30))))
  const sinceIso = new Date(Date.now() - reportingWindowDays * 86400_000).toISOString()
  const todayYmd = ymdTodayUtc()
  const nowIso = new Date().toISOString()
  const end90 = isoDaysFromNow(90)
  const end30ymd = isoDaysFromNow(30).slice(0, 10)

  const grossWindow = Math.max(0, Math.round(Number(options?.grossCollectedWindowCents ?? 0)))
  const overdueInvApprox = Math.max(0, Math.round(Number(options?.overdueInvoiceCount ?? 0)))

  const [
    sched7,
    sched30,
    sched90,
    inst7,
    inst30,
    inst90,
    { data: mrows, error: mErr },
    { data: crows, error: cErr },
    { data: srows, error: sErr },
    { data: prows, error: pErr },
    { data: frows, error: fErr },
    { count: succWindowCount, error: succErr },
  ] = await Promise.all([
    sumScheduledPendingBetween(admin, organizationId, nowIso, isoDaysFromNow(7)),
    sumScheduledPendingBetween(admin, organizationId, nowIso, isoDaysFromNow(30)),
    sumScheduledPendingBetween(admin, organizationId, nowIso, end90),
    sumInstallmentRemainingDueInRange(admin, organizationId, todayYmd, isoDaysFromNow(7).slice(0, 10)),
    sumInstallmentRemainingDueInRange(admin, organizationId, todayYmd, end30ymd),
    sumInstallmentRemainingDueInRange(admin, organizationId, todayYmd, end90.slice(0, 10)),
    admin
      .from("maintenance_plans")
      .select("id, customer_id, status, interval_unit, interval_value, next_due_date, is_archived")
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .limit(RECURRING_MAINTENANCE_SCAN_CAP),
    admin
      .from("org_service_contracts")
      .select("id, customer_id, status, end_date, start_date")
      .eq("organization_id", organizationId)
      .limit(RECURRING_CONTRACT_SCAN_CAP),
    admin
      .from("blitzpay_scheduled_invoice_payments")
      .select("id, org_invoice_id, customer_id, invoice_portion_cents, status, scheduled_for, last_error, updated_at")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(RECURRING_SCHEDULE_SCAN_CAP),
    admin
      .from("blitzpay_customer_payment_profiles")
      .select("customer_id, autopay_authorization_status")
      .eq("organization_id", organizationId)
      .limit(RECURRING_PROFILE_SCAN_CAP),
    admin
      .from("blitzpay_scheduled_invoice_payments")
      .select("id, org_invoice_id, customer_id, invoice_portion_cents, last_error, updated_at")
      .eq("organization_id", organizationId)
      .eq("status", "failed")
      .gte("updated_at", sinceIso)
      .order("updated_at", { ascending: false })
      .limit(RECURRING_FAILED_SCHEDULE_CAP),
    admin
      .from("blitzpay_scheduled_invoice_payments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "succeeded")
      .gte("updated_at", sinceIso),
  ])

  if (mErr) throw new Error(mErr.message)
  if (cErr) throw new Error(cErr.message)
  if (sErr) throw new Error(sErr.message)
  if (pErr) throw new Error(pErr.message)
  if (fErr) throw new Error(fErr.message)
  if (succErr) throw new Error(succErr.message)

  const maintenanceRows = (mrows ?? []) as Array<{
    id: string
    customer_id: string
    status: string
    interval_unit: string
    interval_value: number
    next_due_date: string | null
    is_archived: boolean
  }>

  let maintenanceActiveCount = 0
  let maintenancePausedCount = 0
  let maintenanceExpiredCount = 0
  let maintenanceCadenceUpliftCents = 0
  for (const m of maintenanceRows) {
    const st = String(m.status || "").toLowerCase()
    if (st === "active") {
      maintenanceActiveCount += 1
      const mo = maintenanceIntervalMonthsEquivalent(m.interval_unit, m.interval_value)
      maintenanceCadenceUpliftCents += Math.min(25_000, Math.round(5000 / Math.max(0.25, mo)))
    } else if (st === "paused") maintenancePausedCount += 1
    else if (st === "expired") maintenanceExpiredCount += 1
  }

  const contractRows = (crows ?? []) as Array<{
    id: string
    customer_id: string
    status: string
    end_date: string | null
    start_date: string | null
  }>

  let contractActiveCount = 0
  let contractSuspendedCount = 0
  for (const c of contractRows) {
    const st = String(c.status || "").toLowerCase()
    if (st === "active") contractActiveCount += 1
    if (st === "suspended") contractSuspendedCount += 1
  }

  const contractExpiring30dCount = countContractsExpiringBetween(
    contractRows.map((c) => ({ status: c.status, endYmd: c.end_date })),
    todayYmd,
    end30ymd,
  )
  const expiredContractDataRiskCount = countExpiredStatusRiskContracts(
    contractRows.map((c) => ({ status: c.status, endYmd: c.end_date })),
    todayYmd,
  )

  const maintenanceDueNext30dCount = countMaintenancePlansDueWithinDays(
    maintenanceRows.map((m) => ({
      status: m.status,
      nextDueYmd: m.next_due_date,
      isArchived: Boolean(m.is_archived),
    })),
    todayYmd,
    30,
  )

  const activePlanCustomers = new Set<string>()
  for (const m of maintenanceRows) {
    if (String(m.status || "").toLowerCase() === "active" && m.customer_id) activePlanCustomers.add(m.customer_id)
  }

  const autopayActive = new Set<string>()
  for (const p of (prows ?? []) as Array<{ customer_id: string; autopay_authorization_status?: string }>) {
    if (String(p.autopay_authorization_status || "").toLowerCase() === "active") autopayActive.add(p.customer_id)
  }

  let customersMissingAutopayWithActivePlans = 0
  for (const cid of activePlanCustomers) {
    if (!autopayActive.has(cid)) customersMissingAutopayWithActivePlans += 1
  }

  const profileCustomers = new Set(
    ((prows ?? []) as Array<{ customer_id: string }>).map((p) => p.customer_id).filter(Boolean),
  )
  const autopayAdoptionPct =
    profileCustomers.size === 0
      ? 0
      : Math.min(100, Math.round((autopayActive.size / Math.max(1, profileCustomers.size)) * 1000) / 10)

  const schedRows = (srows ?? []) as Array<{
    id: string
    org_invoice_id: string
    customer_id: string
    invoice_portion_cents: number
    status: string
    scheduled_for: string
    last_error: string | null
    updated_at: string
  }>
  let scheduledPendingCount = 0
  for (const s of schedRows) {
    if (String(s.status || "").toLowerCase() === "pending") scheduledPendingCount += 1
  }

  let scheduledFailedWindowCount = 0
  let failedRenewalExposureCents = 0
  for (const f of (frows ?? []) as Array<{ invoice_portion_cents: number }>) {
    scheduledFailedWindowCount += 1
    failedRenewalExposureCents += Math.max(0, Math.round(Number(f.invoice_portion_cents)))
  }

  const renewalSucceededWindow = succWindowCount ?? 0
  const renewalAttempts = renewalSucceededWindow + scheduledFailedWindowCount
  const renewalSuccessProxyPct =
    renewalAttempts === 0 ? 100 : Math.min(100, Math.round((renewalSucceededWindow / Math.max(1, renewalAttempts)) * 1000) / 10)

  const projectedRenewalRevenue90dCents = projectedRenewalInflowNextDaysCents({
    scheduledPendingCents: sched90,
    installmentDueCents: inst90,
    maintenanceCadenceUpliftCents: Math.min(250_000, maintenanceCadenceUpliftCents),
  })

  const recurringPlannedInflow7dCents = sched7 + inst7
  const recurringPlannedInflow30dCents = sched30 + inst30
  const recurringPlannedInflow90dCents = sched90 + inst90

  const annualizedRecurringRunRateProxyCents = Math.min(500_000_000, Math.round(recurringPlannedInflow30dCents * 12))

  const recurringMixOfCollectedWindowPct =
    grossWindow <= 0
      ? 0
      : Math.min(100, Math.round((recurringPlannedInflow30dCents / grossWindow) * 1000) / 10)

  const churnRiskScore0to100Val = churnRiskScore0to100({
    failedScheduledWindowCount: scheduledFailedWindowCount,
    failedExposureCents: failedRenewalExposureCents,
    overdueInvoiceCount: overdueInvApprox,
    customersMissingAutopayWithActivePlans,
    expiredContractDataRiskCount,
  })

  const recurringStabilityScore0to100 = Math.max(
    0,
    Math.min(100, Math.round(82 - churnRiskScore0to100Val * 0.35 - (100 - renewalSuccessProxyPct) * 0.25)),
  )

  const denom = Math.max(1, maintenanceActiveCount + contractActiveCount)
  const serviceAgreementUtilizationPct = Math.min(100, Math.round((contractActiveCount / denom) * 1000) / 10)

  const treasuryConfidenceNote =
    recurringStabilityScore0to100 >= 72
      ? "Recurring inflows and autopay signals support steady contractor cash timing."
      : recurringStabilityScore0to100 >= 55
        ? "Recurring revenue is present but renewal/autopay friction adds cash timing variance."
        : "Recurring renewals need attention — failed scheduled payments or missing autopay authorizations pressure cash confidence."

  return {
    reportingWindowDays,
    generatedAt: new Date().toISOString(),
    recurringPlannedInflow7dCents,
    recurringPlannedInflow30dCents,
    recurringPlannedInflow90dCents,
    annualizedRecurringRunRateProxyCents,
    recurringMixOfCollectedWindowPct,
    autopayAdoptionPct,
    renewalSuccessProxyPct,
    churnRiskScore0to100: churnRiskScore0to100Val,
    failedRenewalExposureCents,
    maintenanceActiveCount,
    maintenancePausedCount,
    maintenanceExpiredCount,
    maintenanceDueNext30dCount,
    contractActiveCount,
    contractSuspendedCount,
    contractExpiring30dCount,
    expiredContractDataRiskCount,
    customersMissingAutopayWithActivePlans,
    scheduledPendingCount,
    scheduledFailedWindowCount,
    recurringStabilityScore0to100,
    projectedRenewalRevenue90dCents,
    serviceAgreementUtilizationPct,
    maintenanceCadenceUpliftCents: Math.min(250_000, maintenanceCadenceUpliftCents),
    treasuryConfidenceNote,
  }
}

export async function fetchBlitzpayRecurringRevenuePulse(
  admin: SupabaseClient,
  organizationId: string,
  options?: { reportingWindowDays?: number; grossCollectedWindowCents?: number; overdueInvoiceCount?: number },
): Promise<BlitzpayRecurringRevenuePulsePayload> {
  const metrics = await fetchBlitzpayRecurringRevenueMetrics(admin, organizationId, options)
  const reportingWindowDays = metrics.reportingWindowDays
  const sinceIso = new Date(Date.now() - reportingWindowDays * 86400_000).toISOString()
  const todayYmd = ymdTodayUtc()
  const end30ymd = isoDaysFromNow(30).slice(0, 10)
  const nowIso = new Date().toISOString()

  const [{ data: fd, error: fdErr }, { data: upMp, error: upErr }, { data: upCr, error: crErr }, { data: pend, error: peErr }, { data: actPlans, error: apErr }, { data: pr, error: prErr }] =
    await Promise.all([
      admin
        .from("blitzpay_scheduled_invoice_payments")
        .select("id, org_invoice_id, customer_id, invoice_portion_cents, last_error")
        .eq("organization_id", organizationId)
        .eq("status", "failed")
        .gte("updated_at", sinceIso)
        .order("updated_at", { ascending: false })
        .limit(12),
      admin
        .from("maintenance_plans")
        .select("id, customer_id, next_due_date, status, interval_unit, interval_value")
        .eq("organization_id", organizationId)
        .eq("is_archived", false)
        .eq("status", "active")
        .not("next_due_date", "is", null)
        .gte("next_due_date", todayYmd)
        .lte("next_due_date", end30ymd)
        .order("next_due_date", { ascending: true })
        .limit(15),
      admin
        .from("org_service_contracts")
        .select("id, customer_id, end_date, status")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .gte("end_date", todayYmd)
        .lte("end_date", end30ymd)
        .order("end_date", { ascending: true })
        .limit(15),
      admin
        .from("blitzpay_scheduled_invoice_payments")
        .select("id, org_invoice_id, customer_id, invoice_portion_cents, scheduled_for")
        .eq("organization_id", organizationId)
        .eq("status", "pending")
        .gte("scheduled_for", nowIso)
        .order("scheduled_for", { ascending: true })
        .limit(15),
      admin
        .from("maintenance_plans")
        .select("customer_id")
        .eq("organization_id", organizationId)
        .eq("is_archived", false)
        .eq("status", "active")
        .limit(120),
      admin
        .from("blitzpay_customer_payment_profiles")
        .select("customer_id, autopay_authorization_status")
        .eq("organization_id", organizationId)
        .limit(RECURRING_PROFILE_SCAN_CAP),
    ])

  if (fdErr) throw new Error(fdErr.message)
  if (upErr) throw new Error(upErr.message)
  if (crErr) throw new Error(crErr.message)
  if (peErr) throw new Error(peErr.message)
  if (apErr) throw new Error(apErr.message)
  if (prErr) throw new Error(prErr.message)

  const failedRenewals = ((fd ?? []) as Array<{ id: string; org_invoice_id: string; customer_id: string; invoice_portion_cents: number; last_error: string | null }>).map((r) => ({
    invoiceId: r.org_invoice_id,
    customerId: r.customer_id,
    portionCents: Math.max(0, Math.round(Number(r.invoice_portion_cents))),
    errorHint: r.last_error ? String(r.last_error).slice(0, 160) : null,
  }))

  const recurringPaymentRecoveryQueue = ((pend ?? []) as Array<{
    id: string
    org_invoice_id: string
    customer_id: string
    invoice_portion_cents: number
  }>).map((r) => ({
    scheduleId: r.id,
    invoiceId: r.org_invoice_id,
    customerId: r.customer_id,
    portionCents: Math.max(0, Math.round(Number(r.invoice_portion_cents))),
  }))

  const upcomingRenewals: BlitzpayRecurringRevenuePulsePayload["upcomingRenewals"] = []
  for (const m of (upMp ?? []) as Array<{
    id: string
    customer_id: string
    next_due_date: string
    interval_unit: string
    interval_value: number
  }>) {
    upcomingRenewals.push({
      kind: "maintenance",
      refId: m.id,
      customerId: m.customer_id,
      dueYmd: String(m.next_due_date).slice(0, 10),
    })
  }
  for (const c of (upCr ?? []) as Array<{ id: string; customer_id: string; end_date: string }>) {
    upcomingRenewals.push({
      kind: "contract",
      refId: c.id,
      customerId: c.customer_id,
      dueYmd: String(c.end_date).slice(0, 10),
    })
  }

  const autopayOn = new Set<string>()
  for (const p of (pr ?? []) as Array<{ customer_id: string; autopay_authorization_status?: string }>) {
    if (String(p.autopay_authorization_status || "").toLowerCase() === "active") autopayOn.add(p.customer_id)
  }
  const atRiskCustomers: BlitzpayRecurringRevenuePulsePayload["atRiskCustomers"] = []
  const seen = new Set<string>()
  for (const row of (actPlans ?? []) as Array<{ customer_id: string }>) {
    const cid = row.customer_id
    if (!cid || seen.has(cid)) continue
    if (autopayOn.has(cid)) continue
    seen.add(cid)
    const sc = scoreMembershipHealthFromSignals({
      failedScheduledWindowCount: metrics.scheduledFailedWindowCount,
      overdueOpenInvoiceCountForCohort: Math.min(5, metrics.churnRiskScore0to100 > 50 ? 2 : 0),
      activeMaintenanceWithoutAutopay: true,
      contractExpiring30d: metrics.contractExpiring30dCount > 0,
      financingHeavy: false,
      disputePressure: false,
    })
    atRiskCustomers.push({ customerId: cid, band: sc.band, score0to100: sc.score0to100 })
    if (atRiskCustomers.length >= 8) break
  }

  const membershipHealthOrg = scoreMembershipHealthFromSignals({
    failedScheduledWindowCount: metrics.scheduledFailedWindowCount,
    overdueOpenInvoiceCountForCohort: Math.min(12, options?.overdueInvoiceCount ?? 0),
    activeMaintenanceWithoutAutopay: metrics.customersMissingAutopayWithActivePlans > 0,
    contractExpiring30d: metrics.contractExpiring30dCount > 0,
    financingHeavy: metrics.recurringMixOfCollectedWindowPct >= 35,
    disputePressure: metrics.churnRiskScore0to100 >= 60,
  })

  const retentionRecommendations = buildRetentionRecommendationLines({
    customersMissingAutopayWithActivePlans: metrics.customersMissingAutopayWithActivePlans,
    failedScheduledWindowCount: metrics.scheduledFailedWindowCount,
    contractExpiring30dCount: metrics.contractExpiring30dCount,
    churnRiskScore0to100: metrics.churnRiskScore0to100,
  })

  const workflowFlags: string[] = []
  if (metrics.expiredContractDataRiskCount > 0) {
    workflowFlags.push(`${metrics.expiredContractDataRiskCount} agreement(s) still marked active after end date — data hygiene risk.`)
  }
  if (metrics.maintenanceDueNext30dCount >= 8) {
    workflowFlags.push("Heavy preventive visit window — align renewal invoices before trucks roll.")
  }
  if (metrics.contractSuspendedCount > 0) {
    workflowFlags.push(`${metrics.contractSuspendedCount} suspended service agreement(s) — confirm billing pauses match coverage.`)
  }

  return {
    ...metrics,
    membershipHealthOrg,
    retentionRecommendations,
    workflowFlags: workflowFlags.slice(0, 6),
    atRiskCustomers,
    failedRenewals,
    upcomingRenewals: upcomingRenewals.slice(0, 20),
    recurringPaymentRecoveryQueue,
  }
}
