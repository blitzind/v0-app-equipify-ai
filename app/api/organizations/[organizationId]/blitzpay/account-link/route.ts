import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getPublicAppOrigin } from "@/lib/email/config"
import { gateBlitzPayManagement } from "@/lib/blitzpay/access"
import {
  buildBlitzPayOrgUpdateFromStripeAccount,
  createConnectAccountOnboardingLink,
  createUsExpressConnectedAccount,
  retrieveConnectAccount,
} from "@/lib/blitzpay/connect-stripe"
import { supabaseForBlitzPayOrgWrite } from "@/lib/blitzpay/org-write-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Stripe-hosted Connect onboarding. Ensures an Express account exists, then returns a one-time Account Link URL.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const gate = await gateBlitzPayManagement(supabase, user, organizationId)
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden", message: gate.message }, { status: gate.status })
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
    return NextResponse.json({ error: "query_failed", message: loadErr.message }, { status: 500 })
  }

  accountId = (row as { stripe_connect_account_id?: string | null } | null)?.stripe_connect_account_id ?? null
  accountId = accountId && String(accountId).trim() ? String(accountId).trim() : null

  try {
    if (!accountId) {
      const created = await createUsExpressConnectedAccount()
      accountId = created.id
      const account = await retrieveConnectAccount(accountId)
      const patch = buildBlitzPayOrgUpdateFromStripeAccount(account)
      const { error: upErr } = await db
        .from("organizations")
        .update({
          ...patch,
          stripe_connect_account_id: account.id,
        })
        .eq("id", gate.organizationId)
      if (upErr) {
        return NextResponse.json({ error: "update_failed", message: upErr.message }, { status: 500 })
      }
    }

    const link = await createConnectAccountOnboardingLink({
      accountId: accountId!,
      refreshUrl,
      returnUrl,
    })

    return NextResponse.json({ url: link.url, expiresAt: link.expires_at })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe error."
    return NextResponse.json({ error: "stripe_error", message: msg }, { status: 502 })
  }
}
