import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { requireAnyOrgPermission, requireOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"
import {
  createPaymentPlanForInvoiceFromTemplate,
  fetchActivePaymentPlanForInvoice,
  type BlitzpayPaymentPlanTemplate,
} from "@/lib/blitzpay/blitzpay-payment-plan-service"
import { fetchBlitzpayOrgSettingsRow } from "@/lib/blitzpay/payment-repository"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const TEMPLATES = new Set<string>(["stages_25_50_25", "equal_3", "equal_6"])

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; invoiceId: string }> },
) {
  const { organizationId, invoiceId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, [
    "canViewFinancials",
    "canViewBilling",
    "canEditInvoices",
  ])
  if ("error" in gate) return gate.error

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "GET /api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/payment-plan",
  )
  if (drift) return drift

  const row = await fetchActivePaymentPlanForInvoice(admin, organizationId, invoiceId)
  return NextResponse.json({ plan: row })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; invoiceId: string }> },
) {
  const { organizationId, invoiceId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireOrgPermission(organizationId, ["canEditInvoices", "canViewFinancials"])
  if ("error" in gate) return gate.error

  let body: { template?: string; idempotencyKey?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body." }, { status: 400 })
  }
  const template = String(body.template ?? "").trim()
  if (!TEMPLATES.has(template)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid template." }, { status: 400 })
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
    "POST /api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/payment-plan",
  )
  if (drift) return drift

  const settings = await fetchBlitzpayOrgSettingsRow(admin, organizationId)
  if (!Boolean(settings?.blitzpay_installment_plans_enabled)) {
    return NextResponse.json(
      { error: "feature_disabled", message: "Installment plans are not enabled for this workspace." },
      { status: 403 },
    )
  }

  try {
    const res = await createPaymentPlanForInvoiceFromTemplate(admin, {
      organizationId,
      invoiceId,
      template: template as BlitzpayPaymentPlanTemplate,
      idempotencyKey: idem,
    })
    const plan = await fetchActivePaymentPlanForInvoice(admin, organizationId, invoiceId)
    return NextResponse.json({ ok: true, duplicate: res.duplicate, planId: res.planId, plan })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "invoice_not_found") {
      return NextResponse.json({ error: "not_found", message: "Invoice not found." }, { status: 404 })
    }
    if (msg === "invoice_not_eligible") {
      return NextResponse.json({ error: "not_eligible", message: "Invoice is not eligible for a payment plan." }, { status: 409 })
    }
    if (msg === "invalid_installment_schedule") {
      return NextResponse.json({ error: "invalid_schedule", message: "Could not build installment schedule." }, { status: 400 })
    }
    return NextResponse.json({ error: "plan_create_failed", message: msg }, { status: 500 })
  }
}
