import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { applyBlitzpayWalletCreditToInvoice } from "@/lib/blitzpay/blitzpay-customer-wallet"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; customerId: string }> },
) {
  const { organizationId, customerId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(customerId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireOrgPermission(organizationId, ["canEditInvoices", "canViewFinancials"])
  if ("error" in gate) return gate.error

  let body: { invoiceId?: string; amountCents?: number; idempotencyKey?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body." }, { status: 400 })
  }
  const invoiceId = String(body.invoiceId ?? "").trim()
  if (!UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: "bad_request", message: "invoiceId is required." }, { status: 400 })
  }
  const amountCents = Math.round(Number(body.amountCents ?? 0))
  if (!Number.isFinite(amountCents) || amountCents < 1) {
    return NextResponse.json({ error: "bad_request", message: "amountCents must be a positive integer." }, { status: 400 })
  }
  const idem = String(body.idempotencyKey ?? "").trim() || randomUUID()

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "POST /api/organizations/[organizationId]/customers/[customerId]/blitzpay/wallet/apply-invoice",
  )
  if (drift) return drift

  const res = await applyBlitzpayWalletCreditToInvoice(admin, {
    organizationId,
    customerId,
    invoiceId,
    amountCents,
    idempotencyKey: idem,
    actorUserId: gate.userId,
  })
  if (!res.ok) {
    const status =
      res.code === "invoice_not_found" ? 404
      : res.code === "customer_mismatch" || res.code === "invoice_paid" || res.code === "insufficient_wallet" ? 409
      : 400
    return NextResponse.json({ error: res.code, message: res.message }, { status })
  }
  return NextResponse.json({
    ok: true,
    appliedCents: res.appliedCents,
    paymentReference: res.paymentReference,
  })
}
