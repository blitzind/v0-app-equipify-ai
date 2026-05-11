/**
 * BlitzPay Phase 2N — customer wallet, credits, unified balance.
 * Run: pnpm test:blitzpay-phase-2n
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function testMigrationTablesAndIdempotency() {
  const sql = read("supabase/migrations/20260921120000_blitzpay_phase_2n_customer_wallet.sql")
  assert.match(sql, /blitzpay_customer_wallets/)
  assert.match(sql, /blitzpay_customer_wallet_ledger/)
  assert.match(sql, /idempotency_key/)
  assert.match(sql, /idx_blitzpay_wallet_ledger_idem/)
}

function testWalletLedgerKindsAndOverpayPrefix() {
  const src = read("lib/blitzpay/blitzpay-customer-wallet.ts")
  assert.match(src, /credit_overpayment_invoice/)
  assert.match(src, /debit_apply_invoice/)
  assert.match(src, /debit_refund_clawback/)
  assert.match(src, /BLITZPAY_WALLET_OVERPAY_CREDIT_PREFIX/)
  assert.match(src, /blitzpay_wallet_apply_ledger:/)
}

function testApplyInvoiceIdempotentLedgerKey() {
  const src = read("lib/blitzpay/blitzpay-customer-wallet.ts")
  assert.match(src, /blitzpay_wallet_apply_ledger:\$\{idem\}/)
  assert.match(src, /blitzpay_wallet_apply:\$\{idem\}/)
}

function testRollbackCreditOnPaymentInsertFailure() {
  const src = read("lib/blitzpay/blitzpay-customer-wallet.ts")
  assert.match(src, /blitzpay_wallet_apply_rollback:/)
  assert.match(src, /payment_insert_failed/)
}

function testWebhookOverpaymentPath() {
  const src = read("lib/blitzpay/webhook-invoice-pay-completion.ts")
  assert.match(src, /creditBlitzpayWalletOverpaymentFromInvoicePayment/)
}

function testRefundClawbackWired() {
  const src = read("lib/blitzpay/blitzpay-refund-apply.ts")
  assert.match(src, /clawbackBlitzpayWalletOverpaymentForStripeRefund/)
}

function testPortalWalletSanitizedPayload() {
  const src = read("app/api/portal/wallet/route.ts")
  assert.match(src, /accountCreditCents/)
  assert.equal(src.includes("stripe_payment_intent"), false)
}

function testApplyInvoiceRouteRequiresBothPermissions() {
  const src = read("app/api/organizations/[organizationId]/customers/[customerId]/blitzpay/wallet/apply-invoice/route.ts")
  assert.match(src, /requireOrgPermission/)
  assert.match(src, /canEditInvoices/)
  assert.match(src, /canViewFinancials/)
}

function testSchemaHealthIncludesWalletTables() {
  const src = read("lib/blitzpay/blitzpay-schema-health.ts")
  assert.match(src, /blitzpay_customer_wallets/)
  assert.match(src, /blitzpay_customer_wallet_ledger/)
}

function testReportingSnapshotWalletFields() {
  const src = read("lib/blitzpay/blitzpay-reporting-snapshot.ts")
  assert.match(src, /customerWalletSpendableCreditTotalCents/)
  assert.match(src, /customerUnappliedEstimateDepositTotalCents/)
  assert.match(src, /customerWalletAppliedToInvoicesWindowCents/)
}

function testUnappliedDepositQueryIgnoresConvertedQuotes() {
  const src = read("lib/blitzpay/blitzpay-customer-wallet.ts")
  assert.match(src, /blitzpay_converted_invoice_id/)
}

testMigrationTablesAndIdempotency()
testWalletLedgerKindsAndOverpayPrefix()
testApplyInvoiceIdempotentLedgerKey()
testRollbackCreditOnPaymentInsertFailure()
testWebhookOverpaymentPath()
testRefundClawbackWired()
testPortalWalletSanitizedPayload()
testApplyInvoiceRouteRequiresBothPermissions()
testSchemaHealthIncludesWalletTables()
testReportingSnapshotWalletFields()
testUnappliedDepositQueryIgnoresConvertedQuotes()

console.log("blitzpay phase 2n tests passed")
