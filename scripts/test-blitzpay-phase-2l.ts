/**
 * BlitzPay Phase 2L — platform ops, rollout flags, payment-link controls, launch readiness.
 * Run: pnpm test:blitzpay-phase-2l
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { blitzpayReminderDispatchTrigger } from "../lib/blitzpay/blitzpay-reminder-dispatch-trigger"
import {
  buildBlitzpayLaunchTechnicalDiagnostics,
  buildBlitzpayLaunchWorkspaceChecklist,
  blitzpayLaunchReadinessScore,
  blitzpayLaunchReadinessStatusPhrase,
  blitzpayLaunchReadinessSubline,
} from "../lib/blitzpay/blitzpay-launch-readiness"
import { isPlatformAdminEmail } from "../lib/platform-admin-policy"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function testReminderTriggerSelection() {
  assert.equal(blitzpayReminderDispatchTrigger({ dryRun: true, manual: true }), "dry_run")
  assert.equal(blitzpayReminderDispatchTrigger({ dryRun: false, manual: true }), "manual")
  assert.equal(blitzpayReminderDispatchTrigger({ dryRun: false, manual: false }), "cron")
  assert.equal(blitzpayReminderDispatchTrigger(undefined), "cron")
}

function testLaunchWorkspaceChecklistNoRawEnvLabels() {
  const base = {
    platformInvoicePayEnv: true,
    schemaHealthy: true,
    webhookSecretConfigured: true,
    cronSecretConfigured: true,
    stripeConnectAccountPresent: true,
    stripeChargesEnabled: true,
    orgBlitzpayInvoicePayEnabled: true,
    orgCardOrAchEnabled: true,
    orgRemindersEnabled: true,
    orgReceiptEmailsEnabled: true,
    outboundEmailConfigured: true,
    hasSuccessfulTestCapture: true,
  } as const

  const items = buildBlitzpayLaunchWorkspaceChecklist({ ...base })
  assert.equal(items.length, 10)
  const joined = items.map((i) => `${i.label} ${i.detail}`).join(" ")
  assert.doesNotMatch(joined, /BLITZPAY_INVOICE_PAY_ENABLED/)
  assert.doesNotMatch(joined, /STRIPE_BLITZPAY_WEBHOOK_SECRET/)
  assert.doesNotMatch(joined, /CRON_SECRET/)

  const s = blitzpayLaunchReadinessScore(items)
  assert.equal(s.total, 10)
  assert.equal(s.passed, 10)
  assert.equal(blitzpayLaunchReadinessStatusPhrase(items), "Ready to go")
  assert.match(blitzpayLaunchReadinessSubline(items), /10 of 10/)

  const tech = buildBlitzpayLaunchTechnicalDiagnostics({
    platformInvoicePayEnv: true,
    webhookSecretConfigured: true,
    cronSecretConfigured: true,
    schemaHealthy: true,
    schemaDiagnosticDetail: "ok",
  })
  assert.ok(tech.some((r) => r.label === "BLITZPAY_INVOICE_PAY_ENABLED"))
  assert.ok(tech.some((r) => r.label === "STRIPE_BLITZPAY_WEBHOOK_SECRET"))
}

function testRemindersRow() {
  const base = {
    platformInvoicePayEnv: true,
    schemaHealthy: true,
    webhookSecretConfigured: true,
    cronSecretConfigured: true,
    stripeConnectAccountPresent: true,
    stripeChargesEnabled: true,
    orgBlitzpayInvoicePayEnabled: true,
    orgCardOrAchEnabled: true,
    orgRemindersEnabled: false,
    orgReceiptEmailsEnabled: true,
    outboundEmailConfigured: true,
    hasSuccessfulTestCapture: true,
  } as const
  const items = buildBlitzpayLaunchWorkspaceChecklist(base)
  const rem = items.find((i) => i.id === "reminders")
  assert.ok(rem)
  assert.equal(rem.ok, false)
}

function testRolloutHostedPayGate() {
  const items = buildBlitzpayLaunchWorkspaceChecklist({
    platformInvoicePayEnv: false,
    schemaHealthy: true,
    webhookSecretConfigured: true,
    cronSecretConfigured: true,
    stripeConnectAccountPresent: true,
    stripeChargesEnabled: true,
    orgBlitzpayInvoicePayEnabled: true,
    orgCardOrAchEnabled: true,
    orgRemindersEnabled: true,
    orgReceiptEmailsEnabled: true,
    outboundEmailConfigured: true,
    hasSuccessfulTestCapture: false,
  })
  const hosted = items.find((i) => i.id === "online_invoice_payments")
  assert.ok(hosted)
  assert.equal(hosted.ok, false)
}

function testLaunchReadinessApiShape() {
  const src = read("app/api/organizations/[organizationId]/blitzpay/launch-readiness/route.ts")
  assert.match(src, /buildBlitzpayLaunchWorkspaceChecklist/)
  assert.match(src, /buildBlitzpayLaunchTechnicalDiagnostics/)
  assert.match(src, /presentation:/)
  assert.match(src, /technicalDiagnostics/)
}

function testPlatformAdminGateSource() {
  for (const rel of [
    "app/api/platform/blitzpay/operations/route.ts",
    "app/api/platform/blitzpay/reminder-dispatch/route.ts",
    "app/api/platform/blitzpay/reminder-runs/route.ts",
  ]) {
    const src = read(rel)
    assert.match(src, /isPlatformAdminEmail/, `${rel} should gate on platform admin email`)
  }
}

function testPaymentLinkRouteGate() {
  const src = read("app/api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/payment-links/[linkId]/route.ts")
  assert.match(src, /canEditInvoices/)
}

function testPlatformAdminEmailEnv() {
  const prev = process.env.EQUIPIFY_PLATFORM_ADMIN_EMAILS
  process.env.EQUIPIFY_PLATFORM_ADMIN_EMAILS = "ops@equipify.test"
  try {
    assert.equal(isPlatformAdminEmail("ops@equipify.test"), true)
    assert.equal(isPlatformAdminEmail("other@equipify.test"), false)
  } finally {
    if (prev === undefined) delete process.env.EQUIPIFY_PLATFORM_ADMIN_EMAILS
    else process.env.EQUIPIFY_PLATFORM_ADMIN_EMAILS = prev
  }
}

testReminderTriggerSelection()
testLaunchWorkspaceChecklistNoRawEnvLabels()
testRemindersRow()
testRolloutHostedPayGate()
testLaunchReadinessApiShape()
testPlatformAdminGateSource()
testPaymentLinkRouteGate()
testPlatformAdminEmailEnv()

console.log("blitzpay phase 2l tests passed")
