import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { salesTaxCalculateRequestSchema } from "@/lib/tax/org-settings-schema"
import { resolveSalesTaxForLines } from "@/lib/tax/resolve-document-sales-tax"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireAnyOrgPermission(organizationId, ["canEditInvoices", "canApproveInvoices", "canEditQuotes"])
  if ("error" in gate) return gate.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Invalid JSON.", 400)
  }

  const parsed = salesTaxCalculateRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 })
  }

  const b = parsed.data
  const asOf = b.asOfYmd ?? new Date().toISOString().slice(0, 10)

  const result = await resolveSalesTaxForLines(gate.supabase, {
    organizationId,
    customerId: b.customerId ?? null,
    preferAutomatic: b.preferAutomatic,
    lines: b.lines,
    taxBasis: b.taxBasis,
    serviceAddress: b.serviceAddress ?? null,
    billingAddress: b.billingAddress ?? null,
    customerTaxExempt: b.customerTaxExempt ?? false,
    asOfYmd: asOf,
    persistLog: b.persistLog ?? false,
    auditSourceType: "api_sales_tax_calculate",
    idempotencyKey: b.idempotencyKey ?? null,
    actorUserId: gate.userId,
  })

  return NextResponse.json({ result })
}
