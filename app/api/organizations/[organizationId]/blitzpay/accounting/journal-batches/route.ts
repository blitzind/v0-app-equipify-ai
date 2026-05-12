import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { createJournalBatch, listJournalBatches } from "@/lib/blitzpay/blitzpay-general-ledger-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import type { BlitzpayJournalBatchType } from "@/lib/blitzpay/blitzpay-general-ledger"

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
    "GET /api/organizations/[organizationId]/blitzpay/accounting/journal-batches",
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
    const batches = await listJournalBatches(admin, organizationId, status)
    return NextResponse.json({ batches })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET accounting/journal-batches", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/accounting/journal-batches",
  )
  if (schemaResp) return schemaResp
  let body: { batchReference?: string; batchType?: BlitzpayJournalBatchType; sourceType?: string; sourceId?: string }
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
    const batch = await createJournalBatch(admin, organizationId, {
      batchReference: String(body.batchReference ?? ""),
      batchType: body.batchType ?? "manual",
      sourceType: body.sourceType ?? null,
      sourceId: body.sourceId ?? null,
    })
    return NextResponse.json({ batch })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST accounting/journal-batches", e)
  }
}
