import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { applyBlitzpayQuoteDepositCreditToInvoice } from "@/lib/blitzpay/blitzpay-quote-deposit-apply"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; quoteId: string }> },
) {
  const { organizationId, quoteId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(quoteId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canEditInvoices", "canEditQuotes"])
  if ("error" in gate) return gate.error

  let body: { invoiceId?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body." }, { status: 400 })
  }
  const invoiceId = String(body.invoiceId ?? "").trim()
  if (!UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: "bad_request", message: "invoiceId is required." }, { status: 400 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "POST /api/organizations/[organizationId]/quotes/[quoteId]/blitzpay/apply-deposit-credit",
  )
  if (drift) return drift

  const res = await applyBlitzpayQuoteDepositCreditToInvoice(admin, {
    organizationId,
    quoteId,
    invoiceId,
    actorUserId: gate.userId,
  })
  if (!res.ok) {
    const status =
      res.code === "quote_not_found" || res.code === "invoice_not_found" ? 404
      : res.code === "customer_mismatch" ? 409
      : 400
    return NextResponse.json({ error: res.code, message: res.message }, { status })
  }
  return NextResponse.json({ ok: true, appliedCents: res.appliedCents })
}
