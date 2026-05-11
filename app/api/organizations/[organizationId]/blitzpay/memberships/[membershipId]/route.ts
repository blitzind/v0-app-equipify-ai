import { NextResponse } from "next/server"
import { requireAnyOrgPermission, requireOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { getBlitzpayMembershipById, patchBlitzpayMembership } from "@/lib/blitzpay/blitzpay-memberships"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; membershipId: string }> },
) {
  const { organizationId, membershipId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(membershipId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/memberships/[membershipId]",
  )
  if (schemaResp) return schemaResp

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  try {
    const membership = await getBlitzpayMembershipById(admin, organizationId, membershipId)
    if (!membership) return NextResponse.json({ error: "not_found" }, { status: 404 })
    return NextResponse.json({ membership })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "load_failed", message: msg }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; membershipId: string }> },
) {
  const { organizationId, membershipId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(membershipId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireOrgPermission(organizationId, ["canEditInvoices", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "PATCH /api/organizations/[organizationId]/blitzpay/memberships/[membershipId]",
  )
  if (schemaResp) return schemaResp

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  try {
    await patchBlitzpayMembership(admin, organizationId, membershipId, {
      status: typeof body.status === "string" ? body.status : undefined,
      recurring_amount_cents: body.recurringAmountCents != null ? Math.round(Number(body.recurringAmountCents)) : undefined,
      auto_bill_enabled: typeof body.autoBillEnabled === "boolean" ? body.autoBillEnabled : undefined,
      auto_renew: typeof body.autoRenew === "boolean" ? body.autoRenew : undefined,
      next_invoice_at: typeof body.nextInvoiceAt === "string" ? body.nextInvoiceAt : undefined,
      default_payment_method_profile_id:
        body.defaultPaymentMethodProfileId === null
          ? null
          : typeof body.defaultPaymentMethodProfileId === "string"
            ? body.defaultPaymentMethodProfileId
            : undefined,
      renewal_notice_days: body.renewalNoticeDays != null ? Math.round(Number(body.renewalNoticeDays)) : undefined,
      expires_at: body.expiresAt === null ? null : typeof body.expiresAt === "string" ? body.expiresAt : undefined,
    })
    const membership = await getBlitzpayMembershipById(admin, organizationId, membershipId)
    return NextResponse.json({ membership })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message: msg }, { status: 400 })
  }
}
