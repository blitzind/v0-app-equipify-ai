import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { createVendorBillWithLines, listVendorBills } from "@/lib/blitzpay/blitzpay-ap-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/ap/bills",
  )
  if (schemaResp) return schemaResp
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status") ?? undefined
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const bills = await listVendorBills(admin, organizationId, status)
    return NextResponse.json({ bills })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/ap/bills", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/ap/bills",
  )
  if (schemaResp) return schemaResp
  let body: {
    vendorId: string
    billNumber: string
    billDate: string
    dueDate: string
    taxCents: number
    memo?: string | null
    sourceType?: string
    linkedPurchaseOrderId?: string | null
    linkedWorkOrderId?: string | null
    linkedInvoiceId?: string | null
    externalReference?: string | null
    lines: Array<{
      expenseAccountId: string
      lineTotalCents: number
      description?: string | null
      linkedEquipmentId?: string | null
      linkedWorkOrderId?: string | null
      linkedInventoryItemId?: string | null
    }>
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON." }, { status: 400 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const result = await createVendorBillWithLines(admin, organizationId, {
      ...body,
      actorUserId: gate.userId,
    })
    return NextResponse.json({ bill: result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "po_org_mismatch") {
      return NextResponse.json({ error: "validation_error", message: "Purchase order does not belong to this org." }, { status: 400 })
    }
    return blitzpayStaffLoadFailedResponse("POST blitzpay/ap/bills", e)
  }
}
