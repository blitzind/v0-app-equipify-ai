"use server"

import { stripe } from "@/lib/stripe"
import { PLANS, type PlanId } from "@/lib/plans"
import { headers } from "next/headers"

export async function createCheckoutSession(
  planId: PlanId,
  billingCycle: "monthly" | "annual"
): Promise<{ clientSecret: string | null; error?: string }> {
  const plan = PLANS.find((p) => p.id === planId)
  if (!plan) return { clientSecret: null, error: "Invalid plan." }

  const priceId =
    billingCycle === "annual" ? plan.stripeAnnualPriceId : plan.stripeMonthlyPriceId

  const origin = (await headers()).get("origin") ?? "http://localhost:3000"

  try {
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      return_url: `${origin}/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
      subscription_data: {
        trial_period_days: 14,
        metadata: { planId },
      },
      metadata: { planId, billingCycle },
    })
    return { clientSecret: session.client_secret }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error"
    return { clientSecret: null, error: message }
  }
}

export async function createPortalSession(
  stripeCustomerId: string
): Promise<{ url: string | null; error?: string }> {
  const origin = (await headers()).get("origin") ?? "http://localhost:3000"
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/settings/billing`,
    })
    return { url: session.url }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error"
    return { url: null, error: message }
  }
}
