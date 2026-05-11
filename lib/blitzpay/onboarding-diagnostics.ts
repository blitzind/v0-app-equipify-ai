import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { BlitzPayConnectOnboardingErrorCode } from "@/lib/blitzpay/stripe-connect-onboarding-errors"

/** Columns on `organizations` — see `supabase/migrations/20260910160000_blitzpay_onboarding_diagnostics.sql`. */
export type BlitzPayOnboardingDiagnosticsRow = {
  blitzpay_last_onboarding_attempt_at: string | null
  blitzpay_last_onboarding_failure_at: string | null
  blitzpay_last_onboarding_error_category: string | null
  blitzpay_last_stripe_request_id: string | null
}

export function blitzpayOnboardingSuccessDiagnosticsPatch(): Pick<
  BlitzPayOnboardingDiagnosticsRow,
  | "blitzpay_last_onboarding_attempt_at"
  | "blitzpay_last_onboarding_failure_at"
  | "blitzpay_last_onboarding_error_category"
  | "blitzpay_last_stripe_request_id"
> {
  const now = new Date().toISOString()
  return {
    blitzpay_last_onboarding_attempt_at: now,
    blitzpay_last_onboarding_failure_at: null,
    blitzpay_last_onboarding_error_category: null,
    blitzpay_last_stripe_request_id: null,
  }
}

export async function persistBlitzPayOnboardingFailureDiagnostics(
  db: SupabaseClient,
  organizationId: string,
  args: { category: BlitzPayConnectOnboardingErrorCode; stripeRequestId: string | null },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const now = new Date().toISOString()
  const { error } = await db
    .from("organizations")
    .update({
      blitzpay_last_onboarding_attempt_at: now,
      blitzpay_last_onboarding_failure_at: now,
      blitzpay_last_onboarding_error_category: args.category,
      blitzpay_last_stripe_request_id: args.stripeRequestId,
      updated_at: now,
    })
    .eq("id", organizationId)
  if (error) {
    return { ok: false, message: error.message }
  }
  return { ok: true }
}
