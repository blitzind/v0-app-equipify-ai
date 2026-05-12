import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import {
  createInventoryFinancialItem,
  listInventoryFinancialItems,
} from "@/lib/blitzpay/blitzpay-procurement-finance-service"
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
    "GET /api/organizations/[organizationId]/blitzpay/procurement/inventory-items",
  )
  if (schemaResp) return schemaResp
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const items = await listInventoryFinancialItems(admin, organizationId)
    return NextResponse.json({ items })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/procurement/inventory-items", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/procurement/inventory-items",
  )
  if (schemaResp) return schemaResp
  let body: {
    itemName?: string
    sku?: string | null
    inventoryItemId?: string | null
    valuationMethod?: string
    unitCostCents?: number
    averageCostCents?: number | null
    replacementCostCents?: number | null
    serializedTrackingEnabled?: boolean
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
    const row = await createInventoryFinancialItem(admin, organizationId, {
      itemName: String(body.itemName ?? ""),
      sku: body.sku ?? null,
      inventoryItemId: body.inventoryItemId ?? null,
      valuationMethod: body.valuationMethod,
      unitCostCents: body.unitCostCents,
      averageCostCents: body.averageCostCents ?? null,
      replacementCostCents: body.replacementCostCents ?? null,
      serializedTrackingEnabled: body.serializedTrackingEnabled,
      actorUserId: gate.userId,
    })
    return NextResponse.json(row)
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/procurement/inventory-items", e)
  }
}
