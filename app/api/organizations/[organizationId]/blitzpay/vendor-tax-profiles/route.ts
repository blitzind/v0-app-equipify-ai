import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { listVendorTaxProfiles, upsertVendorTaxProfile } from "@/lib/blitzpay/blitzpay-tax-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/vendor-tax-profiles",
  )
  if (schemaResp) return schemaResp
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const vendorTaxProfiles = await listVendorTaxProfiles(admin, organizationId)
    return NextResponse.json({ vendorTaxProfiles })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/vendor-tax-profiles", e)
  }
}

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canManageSettings", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/vendor-tax-profiles",
  )
  if (schemaResp) return schemaResp
  let body: {
    vendorId?: string
    taxProfileStatus?: string
    taxClassification?: string
    requires1099?: boolean
    tinReference?: string | null
    w9ReceivedAt?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON." }, { status: 400 })
  }
  if (!body.vendorId) {
    return NextResponse.json({ error: "bad_request", message: "vendorId required." }, { status: 400 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const row = await upsertVendorTaxProfile(admin, organizationId, {
      vendorId: body.vendorId,
      taxProfileStatus: body.taxProfileStatus,
      taxClassification: body.taxClassification,
      requires1099: body.requires1099,
      tinReference: body.tinReference ?? null,
      w9ReceivedAt: body.w9ReceivedAt ?? null,
      actorUserId: gate.userId,
    })
    return NextResponse.json({ vendorTaxProfile: row })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/vendor-tax-profiles", e)
  }
}
