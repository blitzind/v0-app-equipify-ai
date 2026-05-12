import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import {
  createVendorRebateAccrual,
  createVendorRebateProgram,
  listVendorRebatePrograms,
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
    "GET /api/organizations/[organizationId]/blitzpay/procurement/vendor-rebates",
  )
  if (schemaResp) return schemaResp
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const vendorRebatePrograms = await listVendorRebatePrograms(admin, organizationId)
    return NextResponse.json({ vendorRebatePrograms })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/procurement/vendor-rebates", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/procurement/vendor-rebates",
  )
  if (schemaResp) return schemaResp
  let body: {
    kind?: "program" | "accrual"
    vendorId?: string
    programName?: string
    rebateType?: string
    rebateStatus?: string
    rebateBasisPoints?: number | null
    rebateThresholdCents?: number | null
    estimatedAnnualRebateCents?: number | null
    vendorRebateProgramId?: string
    accruedAmountCents?: number
    accrualDate?: string
    accrualStatus?: string
    linkedVendorBillId?: string | null
    basisAmountCents?: number
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON." }, { status: 400 })
  }
  const kind = body.kind ?? "program"
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    if (kind === "accrual") {
      const accrualDate = String(body.accrualDate ?? "").slice(0, 10)
      if (!UUID_RE.test(String(body.vendorRebateProgramId ?? "")) || !/^\d{4}-\d{2}-\d{2}$/.test(accrualDate)) {
        return NextResponse.json({ error: "bad_request", message: "Invalid accrual payload." }, { status: 400 })
      }
      const row = await createVendorRebateAccrual(admin, organizationId, {
        vendorRebateProgramId: String(body.vendorRebateProgramId),
        accruedAmountCents: Math.max(0, Math.round(Number(body.accruedAmountCents ?? 0))),
        accrualDateYmd: accrualDate,
        accrualStatus: body.accrualStatus,
        linkedVendorBillId: body.linkedVendorBillId ?? null,
        basisAmountCents: body.basisAmountCents,
        actorUserId: gate.userId,
      })
      return NextResponse.json(row)
    }
    if (!UUID_RE.test(String(body.vendorId ?? ""))) {
      return NextResponse.json({ error: "bad_request", message: "vendorId required." }, { status: 400 })
    }
    const row = await createVendorRebateProgram(admin, organizationId, {
      vendorId: String(body.vendorId),
      programName: String(body.programName ?? ""),
      rebateType: body.rebateType,
      rebateStatus: body.rebateStatus,
      rebateBasisPoints: body.rebateBasisPoints ?? null,
      rebateThresholdCents: body.rebateThresholdCents ?? null,
      estimatedAnnualRebateCents: body.estimatedAnnualRebateCents ?? null,
      actorUserId: gate.userId,
    })
    return NextResponse.json(row)
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/procurement/vendor-rebates", e)
  }
}
