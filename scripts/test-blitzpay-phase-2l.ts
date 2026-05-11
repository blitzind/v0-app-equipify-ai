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
  buildBlitzpayLaunchReadinessChecklist,
  blitzpayLaunchReadinessScore,
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

function testLaunchReadinessAudience() {
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

  const orgItems = buildBlitzpayLaunchReadinessChecklist({ ...base, audience: "organization" })
  const platItems = buildBlitzpayLaunchReadinessChecklist({ ...base, audience: "platform" })
  assert.ok(platItems.length > orgItems.length, "platform checklist should include env-only rows")
  assert.ok(!orgItems.some((i) => i.platformOnly), "org audience should strip platformOnly rows")

  const s = blitzpayLaunchReadinessScore(orgItems)
  assert.equal(s.total, orgItems.length)
  assert.ok(s.passed <= s.total)

  const offReminders = buildBlitzpayLaunchReadinessChecklist({
    ...base,
    audience: "organization",
    orgRemindersEnabled: false,
  })
  const rem = offReminders.find((i) => i.id === "reminders")
  assert.ok(rem)
  assert.equal(rem.ok, false)
}

function testRolloutHostedPayGate() {
  const items = buildBlitzpayLaunchReadinessChecklist({
    audience: "organization",
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
  const hosted = items.find((i) => i.id === "hosted_pay")
  assert.ok(hosted)
  assert.equal(hosted.ok, false)
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
testLaunchReadinessAudience()
testRolloutHostedPayGate()
testPlatformAdminGateSource()
testPaymentLinkRouteGate()
testPlatformAdminEmailEnv()

console.log("blitzpay phase 2l tests passed")
