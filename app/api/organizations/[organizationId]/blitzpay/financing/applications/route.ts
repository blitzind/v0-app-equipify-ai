import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { createFinancingApplication, listFinancingApplications } from "@/lib/blitzpay/blitzpay-financing-service"
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
    "GET /api/organizations/[organizationId]/blitzpay/financing/applications",
  )
  if (schemaResp) return schemaResp
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const applications = await listFinancingApplications(admin, organizationId)
    return NextResponse.json({ applications })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/financing/applications", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/financing/applications",
  )
  if (schemaResp) return schemaResp
  let body: {
    customerId?: string | null
    applicationType?: string
    requestedAmountCents?: number
    linkedInvoiceId?: string | null
    linkedWorkOrderId?: string | null
    linkedEquipmentId?: string | null
    linkedMembershipId?: string | null
    expirationDate?: string | null
    qualificationInputs?: {
      recurringRevenueProxyCents?: number
      invoicePaidCountWindow?: number
      collectionHealthScore0to100?: number
      membershipRenewalSuccessProxyPct?: number
      treasuryCoverageBps?: number
    }
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON." }, { status: 400 })
  }
  const amt = Math.max(0, Math.round(Number(body.requestedAmountCents ?? 0)))
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const row = await createFinancingApplication(admin, organizationId, {
      customerId: body.customerId ?? null,
      applicationType: body.applicationType,
      requestedAmountCents: amt,
      linkedInvoiceId: body.linkedInvoiceId ?? null,
      linkedWorkOrderId: body.linkedWorkOrderId ?? null,
      linkedEquipmentId: body.linkedEquipmentId ?? null,
      linkedMembershipId: body.linkedMembershipId ?? null,
      expirationDate: body.expirationDate ?? null,
      qualificationInputs: body.qualificationInputs
        ? {
            recurringRevenueProxyCents: Math.max(0, Math.round(Number(body.qualificationInputs.recurringRevenueProxyCents ?? 0))),
            invoicePaidCountWindow: Math.max(0, Math.round(Number(body.qualificationInputs.invoicePaidCountWindow ?? 0))),
            collectionHealthScore0to100: Math.max(
              0,
              Math.min(100, Math.round(Number(body.qualificationInputs.collectionHealthScore0to100 ?? 0))),
            ),
            membershipRenewalSuccessProxyPct: Math.max(
              0,
              Math.min(100, Math.round(Number(body.qualificationInputs.membershipRenewalSuccessProxyPct ?? 0))),
            ),
            treasuryCoverageBps: Math.max(
              0,
              Math.min(1_000_000, Math.round(Number(body.qualificationInputs.treasuryCoverageBps ?? 0))),
            ),
          }
        : undefined,
      actorUserId: gate.userId,
    })
    return NextResponse.json({ application: row })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/financing/applications", e)
  }
}
