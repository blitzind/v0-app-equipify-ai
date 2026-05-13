import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { loadInvoiceDocumentContext } from "@/lib/invoices/load-invoice-document-context"
import { generateInvoicePdfBuffer } from "@/lib/invoices/generate-invoice-pdf"
import { buildInvoicePdfFilename } from "@/lib/invoices/invoice-pdf-filename"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; invoiceId: string }> },
) {
  const { organizationId, invoiceId } = await context.params

  const gate = await requireAnyOrgPermission(organizationId, ["canEditInvoices", "canViewFinancials"])
  if ("error" in gate) {
    return gate.error
  }

  const supabase = await createServerSupabaseClient()
  const ctx = await loadInvoiceDocumentContext(supabase, organizationId, invoiceId)
  if (!ctx) {
    return NextResponse.json({ error: "not_found", message: "Invoice not found." }, { status: 404 })
  }

  try {
    const bytes = await generateInvoicePdfBuffer(ctx)
    const filename = buildInvoicePdfFilename(ctx.invoiceNumberLabel)
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(
      JSON.stringify({
        source: "invoice-pdf-download",
        ok: false,
        organizationId,
        invoiceId,
        error: msg.slice(0, 500),
      }),
    )
    return NextResponse.json({ error: "pdf_failed", message: "Could not generate invoice PDF." }, { status: 500 })
  }
}
