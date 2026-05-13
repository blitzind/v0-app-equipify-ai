import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { duplicateOrgInvoiceForOrganization } from "@/lib/invoices/duplicate-org-invoice.server"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; invoiceId: string }> },
) {
  const { organizationId, invoiceId } = await context.params

  const gate = await requireOrgPermission(organizationId, "canEditInvoices")
  if ("error" in gate) return gate.error

  const result = await duplicateOrgInvoiceForOrganization(
    gate.supabase,
    organizationId,
    invoiceId,
    gate.userId,
  )

  if (!result.ok) {
    const status =
      result.code === "not_found" ? 404
      : result.code === "archived" ? 409
      : 400
    return NextResponse.json({ error: result.code, message: result.message }, { status })
  }

  return NextResponse.json({
    ok: true,
    invoiceId: result.invoiceId,
    invoiceNumber: result.invoiceNumber,
  })
}
