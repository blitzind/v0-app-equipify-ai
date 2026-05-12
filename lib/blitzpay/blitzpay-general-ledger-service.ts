import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import {
  BLITZPAY_DEFAULT_COA_SEED,
  BLITZPAY_GL_BALANCE_ROW_CAP,
  BLITZPAY_GL_BATCH_LIST_CAP,
  BLITZPAY_GL_CHART_LIST_CAP,
  BLITZPAY_GL_DEFERRED_SCHEDULE_CAP,
  BLITZPAY_GL_ENTRY_LIST_CAP,
  BLITZPAY_GL_LINE_LIST_CAP,
  BLITZPAY_GL_SNAPSHOT_AGGREGATION_DAYS,
  BLITZPAY_GL_TRIAL_BALANCE_ACCOUNT_CAP,
  type BlitzpayCoaAccountType,
  type BlitzpayJournalBatchType,
  type BlitzpayJournalLineInput,
  normalBalanceForAccountType,
  signedNetForAccount,
  sortJournalLinesDeterministic,
  validateBalancedLines,
} from "@/lib/blitzpay/blitzpay-general-ledger"
import {
  assertFinancialPeriodAllowsPosting,
  buildReversalLinesFromPosted,
  trialBalanceHealthy,
  validateJournalEntryForPosting,
} from "@/lib/blitzpay/blitzpay-accounting-engine"
import { applyRecognitionToScheduleState, computeNextRecognitionAmountCents } from "@/lib/blitzpay/blitzpay-revenue-recognition"

export type BlitzpayGlReportingFields = {
  totalAssetsCents: number
  totalLiabilitiesCents: number
  totalEquityCents: number
  deferredRevenueCents: number
  accountsReceivableCents: number
  accountsPayableCents: number
  glPayrollLiabilityCents: number
  trialBalanceHealthy: boolean
  unreconciledBatchCount: number
  pendingRevenueRecognitionCount: number
}

async function loadClosedPeriods(admin: SupabaseClient, organizationId: string) {
  const { data, error } = await admin
    .from("blitzpay_financial_periods")
    .select("start_date, end_date, status")
    .eq("organization_id", organizationId)
    .in("status", ["closed", "soft_closed"])
    .limit(48)
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{ start_date: string; end_date: string; status: "closed" | "soft_closed" }>
}

