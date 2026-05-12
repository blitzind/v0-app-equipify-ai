import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { syncPaymentMethodsFromStripe } from "@/lib/blitzpay/blitzpay-billing-profiles-service"
import { logBlitzpayServerFailure } from "@/lib/blitzpay/blitzpay-server-failure-log"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canManageSettings", "canEditInvoices", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/payment-methods/sync",
  )
  if (schemaResp) return schemaResp
  let body: { customerId?: string }
  try {
    body = (await request.json()) as { customerId?: string }
  } catch {
    return NextResponse.json({ error: "bad_request", message: "JSON body required." }, { status: 400 })
  }
  const customerId = String(body.customerId || "")
  if (!UUID_RE.test(customerId)) {
    return NextResponse.json({ error: "bad_request", message: "customerId required." }, { status: 400 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const { synced } = await syncPaymentMethodsFromStripe(admin, organizationId, customerId)
    return NextResponse.json({ synced })
  } catch (e) {
    logBlitzpayServerFailure("POST payment-methods/sync", e)
    const code = e instanceof Error && e.message === "missing_stripe_customer" ? "precondition_failed" : "sync_failed"
    const status = code === "precondition_failed" ? 412 : 503
    return NextResponse.json(
      {
        error: code,
        message:
          code === "precondition_failed" ?
            "No Stripe customer on file for this account yet. Complete a BlitzPay checkout first."
          : "Payment method sync is temporarily unavailable.",
      },
      { status },
    )
  }
}
