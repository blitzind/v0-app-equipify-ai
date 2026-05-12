/**
 * BlitzPay Phase 3A — general ledger & accounting engine (deterministic, no DB).
 * Run: pnpm test:blitzpay-phase-3a-general-ledger
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  BLITZPAY_GL_CHART_LIST_CAP,
  BLITZPAY_GL_TRIAL_BALANCE_ACCOUNT_CAP,
  buildCoaParentDepthMap,
  hashAccountingSourceReference,
  sortJournalLinesDeterministic,
  validateBalancedLines,
  type BlitzpayJournalLineInput,
} from "../lib/blitzpay/blitzpay-general-ledger"
import {
  assertFinancialPeriodAllowsPosting,
  buildReversalLinesFromPosted,
  trialBalanceHealthy,
  rollupSignedNetByAccountType,
} from "../lib/blitzpay/blitzpay-accounting-engine"
import { applyRecognitionToScheduleState, computeNextRecognitionAmountCents } from "../lib/blitzpay/blitzpay-revenue-recognition"
import { compareArApToOperationalProxies, compareCashGlToTreasuryProxy } from "../lib/blitzpay/blitzpay-ledger-reconciliation"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")

function readUtf8(rel: string): string {
  return fs.readFileSync(path.join(APP_ROOT, rel), "utf8")
}

// --- Balancing & ordering ---
const aid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
const bid = "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee"
const lines: BlitzpayJournalLineInput[] = [
  { accountId: bid, lineType: "credit", amountCents: 100 },
  { accountId: aid, lineType: "debit", amountCents: 100 },
]
const sorted = sortJournalLinesDeterministic(lines)
assert.deepEqual(
  sorted.map((x) => x.accountId),
  [aid, bid],
  "deterministic sort: account id ascending",
)
const bal = validateBalancedLines(sorted)
assert.equal(bal.ok, true)
assert.equal(bal.totalDebitsCents, 100)
assert.equal(bal.totalCreditsCents, 100)

const unbal = validateBalancedLines([
  { accountId: aid, lineType: "debit", amountCents: 50 },
  { accountId: bid, lineType: "credit", amountCents: 49 },
])
assert.equal(unbal.ok, false)
assert.equal(unbal.reason, "unbalanced")

// --- Trial balance ---
assert.equal(trialBalanceHealthy(100, 100), true)
assert.equal(trialBalanceHealthy(100, 99), false)

// --- Reversal ---
const rev = buildReversalLinesFromPosted([
  { line_type: "debit", amount_cents: 25, account_id: aid, description: "Test" },
  { line_type: "credit", amount_cents: 25, account_id: bid, description: null },
])
assert.equal(rev.length, 2)
const dSum = rev.filter((r) => r.lineType === "debit").reduce((s, r) => s + r.amountCents, 0)
const cSum = rev.filter((r) => r.lineType === "credit").reduce((s, r) => s + r.amountCents, 0)
assert.equal(dSum, cSum)
const vbal = validateBalancedLines(rev)
assert.equal(vbal.ok, true)

// --- Period enforcement ---
const closed = assertFinancialPeriodAllowsPosting("2026-06-15", [
  { start_date: "2026-06-01", end_date: "2026-06-30", status: "closed" },
])
assert.equal(closed.ok, false)
const open = assertFinancialPeriodAllowsPosting("2026-07-01", [
  { start_date: "2026-06-01", end_date: "2026-06-30", status: "closed" },
])
assert.equal(open.ok, true)

// --- Deferred revenue ---
const row = {
  id: "1",
  remaining_amount_cents: 1200,
  recognized_amount_cents: 0,
  original_amount_cents: 1200,
  recognition_frequency: "monthly" as const,
  next_recognition_date: "2026-01-01",
  start_date: "2026-01-01",
  end_date: "2026-12-31",
  status: "active",
}
assert.equal(computeNextRecognitionAmountCents(row, "2026-01-01") > 0, true)
const applied = applyRecognitionToScheduleState(row, 100, "2026-01-01")
assert.equal(applied.remaining_amount_cents, 1100)
assert.equal(applied.recognized_amount_cents, 100)
assert.equal(applied.status, "active")

// --- AP/AR & treasury helpers ---
const arap = compareArApToOperationalProxies({
  arGlCents: 1000,
  apGlCents: 500,
  openArProxyCents: 1000,
  openApProxyCents: 500,
  toleranceCents: 1,
})
assert.equal(arap.arBalanced, true)
assert.equal(arap.apBalanced, true)
const arap2 = compareArApToOperationalProxies({
  arGlCents: 2000,
  apGlCents: 500,
  openArProxyCents: 1000,
  openApProxyCents: 500,
  toleranceCents: 1,
})
assert.equal(arap2.arBalanced, false)

const cashChk = compareCashGlToTreasuryProxy({ cashGlCents: 10_000, treasuryOperatingProxyCents: 10_005, toleranceCents: 10 })
assert.equal(cashChk.aligned, true)

// --- Hierarchy rollups ---
const rollup = rollupSignedNetByAccountType([
  { account_type: "asset", debit_cents: 300, credit_cents: 0 },
  { account_type: "liability", debit_cents: 0, credit_cents: 200 },
])
assert.equal(rollup.assets, 300)
assert.equal(rollup.liabilities, 200)

const depth = buildCoaParentDepthMap([
  { id: "r", account_code: "1", account_name: "Root", account_type: "asset", parent_account_id: null, normal_balance: "debit" },
  { id: "c", account_code: "2", account_name: "Child", account_type: "asset", parent_account_id: "r", normal_balance: "debit" },
])
assert.equal(depth.get("c"), 1)

// --- Source hash (deterministic, peppered) ---
const h1 = hashAccountingSourceReference("invoice:abc")
const h2 = hashAccountingSourceReference("invoice:abc")
assert.equal(h1, h2)
assert.equal(h1.length, 64)

// --- Bounded caps ---
assert.equal(BLITZPAY_GL_CHART_LIST_CAP > 0 && BLITZPAY_GL_CHART_LIST_CAP < 10_000, true)
assert.equal(BLITZPAY_GL_TRIAL_BALANCE_ACCOUNT_CAP > 0 && BLITZPAY_GL_TRIAL_BALANCE_ACCOUNT_CAP < 10_000, true)

// --- API permission gate present (staff routes) ---
const trialRoute = readUtf8("app/api/organizations/[organizationId]/blitzpay/accounting/trial-balance/route.ts")
assert.match(trialRoute, /requireAnyOrgPermission/)
assert.match(trialRoute, /blitzpaySchemaGuardNextResponse/)

// --- Schema health table probes (GL) ---
const schemaHealth = readUtf8("lib/blitzpay/blitzpay-schema-health.ts")
for (const t of [
  "blitzpay_chart_of_accounts",
  "blitzpay_journal_batches",
  "blitzpay_journal_entries",
  "blitzpay_journal_lines",
  "blitzpay_financial_periods",
  "blitzpay_deferred_revenue_schedules",
  "blitzpay_account_balances",
]) {
  assert.ok(schemaHealth.includes(`"${t}"`), `schema health lists ${t}`)
}

console.log("blitzpay phase 3a general ledger tests passed")
