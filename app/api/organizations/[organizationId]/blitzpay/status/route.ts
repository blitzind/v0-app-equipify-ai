import { NextResponse } from "next/server"
import { requireOrgMemberSession } from "@/lib/api/require-org-permission"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Read-only BlitzPay Connect snapshot for any active org member.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgMemberSession(organizationId)
  if ("error" in gate) return gate.error

  const { supabase } = gate

  const { data: org, error } = await supabase
    .from("organizations")
    .select(
      [
        "stripe_connect_account_id",
        "stripe_connect_status",
        "stripe_connect_onboarding_complete",
        "stripe_charges_enabled",
        "stripe_payouts_enabled",
        "stripe_details_submitted",
        "stripe_requirements_currently_due",
        "stripe_requirements_eventually_due",
        "stripe_requirements_past_due",
        "last_stripe_connect_sync_at",
        "blitzpay_last_onboarding_attempt_at",
        "blitzpay_last_onboarding_failure_at",
        "blitzpay_last_onboarding_error_category",
        "blitzpay_last_stripe_request_id",
      ].join(", "),
    )
    .eq("id", organizationId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 })
  }

  return NextResponse.json({ organizationId, blitzpay: org ?? {} })
}
