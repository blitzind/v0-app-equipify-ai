import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { gateBlitzPayManagement } from "@/lib/blitzpay/access"
import {
  buildBlitzPayOrgUpdateFromStripeAccount,
  createUsExpressConnectedAccount,
  retrieveConnectAccount,
} from "@/lib/blitzpay/connect-stripe"
import { supabaseForBlitzPayOrgWrite } from "@/lib/blitzpay/org-write-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Create Stripe Express connected account once; refresh normalized columns from Stripe. */
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

  const { data: existing, error: loadErr } = await db
    .from("organizations")
    .select("stripe_connect_account_id")
    .eq("id", gate.organizationId)
    .maybeSingle()

  if (loadErr) {
    return NextResponse.json({ error: "query_failed", message: loadErr.message }, { status: 500 })
  }

  const existingId = (existing as { stripe_connect_account_id?: string | null } | null)?.stripe_connect_account_id
  if (existingId && String(existingId).trim().length > 0) {
    try {
      const account = await retrieveConnectAccount(String(existingId).trim())
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stripe error."
      return NextResponse.json({ error: "stripe_error", message: msg }, { status: 502 })
    }
    return NextResponse.json({ ok: true, alreadyHadAccount: true })
  }

  try {
    const created = await createUsExpressConnectedAccount()
    const account = await retrieveConnectAccount(created.id)
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe error."
    return NextResponse.json({ error: "stripe_error", message: msg }, { status: 502 })
  }

  return NextResponse.json({ ok: true, alreadyHadAccount: false })
}
