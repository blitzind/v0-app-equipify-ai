import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { patchAutopayEnrollment } from "@/lib/blitzpay/blitzpay-billing-profiles-service"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; enrollmentId: string }> },
) {
  const { organizationId, enrollmentId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(enrollmentId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canManageSettings", "canEditInvoices", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "PATCH /api/organizations/[organizationId]/blitzpay/autopay/[enrollmentId]",
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
    await patchAutopayEnrollment(admin, organizationId, enrollmentId, {
      enrollmentStatus: body.enrollmentStatus as "active" | "paused" | "canceled" | "failed" | undefined,
      paymentTiming: body.paymentTiming as string | undefined,
      scheduledDay: body.scheduledDay === null || body.scheduledDay === undefined ? undefined : Number(body.scheduledDay),
      maxChargeAmountCents:
        body.maxChargeAmountCents === null || body.maxChargeAmountCents === undefined ?
          undefined
        : Number(body.maxChargeAmountCents),
      failureRetryEnabled: typeof body.failureRetryEnabled === "boolean" ? body.failureRetryEnabled : undefined,
      notes: body.notes === undefined ? undefined : (body.notes as string | null),
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("PATCH autopay", e)
  }
}
