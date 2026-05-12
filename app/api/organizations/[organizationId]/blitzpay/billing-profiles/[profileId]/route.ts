import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { updateBillingProfile } from "@/lib/blitzpay/blitzpay-billing-profiles-service"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; profileId: string }> },
) {
  const { organizationId, profileId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(profileId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canManageSettings", "canEditInvoices", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "PATCH /api/organizations/[organizationId]/blitzpay/billing-profiles/[profileId]",
  )
  if (schemaResp) return schemaResp
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "JSON body required." }, { status: 400 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    await updateBillingProfile(admin, organizationId, profileId, {
      status: body.status as "active" | "inactive" | "delinquent" | "archived" | undefined,
      autopayEnabled: typeof body.autopayEnabled === "boolean" ? body.autopayEnabled : undefined,
      autopayMethodType: body.autopayMethodType === null || typeof body.autopayMethodType === "string" ? (body.autopayMethodType as string | null) : undefined,
      preferredInvoiceDelivery: body.preferredInvoiceDelivery as "email" | "sms" | "manual" | "portal" | undefined,
      billingEmail: body.billingEmail === undefined ? undefined : (body.billingEmail as string | null),
      billingPhone: body.billingPhone === undefined ? undefined : (body.billingPhone as string | null),
      defaultPaymentMethodLast4:
        body.defaultPaymentMethodLast4 === undefined ? undefined : (body.defaultPaymentMethodLast4 as string | null),
      defaultPaymentMethodBrand:
        body.defaultPaymentMethodBrand === undefined ? undefined : (body.defaultPaymentMethodBrand as string | null),
      defaultPaymentMethodType:
        body.defaultPaymentMethodType === undefined ? undefined : (body.defaultPaymentMethodType as string | null),
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("PATCH billing-profiles", e)
  }
}
