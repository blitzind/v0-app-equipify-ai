import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { createAchAuthorization, listAchAuthorizations } from "@/lib/blitzpay/blitzpay-tax-service"
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
    "GET /api/organizations/[organizationId]/blitzpay/ach-authorizations",
  )
  if (schemaResp) return schemaResp
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const achAuthorizations = await listAchAuthorizations(admin, organizationId)
    return NextResponse.json({ achAuthorizations })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/ach-authorizations", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/ach-authorizations",
  )
  if (schemaResp) return schemaResp
  let body: {
    customerId?: string | null
    authorizationMethod?: string
    authorizationReference?: string | null
    authorizedAtIso?: string
    expiresAtIso?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON." }, { status: 400 })
  }
  const authorizedAtIso = body.authorizedAtIso?.trim() || new Date().toISOString()
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const row = await createAchAuthorization(admin, organizationId, {
      customerId: body.customerId ?? null,
      authorizationMethod: body.authorizationMethod,
      authorizationReference: body.authorizationReference ?? null,
      authorizedAtIso,
      expiresAtIso: body.expiresAtIso ?? null,
      actorUserId: gate.userId,
    })
    return NextResponse.json({ achAuthorization: row })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/ach-authorizations", e)
  }
}
