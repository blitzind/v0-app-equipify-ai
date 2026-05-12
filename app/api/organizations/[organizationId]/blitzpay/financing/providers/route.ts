import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { createMarketplaceFinancingProvider, listMarketplaceFinancingProviders } from "@/lib/blitzpay/blitzpay-financing-service"
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
    "GET /api/organizations/[organizationId]/blitzpay/financing/providers",
  )
  if (schemaResp) return schemaResp
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const providers = await listMarketplaceFinancingProviders(admin, organizationId)
    return NextResponse.json({ providers })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/financing/providers", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/financing/providers",
  )
  if (schemaResp) return schemaResp
  let body: {
    providerName?: string
    providerType?: string
    providerStatus?: string
    minimumAmountCents?: number | null
    maximumAmountCents?: number | null
    supportedProducts?: string[]
    supportedRegions?: string[]
    providerReferenceHash?: string | null
    contactEmail?: string | null
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
    const row = await createMarketplaceFinancingProvider(admin, organizationId, {
      providerName: String(body.providerName ?? ""),
      providerType: body.providerType,
      providerStatus: body.providerStatus,
      minimumAmountCents: body.minimumAmountCents ?? null,
      maximumAmountCents: body.maximumAmountCents ?? null,
      supportedProducts: body.supportedProducts,
      supportedRegions: body.supportedRegions,
      providerReferenceHash: body.providerReferenceHash ?? null,
      contactEmail: body.contactEmail ?? null,
      actorUserId: gate.userId,
    })
    return NextResponse.json({ provider: row })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/financing/providers", e)
  }
}
