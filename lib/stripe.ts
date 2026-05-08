import "server-only"
import Stripe from "stripe"

let cachedStripe: Stripe | null = null

/** Lazily creates the Stripe client at request/runtime execution time. */
export function getStripe(): Stripe {
  if (cachedStripe) return cachedStripe

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY")
  }

  cachedStripe = new Stripe(secretKey, {
    apiVersion: "2026-04-22.dahlia",
  })
  return cachedStripe
}
