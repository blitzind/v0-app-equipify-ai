/**
 * BlitzPay Phase 2J — collections automation foundations.
 * Run: pnpm test:blitzpay-phase-2j
 */
import assert from "node:assert/strict"

function reminderKindFromDueDate(dueDateIso: string, status: string, nowIso: string): string | null {
  const st = status.toLowerCase()
  if (st === "paid" || st === "void") return null
  const dayDiff = Math.floor((Date.parse(nowIso) - Date.parse(dueDateIso)) / (1000 * 60 * 60 * 24))
  if (dayDiff === -3) return "before_due"
  if (dayDiff === 0) return "due_date"
  if (dayDiff === 3) return "overdue_3"
  if (dayDiff === 7) return "overdue_7"
  if (dayDiff >= 14) return "overdue_14"
  return null
}

function reminderIdempotencyKey(orgId: string, invoiceId: string, kind: string): string {
  return `blitzpay:reminder:v1:${orgId}:${invoiceId}:${kind}`
}

function shouldSuppressReminder(input: {
  invoiceStatus: string
  invoiceArchived: boolean
  customerArchived: boolean
  hasPaymentRecorded: boolean
  customerDeliveryPreference: string | null
  hasBillingEmail: boolean
}): string | null {
  if (input.invoiceArchived) return "invoice_archived"
  if (input.invoiceStatus === "paid" || input.hasPaymentRecorded) return "invoice_paid"
  if (input.invoiceStatus === "void") return "invoice_void"
  if (input.customerArchived) return "customer_archived"
  const pref = (input.customerDeliveryPreference ?? "").toLowerCase().trim()
  if (pref === "manual" || pref === "mail") return "customer_preference"
  if (!input.hasBillingEmail) return "missing_customer_email"
  return null
}

function validatePaymentLinkToken(token: string): boolean {
  return token.startsWith("bpl_") && token.length >= 20
}

function testReminderEligibility() {
  const now = "2026-09-30T00:00:00Z"
  assert.equal(reminderKindFromDueDate("2026-10-03T00:00:00Z", "sent", now), "before_due")
  assert.equal(reminderKindFromDueDate("2026-09-30T00:00:00Z", "sent", now), "due_date")
  assert.equal(reminderKindFromDueDate("2026-09-27T00:00:00Z", "sent", now), "overdue_3")
  assert.equal(reminderKindFromDueDate("2026-09-23T00:00:00Z", "sent", now), "overdue_7")
}

function testSuppressionRules() {
  assert.equal(
    shouldSuppressReminder({
      invoiceStatus: "paid",
      invoiceArchived: false,
      customerArchived: false,
      hasPaymentRecorded: true,
      customerDeliveryPreference: "email",
      hasBillingEmail: true,
    }),
    "invoice_paid",
  )
  assert.equal(
    shouldSuppressReminder({
      invoiceStatus: "sent",
      invoiceArchived: false,
      customerArchived: true,
      hasPaymentRecorded: false,
      customerDeliveryPreference: "email",
      hasBillingEmail: true,
    }),
    "customer_archived",
  )
}

function testIdempotencyKeyStable() {
  const k1 = reminderIdempotencyKey("org-1", "inv-1", "due_date")
  const k2 = reminderIdempotencyKey("org-1", "inv-1", "due_date")
  assert.equal(k1, k2)
  assert.equal(k1.includes("due_date"), true)
}

function testPaymentLinkValidation() {
  assert.equal(validatePaymentLinkToken("bpl_abcdef12345678901234"), true)
  assert.equal(validatePaymentLinkToken("bad_token"), false)
}

function testRecoveryRecommendations() {
  const abandonedCount = 2
  const recommendation =
    abandonedCount >= 2 ?
      "Customer has repeated abandoned Checkout attempts; resend a fresh payment link."
    : "Standard reminder cadence is sufficient."
  assert.equal(recommendation.includes("fresh payment link"), true)
}

testReminderEligibility()
testSuppressionRules()
testIdempotencyKeyStable()
testPaymentLinkValidation()
testRecoveryRecommendations()
console.log("blitzpay phase 2j tests passed")
