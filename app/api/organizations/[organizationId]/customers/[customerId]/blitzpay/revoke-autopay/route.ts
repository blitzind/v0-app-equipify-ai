import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; customerId: string }> },
) {
  const { organizationId, customerId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(customerId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canEditInvoices", "canViewFinancials"])
  if ("error" in gate) return gate.error

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "POST /api/organizations/[organizationId]/customers/[customerId]/blitzpay/revoke-autopay",
  )
  if (drift) return drift

  const now = new Date().toISOString()
  const { error: upErr } = await admin
    .from("blitzpay_customer_payment_profiles")
    .update({
      autopay_authorization_status: "revoked",
      autopay_revoked_at: now,
      off_session_authorized: false,
      autopay_eligible: false,
      updated_at: now,
    })
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
  if (upErr) {
    return NextResponse.json({ error: "update_failed", message: upErr.message }, { status: 500 })
  }
  const { error: evErr } = await admin.from("blitzpay_autopay_consent_events").insert({
    organization_id: organizationId,
    customer_id: customerId,
    action: "revoked",
    method_type: null,
    source: "staff_dashboard",
    copy_version: null,
    actor_kind: "staff",
    actor_user_id: gate.userId,
    metadata: {},
  })
  if (evErr) {
    return NextResponse.json({ error: "audit_failed", message: evErr.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
