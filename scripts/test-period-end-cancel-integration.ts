/**
 * Mocked period-end cancellation integration tests (no Stripe API, no DB).
 * Run: npx tsx scripts/test-period-end-cancel-integration.ts
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  runPeriodEndCancelFlow,
  type PeriodEndCancelDeps,
  type PeriodEndCancelStripeSubscription,
} from "../lib/billing/period-end-cancel-request"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function baseSub(overrides: Partial<PeriodEndCancelStripeSubscription> = {}): PeriodEndCancelStripeSubscription {
  return {
    id: "sub_test",
    status: "active",
    cancel_at_period_end: false,
    customer: "cus_org",
    current_period_end: 1_892_000_000,
    ...overrides,
  }
}

function deps(overrides: Partial<PeriodEndCancelDeps> = {}): PeriodEndCancelDeps {
  const sub = baseSub()
  return {
    retrieveSubscription: async () => sub,
    scheduleCancelAtPeriodEnd: async () => ({ ...sub, cancel_at_period_end: true }),
    lookupSubscriptionOwnerOrganizationId: async () => orgA,
    upsertLocalSubscription: async () => undefined,
    mapStripeStatus: (s) => s,
    unixSecondsToIso: (s) => (s ? new Date(s * 1000).toISOString() : null),
    ...overrides,
  }
}

const orgA = "00000000-0000-4000-8000-000000000001"
const local = { stripe_customer_id: "cus_org", current_period_end: "2026-12-01T00:00:00.000Z" }

async function main(): Promise<void> {
console.log("Period-end cancel integration (mocked)\n")

// Authorized schedule
{
  let updated = false
  const r = await runPeriodEndCancelFlow({
    organizationId: orgA,
    stripeSubscriptionId: "sub_test",
    localSubscription: local,
    deps: deps({
      scheduleCancelAtPeriodEnd: async () => {
        updated = true
        return baseSub({ cancel_at_period_end: true })
      },
    }),
  })
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(updated, true)
}

// Cross-organization
{
  const r = await runPeriodEndCancelFlow({
    organizationId: orgA,
    stripeSubscriptionId: "sub_test",
    localSubscription: local,
    deps: deps({
      lookupSubscriptionOwnerOrganizationId: async () => "org-other",
    }),
  })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.code, "subscription_org_mismatch")
}

// Customer mismatch
{
  const r = await runPeriodEndCancelFlow({
    organizationId: orgA,
    stripeSubscriptionId: "sub_test",
    localSubscription: { stripe_customer_id: "cus_org", current_period_end: null },
    deps: deps({
      retrieveSubscription: async () => baseSub({ customer: "cus_other" }),
    }),
  })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.code, "customer_mismatch")
}

// Already scheduled — no Stripe update
{
  let updated = false
  const r = await runPeriodEndCancelFlow({
    organizationId: orgA,
    stripeSubscriptionId: "sub_test",
    localSubscription: local,
    deps: deps({
      retrieveSubscription: async () => baseSub({ cancel_at_period_end: true }),
      scheduleCancelAtPeriodEnd: async () => {
        updated = true
        return baseSub({ cancel_at_period_end: true })
      },
    }),
  })
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.alreadyScheduled, true)
  assert.equal(updated, false)
}

// Already canceled
{
  const r = await runPeriodEndCancelFlow({
    organizationId: orgA,
    stripeSubscriptionId: "sub_test",
    localSubscription: local,
    deps: deps({
      retrieveSubscription: async () => baseSub({ status: "canceled" }),
    }),
  })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.code, "already_canceled")
}

// Stripe retrieve failure
{
  const r = await runPeriodEndCancelFlow({
    organizationId: orgA,
    stripeSubscriptionId: "sub_test",
    localSubscription: local,
    deps: deps({
      retrieveSubscription: async () => {
        throw new Error("network")
      },
    }),
  })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.code, "stripe_retrieve_failed")
}

// Stripe update failure
{
  const r = await runPeriodEndCancelFlow({
    organizationId: orgA,
    stripeSubscriptionId: "sub_test",
    localSubscription: local,
    deps: deps({
      scheduleCancelAtPeriodEnd: async () => {
        throw new Error("card_error")
      },
    }),
  })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.code, "stripe_update_failed")
}

// Stripe success, local DB failure — success with sync pending (not a Stripe failure)
{
  const r = await runPeriodEndCancelFlow({
    organizationId: orgA,
    stripeSubscriptionId: "sub_test",
    localSubscription: local,
    deps: deps({
      upsertLocalSubscription: async () => {
        throw new Error("db down")
      },
    }),
  })
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal(r.localSyncPending, true)
    assert.match(r.message ?? "", /next sync/i)
  }
}

// Webhook reconciliation remains authoritative
const webhookSync = readFileSync(resolve(root, "lib/billing/stripe-webhook-sync.ts"), "utf8")
assert.match(webhookSync, /cancel_at_period_end: sub\.cancel_at_period_end/)

// Server action gates (unauthorized / missing sub) — structural
const stripeActions = readFileSync(resolve(root, "app/actions/stripe.ts"), "utf8")
assert.match(stripeActions, /canEditOrgBilling/)
assert.match(stripeActions, /runPeriodEndCancelFlow/)
assert.match(stripeActions, /No paid Stripe subscription is on file/)
assert.doesNotMatch(stripeActions, /subscriptions\.cancel\(/)

console.log("OK: period-end cancel integration scenarios passed.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
