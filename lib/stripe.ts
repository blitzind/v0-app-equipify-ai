import "server-only"
import Stripe from "stripe"

/** Requires `STRIPE_SECRET_KEY` (see `.env.local.example`). */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
})
