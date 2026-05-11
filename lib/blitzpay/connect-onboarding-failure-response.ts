import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import Stripe from "stripe"
import { persistBlitzPayOnboardingFailureDiagnostics } from "@/lib/blitzpay/onboarding-diagnostics"
import {
  buildBlitzPayConnectOnboardingFailureLog,
  logBlitzPayConnectOnboardingFailure,
  normalizeConnectOnboardingStripeError,
  type BlitzPayConnectOnboardingStage,
} from "@/lib/blitzpay/stripe-connect-onboarding-errors"
import { NextResponse } from "next/server"

/**
 * Logs full Stripe diagnostics server-side, persists last-failure summary on `organizations`,
 * and returns a safe JSON body for the browser.
 */
export async function nextResponseBlitzPayConnectOnboardingFailure(
  db: SupabaseClient,
  args: {
    organizationId: string
    userId: string | null
    stage: BlitzPayConnectOnboardingStage
    err: unknown
  },
): Promise<NextResponse> {
  const normalized = normalizeConnectOnboardingStripeError(args.err, args.stage)
  logBlitzPayConnectOnboardingFailure(
    buildBlitzPayConnectOnboardingFailureLog({
      stage: args.stage,
      organizationId: args.organizationId,
      userId: args.userId,
      normalizedCode: normalized.code,
      err: args.err,
    }),
  )
  const stripeRequestId =
    args.err instanceof Stripe.errors.StripeError ? (args.err.requestId ?? null) : null
  const persist = await persistBlitzPayOnboardingFailureDiagnostics(db, args.organizationId, {
    category: normalized.code,
    stripeRequestId,
  })
  if (!persist.ok) {
    console.error(
      JSON.stringify({
        source: "blitzpay_connect_onboarding",
        phase: "diagnostics_persist_failed",
        organizationId: args.organizationId,
        message: persist.message,
      }),
    )
  }
  return NextResponse.json(
    { error: normalized.code, message: normalized.userMessage },
    { status: normalized.httpStatus },
  )
}
