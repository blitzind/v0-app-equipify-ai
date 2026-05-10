import "server-only"
import Stripe from "stripe"
import { assertStripeSecretKeyMatchesDeployment } from "@/lib/billing/stripe-env"

let cachedStripe: Stripe | null = null

/** Lazily creates the Stripe client at request/runtime execution time. */
export function getStripe(): Stripe {
  if (cachedStripe) return cachedStripe

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to the server environment (see docs/STRIPE_PRODUCTION_READINESS.md).",
    )
  }
  assertStripeSecretKeyMatchesDeployment(secretKey)

  cachedStripe = new Stripe(secretKey, {
    apiVersion: "2026-04-22.dahlia",
  })
  return cachedStripe
}
