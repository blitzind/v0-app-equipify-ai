import { createHash } from "node:crypto"

/** Bounded reads for Phase 3A GL APIs and reporting. */
export const BLITZPAY_GL_CHART_LIST_CAP = 200
export const BLITZPAY_GL_BATCH_LIST_CAP = 80
export const BLITZPAY_GL_ENTRY_LIST_CAP = 120
export const BLITZPAY_GL_LINE_LIST_CAP = 400
export const BLITZPAY_GL_TRIAL_BALANCE_ACCOUNT_CAP = 150
export const BLITZPAY_GL_BALANCE_ROW_CAP = 200
export const BLITZPAY_GL_DEFERRED_SCHEDULE_CAP = 100
export const BLITZPAY_GL_SNAPSHOT_AGGREGATION_DAYS = 120

export type BlitzpayCoaAccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense"
  | "contra_asset"
  | "contra_liability"

export type BlitzpayNormalBalance = "debit" | "credit"

export type BlitzpayJournalBatchType =
  | "invoice"
  | "payment"
  | "payout"
  | "payroll"
  | "adjustment"
  | "accrual"
  | "deferred_revenue"
  | "treasury_reconciliation"
  | "ap"
  | "ar"
  | "manual"

export type BlitzpayJournalBatchStatus = "draft" | "posted" | "reversed" | "archived"

export type BlitzpayJournalLineType = "debit" | "credit"

export type BlitzpayFinancialPeriodStatus = "open" | "soft_closed" | "closed"

export type BlitzpayDeferredRecognitionFrequency = "daily" | "weekly" | "monthly" | "milestone"

const GL_SOURCE_PEPPER = process.env.BLITZPAY_GL_SOURCE_PEPPER ?? "blitzpay_gl_source_pepper_dev_only"

/** Deterministic fingerprint for optional external references (no raw ids in payloads). */
export function hashAccountingSourceReference(raw: string): string {
  const s = String(raw || "").trim()
  return createHash("sha256").update(GL_SOURCE_PEPPER).update("|").update(s).digest("hex")
}

export type BlitzpayJournalLineInput = {
  accountId: string
  lineType: BlitzpayJournalLineType
  amountCents: number
  description?: string | null
  customerId?: string | null
  vendorId?: string | null
  workOrderId?: string | null
  invoiceId?: string | null
  equipmentId?: string | null
  technicianId?: string | null
  department?: string | null
  metadata?: Record<string, unknown>
}

export function sortJournalLinesDeterministic(lines: BlitzpayJournalLineInput[]): BlitzpayJournalLineInput[] {
  return [...lines].sort((a, b) => {
    const ac = a.accountId.localeCompare(b.accountId)
    if (ac !== 0) return ac
    const lt = a.lineType.localeCompare(b.lineType)
    if (lt !== 0) return lt
    return a.amountCents - b.amountCents
  })
}

export function validateBalancedLines(lines: BlitzpayJournalLineInput[]): {
  ok: boolean
  totalDebitsCents: number
  totalCreditsCents: number
  reason?: string
} {
  if (!lines.length) return { ok: false, totalDebitsCents: 0, totalCreditsCents: 0, reason: "no_lines" }
  if (lines.length < 2) return { ok: false, totalDebitsCents: 0, totalCreditsCents: 0, reason: "min_two_lines" }
  let d = 0
  let c = 0
  for (const ln of lines) {
    const n = Math.round(Number(ln.amountCents))
    if (!Number.isFinite(n) || n <= 0) return { ok: false, totalDebitsCents: 0, totalCreditsCents: 0, reason: "invalid_amount" }
    if (ln.lineType === "debit") d += n
    else if (ln.lineType === "credit") c += n
    else return { ok: false, totalDebitsCents: 0, totalCreditsCents: 0, reason: "invalid_line_type" }
  }
  if (d !== c) return { ok: false, totalDebitsCents: d, totalCreditsCents: c, reason: "unbalanced" }
  return { ok: true, totalDebitsCents: d, totalCreditsCents: c }
}