export async function ensureBlitzpayDefaultChartOfAccounts(admin: SupabaseClient, organizationId: string): Promise<{ created: number }> {
  assertUuid(organizationId, "organizationId")
  let created = 0
  for (const row of BLITZPAY_DEFAULT_COA_SEED) {
    const normal = normalBalanceForAccountType(row.type)
    const { data: existing } = await admin
      .from("blitzpay_chart_of_accounts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("account_code", row.code)
      .maybeSingle()
    if (existing) continue
    const { error } = await admin.from("blitzpay_chart_of_accounts").insert({
      organization_id: organizationId,
      account_code: row.code,
      account_name: row.name,
      account_type: row.type,
      parent_account_id: null,
      is_system_account: true,
      is_active: true,
      normal_balance: normal,
      reporting_category: "system_seed",
      currency: "usd",
      metadata: { seed: "blitzpay_phase_3a_default" },
    })
    if (error) throw new Error(error.message)
    created += 1
  }
  return { created }
}

export async function listChartOfAccounts(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_chart_of_accounts")
    .select("id, account_code, account_name, account_type, parent_account_id, is_system_account, is_active, normal_balance, reporting_category, currency")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("account_code", { ascending: true })
    .limit(BLITZPAY_GL_CHART_LIST_CAP)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createCustomCoaAccount(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    accountCode: string
    accountName: string
    accountType: BlitzpayCoaAccountType
    parentAccountId?: string | null
    reportingCategory?: string | null
  },
) {
  assertUuid(organizationId, "organizationId")
  const code = String(input.accountCode || "").trim()
  if (!code) throw new Error("account_code_required")
  const normal = normalBalanceForAccountType(input.accountType)
  const row: Record<string, unknown> = {
    organization_id: organizationId,
    account_code: code,
    account_name: String(input.accountName || "").trim() || code,
    account_type: input.accountType,
    parent_account_id: input.parentAccountId ?? null,
    is_system_account: false,
    is_active: true,
    normal_balance: normal,
    reporting_category: input.reportingCategory ?? null,
    currency: "usd",
    metadata: {},
  }
  const { data, error } = await admin.from("blitzpay_chart_of_accounts").insert(row).select("id").single()
  if (error) throw new Error(error.message)
  return data as { id: string }
}

export async function listJournalBatches(admin: SupabaseClient, organizationId: string, status?: string) {
  assertUuid(organizationId, "organizationId")
  let q = admin
    .from("blitzpay_journal_batches")
    .select("id, batch_reference, batch_type, status, posted_at, created_at, source_type, source_id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(BLITZPAY_GL_BATCH_LIST_CAP)
  if (status) q = q.eq("status", status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createJournalBatch(
  admin: SupabaseClient,
  organizationId: string,
  input: { batchReference: string; batchType: BlitzpayJournalBatchType; sourceType?: string | null; sourceId?: string | null },
) {
  assertUuid(organizationId, "organizationId")
  const ref = String(input.batchReference || "").trim()
  if (!ref) throw new Error("batch_reference_required")
  const { data, error } = await admin
    .from("blitzpay_journal_batches")
    .insert({
      organization_id: organizationId,
      batch_reference: ref,
      batch_type: input.batchType,
      status: "draft",
      source_type: input.sourceType ?? null,
      source_id: input.sourceId ?? null,
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return data as { id: string }
}

export async function listJournalEntries(admin: SupabaseClient, organizationId: string, batchId?: string) {
  assertUuid(organizationId, "organizationId")
  let q = admin
    .from("blitzpay_journal_entries")
    .select("id, batch_id, entry_reference, entry_date, memo, total_debits_cents, total_credits_cents, is_balanced, is_reversing_entry, created_at")
    .eq("organization_id", organizationId)
    .order("entry_date", { ascending: false })
    .limit(BLITZPAY_GL_ENTRY_LIST_CAP)
  if (batchId) {
    assertUuid(batchId, "batchId")
    q = q.eq("batch_id", batchId)
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createJournalEntryWithLines(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    batchId: string
    entryReference: string
    entryDate: string
    memo?: string | null
    sourceType?: string | null
    sourceId?: string | null
    lines: BlitzpayJournalLineInput[]
  },
) {
  assertUuid(organizationId, "organizationId")
  assertUuid(input.batchId, "batchId")
  const ref = String(input.entryReference || "").trim()
  if (!ref) throw new Error("entry_reference_required")
  const sorted = sortJournalLinesDeterministic(input.lines)
  const v = validateJournalEntryForPosting(sorted)
  if (!v.ok) throw new Error(v.reason ?? "invalid_entry")

  const { data: batch, error: bErr } = await admin
    .from("blitzpay_journal_batches")
    .select("id, status")
    .eq("id", input.batchId)
    .eq("organization_id", organizationId)
    .single()
  if (bErr || !batch) throw new Error("batch_not_found")
  if ((batch as { status: string }).status !== "draft") throw new Error("batch_not_draft")

  const periods = await loadClosedPeriods(admin, organizationId)
  const gate = assertFinancialPeriodAllowsPosting(input.entryDate, periods)
  if (!gate.ok) throw new Error(gate.reason)

  const { data: entry, error: eErr } = await admin
    .from("blitzpay_journal_entries")
    .insert({
      organization_id: organizationId,
      batch_id: input.batchId,
      entry_reference: ref,
      entry_date: input.entryDate.slice(0, 10),
      memo: input.memo ?? null,
      source_type: input.sourceType ?? null,
      source_id: input.sourceId ?? null,
      total_debits_cents: v.totalDebitsCents,
      total_credits_cents: v.totalCreditsCents,
      is_balanced: true,
      is_reversing_entry: false,
      metadata: {},
    })
    .select("id")
    .single()
  if (eErr || !entry) throw new Error(eErr?.message ?? "entry_insert_failed")

  const entryId = (entry as { id: string }).id
  const lineRows = sorted.map((ln) => ({
    organization_id: organizationId,
    journal_entry_id: entryId,
    account_id: ln.accountId,
    line_type: ln.lineType,
    amount_cents: Math.round(ln.amountCents),
    description: ln.description ?? null,
    customer_id: ln.customerId ?? null,
    vendor_id: ln.vendorId ?? null,
    work_order_id: ln.workOrderId ?? null,
    invoice_id: ln.invoiceId ?? null,
    equipment_id: ln.equipmentId ?? null,
    technician_id: ln.technicianId ?? null,
    department: ln.department ?? null,
    metadata: ln.metadata ?? {},
  }))
  const { error: lErr } = await admin.from("blitzpay_journal_lines").insert(lineRows)
  if (lErr) throw new Error(lErr.message)
  return { id: entryId }
}

async function upsertAccountBalanceIncrement(
  admin: SupabaseClient,
  organizationId: string,
  accountId: string,
  balanceDate: string,
  debitAdd: number,
  creditAdd: number,
  accountType: BlitzpayCoaAccountType,
) {
  const day = balanceDate.slice(0, 10)
  const { data: row } = await admin
    .from("blitzpay_account_balances")
    .select("id, debit_balance_cents, credit_balance_cents")
    .eq("organization_id", organizationId)
    .eq("account_id", accountId)
    .eq("balance_date", day)
    .eq("source", "system")
    .maybeSingle()
  const d0 = row ? Math.round(Number((row as { debit_balance_cents: number }).debit_balance_cents)) : 0
  const c0 = row ? Math.round(Number((row as { credit_balance_cents: number }).credit_balance_cents)) : 0
  const d1 = d0 + debitAdd
  const c1 = c0 + creditAdd
  const net = signedNetForAccount(accountType, d1, c1)
  const payload = {
    organization_id: organizationId,
    account_id: accountId,
    balance_date: day,
    debit_balance_cents: d1,
    credit_balance_cents: c1,
    net_balance_cents: net,
    source: "system",
    metadata: {},
  }
  if (row) {
    const { error } = await admin
      .from("blitzpay_account_balances")
      .update({ debit_balance_cents: d1, credit_balance_cents: c1, net_balance_cents: net })
      .eq("id", (row as { id: string }).id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await admin.from("blitzpay_account_balances").insert(payload)
    if (error) throw new Error(error.message)
  }
}

export async function postJournalEntry(admin: SupabaseClient, organizationId: string, entryId: string) {
  assertUuid(organizationId, "organizationId")
  assertUuid(entryId, "entryId")
  const { data: entry, error: e0 } = await admin
    .from("blitzpay_journal_entries")
    .select("id, batch_id, entry_date, is_balanced, total_debits_cents, total_credits_cents")
    .eq("organization_id", organizationId)
    .eq("id", entryId)
    .single()
  if (e0 || !entry) throw new Error("entry_not_found")
  const ent = entry as {
    id: string
    batch_id: string
    entry_date: string
    is_balanced: boolean
    total_debits_cents: number
    total_credits_cents: number
  }
  if (!ent.is_balanced) throw new Error("entry_not_balanced")

  const periods = await loadClosedPeriods(admin, organizationId)
  const gate = assertFinancialPeriodAllowsPosting(ent.entry_date, periods)
  if (!gate.ok) throw new Error(gate.reason)

  const { data: batch, error: b0 } = await admin
    .from("blitzpay_journal_batches")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("id", ent.batch_id)
    .single()
  if (b0 || !batch) throw new Error("batch_not_found")
  if ((batch as { status: string }).status !== "draft") throw new Error("batch_not_draft")

  const { data: entries, error: e1 } = await admin
    .from("blitzpay_journal_entries")
    .select("id, is_balanced, total_debits_cents, total_credits_cents, entry_date")
    .eq("organization_id", organizationId)
    .eq("batch_id", ent.batch_id)
    .limit(BLITZPAY_GL_ENTRY_LIST_CAP)
  if (e1) throw new Error(e1.message)
  for (const x of entries ?? []) {
    const r = x as { is_balanced: boolean; total_debits_cents: number; total_credits_cents: number }
    if (!r.is_balanced || Math.round(r.total_debits_cents) !== Math.round(r.total_credits_cents)) {
      throw new Error("batch_has_unbalanced_entry")
    }
  }

  const entryDateById = new Map((entries ?? []).map((e) => [(e as { id: string }).id, (e as { entry_date: string }).entry_date]))

  const { data: lines, error: l0 } = await admin
    .from("blitzpay_journal_lines")
    .select("id, account_id, line_type, amount_cents, journal_entry_id")
    .eq("organization_id", organizationId)
    .in(
      "journal_entry_id",
      (entries ?? []).map((x) => (x as { id: string }).id),
    )
    .limit(BLITZPAY_GL_LINE_LIST_CAP)
  if (l0) throw new Error(l0.message)

  const accountIds = [...new Set((lines ?? []).map((l) => (l as { account_id: string }).account_id))]
  const { data: coa } = await admin
    .from("blitzpay_chart_of_accounts")
    .select("id, account_type")
    .eq("organization_id", organizationId)
    .in("id", accountIds.slice(0, BLITZPAY_GL_TRIAL_BALANCE_ACCOUNT_CAP))
  const typeByAccount = new Map((coa ?? []).map((c) => [(c as { id: string }).id, (c as { account_type: BlitzpayCoaAccountType }).account_type]))

  const { error: pb } = await admin
    .from("blitzpay_journal_batches")
    .update({ status: "posted", posted_at: new Date().toISOString() })
    .eq("id", ent.batch_id)
    .eq("organization_id", organizationId)
  if (pb) throw new Error(pb.message)

  for (const ln of lines ?? []) {
    const row = ln as { account_id: string; line_type: string; amount_cents: number; journal_entry_id: string }
    const at = typeByAccount.get(row.account_id) ?? "expense"
    const amt = Math.round(Number(row.amount_cents))
    const debitAdd = row.line_type === "debit" ? amt : 0
    const creditAdd = row.line_type === "credit" ? amt : 0
    const ed = entryDateById.get(row.journal_entry_id) ?? ent.entry_date
    await upsertAccountBalanceIncrement(admin, organizationId, row.account_id, ed, debitAdd, creditAdd, at)
  }

  return { postedBatchId: ent.batch_id }
}

export async function reverseJournalEntry(admin: SupabaseClient, organizationId: string, entryId: string) {
  assertUuid(organizationId, "organizationId")
  assertUuid(entryId, "entryId")
  const { data: entry, error: e0 } = await admin
    .from("blitzpay_journal_entries")
    .select("id, batch_id, entry_date, entry_reference")
    .eq("organization_id", organizationId)
    .eq("id", entryId)
    .single()
  if (e0 || !entry) throw new Error("entry_not_found")
  const ent = entry as { id: string; batch_id: string; entry_date: string; entry_reference: string }

  const { data: batch, error: b0 } = await admin
    .from("blitzpay_journal_batches")
    .select("status")
    .eq("id", ent.batch_id)
    .eq("organization_id", organizationId)
    .single()
  if (b0 || !batch || (batch as { status: string }).status !== "posted") throw new Error("original_not_posted")

  const { data: lines, error: l0 } = await admin
    .from("blitzpay_journal_lines")
    .select("line_type, amount_cents, account_id, description")
    .eq("journal_entry_id", entryId)
    .eq("organization_id", organizationId)
    .limit(BLITZPAY_GL_LINE_LIST_CAP)
  if (l0) throw new Error(l0.message)
  const revLines = buildReversalLinesFromPosted((lines ?? []) as Array<{ line_type: string; amount_cents: number; account_id: string; description: string | null }>)
  const ref = `rev:${ent.entry_reference}:${Date.now()}`
  const { id: batchId } = await createJournalBatch(admin, organizationId, {
    batchReference: ref,
    batchType: "adjustment",
    sourceType: "journal_reversal",
    sourceId: ent.id,
  })
  const { id: newEntryId } = await createJournalEntryWithLines(admin, organizationId, {
    batchId,
    entryReference: `${ref}:entry`,
    entryDate: new Date().toISOString().slice(0, 10),
    memo: `Reversal of ${ent.entry_reference}`,
    sourceType: "journal_reversal",
    sourceId: ent.id,
    lines: revLines,
  })
  await admin
    .from("blitzpay_journal_entries")
    .update({ is_reversing_entry: true, reversal_entry_id: ent.id, metadata: { reverses_entry_id: ent.id } })
    .eq("id", newEntryId)
    .eq("organization_id", organizationId)
  await postJournalEntry(admin, organizationId, newEntryId)
  return { reversalEntryId: newEntryId, reversalBatchId: batchId }
}

export async function getTrialBalance(admin: SupabaseClient, organizationId: string, asOfDate: string) {
  assertUuid(organizationId, "organizationId")
  const asOf = asOfDate.slice(0, 10)
  const since = new Date(`${asOf}T12:00:00.000Z`)
  since.setUTCDate(since.getUTCDate() - BLITZPAY_GL_SNAPSHOT_AGGREGATION_DAYS)
  const sinceStr = since.toISOString().slice(0, 10)

  const { data: coa, error: cErr } = await admin
    .from("blitzpay_chart_of_accounts")
    .select("id, account_code, account_name, account_type")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("account_code", { ascending: true })
    .limit(BLITZPAY_GL_TRIAL_BALANCE_ACCOUNT_CAP)
  if (cErr) throw new Error(cErr.message)

  const { data: lines, error: lErr } = await admin
    .from("blitzpay_journal_lines")
    .select("account_id, line_type, amount_cents, journal_entry_id")
    .eq("organization_id", organizationId)
    .limit(BLITZPAY_GL_LINE_LIST_CAP)
  if (lErr) throw new Error(lErr.message)

  const entryIds = [...new Set((lines ?? []).map((x) => (x as { journal_entry_id: string }).journal_entry_id))]
  if (!entryIds.length) {
    return {
      asOfDate: asOf,
      accounts: (coa ?? []).map((a) => ({
        ...(a as object),
        debit_cents: 0,
        credit_cents: 0,
      })),
      totalDebitCents: 0,
      totalCreditCents: 0,
      healthy: true,
    }
  }
  const { data: entries, error: eErr } = await admin
    .from("blitzpay_journal_entries")
    .select("id, entry_date, batch_id")
    .eq("organization_id", organizationId)
    .in("id", entryIds.slice(0, BLITZPAY_GL_ENTRY_LIST_CAP))
  if (eErr) throw new Error(eErr.message)
  const batchIds = [...new Set((entries ?? []).map((e) => (e as { batch_id: string }).batch_id))]
  const { data: batches, error: bErr } = await admin
    .from("blitzpay_journal_batches")
    .select("id, status")
    .eq("organization_id", organizationId)
    .in("id", batchIds.slice(0, BLITZPAY_GL_BATCH_LIST_CAP))
  if (bErr) throw new Error(bErr.message)
  const postedBatch = new Set((batches ?? []).filter((b) => (b as { status: string }).status === "posted").map((b) => (b as { id: string }).id))
  const entryOk = new Set(
    (entries ?? [])
      .filter((e) => {
        const ed = (e as { entry_date: string }).entry_date
        const bid = (e as { batch_id: string }).batch_id
        return ed >= sinceStr && ed <= asOf && postedBatch.has(bid)
      })
      .map((e) => (e as { id: string }).id),
  )

  const totals = new Map<string, { d: number; c: number }>()
  for (const ln of lines ?? []) {
    const row = ln as { account_id: string; line_type: string; amount_cents: number; journal_entry_id: string }
    if (!entryOk.has(row.journal_entry_id)) continue
    const cur = totals.get(row.account_id) ?? { d: 0, c: 0 }
    if (row.line_type === "debit") cur.d += Math.round(row.amount_cents)
    else cur.c += Math.round(row.amount_cents)
    totals.set(row.account_id, cur)
  }

  let td = 0
  let tc = 0
  const accounts = (coa ?? []).map((a) => {
    const id = (a as { id: string }).id
    const t = totals.get(id) ?? { d: 0, c: 0 }
    td += t.d
    tc += t.c
    return { ...(a as Record<string, unknown>), debit_cents: t.d, credit_cents: t.c }
  })
  return { asOfDate: asOf, accounts, totalDebitCents: td, totalCreditCents: tc, healthy: trialBalanceHealthy(td, tc) }
}

export async function listAccountBalances(admin: SupabaseClient, organizationId: string, asOfDate?: string) {
  assertUuid(organizationId, "organizationId")
  let q = admin
    .from("blitzpay_account_balances")
    .select("id, account_id, balance_date, debit_balance_cents, credit_balance_cents, net_balance_cents, source")
    .eq("organization_id", organizationId)
    .order("balance_date", { ascending: false })
    .limit(BLITZPAY_GL_BALANCE_ROW_CAP)
  if (asOfDate) q = q.lte("balance_date", asOfDate.slice(0, 10))
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listFinancialPeriods(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_financial_periods")
    .select("id, period_name, start_date, end_date, status, closed_at")
    .eq("organization_id", organizationId)
    .order("start_date", { ascending: false })
    .limit(36)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createFinancialPeriod(
  admin: SupabaseClient,
  organizationId: string,
  input: { periodName: string; startDate: string; endDate: string },
) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_financial_periods")
    .insert({
      organization_id: organizationId,
      period_name: input.periodName.trim(),
      start_date: input.startDate.slice(0, 10),
      end_date: input.endDate.slice(0, 10),
      status: "open",
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return data as { id: string }
}

export async function closeFinancialPeriod(admin: SupabaseClient, organizationId: string, periodId: string, mode: "soft_closed" | "closed") {
  assertUuid(organizationId, "organizationId")
  assertUuid(periodId, "periodId")
  const { error } = await admin
    .from("blitzpay_financial_periods")
    .update({ status: mode, closed_at: new Date().toISOString(), closed_by: null })
    .eq("id", periodId)
    .eq("organization_id", organizationId)
  if (error) throw new Error(error.message)
  return { ok: true }
}

export async function runRevenueRecognition(
  admin: SupabaseClient,
  organizationId: string,
  asOfDateIso: string,
): Promise<{ processed: number; recognizedCents: number }> {
  assertUuid(organizationId, "organizationId")
  await ensureBlitzpayDefaultChartOfAccounts(admin, organizationId)
  const asOf = asOfDateIso.slice(0, 10)
  const { data: schedules, error } = await admin
    .from("blitzpay_deferred_revenue_schedules")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .limit(BLITZPAY_GL_DEFERRED_SCHEDULE_CAP)
  if (error) throw new Error(error.message)

  let processed = 0
  let recognizedCents = 0
  const { id: defRevLiab } = await resolveAccountByCode(admin, organizationId, "2100")
  const { id: serviceRev } = await resolveAccountByCode(admin, organizationId, "4000")

  for (const raw of schedules ?? []) {
    const row = raw as import("@/lib/blitzpay/blitzpay-revenue-recognition").DeferredScheduleRow
    const amt = computeNextRecognitionAmountCents(row, asOf)
    if (amt <= 0) continue
    const nextState = applyRecognitionToScheduleState(row, amt, asOf)
    const { id: batchId } = await createJournalBatch(admin, organizationId, {
      batchReference: `revrec:${row.id}:${asOf}:${randomUUID()}`,
      batchType: "deferred_revenue",
      sourceType: "deferred_revenue_schedule",
      sourceId: row.id,
    })
    const { id: recEntryId } = await createJournalEntryWithLines(admin, organizationId, {
      batchId,
      entryReference: `revrec:${row.id}:${asOf}:entry`,
      entryDate: asOf,
      memo: "Scheduled revenue recognition",
      sourceType: "deferred_revenue_schedule",
      sourceId: row.id,
      lines: [
        { accountId: defRevLiab, lineType: "debit", amountCents: amt, description: "Recognize deferred revenue" },
        { accountId: serviceRev, lineType: "credit", amountCents: amt, description: "Service revenue" },
      ],
    })
    await postJournalEntry(admin, organizationId, recEntryId)

    const { error: uErr } = await admin
      .from("blitzpay_deferred_revenue_schedules")
      .update({
        recognized_amount_cents: nextState.recognized_amount_cents,
        remaining_amount_cents: nextState.remaining_amount_cents,
        next_recognition_date: nextState.next_recognition_date,
        status: nextState.status,
      })
      .eq("id", row.id)
      .eq("organization_id", organizationId)
    if (uErr) throw new Error(uErr.message)
    processed += 1
    recognizedCents += amt
  }
  return { processed, recognizedCents }
}

async function resolveAccountByCode(admin: SupabaseClient, organizationId: string, code: string): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("blitzpay_chart_of_accounts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("account_code", code)
    .maybeSingle()
  if (error || !data) throw new Error(`missing_account_${code}`)
  return data as { id: string }
}

export async function fetchGlReportingSnapshotFields(
  admin: SupabaseClient,
  organizationId: string,
): Promise<BlitzpayGlReportingFields> {
  assertUuid(organizationId, "organizationId")
  const defaults: BlitzpayGlReportingFields = {
    totalAssetsCents: 0,
    totalLiabilitiesCents: 0,
    totalEquityCents: 0,
    deferredRevenueCents: 0,
    accountsReceivableCents: 0,
    accountsPayableCents: 0,
    glPayrollLiabilityCents: 0,
    trialBalanceHealthy: true,
    unreconciledBatchCount: 0,
    pendingRevenueRecognitionCount: 0,
  }
  try {
    await ensureBlitzpayDefaultChartOfAccounts(admin, organizationId)
  } catch {
    /* optional */
  }

  const asOf = new Date().toISOString().slice(0, 10)
  let tb: Awaited<ReturnType<typeof getTrialBalance>>
  try {
    tb = await getTrialBalance(admin, organizationId, asOf)
  } catch {
    return defaults
  }

  const { data: coa } = await admin
    .from("blitzpay_chart_of_accounts")
    .select("id, account_type, account_code")
    .eq("organization_id", organizationId)
    .limit(BLITZPAY_GL_TRIAL_BALANCE_ACCOUNT_CAP)

  const codeById = new Map((coa ?? []).map((c) => [(c as { id: string }).id, (c as { account_code: string }).account_code]))
  const typeById = new Map((coa ?? []).map((c) => [(c as { id: string }).id, (c as { account_type: BlitzpayCoaAccountType }).account_type]))

  let assets = 0
  let liabilities = 0
  let equity = 0
  let deferredRevenue = 0
  let ar = 0
  let ap = 0
  let payrollLiab = 0
  for (const a of tb.accounts as Array<{ id: string; debit_cents: number; credit_cents: number }>) {
    const t = typeById.get(a.id) ?? "expense"
    const code = codeById.get(a.id) ?? ""
    const net = signedNetForAccount(t, a.debit_cents, a.credit_cents)
    if (t === "asset" || t === "contra_asset") assets += net
    if (t === "liability" || t === "contra_liability") liabilities += net
    if (t === "equity") equity += net
    if (code === "2100") deferredRevenue += Math.max(0, net)
    if (code === "1100") ar += net
    if (code === "2000") ap += net
    if (code === "2200") payrollLiab += net
  }

  let unreconciled = 0
  try {
    const { data: dBatches } = await admin
      .from("blitzpay_journal_batches")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("status", "draft")
      .limit(500)
    unreconciled = (dBatches ?? []).length
  } catch {
    unreconciled = 0
  }

  let pendingRev = 0
  try {
    const today = new Date().toISOString().slice(0, 10)
    const { data: dSched } = await admin
      .from("blitzpay_deferred_revenue_schedules")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .lte("next_recognition_date", today)
      .limit(500)
    pendingRev = (dSched ?? []).length
  } catch {
    pendingRev = 0
  }

  return {
    totalAssetsCents: Math.round(assets),
    totalLiabilitiesCents: Math.round(liabilities),
    totalEquityCents: Math.round(equity),
    deferredRevenueCents: Math.round(deferredRevenue),
    accountsReceivableCents: Math.round(ar),
    accountsPayableCents: Math.round(ap),
    glPayrollLiabilityCents: Math.round(payrollLiab),
    trialBalanceHealthy: tb.healthy,
    unreconciledBatchCount: Math.min(99_999, unreconciled),
    pendingRevenueRecognitionCount: Math.min(99_999, pendingRev),
  }
}
