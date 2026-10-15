/**
 * Release-critical SMS opt-out / fail-closed gates.
 * Run: npx tsx scripts/test-release-sms-opt-out.ts
 * Does not send SMS or touch providers.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  classifySmsOptOutKeyword,
  evaluateGrowthSmsLiveSendGate,
  isSmsStopKeyword,
} from "../lib/sms/sms-opt-out-rules"
import {
  periodEndCancelConfirmationMessage,
  shouldScheduleCancelAtPeriodEnd,
  verifyPeriodEndCancelOwnership,
} from "../lib/billing/request-cancel-at-period-end"

console.log("Release controls — SMS opt-out + period-end cancel helpers\n")

assert.equal(classifySmsOptOutKeyword("stop"), "stop")
assert.equal(classifySmsOptOutKeyword("STOP."), "stop")
assert.equal(classifySmsOptOutKeyword("unsubscribe"), "stop")
assert.equal(isSmsStopKeyword("END"), true)
assert.equal(classifySmsOptOutKeyword("HELP"), "help")
assert.equal(classifySmsOptOutKeyword("yes interested"), null)

const noop = evaluateGrowthSmsLiveSendGate({
  liveSendEnabled: false,
  suppressed: false,
  organizationId: "org-1",
})
assert.equal(noop.allow, true)

const liveMissingConsent = evaluateGrowthSmsLiveSendGate({
  liveSendEnabled: true,
  suppressed: false,
  organizationId: "org-1",
})
assert.equal(liveMissingConsent.allow, false)
if (!liveMissingConsent.allow) assert.equal(liveMissingConsent.code, "missing_consent")

const liveSuppressed = evaluateGrowthSmsLiveSendGate({
  liveSendEnabled: true,
  suppressed: true,
  organizationId: "org-1",
})
assert.equal(liveSuppressed.allow, false)
if (!liveSuppressed.allow) assert.equal(liveSuppressed.code, "suppressed")

const liveNoOrg = evaluateGrowthSmsLiveSendGate({
  liveSendEnabled: true,
  suppressed: false,
  organizationId: null,
})
assert.equal(liveNoOrg.allow, false)
if (!liveNoOrg.allow) assert.equal(liveNoOrg.code, "missing_org")

assert.equal(shouldScheduleCancelAtPeriodEnd({ stripeStatus: "active", cancelAtPeriodEnd: false }), "schedule")
assert.equal(shouldScheduleCancelAtPeriodEnd({ stripeStatus: "active", cancelAtPeriodEnd: true }), "already_scheduled")
assert.equal(shouldScheduleCancelAtPeriodEnd({ stripeStatus: "canceled", cancelAtPeriodEnd: false }), "rejected")
assert.match(periodEndCancelConfirmationMessage("2026-11-01T00:00:00.000Z"), /2026-11-01/)

const stripeActions = readFileSync(resolve("app/actions/stripe.ts"), "utf8")
assert.match(stripeActions, /cancel_at_period_end: true/)
assert.doesNotMatch(stripeActions, /subscriptions\.cancel\(/)
assert.match(stripeActions, /requestCancelSubscriptionAtPeriodEnd/)
assert.match(stripeActions, /canEditOrgBilling/)
assert.match(stripeActions, /runPeriodEndCancelFlow/)
assert.equal(
  verifyPeriodEndCancelOwnership({
    activeOrganizationId: "00000000-0000-4000-8000-000000000001",
    subscriptionRowOrganizationId: "00000000-0000-4000-8000-000000000002",
    orgStripeCustomerId: "cus_a",
    stripeSubscriptionCustomerId: "cus_a",
  }).ok,
  false,
)

const billingPage = readFileSync(resolve("app/(dashboard)/settings/billing/page.tsx"), "utf8")
assert.match(billingPage, /requestCancelSubscriptionAtPeriodEnd/)
assert.doesNotMatch(billingPage, /Canceling or downgrading your subscription through a self-serve control is not available/)
assert.doesNotMatch(billingPage, /createPortalSession/)

const sendSms = readFileSync(resolve("lib/growth/sms/send-sms.ts"), "utf8")
assert.match(sendSms, /evaluateGrowthSmsLiveSendGate/)
assert.match(sendSms, /isOrganizationSmsSuppressed/)

const inbound = readFileSync(resolve("lib/growth/sms/webhooks/twilio-sms-ingestion.ts"), "utf8")
const smsRepo = readFileSync(resolve("lib/growth/sms/sms-repository.ts"), "utf8")
assert.match(inbound, /persistStopKeywordSuppression/)
assert.match(inbound, /classifySmsOptOutKeyword/)
assert.match(inbound, /lead\.organizationId/)
assert.doesNotMatch(inbound, /lead\.promotedOrganizationId/)

// findLeadByPhone maps promoted_organization_id → organizationId (remote main contract).
assert.match(smsRepo, /organizationId: asString\(row\.promoted_organization_id\)/)

// STOP resolves org from lead without requiring workspace settings in the stopOrgId chain.
assert.match(
  inbound,
  /conversation\.organizationId \?\? lead\.organizationId \?\? settings\?\.organizationId/,
)

// Missing organization fails safely (no downstream reply/sequence path).
assert.match(inbound, /stop_missing_org/)
assert.match(inbound, /stop_not_persisted/)

// Settings fallback when lead is missing (no lead row) but STOP is received.
assert.match(inbound, /settingsForStop\?\.organizationId/)

// STOP returns before AI/reply ingestion (processSmsInboundReply).
const stopHandlerStart = inbound.indexOf('if (optOut === "stop")')
const stopReturnMarker = inbound.indexOf('optOut: confirmedStop ? "stop"', stopHandlerStart)
const replyIngestion = inbound.indexOf("processSmsInboundReply", stopHandlerStart)
assert.ok(stopHandlerStart >= 0 && stopReturnMarker > stopHandlerStart && replyIngestion > stopReturnMarker)

console.log("OK: SMS fail-closed gates, STOP keywords, and period-end cancel contracts passed.")
