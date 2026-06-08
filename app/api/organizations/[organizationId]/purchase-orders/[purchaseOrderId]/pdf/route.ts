import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { generatePurchaseOrderPdfBuffer } from "@/lib/purchase-orders/generate-purchase-order-pdf"
import {
  buildPurchaseOrderPdfDownloadHeaders,
  buildPurchaseOrderPdfFilename,
} from "@/lib/purchase-orders/purchase-order-pdf-filename"
import { loadPurchaseOrderDocumentContext } from "@/lib/purchase-orders/load-purchase-order-document-context"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; purchaseOrderId: string }> },
) {
  const { organizationId, purchaseOrderId } = await context.params

  const gate = await requireAnyOrgPermission(organizationId, ["canEditQuotes", "canViewFinancials"])
  if ("error" in gate) {
    return gate.error
  }

  const supabase = await createServerSupabaseClient()
  const ctx = await loadPurchaseOrderDocumentContext(supabase, organizationId, purchaseOrderId, {
    staffDocumentExport: true,
  })
  if (!ctx) {
    return NextResponse.json({ error: "not_found", message: "Purchase order not found." }, { status: 404 })
  }

  try {
    const bytes = await generatePurchaseOrderPdfBuffer(ctx)
    const filename = buildPurchaseOrderPdfFilename(ctx.purchaseOrderNumberLabel)
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: buildPurchaseOrderPdfDownloadHeaders(filename),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(
      JSON.stringify({
        source: "purchase-order-pdf-download",
        ok: false,
        organizationId,
        purchaseOrderId,
        error: msg.slice(0, 500),
      }),
    )
    return NextResponse.json(
      { error: "pdf_failed", message: "Could not generate purchase order PDF." },
      { status: 500 },
    )
  }
}
