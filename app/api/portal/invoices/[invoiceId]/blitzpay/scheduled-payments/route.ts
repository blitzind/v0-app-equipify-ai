import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import { createBlitzpayScheduledInvoicePayment } from "@/lib/blitzpay/blitzpay-scheduled-payments"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ invoiceId: string }> },
) {
  const portalCtx = await requirePortalSession()
  if (portalCtx instanceof NextResponse) return portalCtx

  const { invoiceId } = await context.params
  if (!UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid invoice id." }, { status: 400 })
  }

  let body: {
    scheduledFor?: string
    invoicePortionCents?: number
    scheduleConsentAcknowledged?: boolean
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body." }, { status: 400 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "POST /api/portal/invoices/[invoiceId]/blitzpay/scheduled-payments",
  )
  if (drift) return drift

  const organizationId = portalCtx.portalUser.organization_id
  const portalUserId = portalCtx.portalUser.id
  const customerId = portalCtx.portalUser.customer_id

  const result = await createBlitzpayScheduledInvoicePayment(admin, {
    organizationId,
    orgInvoiceId: invoiceId,
    customerId,
    invoicePortionCents: Math.round(Number(body.invoicePortionCents ?? 0)),
    scheduledForIso: String(body.scheduledFor ?? "").trim(),
    createdByKind: "customer_portal",
    portalUserId,
    scheduleConsentAcknowledged: Boolean(body.scheduleConsentAcknowledged),
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.code, message: result.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true, scheduleId: result.id })
}
