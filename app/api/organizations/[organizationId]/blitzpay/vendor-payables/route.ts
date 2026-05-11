import { NextResponse } from "next/server"
import { requireAnyOrgPermission, requireOrgPermission } from "@/lib/api/require-org-permission"
import {
  blitzpayStaffLoadFailedResponse,
  blitzpayStaffOperationFailedResponse,
} from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import {
  fetchOrgVendorPayablesForDashboard,
  insertBlitzpayVendorPayable,
  type VendorPayableVendorKind,
} from "@/lib/blitzpay/blitzpay-vendor-payables"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const KINDS = new Set<string>([
  "vendor",
  "subcontractor",
  "field_reimbursement",
  "equipment_supplier",
  "material_supplier",
])

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canEditInvoices", "canViewFinancials"])
  if ("error" in gate) return gate.error

  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/vendor-payables",
  )
  if (schemaResp) return schemaResp

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  try {
    const payables = await fetchOrgVendorPayablesForDashboard(admin, organizationId)
    return NextResponse.json({ payables })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET vendor-payables", e)
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireOrgPermission(organizationId, ["canViewFinancials", "canEditInvoices"])
  if ("error" in gate) return gate.error

  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/vendor-payables",
  )
  if (schemaResp) return schemaResp

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }

  const vendorKind = String(body.vendorKind ?? "")
  if (!KINDS.has(vendorKind)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid vendorKind." }, { status: 400 })
  }
  const counterpartyLabel = String(body.counterpartyLabel ?? "").trim()
  if (!counterpartyLabel) {
    return NextResponse.json({ error: "bad_request", message: "counterpartyLabel is required." }, { status: 400 })
  }
  const amountCents = Math.round(Number(body.amountCents))
  if (!Number.isFinite(amountCents) || amountCents < 0) {
    return NextResponse.json({ error: "bad_request", message: "amountCents must be a non-negative number." }, { status: 400 })
  }
  const dueDate = String(body.dueDate ?? "").trim()
  const workOrderId = body.workOrderId ? String(body.workOrderId) : null
  const orgVendorId = body.orgVendorId ? String(body.orgVendorId) : null
  const orgInvoiceId = body.orgInvoiceId ? String(body.orgInvoiceId) : null
  const orgPurchaseOrderId = body.orgPurchaseOrderId ? String(body.orgPurchaseOrderId) : null

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  try {
    const { id } = await insertBlitzpayVendorPayable(admin, organizationId, {
      vendorKind: vendorKind as VendorPayableVendorKind,
      counterpartyLabel,
      orgVendorId,
      amountCents,
      dueDate,
      workOrderId,
      orgInvoiceId: orgInvoiceId ?? undefined,
      orgPurchaseOrderId: orgPurchaseOrderId ?? undefined,
      reimbursementFlag: Boolean(body.reimbursementFlag),
      materialCostFlag: Boolean(body.materialCostFlag),
      requestedByUserId: gate.userId,
    })
    return NextResponse.json({ id })
  } catch (e) {
    return blitzpayStaffOperationFailedResponse("POST vendor-payables", e, "insert_failed", 400)
  }
}