export function normalBalanceForAccountType(accountType: BlitzpayCoaAccountType): BlitzpayNormalBalance {
  if (accountType === "asset" || accountType === "contra_liability" || accountType === "expense") return "debit"
  return "credit"
}

/** Signed net in “debit-positive” space for rollups (assets/expenses positive when net debit). */
export function signedNetForAccount(
  accountType: BlitzpayCoaAccountType,
  debitTotalCents: number,
  creditTotalCents: number,
): number {
  const d = Math.round(debitTotalCents)
  const cr = Math.round(creditTotalCents)
  const nb = normalBalanceForAccountType(accountType)
  if (nb === "debit") return d - cr
  return cr - d
}

export type BlitzpayCoaRow = {
  id: string
  account_code: string
  account_name: string
  account_type: BlitzpayCoaAccountType
  parent_account_id: string | null
  normal_balance: BlitzpayNormalBalance
}

/** Parent map must be acyclic (DB enforces); this returns depth for sorting roots first. */
export function buildCoaParentDepthMap(rows: BlitzpayCoaRow[]): Map<string, number> {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const memo = new Map<string, number>()
  function depthOf(id: string): number {
    if (memo.has(id)) return memo.get(id)!
    const row = byId.get(id)
    if (!row || !row.parent_account_id) {
      memo.set(id, 0)
      return 0
    }
    const d = 1 + depthOf(row.parent_account_id)
    memo.set(id, d)
    return d
  }
  for (const r of rows) depthOf(r.id)
  return memo
}

export const BLITZPAY_DEFAULT_COA_SEED: ReadonlyArray<{
  code: string
  name: string
  type: BlitzpayCoaAccountType
}> = [
  { code: "1000", name: "Cash", type: "asset" },
  { code: "1100", name: "Accounts Receivable", type: "asset" },
  { code: "1150", name: "Undeposited Funds", type: "asset" },
  { code: "1200", name: "Deferred Revenue (asset memo)", type: "asset" },
  { code: "2000", name: "Accounts Payable", type: "liability" },
  { code: "2100", name: "Deferred Revenue Liability", type: "liability" },
  { code: "2200", name: "Payroll Liabilities", type: "liability" },
  { code: "2300", name: "Sales Tax Payable", type: "liability" },
  { code: "3900", name: "Retained Earnings", type: "equity" },
  { code: "4000", name: "Service Revenue", type: "revenue" },
  { code: "4100", name: "Membership Revenue", type: "revenue" },
  { code: "4200", name: "Equipment Revenue", type: "revenue" },
  { code: "5000", name: "Payroll Expense", type: "expense" },
  { code: "5100", name: "Processing Fees", type: "expense" },
  { code: "5200", name: "Cost of Goods Sold", type: "expense" },
]

/** Phase 3B — additional system COA rows for AP / vendor bill posting (merged by ensureBlitzpayDefaultVendorAccounts). */
export const BLITZPAY_VENDOR_COA_EXTENSION: ReadonlyArray<{
  code: string
  name: string
  type: BlitzpayCoaAccountType
}> = [
  { code: "1300", name: "Inventory Asset", type: "asset" },
  { code: "5300", name: "Utilities Expense", type: "expense" },
  { code: "5400", name: "Subcontractor Expense", type: "expense" },
  { code: "5500", name: "Inventory Expense", type: "expense" },
  { code: "5600", name: "Vehicle Expense", type: "expense" },
]

/** Phase 3C — tax & compliance GL extensions (merged by ensureBlitzpayDefaultTaxAccounts). 2300 Sales Tax Payable is in default COA seed. */
export const BLITZPAY_TAX_COA_EXTENSION: ReadonlyArray<{
  code: string
  name: string
  type: BlitzpayCoaAccountType
}> = [
  { code: "2310", name: "Employer Payroll Tax Payable", type: "liability" },
  { code: "5750", name: "Payroll Tax Expense", type: "expense" },
  { code: "5760", name: "Sales Tax Expense", type: "expense" },
]
