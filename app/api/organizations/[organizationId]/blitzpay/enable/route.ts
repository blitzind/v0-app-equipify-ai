import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { gateBlitzPayManagement } from "@/lib/blitzpay/access"
import { nextResponseBlitzPayConnectOnboardingFailure } from "@/lib/blitzpay/connect-onboarding-failure-response"
import { blitzpayEnableDebug, stripeSecretKeyDiagnostics } from "@/lib/blitzpay/enable-debug-log"
import { blitzpayOnboardingSuccessDiagnosticsPatch } from "@/lib/blitzpay/onboarding-diagnostics"
import {
  buildBlitzPayOrgUpdateFromStripeAccount,
  createUsExpressConnectedAccount,
  retrieveConnectAccount,
} from "@/lib/blitzpay/connect-stripe"
import { supabaseForBlitzPayOrgWrite } from "@/lib/blitzpay/org-write-client"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status })
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return "Unexpected error."
}

/** Create Stripe Express connected account once; refresh normalized columns from Stripe. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await context.params
    const orgTail = organizationId.length >= 8 ? organizationId.slice(-8) : organizationId

    if (!UUID_RE.test(organizationId)) {
      return jsonError(400, "bad_request", "Invalid organization.")
    }

    blitzpayEnableDebug("enable.params_ok", { orgTail })

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? null
    blitzpayEnableDebug("enable.auth", { orgTail, hasUser: Boolean(user), userIdTail: user?.id?.slice(-6) })

    const gate = await gateBlitzPayManagement(supabase, user, organizationId)
    if (!gate.ok) {
      blitzpayEnableDebug("enable.gate_denied", { orgTail, status: gate.status })
      return jsonError(gate.status, "forbidden", gate.message)
    }
    const schemaResp = await blitzpaySchemaGuardNextResponse("POST /api/organizations/[organizationId]/blitzpay/enable")
    if (schemaResp) return schemaResp
    blitzpayEnableDebug("enable.gate_ok", { orgTail, platformAdmin: gate.platformAdmin })

    const db = await supabaseForBlitzPayOrgWrite(gate)
    blitzpayEnableDebug("enable.db_client", { orgTail, writePath: gate.platformAdmin ? "service_role" : "user_jwt" })

    const { data: existing, error: loadErr } = await db
      .from("organizations")
      .select("stripe_connect_account_id")
      .eq("id", gate.organizationId)
      .maybeSingle()

    if (loadErr) {
      blitzpayEnableDebug("enable.org_load_failed", { orgTail, code: loadErr.code })
      return jsonError(500, "query_failed", "Could not load workspace settings. Please try again.")
    }
    blitzpayEnableDebug("enable.org_load_ok", { orgTail })

    const existingId = (existing as { stripe_connect_account_id?: string | null } | null)?.stripe_connect_account_id
    if (existingId && String(existingId).trim().length > 0) {
      const acct = String(existingId).trim()
      blitzpayEnableDebug("enable.branch_existing_account", { orgTail, acctPrefix: acct.slice(0, 7) })
      try {
        const account = await retrieveConnectAccount(acct)
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
          blitzpayEnableDebug("enable.existing_update_failed", { orgTail, code: upErr.code })
          return jsonError(500, "update_failed", "Could not save BlitzPay account. Please try again.")
        }
      } catch (e) {
        blitzpayEnableDebug("enable.existing_stripe_or_update_throw", { orgTail, message: errMessage(e) })
        return nextResponseBlitzPayConnectOnboardingFailure(db, {
          organizationId: gate.organizationId,
          userId,
          stage: "accounts_retrieve",
          err: e,
        })
      }
      return NextResponse.json({ ok: true, alreadyHadAccount: true })
    }

    blitzpayEnableDebug("enable.pre_stripe", {
      orgTail,
      stripe: stripeSecretKeyDiagnostics(),
    })

    try {
      getStripe()
      blitzpayEnableDebug("enable.stripe_client_ready", { orgTail })
    } catch (e) {
      blitzpayEnableDebug("enable.stripe_client_init_failed", { orgTail, message: errMessage(e) })
      return nextResponseBlitzPayConnectOnboardingFailure(db, {
        organizationId: gate.organizationId,
        userId,
        stage: "stripe_client_init",
        err: e,
      })
    }

    try {
      blitzpayEnableDebug("enable.stripe_accounts_create_start", { orgTail })
      const created = await createUsExpressConnectedAccount(gate.organizationId)
      blitzpayEnableDebug("enable.stripe_accounts_create_ok", {
        orgTail,
        acctPrefix: created.id?.slice(0, 7) ?? null,
      })

      const patch = buildBlitzPayOrgUpdateFromStripeAccount(created)
      blitzpayEnableDebug("enable.supabase_update_start", { orgTail })
      const { error: upErr } = await db
        .from("organizations")
        .update({
          ...patch,
          stripe_connect_account_id: created.id,
          ...blitzpayOnboardingSuccessDiagnosticsPatch(),
        })
        .eq("id", gate.organizationId)
      if (upErr) {
        blitzpayEnableDebug("enable.supabase_update_failed", { orgTail, code: upErr.code })
        return jsonError(500, "update_failed", "Could not save BlitzPay account. Please try again.")
      }
      blitzpayEnableDebug("enable.supabase_update_ok", { orgTail })
    } catch (e) {
      blitzpayEnableDebug("enable.create_or_persist_failed", { orgTail, message: errMessage(e) })
      return nextResponseBlitzPayConnectOnboardingFailure(db, {
        organizationId: gate.organizationId,
        userId,
        stage: "accounts_create",
        err: e,
      })
    }

    const body = { ok: true as const, alreadyHadAccount: false as const }
    blitzpayEnableDebug("enable.response_ok", { orgTail })
    return NextResponse.json(body)
  } catch (e) {
    blitzpayEnableDebug("enable.unhandled", { message: errMessage(e) })
    console.error("[blitzpay/enable] unhandled", e)
    return jsonError(500, "internal_error", "Something went wrong. Please try again.")
  }
}
