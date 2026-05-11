import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getPublicAppOrigin } from "@/lib/email/config"
import { gateBlitzPayManagement } from "@/lib/blitzpay/access"
import { nextResponseBlitzPayConnectOnboardingFailure } from "@/lib/blitzpay/connect-onboarding-failure-response"
import { blitzpayEnableDebug, stripeSecretKeyDiagnostics } from "@/lib/blitzpay/enable-debug-log"
import { blitzpayOnboardingSuccessDiagnosticsPatch } from "@/lib/blitzpay/onboarding-diagnostics"
import {
  buildBlitzPayOrgUpdateFromStripeAccount,
  createConnectAccountOnboardingLink,
  createUsExpressConnectedAccount,
} from "@/lib/blitzpay/connect-stripe"
import { supabaseForBlitzPayOrgWrite } from "@/lib/blitzpay/org-write-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status })
}

/**
 * Stripe-hosted Connect onboarding. Ensures an Express account exists, then returns a one-time Account Link URL.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  const orgTail = organizationId.length >= 8 ? organizationId.slice(-8) : organizationId

  if (!UUID_RE.test(organizationId)) {
    return jsonError(400, "bad_request", "Invalid organization.")
  }

  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? null
    const gate = await gateBlitzPayManagement(supabase, user, organizationId)
    if (!gate.ok) {
      return jsonError(gate.status, "forbidden", gate.message)
    }

    const db = await supabaseForBlitzPayOrgWrite(gate)
    const origin = getPublicAppOrigin().replace(/\/+$/, "")
    const returnUrl = `${origin}/settings/payments?blitzpay_return=1`
    const refreshUrl = `${origin}/settings/payments?blitzpay_refresh=1`

    let accountId: string | null = null

    const { data: row, error: loadErr } = await db
      .from("organizations")
      .select("stripe_connect_account_id")
      .eq("id", gate.organizationId)
      .maybeSingle()

    if (loadErr) {
      return jsonError(500, "query_failed", "Could not load workspace settings. Please try again.")
    }

    accountId = (row as { stripe_connect_account_id?: string | null } | null)?.stripe_connect_account_id ?? null
    accountId = accountId && String(accountId).trim() ? String(accountId).trim() : null

    if (!accountId) {
      try {
        blitzpayEnableDebug("account_link.pre_create", { orgTail, stripe: stripeSecretKeyDiagnostics() })
        const created = await createUsExpressConnectedAccount(gate.organizationId)
        accountId = created.id
        const patch = buildBlitzPayOrgUpdateFromStripeAccount(created)
        const { error: upErr } = await db
          .from("organizations")
          .update({
            ...patch,
            stripe_connect_account_id: created.id,
            ...blitzpayOnboardingSuccessDiagnosticsPatch(),
          })
          .eq("id", gate.organizationId)
        if (upErr) {
          return jsonError(500, "update_failed", "Could not save BlitzPay account. Please try again.")
        }
      } catch (e) {
        blitzpayEnableDebug("account_link.create_failed", { orgTail })
        return nextResponseBlitzPayConnectOnboardingFailure(db, {
          organizationId: gate.organizationId,
          userId,
          stage: "accounts_create",
          err: e,
        })
      }
    }

    try {
      const link = await createConnectAccountOnboardingLink({
        accountId: accountId!,
        refreshUrl,
        returnUrl,
      })

      return NextResponse.json({ url: link.url, expiresAt: link.expires_at })
    } catch (e) {
      blitzpayEnableDebug("account_link.link_create_failed", { orgTail })
      return nextResponseBlitzPayConnectOnboardingFailure(db, {
        organizationId: gate.organizationId,
        userId,
        stage: "account_link_create",
        err: e,
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error."
    console.error("[blitzpay/account-link] unhandled", e)
    blitzpayEnableDebug("account_link.unhandled", { orgTail, message: msg })
    return jsonError(500, "internal_error", "Something went wrong. Please try again.")
  }
}
