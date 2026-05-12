import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { createBillingProfile, listBillingProfilesSafe } from "@/lib/blitzpay/blitzpay-billing-profiles-service"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewBilling", "canViewFinancials", "canViewFinancialReports"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/billing-profiles",
  )
  if (schemaResp) return schemaResp
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  let customerId: string | null = null
  try {
    const u = new URL(request.url)
    customerId = u.searchParams.get("customerId")
  } catch {
    /* ignore */
  }
  try {
    const billingProfiles = await listBillingProfilesSafe(admin, organizationId, { customerId })
    return NextResponse.json({ billingProfiles })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET billing-profiles", e)
  }
}

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canManageSettings", "canEditInvoices", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/billing-profiles",
  )
  if (schemaResp) return schemaResp
  let body: { customerId?: string; preferredInvoiceDelivery?: string; billingEmail?: string | null; billingPhone?: string | null }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "bad_request", message: "JSON body required." }, { status: 400 })
  }
  const customerId = String(body.customerId || "")
  if (!UUID_RE.test(customerId)) {
    return NextResponse.json({ error: "bad_request", message: "customerId required." }, { status: 400 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const { id } = await createBillingProfile(admin, {
      organizationId,
      customerId,
      createdBy: gate.userId,
      preferredInvoiceDelivery: body.preferredInvoiceDelivery as "email" | "sms" | "manual" | "portal" | undefined,
      billingEmail: body.billingEmail,
      billingPhone: body.billingPhone,
    })
    return NextResponse.json({ id })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST billing-profiles", e)
  }
}
