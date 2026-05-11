import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { gateBlitzPayManagement } from "@/lib/blitzpay/access"
import { nextResponseBlitzPayConnectOnboardingFailure } from "@/lib/blitzpay/connect-onboarding-failure-response"
import { blitzpayOnboardingSuccessDiagnosticsPatch } from "@/lib/blitzpay/onboarding-diagnostics"
import { buildBlitzPayOrgUpdateFromStripeAccount, retrieveConnectAccount } from "@/lib/blitzpay/connect-stripe"
import { supabaseForBlitzPayOrgWrite } from "@/lib/blitzpay/org-write-client"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status })
}

/** Pull latest Stripe Connect Account and persist normalized columns. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return jsonError(400, "bad_request", "Invalid organization.")
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user?.id ?? null
  const gate = await gateBlitzPayManagement(supabase, user, organizationId)
  if (!gate.ok) {
    return jsonError(gate.status, "forbidden", gate.message)
  }

  const schemaResp = await blitzpaySchemaGuardNextResponse("POST /api/organizations/[organizationId]/blitzpay/sync")
  if (schemaResp) return schemaResp

  const db = await supabaseForBlitzPayOrgWrite(gate)

  const { data: row, error: loadErr } = await db
    .from("organizations")
    .select("stripe_connect_account_id")
    .eq("id", gate.organizationId)
    .maybeSingle()

  if (loadErr) {
    return jsonError(500, "query_failed", "Could not load workspace settings. Please try again.")
  }

  const acct = (row as { stripe_connect_account_id?: string | null } | null)?.stripe_connect_account_id
  if (!acct || !String(acct).trim()) {
    return jsonError(
      412,
      "precondition_failed",
      "BlitzPay is not enabled yet for this workspace.",
    )
  }

  try {
    const account = await retrieveConnectAccount(String(acct).trim())
    const patch = buildBlitzPayOrgUpdateFromStripeAccount(account)
    const { error: upErr } = await db
      .from("organizations")
      .update({
        ...patch,
        stripe_connect_account_id: account.id,
        ...blitzpayOnboardingSuccessDiagnosticsPatch(),
      })
      .eq("id", gate.organizationId)
    if (upErr) {
      return jsonError(500, "update_failed", "Could not save BlitzPay account. Please try again.")
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return nextResponseBlitzPayConnectOnboardingFailure(db, {
      organizationId: gate.organizationId,
      userId,
      stage: "accounts_retrieve",
      err: e,
    })
  }
}
