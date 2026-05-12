import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { logBlitzpayServerFailure } from "@/lib/blitzpay/blitzpay-server-failure-log"
import {
  ensureCollectionStateForInvoice,
  staffPauseRecovery,
} from "@/lib/blitzpay/blitzpay-collections-service"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function assertInvoiceCustomer(
  admin: ReturnType<typeof createServiceRoleSupabaseClient>,
  organizationId: string,
  invoiceId: string,
  customerId: string,
): Promise<NextResponse | null> {
  const { data, error } = await admin
    .from("org_invoices")
    .select("customer_id")
    .eq("organization_id", organizationId)
    .eq("id", invoiceId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: "lookup_failed", message: "Could not verify invoice." }, { status: 500 })
  if (!data) return NextResponse.json({ error: "not_found", message: "Invoice not found." }, { status: 404 })
  if ((data as { customer_id: string }).customer_id !== customerId) {
    return NextResponse.json({ error: "bad_request", message: "customerId does not match invoice." }, { status: 400 })
  }
  return null
}

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canManageSettings", "canEditInvoices", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/collections/pause",
  )
  if (schemaResp) return schemaResp
  let body: { invoiceId?: string; customerId?: string }
  try {
    body = (await request.json()) as { invoiceId?: string; customerId?: string }
  } catch {
    return NextResponse.json({ error: "bad_request", message: "JSON body required." }, { status: 400 })
  }
  const invoiceId = String(body.invoiceId || "")
  const customerId = String(body.customerId || "")
  if (!UUID_RE.test(invoiceId) || !UUID_RE.test(customerId)) {
    return NextResponse.json({ error: "bad_request", message: "invoiceId and customerId required." }, { status: 400 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const v = await assertInvoiceCustomer(admin, organizationId, invoiceId, customerId)
  if (v) return v
  try {
    await ensureCollectionStateForInvoice(admin, { organizationId, invoiceId, customerId })
    await staffPauseRecovery(admin, {
      organizationId,
      invoiceId,
      customerId,
      userId: gate.userId,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof Error && e.message === "not_found") {
      return NextResponse.json({ error: "not_found", message: "No collection record for this invoice yet." }, { status: 404 })
    }
    logBlitzpayServerFailure("POST blitzpay/collections/pause", e)
    return blitzpayStaffLoadFailedResponse("POST blitzpay/collections/pause", e)
  }
}
