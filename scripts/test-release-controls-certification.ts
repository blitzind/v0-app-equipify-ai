/**
 * Offline certification for release-controls: period-end cancel + SMS fail-closed.
 * Run: npx tsx scripts/test-release-controls-certification.ts
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  periodEndCancelConfirmationMessage,
  periodEndCancelOwnershipErrorMessage,
  shouldScheduleCancelAtPeriodEnd,
  stripeSubscriptionCustomerId,
  verifyPeriodEndCancelOwnership,
} from "../lib/billing/request-cancel-at-period-end"
import {
  classifySmsOptOutKeyword,
  evaluateGrowthSmsLiveSendGate,
  isSmsStopKeyword,
} from "../lib/sms/sms-opt-out-rules"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function read(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8")
}

console.log("Release controls certification (offline)\n")

// --- Period-end cancel helpers ---
assert.equal(shouldScheduleCancelAtPeriodEnd({ stripeStatus: "active", cancelAtPeriodEnd: false }), "schedule")
assert.equal(shouldScheduleCancelAtPeriodEnd({ stripeStatus: "active", cancelAtPeriodEnd: true }), "already_scheduled")
assert.equal(shouldScheduleCancelAtPeriodEnd({ stripeStatus: "canceled", cancelAtPeriodEnd: false }), "rejected")
assert.match(periodEndCancelConfirmationMessage("2026-11-01T12:00:00.000Z"), /2026-11-01/)

assert.equal(stripeSubscriptionCustomerId("cus_abc"), "cus_abc")
assert.equal(stripeSubscriptionCustomerId({ id: "cus_xyz" }), "cus_xyz")
assert.equal(stripeSubscriptionCustomerId({ id: "cus_del", deleted: true }), null)

assert.deepEqual(
  verifyPeriodEndCancelOwnership({
    activeOrganizationId: "org-a",
    subscriptionRowOrganizationId: "org-a",
    orgStripeCustomerId: "cus_1",
    stripeSubscriptionCustomerId: "cus_1",
  }),
  { ok: true },
)
assert.equal(
  verifyPeriodEndCancelOwnership({
    activeOrganizationId: "org-a",
    subscriptionRowOrganizationId: "org-b",
    orgStripeCustomerId: "cus_1",
    stripeSubscriptionCustomerId: "cus_1",
  }).ok,
  false,
)
assert.equal(
  verifyPeriodEndCancelOwnership({
    activeOrganizationId: "org-a",
    subscriptionRowOrganizationId: null,
    orgStripeCustomerId: "cus_1",
    stripeSubscriptionCustomerId: "cus_2",
  }).ok,
  false,
)
assert.match(periodEndCancelOwnershipErrorMessage("customer_mismatch"), /billing profile/i)

const stripeActions = read("app/actions/stripe.ts")
assert.match(stripeActions, /runPeriodEndCancelFlow/)
assert.match(stripeActions, /cancel_at_period_end: true/)
assert.doesNotMatch(stripeActions, /subscriptions\.cancel\(/)
assert.match(stripeActions, /requireOrgPermissionForServerAction\(resolved\.organizationId, "canEditOrgBilling"\)/)

// --- SMS gates ---
for (const kw of ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]) {
  assert.equal(isSmsStopKeyword(kw), true, kw)
}
assert.equal(classifySmsOptOutKeyword("HELP"), "help")
assert.equal(classifySmsOptOutKeyword("help"), "help")
assert.equal(isSmsStopKeyword("HELP"), false)

const liveBlocked = evaluateGrowthSmsLiveSendGate({
  liveSendEnabled: true,
  suppressed: false,
  organizationId: "org-1",
})
assert.equal(liveBlocked.allow, false)
if (!liveBlocked.allow) assert.equal(liveBlocked.code, "missing_consent")

const sendSms = read("lib/growth/sms/send-sms.ts")
assert.match(sendSms, /evaluateGrowthSmsLiveSendGate/)
assert.match(sendSms, /isOrganizationSmsSuppressed/)

const inbound = read("lib/growth/sms/webhooks/twilio-sms-ingestion.ts")
assert.match(inbound, /persistStopKeywordSuppression/)
assert.match(inbound, /optOut === "stop"/)
assert.match(inbound, /confirmedStop \? "stop"/)
assert.doesNotMatch(inbound, /reason: "help"/)
assert.match(inbound, /validateWebhook/)
assert.match(inbound, /lead\.organizationId/)
assert.doesNotMatch(inbound, /lead\.promotedOrganizationId/)

const inboundRoute = read("app/api/growth/webhooks/sms/twilio/inbound/route.ts")
assert.match(inboundRoute, /result\.optOut === "stop"/)

const transactional = read("lib/sms/queue-transactional-sms-notification.server.ts")
assert.match(transactional, /organization_sms_suppressions/)
assert.match(transactional, /organization_sms_recipient_consents/)
assert.match(transactional, /consent_scope", "transactional"/)
assert.match(transactional, /suppression_lookup_failed/)
assert.match(transactional, /consent_lookup_failed/)

const cancelFlow = read("lib/billing/period-end-cancel-request.ts")
assert.match(cancelFlow, /localSyncPending/)

console.log("OK: release-controls certification checks passed.")
