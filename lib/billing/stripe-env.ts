/**
 * Phase 54.1 — Stripe deployment guards and env validation (no secrets logged or embedded).
 *
 * @see docs/STRIPE_PRODUCTION_READINESS.md for Vercel/Stripe setup checklist.
 *
 * Env vars used by Equipify billing (names only):
 * - STRIPE_SECRET_KEY — server, Checkout + Customer Portal + webhooks client
 * - STRIPE_WEBHOOK_SECRET — server, POST /api/stripe/webhook signature verification
 * - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — client, Elements on /settings/billing (optional if card UI hidden)
 * - STRIPE_PRICE_{SOLO,CORE,GROWTH,SCALE}_{MONTHLY,ANNUAL} — optional overrides (see lib/billing/stripe-price-map.ts)
 *
 * Live vs test separation:
 * - Production deploys (VERCEL_ENV=production) or STRIPE_LIVE_MODE=true require sk_live_ / pk_live_.
 * - Local/preview use sk_test_ / pk_test_ by default.
 * - Price IDs cannot be told apart by string format; use separate Stripe accounts + env per deploy.
 */
import "server-only"

import { PLAN_IDS } from "@/lib/plans"
import { stripePriceIdForPlan } from "@/lib/billing/stripe-price-map"
import { validateStripePriceId } from "@/lib/billing/stripe-price-validation"

/** True when this process must use Stripe *live* keys (not sk_test_/pk_test_). */
export function isStripeLiveEnforced(): boolean {
  if (process.env.STRIPE_LIVE_MODE === "true") return true
  if (process.env.VERCEL_ENV === "production") return true
  return false
}

/**
 * Ensures STRIPE_SECRET_KEY shape and mode match the deploy.
 * Throws Error with messages that name env vars only (never values).
 */
export function assertStripeSecretKeyMatchesDeployment(secretKey: string): void {
  const trimmed = secretKey.trim()
  if (!trimmed) {
    throw new Error(
      "STRIPE_SECRET_KEY is missing or empty. Add it to your server environment (e.g. Vercel project env). Never commit secret values.",
    )
  }
  const isTest = trimmed.startsWith("sk_test_")
  const isLive = trimmed.startsWith("sk_live_")
  if (!isTest && !isLive) {
    throw new Error(
      "STRIPE_SECRET_KEY must start with sk_test_ (test mode) or sk_live_ (live mode). Verify the variable name and that the value is the full secret key from Stripe Dashboard → Developers → API keys.",
    )
  }
  if (isStripeLiveEnforced() && isTest) {
    throw new Error(
      "STRIPE_SECRET_KEY is a test key (sk_test_...) but this deploy is configured for live Stripe (VERCEL_ENV=production or STRIPE_LIVE_MODE=true). Use a live secret key for production, or use preview/local with test keys.",
    )
  }
  if (!isStripeLiveEnforced() && isLive && process.env.NODE_ENV === "development") {
    console.warn(
      "[stripe-env] STRIPE_SECRET_KEY is sk_live_ while NODE_ENV=development. Confirm this workspace should touch live Stripe data.",
    )
  }
}

/**
 * When set, publishable key mode should match secret key mode on live deploys to avoid mixed Dashboard/account confusion.
 * No-op if unset (billing UI may hide Stripe Elements).
 */
export function assertPublishableKeyMatchesDeployment(publishableKey: string | undefined): void {
  const raw = publishableKey?.trim()
  if (!raw) return

  const pkTest = raw.startsWith("pk_test_")
  const pkLive = raw.startsWith("pk_live_")
  if (!pkTest && !pkLive) {
    throw new Error(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_test_ or pk_live_. Check the variable name in your environment.",
    )
  }
  if (isStripeLiveEnforced() && pkTest) {
    throw new Error(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is a test publishable key (pk_test_...) but this deploy expects live Stripe. Set pk_live_... for production, or unset STRIPE_LIVE_MODE if this is intentional test traffic (not recommended on production hostname).",
    )
  }
  if (!isStripeLiveEnforced() && pkLive && process.env.NODE_ENV === "development") {
    console.warn(
      "[stripe-env] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is pk_live_ on a non-live-enforced deploy. Confirm intentional.",
    )
  }
}

export function validateStripeWebhookSecretConfigured():
  | { ok: true }
  | { ok: false; message: string } {
  const s = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!s) {
    return {
      ok: false,
      message:
        "STRIPE_WEBHOOK_SECRET is not set. Add the signing secret from Stripe Dashboard → Developers → Webhooks for the endpoint that posts to /api/stripe/webhook.",
    }
  }
  return { ok: true }
}

/**
 * Validates resolved Price IDs for all plans/cycles (env override or catalog in lib/plans.ts).
 * Use before creating Checkout sessions in strict environments.
 */
export function validateResolvedStripePriceIds():
  | { ok: true }
  | { ok: false; errors: string[] } {
  const errors: string[] = []
  for (const planId of PLAN_IDS) {
    for (const cycle of ["monthly", "annual"] as const) {
      const priceId = stripePriceIdForPlan(planId, cycle)
      const v = validateStripePriceId(priceId)
      if (!v.ok) {
        errors.push(`Plan ${planId} (${cycle}): ${v.error} — set the matching STRIPE_PRICE_* env var or fix catalog IDs in lib/plans.ts.`)
      }
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true }
}

/** Safe structured fields for logs (no secrets, no card data). */
export function stripeWebhookLogContext(): {
  stripeLiveEnforced: boolean
  vercelEnv: string | undefined
  nodeEnv: string | undefined
} {
  return {
    stripeLiveEnforced: isStripeLiveEnforced(),
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
  }
}
