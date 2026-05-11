import "server-only"

import { isStripeLiveEnforced } from "@/lib/billing/stripe-env"

/** Set `BLITZPAY_ENABLE_DEBUG=true` in server env to log sanitized enable/account-link stages (remove after incident). */
export function blitzpayEnableDebug(stage: string, fields: Record<string, unknown>): void {
  if (process.env.BLITZPAY_ENABLE_DEBUG !== "true") return
  console.info("[blitzpay]", JSON.stringify({ stage, ts: new Date().toISOString(), ...fields }))
}

export function stripeSecretKeyDiagnostics(): {
  present: boolean
  prefix: "sk_test" | "sk_live" | "sk_unknown" | "empty"
  liveEnforced: boolean
  vercelEnv: string | undefined
} {
  const raw = process.env.STRIPE_SECRET_KEY?.trim() ?? ""
  const prefix =
    raw.startsWith("sk_test_") ? "sk_test"
    : raw.startsWith("sk_live_") ? "sk_live"
    : raw.length === 0 ? "empty"
    : "sk_unknown"
  return {
    present: raw.length > 0,
    prefix,
    liveEnforced: isStripeLiveEnforced(),
    vercelEnv: process.env.VERCEL_ENV,
  }
}
