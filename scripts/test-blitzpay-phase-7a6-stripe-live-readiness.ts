/**
 * BlitzPay Phase 7A.6 — Stripe live readiness, webhook safety, and operational diagnostics (pure helpers + wiring assertions).
 * Run: pnpm test:blitzpay-phase-7a6-stripe-live-readiness
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  blitzpayWebhookDuplicateDeliveryBody,
  buildBlitzpayStripeLiveReadinessStrip,
  inferStripeWebhookLivemodeAlignment,
  isLikelyStripeWebhookEventId,
  parseStripePublishableKeyMode,
  parseStripeSecretKeyMode,
  sanitizeBlitzpayOperationalLogDetail,
  scanJsonForStripeLikeTokens,
  summarizeBlitzpayWebhookOperationalStatus,
} from "../lib/blitzpay/blitzpay-stripe-readiness-guards"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")

function read(rel: string): string {
  return fs.readFileSync(path.join(APP_ROOT, rel), "utf8")
}

function main(): void {
  assert.equal(parseStripeSecretKeyMode("sk_test_abc"), "test")
  assert.equal(parseStripeSecretKeyMode("sk_live_abc"), "live")
  assert.equal(parseStripeSecretKeyMode(""), "missing")
  assert.equal(parseStripeSecretKeyMode("bogus"), "invalid")

  assert.ok(isLikelyStripeWebhookEventId("evt_1234567890ab"))
  assert.ok(!isLikelyStripeWebhookEventId("not_evt"))

  assert.deepEqual(blitzpayWebhookDuplicateDeliveryBody(), { received: true, duplicate: true })

  assert.equal(inferStripeWebhookLivemodeAlignment({ stripeSecretKeyMode: "test", eventLivemode: true, stripeLiveModeEnforcedOnHost: false }), "mismatch_live_event_on_test_host")
  assert.equal(
    inferStripeWebhookLivemodeAlignment({ stripeSecretKeyMode: "live", eventLivemode: false, stripeLiveModeEnforcedOnHost: true }),
    "mismatch_test_event_on_live_enforced_host",
  )
  assert.equal(inferStripeWebhookLivemodeAlignment({ stripeSecretKeyMode: "live", eventLivemode: true, stripeLiveModeEnforcedOnHost: true }), "aligned")

  const dirty = "failed whsec_abc123 token sk_live_xxxxxxxxxxxxxxxx and pk_test_yyyyy"
  const clean = sanitizeBlitzpayOperationalLogDetail(dirty)
  assert.ok(!clean.includes("whsec_"))
  assert.ok(!clean.includes("sk_live_"))
  assert.ok(!clean.includes("pk_test_"))

  const tokens = scanJsonForStripeLikeTokens({ a: "pi_1234567890abcdefghijkl", nested: ["acct_1234567890abcdef"] })
  assert.ok(tokens.some((t) => t.startsWith("pi_")))
  assert.ok(tokens.some((t) => t.startsWith("acct_")))

  const iso = "2026-05-12T12:00:00.000Z"
  const strip = buildBlitzpayStripeLiveReadinessStrip({
    generatedAtIso: iso,
    stripeSecretKeyMode: "test",
    nextPublicPublishableKeyMode: "test",
    stripeLiveModeEnforcedOnHost: false,
    blitzpayWebhookSecretConfigured: true,
    connectStatus: "ready",
    stripeChargesEnabled: true,
    stripePayoutsEnabled: true,
    stripeDetailsSubmitted: true,
    requirementsCurrentlyDueCount: 0,
    requirementsPastDueCount: 0,
    failedPayoutCount30d: 0,
    pendingPayoutsCents: 10_000_00,
    openDisputesCount: 0,
    openDisputesAmountCents: 0,
    achNudgeOpportunityCount: 0,
  })
  const strip2 = buildBlitzpayStripeLiveReadinessStrip({
    generatedAtIso: iso,
    stripeSecretKeyMode: "test",
    nextPublicPublishableKeyMode: "test",
    stripeLiveModeEnforcedOnHost: false,
    blitzpayWebhookSecretConfigured: true,
    connectStatus: "ready",
    stripeChargesEnabled: true,
    stripePayoutsEnabled: true,
    stripeDetailsSubmitted: true,
    requirementsCurrentlyDueCount: 0,
    requirementsPastDueCount: 0,
    failedPayoutCount30d: 0,
    pendingPayoutsCents: 10_000_00,
    openDisputesCount: 0,
    openDisputesAmountCents: 0,
    achNudgeOpportunityCount: 0,
  })
  assert.equal(JSON.stringify(strip), JSON.stringify(strip2))
  assert.ok(strip.connectOperationalWarnings.length <= 5)
  assert.ok(strip.operationalFootnotes.length <= 4)

  const mismatchPk = buildBlitzpayStripeLiveReadinessStrip({
    generatedAtIso: iso,
    stripeSecretKeyMode: "test",
    nextPublicPublishableKeyMode: "live",
    stripeLiveModeEnforcedOnHost: false,
    blitzpayWebhookSecretConfigured: true,
    connectStatus: "ready",
    stripeChargesEnabled: true,
    stripePayoutsEnabled: true,
    stripeDetailsSubmitted: true,
    requirementsCurrentlyDueCount: 0,
    requirementsPastDueCount: 0,
    failedPayoutCount30d: 0,
    pendingPayoutsCents: 0,
    openDisputesCount: 0,
    openDisputesAmountCents: 0,
    achNudgeOpportunityCount: 0,
  })
  assert.equal(mismatchPk.publishableSecretModeAligned, false)
  assert.ok(mismatchPk.environmentAlignmentNote)

  const webhookNarr = summarizeBlitzpayWebhookOperationalStatus({ deadInbox24h: 2, pendingInboxApprox: 12, ignoredUnknownEvents7dApprox: 0 })
  assert.equal(webhookNarr.tone, "attention")
  assert.ok(webhookNarr.detailLines.length <= 4)

  const fcc = read("lib/blitzpay/blitzpay-financial-command-center.ts")
  assert.match(fcc, /stripeLiveReadiness/)
  assert.match(fcc, /buildBlitzpayStripeLiveReadinessStrip/)

  const plat = read("lib/blitzpay/blitzpay-platform-operations.ts")
  assert.match(plat, /stripeHostSecretKeyMode/)
  assert.match(plat, /webhookOperationalStatus/)

  const webhookRoute = read("app/api/blitzpay/webhook/route.ts")
  assert.match(webhookRoute, /duplicate: true/)
  assert.match(webhookRoute, /blitzpay_stripe_webhook_events/)

  assert.equal(parseStripePublishableKeyMode("pk_test_x"), "test")
}

try {
  main()
} catch (e) {
  console.error(e)
  process.exit(1)
}
