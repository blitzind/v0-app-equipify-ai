import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { parseQuantityMilliFromNumericString } from "@/lib/blitzpay/blitzpay-inventory-finance"
import {
  createInventoryFinancialMovement,
  listInventoryFinancialMovements,
} from "@/lib/blitzpay/blitzpay-procurement-finance-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MOVEMENT_TYPES = new Set([
  "purchase",
  "adjustment",
  "transfer",
  "work_order_usage",
  "invoice_sale",
  "return",
  "writeoff",
  "reconciliation",
])

export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/procurement/inventory-movements",
  )
  if (schemaResp) return schemaResp
  const url = new URL(request.url)
  const itemId = url.searchParams.get("itemId")
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const movements = await listInventoryFinancialMovements(admin, organizationId, itemId)
    return NextResponse.json({ movements })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/procurement/inventory-movements", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/procurement/inventory-movements",
  )
  if (schemaResp) return schemaResp
  let body: {
    inventoryFinancialItemId?: string
    movementType?: string
    quantityMilli?: number | string
    unitCostCents?: number
    movementDate?: string
    linkedVendorBillId?: string | null
    linkedWorkOrderId?: string | null
    linkedInvoiceId?: string | null
    linkedPurchaseOrderId?: string | null
    metadata?: Record<string, unknown>
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON." }, { status: 400 })
  }
  const movementType = String(body.movementType ?? "")
  if (!MOVEMENT_TYPES.has(movementType)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid movement_type." }, { status: 400 })
  }
  const s = String(body.quantityMilli ?? "0").trim()
  const quantityMilli =
    typeof body.quantityMilli === "number" && Number.isFinite(body.quantityMilli)
      ? BigInt(Math.trunc(body.quantityMilli))
      : s.includes(".")
        ? parseQuantityMilliFromNumericString(s) ?? 0n
        : (() => {
            try {
              return BigInt(s || "0")
            } catch {
              return 0n
            }
          })()
  const absQ = quantityMilli < 0n ? -quantityMilli : quantityMilli
  if (absQ > 1_000_000_000_000n) {
    return NextResponse.json({ error: "bad_request", message: "quantityMilli out of bounds." }, { status: 400 })
  }
  const movementDateYmd = String(body.movementDate ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(movementDateYmd)) {
    return NextResponse.json({ error: "bad_request", message: "movementDate must be YYYY-MM-DD." }, { status: 400 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const row = await createInventoryFinancialMovement(admin, organizationId, {
      inventoryFinancialItemId: String(body.inventoryFinancialItemId ?? ""),
      movementType,
      quantityMilli,
      unitCostCents: Math.max(0, Math.round(Number(body.unitCostCents ?? 0))),
      movementDateYmd,
      linkedVendorBillId: body.linkedVendorBillId ?? null,
      linkedWorkOrderId: body.linkedWorkOrderId ?? null,
      linkedInvoiceId: body.linkedInvoiceId ?? null,
      linkedPurchaseOrderId: body.linkedPurchaseOrderId ?? null,
      metadata: body.metadata,
      actorUserId: gate.userId,
    })
    return NextResponse.json(row)
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/procurement/inventory-movements", e)
  }
}
