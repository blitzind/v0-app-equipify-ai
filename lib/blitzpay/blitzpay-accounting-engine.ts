import {
  sortJournalLinesDeterministic,
  validateBalancedLines,
  type BlitzpayCoaAccountType,
  type BlitzpayFinancialPeriodStatus,
  type BlitzpayJournalLineInput,
  type BlitzpayJournalLineType,
} from "@/lib/blitzpay/blitzpay-general-ledger"

export type BlitzpayJournalBatchRow = { id: string; status: string; organization_id: string }

export function assertFinancialPeriodAllowsPosting(
  entryDateIso: string,
  periods: Array<{ start_date: string; end_date: string; status: BlitzpayFinancialPeriodStatus }>,
): { ok: true } | { ok: false; reason: string } {
  const day = entryDateIso.slice(0, 10)
  for (const p of periods) {
    if (p.status !== "closed" && p.status !== "soft_closed") continue
    if (day >= p.start_date && day <= p.end_date) {
      return { ok: false, reason: "period_closed" }
    }
  }
  return { ok: true }
}

export function validateJournalEntryForPosting(lines: BlitzpayJournalLineInput[]) {
  const sorted = sortJournalLinesDeterministic(lines)
  return validateBalancedLines(sorted)
}

export function buildReversalLinesFromPosted(lines: Array<{ line_type: string; amount_cents: number; account_id: string; description: string | null }>): BlitzpayJournalLineInput[] {
  const out: BlitzpayJournalLineInput[] = []
  for (const ln of lines) {
    const flip: BlitzpayJournalLineType = ln.line_type === "debit" ? "credit" : "debit"
    out.push({
      accountId: ln.account_id,
      lineType: flip,
      amountCents: Math.round(Number(ln.amount_cents)),
      description: ln.description ? `Reversal: ${ln.description}` : "Reversal",
    })
  }
  return sortJournalLinesDeterministic(out)
}

export function trialBalanceHealthy(totalDebitCents: number, totalCreditCents: number): boolean {
  return Math.round(totalDebitCents) === Math.round(totalCreditCents)
}

export function rollupSignedNetByAccountType(
  rows: Array<{ account_type: BlitzpayCoaAccountType; debit_cents: number; credit_cents: number }>,
): { assets: number; liabilities: number; equity: number; revenue: number; expenses: number } {
  const keys: BlitzpayCoaAccountType[] = ["asset", "contra_asset", "liability", "contra_liability", "equity", "revenue", "expense"]
  const sums = Object.fromEntries(keys.map((k) => [k, 0])) as Record<BlitzpayCoaAccountType, number>
  for (const r of rows) {
    const d = Math.round(r.debit_cents)
    const c = Math.round(r.credit_cents)
    let net = 0
    if (r.account_type === "asset" || r.account_type === "contra_liability" || r.account_type === "expense") net = d - c
    else net = c - d
    sums[r.account_type] += net
  }
  return {
    assets: sums.asset + sums.contra_asset,
    liabilities: sums.liability + sums.contra_liability,
    equity: sums.equity,
    revenue: sums.revenue,
    expenses: sums.expense,
  }
}
