import { NextResponse } from "next/server"
import { requireAnyOrgPermission, requireOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { createBlitzpayMembership, listBlitzpayMemberships } from "@/lib/blitzpay/blitzpay-memberships"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse("GET /api/organizations/[organizationId]/blitzpay/memberships")
  if (schemaResp) return schemaResp

  let customerId: string | undefined
  try {
    const u = new URL(request.url)
    const c = u.searchParams.get("customerId")
    if (c && UUID_RE.test(c)) customerId = c
  } catch {
    /* ignore */
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  try {
    const memberships = await listBlitzpayMemberships(admin, organizationId, customerId ? { customerId } : undefined)
    return NextResponse.json({ memberships })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "load_failed", message: msg }, { status: 500 })
  }
}

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireOrgPermission(organizationId, ["canEditInvoices", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse("POST /api/organizations/[organizationId]/blitzpay/memberships")
  if (schemaResp) return schemaResp

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }
  const customerId = typeof body.customerId === "string" ? body.customerId : ""
  if (!UUID_RE.test(customerId)) {
    return NextResponse.json({ error: "bad_request", message: "customerId is required." }, { status: 400 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  try {
    const id = await createBlitzpayMembership(admin, {
      organizationId,
      customerId,
      membershipNumber: typeof body.membershipNumber === "string" ? body.membershipNumber : undefined,
      maintenancePlanId: typeof body.maintenancePlanId === "string" ? body.maintenancePlanId : null,
      workOrderTemplateId: typeof body.workOrderTemplateId === "string" ? body.workOrderTemplateId : null,
      billingFrequency: String(body.billingFrequency || "monthly"),
      billingAnchorDate: String(body.billingAnchorDate || new Date().toISOString().slice(0, 10)),
      recurringAmountCents: Math.round(Number(body.recurringAmountCents ?? 0)),
      autoRenew: Boolean(body.autoRenew ?? true),
      autoBillEnabled: Boolean(body.autoBillEnabled ?? false),
      defaultPaymentMethodProfileId:
        typeof body.defaultPaymentMethodProfileId === "string" ? body.defaultPaymentMethodProfileId : null,
      renewalNoticeDays: body.renewalNoticeDays != null ? Math.round(Number(body.renewalNoticeDays)) : undefined,
      expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : null,
    })
    return NextResponse.json({ membership: id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message: msg }, { status: 400 })
  }
}
